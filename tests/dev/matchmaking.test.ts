import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

// use shared prisma instance
const ADMIN = 'http://localhost:3001/api/admin';

jest.setTimeout(20000);

describe('Matchmaking Job', () => {
  let jobId: string;
  beforeAll(async () => {
  // Clean potential duplicates from previous runs
  await (prisma as any).scrapedProperty.deleteMany({ where: { address: { in: ['M1','M2','M3'] } } });
    // Seed a few enriched properties to be matched
    const make = (data: any) => (prisma as any).scrapedProperty.create({ data });
    try {
      await Promise.all([
        make({ source:'zillow', zip:'10001', address:'M1', investmentScore:80, enrichmentTags:['fixer'], condition:'Fair' }),
        make({ source:'zillow', zip:'10002', address:'M2', investmentScore:90, enrichmentTags:['equity'], condition:'Fair' }),
        make({ source:'auction', zip:'10003', address:'M3', investmentScore:75, enrichmentTags:['high-ROI'], condition:'NeedsWork' })
      ]);
    } catch (e) {
      // ignore unique constraint race in parallel test runs
    }
  });

  it('creates and processes matchmaking job', async () => {
    const resp = await fetch(`${ADMIN}/matchmaking-jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON: { minScore:70, source:'zillow' } }) });
    if (resp.status !== 201) {
      const text = await resp.text();
      throw new Error(`enqueue_failed status=${resp.status} body=${text}`);
    }
    const j: any = await resp.json();
    jobId = j.jobId;
    expect(jobId).toBeTruthy();
    // Poll for completion
    const deadline = Date.now() + 8000;
    let row: any;
    while (Date.now() < deadline) {
      row = await (prisma as any).matchmakingJob.findUnique({ where: { id: jobId } });
      if (row?.status === 'completed') break;
      await new Promise(r => setTimeout(r, 200));
    }
    expect(row).toBeTruthy();
    expect(row.status).toBe('completed');
    expect(row.matchedCount).toBeGreaterThan(0);
  });
});
