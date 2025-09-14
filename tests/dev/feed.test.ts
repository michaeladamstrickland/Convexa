import fetch from 'node-fetch';

const DEV_BASE = process.env.TEST_BASE_URL || 'http://localhost:3001/api/dev';
const FEED_BASE = process.env.TEST_FEED_URL || 'http://localhost:3001/api/properties';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

jest.setTimeout(30000);

describe('Lead Feed API', () => {
  it('supports filters, pagination, and sorting', async () => {
    // produce data
    const resp = await fetch(`${DEV_BASE}/queue-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'zillow', zip: '08081', filters: { minPrice: 350000 } })
    });
    const jr: any = await resp.json();
    expect(jr.success).toBe(true);
    const jobId = jr.job.id;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const st = await fetch(`${DEV_BASE}/job/${jobId}`); const sj: any = await st.json();
      if (sj.job && sj.job.status === 'completed') break;
      await sleep(600);
    }
    const q1 = await fetch(`${FEED_BASE}?source=zillow&zip=08081&minScore=0&limit=5&offset=0&sortBy=createdAt`);
    const j1: any = await q1.json();
    expect(Array.isArray(j1.data)).toBe(true);
    expect(j1.meta.pagination.limit).toBe(5);
    expect(['createdAt','score']).toContain(j1.meta.sortBy);

    // with tag filter (may be empty if tags not present, just verify it doesn't error)
    const q2 = await fetch(`${FEED_BASE}?tag=high-potential&sortBy=score&limit=5`);
    const j2: any = await q2.json();
    expect(Array.isArray(j2.data)).toBe(true);
    expect(j2.meta.sortBy).toBe('score');

    // isEnriched true
    const q3 = await fetch(`${FEED_BASE}?isEnriched=true&limit=3`);
    const j3: any = await q3.json();
    expect(Array.isArray(j3.data)).toBe(true);
  });
});
