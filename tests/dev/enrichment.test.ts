import { prisma } from '../../src/db/prisma';
import { enqueuePropertyEnrichment } from '../../src/utils/enqueueEnrichmentJob';

// use shared prisma instance
jest.setTimeout(20000);

describe('Enrichment Pipeline (Deterministic Scoring)', () => {
  it('scores high-potential property and assigns tag', async () => {
  const uniq = Date.now();
  const prop:any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'99990', address:`SCORING-1-${uniq}`, price:100000, beds:3, sqft:1301, condition:'NeedsWork', enrichmentTags:[] } });
    await enqueuePropertyEnrichment(prop.id);
    const deadline = Date.now()+6000; let enriched:any=null;
    while(Date.now()<deadline){
      enriched = await (prisma as any).scrapedProperty.findUnique({ where:{ id: prop.id } });
      if(enriched?.investmentScore!=null) break; await new Promise(r=>setTimeout(r,120));
    }
    // Expected score: 50 +10(sqft) +10(price) +15(condition)=85
    expect(enriched.investmentScore).toBe(85);
  expect(enriched.enrichmentTags).toContain('high-potential');
  // Persisted observability fields
  expect(Array.isArray(enriched.reasons)).toBe(true);
  expect(enriched.reasons.length).toBeGreaterThan(0);
  expect(enriched.tagReasons == null || typeof enriched.tagReasons === 'object').toBe(true);
  });

  it('applies low-margin tag when sqft small & price high', async () => {
  const uniq = Date.now();
  const prop:any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'99991', address:`SCORING-2-${uniq}`, price:400000, beds:2, sqft:700, enrichmentTags:[] } });
    await enqueuePropertyEnrichment(prop.id);
    const deadline = Date.now()+6000; let enriched:any=null;
    while(Date.now()<deadline){
      enriched = await (prisma as any).scrapedProperty.findUnique({ where:{ id: prop.id } });
      if(enriched?.investmentScore!=null) break; await new Promise(r=>setTimeout(r,120));
    }
  expect(enriched.enrichmentTags).toContain('low-margin');
  expect(Array.isArray(enriched.reasons)).toBe(true);
  expect(enriched.tagReasons == null || typeof enriched.tagReasons === 'object').toBe(true);
  // Score currently computed with rule set; ensure it's <=50 (penalties applied) and >=30
  expect(enriched.investmentScore).toBeLessThanOrEqual(50);
  expect(enriched.investmentScore).toBeGreaterThanOrEqual(30);
  });
});
