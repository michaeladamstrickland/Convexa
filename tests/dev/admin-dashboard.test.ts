import fetch from 'node-fetch';

const DEV_BASE = process.env.TEST_BASE_URL || 'http://localhost:3001/api/dev';
const ADMIN_BASE = process.env.TEST_ADMIN_URL || 'http://localhost:3001/api/admin';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

describe('Admin dashboard metrics & timeline', () => {
  it('returns dashboard metrics with defaults', async () => {
    // ensure at least one job
    const resp = await fetch(`${DEV_BASE}/queue-job`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ source: 'zillow', zip: '08081' }) });
    const jr: any = await resp.json();
    expect(jr.success).toBe(true);
    const jobId = jr.job.id;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const st = await fetch(`${DEV_BASE}/job/${jobId}`); const sj: any = await st.json();
      if (sj.job && ['completed','failed'].includes(sj.job.status)) break;
      await sleep(800);
    }
    const metrics = await fetch(`${ADMIN_BASE}/dashboard-metrics`);
    const m: any = await metrics.json();
    expect(typeof m.jobsProcessed).toBe('number');
    expect(m.sources).toBeTruthy();
    expect(Array.isArray(m.topZips)).toBe(true);
  }, 60000);

  it('returns timeline with pagination & sorting', async () => {
    const tl = await fetch(`${ADMIN_BASE}/jobs/timeline?limit=5&offset=0&sortBy=createdAt`);
    const t: any = await tl.json();
    expect(Array.isArray(t.data)).toBe(true);
    if (t.data.length > 1) {
      const d0 = new Date(t.data[0].createdAt).getTime();
      const d1 = new Date(t.data[1].createdAt).getTime();
      expect(d0 >= d1).toBe(true);
    }
    const tl2 = await fetch(`${ADMIN_BASE}/jobs/timeline?limit=5&sortBy=listings`);
    const t2: any = await tl2.json();
    expect(Array.isArray(t2.data)).toBe(true);
  }, 30000);
});
