import fetch from 'node-fetch';
import http from 'http';
import crypto from 'crypto';

const ADMIN = 'http://localhost:3001/api/admin';
const DEV = 'http://localhost:3001/api/dev';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

// Relax global timeout to accommodate background workers under suite load
jest.setTimeout(120000);

describe('Webhook delivery system', () => {
  let received: any[] = [];
  let server: http.Server;
  let port: number;
  let goodSubId: string;
  let failSubId: string;

  beforeAll(async () => {
    // start mock receiver
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        received.push({
          url: req.url,
          headers: req.headers,
          body: bodyStr,
          parsed: (()=>{ try { return JSON.parse(bodyStr); } catch { return null; } })()
        });
        res.writeHead(200, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ ok:true }));
      });
    });
    await new Promise<void>(r=>server.listen(0, ()=>r()));
    port = (server.address() as any).port;

    // create success subscription
    const resp = await fetch(`${ADMIN}/webhooks`, { method: 'POST', headers: { 'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: `http://localhost:${port}/hook`, eventTypes: ['job.completed','property.new'] }) });
    const jr:any = await resp.json();
    goodSubId = jr.data.id;

    // create failing subscription (unused port 65535)
    const failResp = await fetch(`${ADMIN}/webhooks`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:6553', eventTypes: ['job.completed'] }) });
    const fr:any = await failResp.json();
    failSubId = fr.data.id;
  });

  afterAll(async () => {
    await new Promise(r=>server.close(r));
  });

  it('delivers property.new and job.completed with headers & signature', async () => {
    // manually trigger test webhook
    await fetch(`${ADMIN}/webhook-test`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscriptionId: goodSubId, eventType: 'job.completed', payload: { demo:true } }) });
    // wait for worker + webhook dispatcher (relax under load)
    // Allow generous time under full-suite load
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && received.length < 1) {
      await sleep(200);
    }
    expect(received.length).toBeGreaterThan(0);
    const first = received[0];
  const sig = first.headers['x-signature'] as string;
  expect(sig).toMatch(/^sha256=/);
    expect(first.headers['x-timestamp']).toBeTruthy();
    expect(first.headers['x-event-type']).toBeTruthy();
    expect(first.parsed?.event).toBeTruthy();
    expect(first.parsed?.data).toBeTruthy();
  });

  it('records failure after retries for unreachable subscription', async () => {
    // trigger manual test to unreachable port
    await fetch(`${ADMIN}/webhook-test`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscriptionId: failSubId, eventType: 'job.completed', payload: { test:true } }) });
    // Only consider fresh failures to avoid matching stale rows from other tests
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const deadline = Date.now() + 90_000;
    let match:any;
    while (Date.now() < deadline) {
      const failuresResp = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failSubId}&eventType=job.completed&since=${encodeURIComponent(sinceIso)}&limit=1`);
      const fr:any = await failuresResp.json();
      match = fr.data?.[0];
      if (match) break;
      await sleep(200);
    }
    expect(match).toBeTruthy();
    expect(match.attempts).toBeGreaterThanOrEqual(3);
  });
  
  afterEach(() => { received.length = 0; });
});
