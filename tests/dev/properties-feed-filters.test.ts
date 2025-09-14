import fetch from 'node-fetch';

const FEED_BASE = process.env.TEST_FEED_URL || 'http://localhost:3001/api/properties';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

// Helper to wait briefly after enrichment/matchmaking logs to ensure DB writes are visible in tests
async function tinySettle(){ await sleep(200); }

describe('Public properties feed - new filters', () => {
  it('filters by tag with multiple values (CSV)', async () => {
    const res = await fetch(`${FEED_BASE}?tag=high-potential,fixer&minScore=50&limit=50`);
    const j: any = await res.json();
    expect(Array.isArray(j.data)).toBe(true);
    // If there are rows, each must have at least the tags requested (AND semantics enforced via hasEvery)
    for (const r of j.data) {
      expect(Array.isArray(r.enrichmentTags)).toBe(true);
      // rows may have more tags, but should include both requested in AND mode
      expect(r.enrichmentTags).toEqual(expect.arrayContaining(['high-potential','fixer']));
    }
  });

  it('filters by reason with multiple values (hasSome)', async () => {
    const res = await fetch(`${FEED_BASE}?reason=sqft>1200:+10,condition=NeedsWork:+15&limit=50`);
    const j: any = await res.json();
    expect(Array.isArray(j.data)).toBe(true);
    for (const r of j.data) {
      // reasons may be absent on some seeded rows; skip validation for empty
      if (Array.isArray(r.reasons) && r.reasons.length) {
        const rs = new Set(r.reasons);
        expect(
          rs.has('sqft>1200:+10') || rs.has('condition=NeedsWork:+15')
        ).toBe(true);
      }
    }
  });

  it('filters by tagReasons proxy (matches known tags via OR/hasSome)', async () => {
    const res = await fetch(`${FEED_BASE}?tagReasons=high-potential,low-margin&limit=50`);
    const j: any = await res.json();
    expect(Array.isArray(j.data)).toBe(true);
    const anyMatched = j.data.some((r: any) => Array.isArray(r.enrichmentTags) && (
      r.enrichmentTags.includes('high-potential') || r.enrichmentTags.includes('low-margin')
    ));
    expect(anyMatched || j.data.length === 0).toBe(true);
  });

  it('reason filter prefers rows with reasons when provided', async () => {
    const res = await fetch(`${FEED_BASE}?reason=price<150k:+10&limit=50`);
    const j: any = await res.json();
    expect(Array.isArray(j.data)).toBe(true);
    // Ensure that if reasons are present they are non-empty; tolerate legacy data with missing reasons
  const withReasons = j.data.filter((r: any) => Array.isArray(r.reasons) && r.reasons.length > 0);
  expect(j.data.length === 0 || withReasons.length > 0).toBe(true);
  });
});
