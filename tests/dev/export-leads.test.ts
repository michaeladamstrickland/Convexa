import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

// use shared prisma instance
const ADMIN = 'http://localhost:3001/api/admin';

jest.setTimeout(30000);

describe('Export Leads API', () => {
  beforeAll(async () => {
    // Seed properties
    const make = (data: any) => (prisma as any).scrapedProperty.create({ data });
    const ts = Date.now();
    await Promise.all([
      make({ source: 'zillow', zip: '08081', address: `1 A St ${ts}`, enrichmentTags: ['fixer','equity'], investmentScore: 85, condition: 'Fair' }),
      make({ source: 'zillow', zip: '08081', address: `2 B St ${ts}`, enrichmentTags: ['rental'], investmentScore: 60, condition: 'NeedsWork' }),
      make({ source: 'auction', zip: '08080', address: `3 C St ${ts}`, enrichmentTags: ['high-ROI'], investmentScore: 92, condition: 'Fair' }),
      make({ source: 'zillow', zip: '08082', address: `4 D St ${ts}`, enrichmentTags: [], investmentScore: 10, condition: 'NeedsWork' }),
    ]);
  });

  it('returns JSON export with filters', async () => {
  const r = await fetch(`${ADMIN}/export-leads?format=json&zip=08081&minScore=70&tag=fixer`);
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(Array.isArray(j.data)).toBe(true);
    expect(j.data.length).toBeGreaterThanOrEqual(1);
    for (const row of j.data) {
      expect(row.zip).toBe('08081');
      expect(row.investmentScore).toBeGreaterThanOrEqual(70);
      expect(row.enrichmentTags).toContain('fixer');
    }
    expect(j.meta.filtersApplied.zip).toBe('08081');
  });

  it('returns CSV export with filters and proper headers', async () => {
    const r = await fetch(`${ADMIN}/export-leads?format=csv&source=zillow&minScore=50`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/csv');
    const body = await r.text();
    const lines = body.trim().split(/\n/);
    expect(lines[0]).toContain('id,source,zip,price');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('pagination works', async () => {
    const r1 = await fetch(`${ADMIN}/export-leads?limit=1&format=json&source=zillow&sortBy=createdAt`);
    const j1: any = await r1.json();
    expect(j1.data.length).toBe(1);
    const r2 = await fetch(`${ADMIN}/export-leads?limit=1&offset=1&format=json&source=zillow&sortBy=createdAt`);
    const j2: any = await r2.json();
    expect(j2.data.length).toBe(1);
    expect(j1.data[0].id).not.toBe(j2.data[0].id);
  });

  it('invalid format returns error', async () => {
    const r = await fetch(`${ADMIN}/export-leads?format=xml`);
    expect(r.status).toBe(400);
    const j: any = await r.json();
    expect(j.error).toBe('unsupported_format');
  });
});
