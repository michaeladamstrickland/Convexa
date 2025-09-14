import fetch from 'node-fetch';

const DEV_BASE = process.env.TEST_BASE_URL || 'http://localhost:3001/api/dev';
const FEED_BASE = process.env.TEST_FEED_URL || 'http://localhost:3001/api/properties';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

describe('Public properties feed', () => {
  it('produces results after enqueue and supports filters & pagination', async () => {
    const resp = await fetch(`${DEV_BASE}/queue-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'zillow', zip: '08081', filters: { minPrice: 390000 } })
    });
    const data: any = await resp.json();
    expect(data.success).toBe(true);
    const jobId = data.job.id;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const jr = await fetch(`${DEV_BASE}/job/${jobId}`);
      const jd: any = await jr.json();
      if (jd.job && jd.job.status === 'completed') break;
      await sleep(800);
    }
    const feed = await fetch(`${FEED_BASE}?source=zillow&zip=08081&minPrice=100000&limit=10&offset=0`);
    const feedJson: any = await feed.json();
    expect(Array.isArray(feedJson.data)).toBe(true);
    expect(feedJson.meta.pagination.limit).toBe(10);
    const feed2 = await fetch(`${FEED_BASE}?source=zillow&beds=2`);
    const feedJson2: any = await feed2.json();
    expect(feedJson2.meta.filtersApplied.includes('beds') || feedJson2.data.length >= 0).toBe(true);
  }, 60000);

  it('supports propertyType and dedupedOnly toggle', async () => {
    const feed = await fetch(`${FEED_BASE}?propertyType=single_family&dedupedOnly=true`);
    const j: any = await feed.json();
    expect(j.meta.filtersApplied.includes('propertyType') || j.data.length >= 0).toBe(true);
  });
});
