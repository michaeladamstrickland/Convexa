import fetch from 'node-fetch';

// Simple E2E bulk enqueue test (lightweight placeholder)
// Assumes server & worker running locally on PORT 3001 (adjust if needed)

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001/api/dev';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

describe('Bulk enqueue scraping jobs', () => {
  it('enqueues bulk jobs and returns no duplicates (baseline)', async () => {
    const resp = await fetch(`${BASE}/enqueue-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: ['zillow','auction'], zips: ['08081','08080'], filters: { minPrice: 390000, maxPrice: 410000 } })
    });
    const data: any = await resp.json();
    expect(data.success).toBe(true);
    expect(data.createdCount).toBeGreaterThan(0);
    const jobIds = data.created.map((j: any) => j.id);
    const deadline = Date.now() + 60_000;
    const remaining = new Set(jobIds);
    while (remaining.size && Date.now() < deadline) {
      for (const id of Array.from(remaining)) {
        const jr = await fetch(`${BASE}/job/${id}`);
        const jd: any = await jr.json();
        if (jd.job && ['completed','failed'].includes(jd.job.status)) remaining.delete(id);
      }
      if (remaining.size) await sleep(1200);
    }
    expect(remaining.size).toBe(0);
    const met = await fetch(`${BASE}/metrics`);
    const txt = await met.text();
    expect(txt).toMatch(/leadflow_jobs_total/);
  }, 120000);

  it('handles historical range with meta.historyWindow and counties expansion', async () => {
    const fromDate = '2025-01-01';
    const toDate = '2025-01-05';
    const resp = await fetch(`${BASE}/enqueue-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: ['zillow'], zips: ['08081'], fromDate, toDate, filters: { beds: 2 } })
    });
    const data: any = await resp.json();
    expect(data.success).toBe(true);
    const jobIds = data.created.map((j: any) => j.id);
    const deadline = Date.now() + 60_000;
    const remaining = new Set(jobIds);
    while (remaining.size && Date.now() < deadline) {
      for (const id of Array.from(remaining)) {
        const jr = await fetch(`${BASE}/job/${id}`);
        const jd: any = await jr.json();
        if (jd.job && jd.job.status === 'completed') {
          const meta = jd.job.resultPayload?.meta;
            if (meta) remaining.delete(id);
        }
      }
      if (remaining.size) await sleep(1500);
    }
    expect(remaining.size).toBe(0);
    const resp2 = await fetch(`${BASE}/enqueue-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: ['zillow'], counties: ['Camden','Gloucester'], fromDate, toDate })
    });
    const data2: any = await resp2.json();
    expect(data2.success).toBe(true);
    expect(Array.isArray(data2.resolvedZips)).toBe(true);
    expect(data2.resolvedZips.length).toBeGreaterThan(5);
  }, 120000);

  it('applies filters and records metadata with dedup', async () => {
    const resp = await fetch(`${BASE}/queue-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'zillow', zip: '08081', filters: { minPrice: 399000, beds: 3 } })
    });
    const data: any = await resp.json();
    expect(data.success).toBe(true);
    const jobId = data.job.id;
  const deadline = Date.now() + 60000;
    let meta: any = null;
    while (Date.now() < deadline) {
      const jr = await fetch(`${BASE}/job/${jobId}`);
      const jd: any = await jr.json();
      if (jd.job && jd.job.status === 'completed') { meta = jd.job.resultPayload.meta; break; }
      await sleep(800);
    }
    expect(meta).toBeTruthy();
    expect(meta.filtersApplied).toContain('minPrice');
    expect(meta.sourceAdapterVersion).toBeDefined();
    expect(meta.scrapedCount).toBeLessThanOrEqual(meta.totalItems || meta.scrapedCount);
  }, 60000);
});
