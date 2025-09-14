import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

const ADMIN = 'http://localhost:3001/api/admin';

jest.setTimeout(20000);

describe('Matchmaking Auto-Trigger', () => {
  it('auto-enqueues matchmaking on enrichment (score>=85)', async () => {
    // Seed one property needing enrichment that will hit score 85
  const addr = `AUTO-MM-1-${Date.now()}`;
  const prop = await (prisma as any).scrapedProperty.create({
      data: {
        source: 'zillow',
        zip: '12345',
    address: addr,
        price: 140000,
        sqft: 1300,
        beds: 3,
        propertyType: 'SingleFamily',
    condition: 'NeedsWork',
        enrichmentTags: [],
        investmentScore: null
      }
    });

    // Trigger enrichment via admin
    const r = await fetch(`${ADMIN}/enrich/${prop.id}`, { method: 'POST' });
    expect(r.status).toBe(202);

    // Poll for a matchmaking job created with propertyId and source=auto, and completed
    const deadline = Date.now() + 8000;
    let mm: any;
    while (Date.now() < deadline) {
      mm = await (prisma as any).matchmakingJob.findFirst({ where: { filterJSON: { path: ['propertyId'], equals: prop.id } } }).catch(async () => {
        // Prisma JSON path may not be supported; fallback to naive scan
        const rows = await (prisma as any).matchmakingJob.findMany({ orderBy: { createdAt: 'desc' } });
        return rows.find((x:any)=> (x.filterJSON||{}).propertyId === prop.id);
      });
      if (mm) {
        if (mm.status === 'completed') break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    expect(mm).toBeTruthy();
    expect((mm.filterJSON||{}).propertyId).toBe(prop.id);
    expect((mm.filterJSON||{}).source).toBe('auto');
  });
});
