import fetch from 'node-fetch';
import { enqueueWebhookDelivery } from '../utils/enqueueProxy';

jest.setTimeout(60000);

const ADMIN = 'http://localhost:3001/api/admin';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function waitForFailure(subId: string, attemptsTarget = 3, timeoutMs=60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${subId}&limit=1`);
    const js:any = await resp.json();
    if (js.data?.length) {
      const r = js.data[0];
      if (r.attempts >= attemptsTarget) return r;
    }
    await sleep(200);
  }
  throw new Error('timeout waiting for failure attempts');
}

let failingSub: string;

beforeAll(async () => {
  const bad = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:4567/fail', eventTypes:['job.completed'] }) });
  failingSub = (await bad.json()).data.id;
});

describe('Webhook Retry Flow', () => {

  it('lands in dead-letter after max attempts', async () => {
    await enqueueWebhookDelivery({ subscriptionId: failingSub, eventType: 'job.completed', payload: { case:'retry-flow'} });
    const failure = await waitForFailure(failingSub, 3, 60000);
    expect(failure).toBeTruthy();
    expect(failure.attemptsMade).toBeGreaterThanOrEqual(3);
  });

  let failureId: string;
  it('single retry requeues', async () => {
    // Ensure at least one failure exists for this subscription
    let list:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&limit=1`)).json(); 
    const waitUntil = Date.now() + 30000;
    while ((!list.data || !list.data.length) && Date.now() < waitUntil) {
      await sleep(200);
      list = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&limit=1`)).json();
    }
    if (!list.data?.length) throw new Error('No failure found to retry');
    failureId = list.data[0].id;
    const resp = await fetch(`${ADMIN}/webhook-failures/${failureId}/retry`, { method:'POST' });
    const jr:any = await resp.json();
    expect(jr.retried).toBe(true);
  });

  it('bulk retry returns retried > 0', async () => {
    const resp = await fetch(`${ADMIN}/webhook-failures/retry-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscriptionId: failingSub }) });
    const jr:any = await resp.json();
    expect(jr.retried).toBeGreaterThan(0);
});
  });

  // New test validating resolution flow by updating target to mock endpoint and retrying
  describe('webhook retry resolution', () => {
    it('marks failure resolved after successful retry', async () => {
      // Wait until there is a failure to resolve
      let list:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&limit=1`)).json();
      const until = Date.now() + 30000;
      while ((!list.data || !list.data.length) && Date.now() < until) {
        await sleep(200);
        list = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&limit=1`)).json();
      }
      const failure = list.data?.[0];
      expect(failure).toBeTruthy();
  await fetch(`${ADMIN}/webhooks/${failingSub}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl:'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
      await fetch(`${ADMIN}/webhook-failures/${failure.id}/retry`, { method:'POST' });
      // Poll until the failure disappears from unresolved list
      const deadline = Date.now()+30000;
      let resolvedGone = false;
      while(Date.now()<deadline){
        const after:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}`)).json();
        const still = after.data.find((f:any)=>f.id===failure.id);
        if(!still){ resolvedGone = true; break; }
        await new Promise(r=>setTimeout(r,200));
      }
      expect(resolvedGone).toBe(true);
      const withResolved:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&includeResolved=true`)).json();
      const resolved = withResolved.data.find((f:any)=>f.id===failure.id);
      expect(resolved).toBeTruthy();
      expect(resolved.isResolved).toBe(true);
    }, 20000);
  });

// Cleanup via global teardown
