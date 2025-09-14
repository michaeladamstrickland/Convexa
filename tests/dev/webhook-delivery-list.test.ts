import fetch from 'node-fetch';
import { enqueueWebhookDelivery } from '../utils/enqueueProxy';

jest.setTimeout(45000);
const ADMIN='http://localhost:3001/api/admin';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function waitFor(predicate:()=>Promise<boolean>, timeout=15000){
  const end=Date.now()+timeout; while(Date.now()<end){ if(await predicate()) return; await sleep(200);} throw new Error('timeout');
}

describe('Webhook Delivery Listing', () => {
  let successSub:string; let failSub:string; let failureId:string;
  beforeAll(async()=>{
    // success subscription uses mock receiver
    const good = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
    successSub = (await good.json()).data.id;
    const bad = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl: 'http://127.0.0.1:65530/fail', eventTypes:['job.completed'] }) });
    failSub = (await bad.json()).data.id;
    await enqueueWebhookDelivery({ subscriptionId: successSub, eventType:'job.completed', payload:{ ok:true }});
    await enqueueWebhookDelivery({ subscriptionId: failSub, eventType:'job.completed', payload:{ fail:true }});
    // wait for failure row
    await waitFor(async()=>{
      const r = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failSub}`); const j:any = await r.json(); return j.data?.length>0; });
    const fl:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failSub}&limit=1`)).json();
    failureId = fl.data[0].id;
  });

  it('lists mixed delivery records with filters', async () => {
    // give worker time to write logs
    await sleep(800);
    const base:any = await (await fetch(`${ADMIN}/webhook-deliveries?limit=100`)).json();
    expect(base.data.length).toBeGreaterThanOrEqual(2);
    const failed:any = await (await fetch(`${ADMIN}/webhook-deliveries?status=failed`)).json();
    expect(failed.data.every((r:any)=>r.status==='failed')).toBe(true);
    const delivered:any = await (await fetch(`${ADMIN}/webhook-deliveries?status=delivered`)).json();
    expect(delivered.data.every((r:any)=>r.status==='delivered')).toBe(true);
  });

  it('marks resolved after retry and appears as isResolved=true', async () => {
    // patch failing subscription to success
    await fetch(`${ADMIN}/webhooks/${failSub}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl:'http://localhost:3001/_mock/webhook', eventTypes:['job.completed'] }) });
    await fetch(`${ADMIN}/webhook-failures/${failureId}/retry`, { method:'POST' });
    // Wait until the failed delivery log is marked resolved by the worker
    await waitFor(async () => {
      const resp = await fetch(`${ADMIN}/webhook-deliveries?status=failed&isResolved=true&subscriptionId=${failSub}`);
      const j:any = await resp.json();
      return !!j.data?.find((r:any)=>r.subscriptionId===failSub && r.isResolved === true);
    }, 12000);
  });
  // Cleanup via global teardown
});
