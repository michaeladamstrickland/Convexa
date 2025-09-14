import fetch from 'node-fetch';
import { enqueueWebhookDelivery } from '../utils/enqueueProxy';

// Use test server port 3001
const ADMIN = 'http://localhost:3001/api/admin';
const sleep = (ms:number)=> new Promise(r=>setTimeout(r,ms));

jest.setTimeout(120000);

describe('Webhook Failures Admin Flow', () => {
  let badSubId:string;
  let goodSubId:string;
  let failingJobId: string | undefined;

  beforeAll(async () => {
    // Create failing subscription (unreachable host)
  const badRes = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://127.0.0.1:65530/does-not-exist', eventTypes:['job.completed'] }) });
    badSubId = (await badRes.json()).data.id;
    const goodRes = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:3001/webhook-listener', eventTypes:['job.completed'] }) });
    goodSubId = (await goodRes.json()).data.id;
  });

  it('captures failure records after retries', async () => {
    // enqueue job
    const job = await enqueueWebhookDelivery({ subscriptionId: badSubId, eventType: 'job.completed', payload: { seed:true } });
    failingJobId = job.id?.toString();
  const targetAttempts = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '3',10);
    // poll failures endpoint until record present
    let record:any; let attempts=0;
    const failDeadline = Date.now() + 60000; // allow ample time under load
    while (Date.now() < failDeadline) {
      const resp = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=1`);
      const json:any = await resp.json();
      record = json.data?.[0];
      if (record) { attempts = record.attempts; if (attempts >= targetAttempts) break; }
      await sleep(200);
    }
    expect(record).toBeTruthy();
    expect(record.subscriptionId).toBe(badSubId);
    expect(record.eventType).toBe('job.completed');
    expect(record.attempts).toBeGreaterThanOrEqual(targetAttempts);
    expect(record.isResolved).toBe(false);
    expect(record.lastError).toBeTruthy();
  });

  let failureId:string;
  it('retries single failure', async () => {
    // Wait until at least one failure is present
    let list:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=1`)).json();
    const waitUntil = Date.now() + 30000;
    while ((!list.data || !list.data.length) && Date.now() < waitUntil) {
      await sleep(200);
      list = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=1`)).json();
    }
  if (!list.data?.length) throw new Error('No failure records to retry');
  failureId = list.data[0].id;
  const beforeCount:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=5`)).json();
  const r = await fetch(`${ADMIN}/webhook-failures/${failureId}/retry`, { method:'POST' });
  expect(r.status).toBe(200);
  // Allow job to process (it will likely fail again)
  await sleep(1000);
  const afterCount:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=5`)).json();
  expect(afterCount.total).toBeGreaterThanOrEqual(beforeCount.total); // may create new record or stay same
  }, 15000);

  it('bulk retry endpoint works (no filter)', async () => {
  // Ensure at least one failure exists (if not, enqueue and wait briefly)
  let unresolved:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=1`)).json();
  if (!unresolved.data?.length) {
    await enqueueWebhookDelivery({ subscriptionId: badSubId, eventType: 'job.completed', payload: { seed: 'retry-all' } });
    const until = Date.now() + 30000;
    while (!unresolved.data?.length && Date.now() < until) {
      await sleep(200);
      unresolved = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${badSubId}&eventType=job.completed&limit=1`)).json();
    }
  }
  const r = await fetch(`${ADMIN}/webhook-failures/retry-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscriptionId: badSubId }) });
  const j:any = await r.json();
  expect(j.retried).toBeGreaterThan(0);
  }, 30000);

  it('webhook metrics endpoint returns expected shape', async () => {
    const r = await fetch(`${ADMIN}/webhook-metrics`);
    const j:any = await r.json();
    expect(j).toHaveProperty('delivered');
    expect(j).toHaveProperty('failed');
    expect(j).toHaveProperty('activeSubscriptions');
  });
  // Cleanup handled by global teardown
});
