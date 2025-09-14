import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

const ADMIN = 'http://localhost:3001/api/admin';

jest.setTimeout(20000);

describe('Matchmaking Admin Tools', () => {
  let jobId: string;

  beforeAll(async () => {
    // Ensure at least one enriched property exists for matching
    await (prisma as any).scrapedProperty.create({
      data: { source: 'zillow', zip: '90001', address: 'MM-ADMIN-1', investmentScore: 95, enrichmentTags: ['high-potential'] }
    }).catch(()=>{});
  });

  it('creates, lists (with filters), and replays a job', async () => {
    // Create a job via admin
    const resp = await fetch(`${ADMIN}/matchmaking-jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON: { minScore: 80 } }) });
    expect(resp.status).toBe(201);
    const body: any = await resp.json();
    jobId = body.jobId;

    // Wait for completion
    const deadline = Date.now() + 8000;
    let row: any;
    while (Date.now() < deadline) {
      row = await (prisma as any).matchmakingJob.findUnique({ where: { id: jobId } });
      if (row?.status === 'completed') break;
      await new Promise(r => setTimeout(r, 200));
    }
    expect(row).toBeTruthy();
    expect(row.status).toBe('completed');

    // List jobs
    const list = await fetch(`${ADMIN}/matchmaking-jobs?limit=5`);
    expect(list.status).toBe(200);
    const listed: any = await list.json();
    expect(Array.isArray(listed.data)).toBe(true);

    // Replay the job
    const replay = await fetch(`${ADMIN}/matchmaking-jobs/${jobId}/replay`, { method: 'POST' });
    expect(replay.status).toBe(200);

    // Optionally verify metrics surfaced
    const metricsResp = await fetch('http://localhost:3001/api/dev/metrics');
    const metricsText = await metricsResp.text();
    expect(metricsText).toMatch(/leadflow_matchmaking_replay_total \d+/);
  });
});
