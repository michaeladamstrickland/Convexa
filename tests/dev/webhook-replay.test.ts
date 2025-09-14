import fetch from 'node-fetch';
import { enqueueWebhookDelivery, getWebhookJob } from '../utils/enqueueProxy';

jest.setTimeout(45000);
const ADMIN = 'http://localhost:3001/api/admin';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitForFailure(subId:string, timeout=20000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const r = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${subId}&limit=1`);
    const j:any = await r.json();
    if (j.data?.length) return j.data[0];
    await sleep(200);
  }
  throw new Error('timeout');
}
async function waitForResolved(failureId:string, subId:string, timeout=8000){
  const end = Date.now()+timeout;
  while(Date.now()<end){
    const unresolved:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${subId}`)).json();
    if(!unresolved.data.find((f:any)=>f.id===failureId)) return true;
    await sleep(300);
  }
  return false;
}

describe('Webhook Replay Flow', () => {
  let failingSub:string; let failureId:string;
  beforeAll( async () => {
    // Create failing subscription (unreachable port)
    const bad = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://127.0.0.1:65530/replay-fail', eventTypes:['job.completed'] }) });
    failingSub = (await bad.json()).data.id;
    const job = await enqueueWebhookDelivery({ subscriptionId: failingSub, eventType: 'job.completed', payload: { step:'initial' } });
    // Wait for the initial job to finish all attempts (fail path)
    const end = Date.now()+15000;
    while(Date.now()<end){
      const j = await getWebhookJob(job.id);
      const state = await j?.getState?.();
      const attemptsMade = (j as any)?.attemptsMade || 0;
      // Log minimal progress for debugging flake
      if (Date.now() % 1000 < 60) {
        // lightweight periodic log
        // eslint-disable-next-line no-console
        console.log(`[replay.beforeAll] state=${state} attempts=${attemptsMade}`);
      }
      if (state === 'failed' || state === 'completed') break;
      await sleep(100);
    }
    const failure = await waitForFailure(failingSub, 20000);
    failureId = failure.id;
  });

  it('replay endpoint enqueues job and not yet resolved until success', async () => {
    const resp = await fetch(`${ADMIN}/webhook-failures/${failureId}/replay`, { method:'POST' });
    expect(resp.status).toBe(200);
    const j:any = await resp.json();
    expect(j.replayed).toBe(true);
    expect(j.jobId).toBeTruthy();
    // Wait for replay job to fail again (target still bad)
    const rjob = await getWebhookJob(j.jobId);
    const end = Date.now()+12000;
    while(Date.now()<end){
      const state = await rjob?.getState?.();
      const attempts = (rjob as any)?.attemptsMade || 0;
      if (state === 'failed') break;
      await sleep(100);
      await rjob?.update?.();
    }
    const list:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}`)).json();
    expect(list.data.some((f:any)=>f.id===failureId)).toBe(true);
  });

  it('after fixing subscription, replay resolves failure', async () => {
    // Patch to working endpoint
    await fetch(`${ADMIN}/webhooks/${failingSub}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
    const resp = await fetch(`${ADMIN}/webhook-failures/${failureId}/replay`, { method:'POST' });
    expect(resp.status).toBe(200);
  const resolvedDisappeared = await waitForResolved(failureId, failingSub, 12000);
  expect(resolvedDisappeared).toBe(true);
    const resolved:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}&includeResolved=true`)).json();
    const row = resolved.data.find((f:any)=>f.id===failureId);
    expect(row).toBeTruthy();
    expect(row.isResolved).toBe(true);
    expect(row.replayedAt).toBeTruthy();
  });

  it('bulk replay resolves multiple failures and increments bulk metrics', async () => {
    // Create two failing subs
    const subA = await (await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://127.0.0.1:65534/bulkA', eventTypes:['job.completed'] }) })).json();
    const subB = await (await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://127.0.0.1:65534/bulkB', eventTypes:['job.completed'] }) })).json();
    const jA = await enqueueWebhookDelivery({ subscriptionId: subA.data.id, eventType: 'job.completed', payload: { bulk: 'A' } });
    const jB = await enqueueWebhookDelivery({ subscriptionId: subB.data.id, eventType: 'job.completed', payload: { bulk: 'B' } });
    // Ensure both initial jobs have failed before proceeding
    const waitJobFail = async (jid:string)=>{
      const end = Date.now()+15000; const job = await getWebhookJob(jid);
      while(Date.now()<end){
        const st = await job?.getState?.();
        if (st === 'failed' || st === 'completed') break;
        await sleep(100);
        await job?.update?.();
      }
    };
    await Promise.all([waitJobFail(jA.id), waitJobFail(jB.id)]);
    // Wait for failures recorded
    await waitForFailure(subA.data.id, 20000);
    await waitForFailure(subB.data.id, 20000);
    // Fix endpoints
    await fetch(`${ADMIN}/webhooks/${subA.data.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
    await fetch(`${ADMIN}/webhooks/${subB.data.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
    // Bulk replay
    const bulk = await fetch(`${ADMIN}/webhook-failures/replay-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ eventType:'job.completed' }) });
    expect(bulk.status).toBe(200);
    const bj:any = await bulk.json();
    expect(bj.replayed).toBeGreaterThanOrEqual(2);
  await sleep(2000);
    const metricsText = await (await fetch('http://localhost:3001/api/dev/metrics')).text();
    expect(metricsText).toContain('leadflow_webhook_replay_total{mode="bulk",status="success"}');
  });
});
