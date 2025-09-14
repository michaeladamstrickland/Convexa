import fetch from 'node-fetch';
import http from 'http';
import { prisma } from '../../src/db/prisma';

const ADMIN = 'http://localhost:3001/api/admin';
const DEV = 'http://localhost:3001/api/dev';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

// Allow generous time in CI
jest.setTimeout(120000);

describe('CRM push webhook on matchmaking.completed', () => {
  let server: http.Server; let port: number; let received: any[] = [];
  let receivedHeaders: any[] = [];
  let subId: string;

  beforeAll(async () => {
  server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
    receivedHeaders.push(req.headers);
    try { received.push(JSON.parse(bodyStr)); } catch { received.push({ raw: bodyStr }); }
        res.writeHead(200, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>(r=>server.listen(0, ()=>r()));
    port = (server.address() as any).port;
    const resp = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ targetUrl: `http://localhost:${port}/crm`, eventTypes: ['matchmaking.completed'] }) });
    const jr:any = await resp.json();
    subId = jr.data.id;
  });

  afterAll(async () => { await new Promise(r=>server.close(r)); });
  afterEach(() => { received.length = 0; });

  it('emits and delivers matchmaking.completed on job completion', async () => {
    // Baseline metric
    const m0r = await fetch(`${DEV}/metrics`); const m0 = await m0r.text();
    const beforeMatch = m0.match(/leadflow_webhook_delivery_total\{event="matchmaking\.completed"\} (\d+)/);
    const before = beforeMatch ? parseInt(beforeMatch[1],10) : 0;
    // Seed: create property directly via prisma and trigger matchmaking for it
    const prop: any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'90001', address:`CRM-E2E-${Date.now()}`, price: 100000, sqft: 1300, condition: 'NeedsWork', enrichmentTags: [] } });
    const jobResp = await fetch(`${ADMIN}/matchmaking-jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON: { propertyId: prop.id } }) });
    const jr:any = await jobResp.json();

    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && received.length < 1) { await sleep(200); }
    expect(received.length).toBeGreaterThanOrEqual(1);
    const first = received[0];
    expect(first.event).toBe('matchmaking.completed');
    expect(first.data).toBeTruthy();
    expect(first.data.jobId).toBeTruthy();
    expect(typeof first.data.matchedCount).toBe('number');
    // Headers/signature
    const h = receivedHeaders[0] || {};
    expect(String(h['x-event-type']||'')).toBe('matchmaking.completed');
    expect(String(h['x-signature']||'')).toMatch(/^sha256=/);
    // Metric increment
    let after = before;
    while (Date.now() < deadline && after <= before) {
      const m1r = await fetch(`${DEV}/metrics`); const m1 = await m1r.text();
      const mm = m1.match(/leadflow_webhook_delivery_total\{event="matchmaking\.completed"\} (\d+)/);
      after = mm ? parseInt(mm[1],10) : after;
      if (after > before) break; await sleep(200);
    }
    expect(after).toBeGreaterThan(before);
  });
});
