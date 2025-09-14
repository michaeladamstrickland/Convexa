import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';
import { enqueueWebhookDelivery } from '../utils/enqueueProxy';
import { enqueuePropertyEnrichment } from '../../src/utils/enqueueEnrichmentJob';

// use shared prisma instance
const ADMIN = 'http://localhost:3001/api/admin';
const DEV_METRICS = 'http://localhost:3001/api/dev/metrics';

// Increase Jest timeout to tolerate background workers and retries under full-suite load
jest.setTimeout(180000);

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
async function waitForFailure(subscriptionId:string, timeout=120000){
  const end = Date.now()+timeout;
  while(Date.now()<end){
    const r = await fetch(`${ADMIN}/webhook-failures?subscriptionId=${subscriptionId}`);
    const j:any = await r.json();
    if (j.data?.length) return j.data[0];
  await sleep(200);
  }
  throw new Error('failure_timeout');
}

describe('E2E Flow: Replay -> Enrich -> Export -> Matchmaking', () => {
  let propertyId:string; let failingSub:string; let failureId:string;
  it('runs full pipeline', async () => {
    // 1. Create property (simulate scraped)
  const prop:any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'77777', address:`FLOW-E2E-1-${Date.now()}`, price:100000, beds:3, sqft:1200, enrichmentTags:[] } });
    propertyId = prop.id;
    // 2. Create failing webhook subscription & enqueue delivery (property.new)
    const bad = await fetch(`${ADMIN}/webhooks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl:'http://127.0.0.1:65535/e2e-webhook', eventTypes:['property.new'] }) });
    failingSub = (await bad.json()).data.id;
    await enqueueWebhookDelivery({ subscriptionId: failingSub, eventType:'property.new', payload:{ propertyId } });
    const failure = await waitForFailure(failingSub); failureId = failure.id;
    // 3. Replay after fixing subscription
    await fetch(`${ADMIN}/webhooks/${failingSub}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ targetUrl:'http://localhost:3001/_mock/webhook', eventTypes:['property.new'] }) });
    await fetch(`${ADMIN}/webhook-failures/${failureId}/replay`, { method:'POST' });
  const replayDeadline = Date.now()+60000;
    let resolved=false;
    while(Date.now()<replayDeadline){
      const list:any = await (await fetch(`${ADMIN}/webhook-failures?subscriptionId=${failingSub}`)).json();
      if(!list.data?.length){ resolved=true; break; }
      await sleep(400);
    }
    expect(resolved).toBe(true);
    // 4. Enrich property
    await enqueuePropertyEnrichment(propertyId);
  const enrichDeadline = Date.now()+30000;
    let enriched:any=null;
    while(Date.now()<enrichDeadline){
      enriched = await (prisma as any).scrapedProperty.findUnique({ where:{ id: propertyId } });
      if (enriched?.investmentScore != null) break;
      await sleep(200);
    }
    expect(enriched?.investmentScore).not.toBeNull();
    // 5. Export JSON filtered by zip
    const exp = await fetch(`${ADMIN}/export-leads?format=json&zip=77777`);
    const expJson:any = await exp.json();
    expect(expJson.data.some((r:any)=>r.id===propertyId)).toBe(true);
    // 6. Matchmaking job (minScore 0, source zillow)
    const mmResp = await fetch(`${ADMIN}/matchmaking-jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON:{ minScore:0, source:'zillow' } }) });
    expect(mmResp.status).toBe(201);
    const { jobId } = await mmResp.json();
  const mmDeadline = Date.now()+30000;
    let mm:any=null;
    while(Date.now()<mmDeadline){
      mm = await (prisma as any).matchmakingJob.findUnique({ where:{ id: jobId } });
      if (mm?.status==='completed') break;
      await sleep(300);
    }
    expect(mm?.status).toBe('completed');
    expect(mm.matchedCount).toBeGreaterThan(0);
    // 7. Metrics assertions (basic presence & increments)
    const metricsText = await (await fetch(DEV_METRICS)).text();
  expect(metricsText).toMatch(/leadflow_webhook_replay_total\{mode="(single|bulk)",status="success"\} \d+/);
    expect(metricsText).toContain('leadflow_enrichment_processed_total');
    expect(metricsText).toContain('leadflow_export_total{format="json"}');
    expect(metricsText).toContain('leadflow_matchmaking_jobs_total{status="completed"}');
  });
});
