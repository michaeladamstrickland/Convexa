import { Router } from 'express';
import { prisma } from '../db/prisma';
import { randomBytes } from 'crypto';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';
import crypto from 'crypto';
import { webhookMetrics } from '../workers/webhookWorker';

const router = Router();

function generateSecret() { return randomBytes(32).toString('hex'); }

router.get('/webhooks', async (_req,res) => {
  const subs = await (prisma as any).webhookSubscription.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: subs });
});

router.post('/webhooks', async (req,res) => {
  const { targetUrl, eventTypes } = req.body || {};
  if (!targetUrl || !Array.isArray(eventTypes) || !eventTypes.length) return res.status(400).json({ error: 'invalid_payload'});
  const sub = await (prisma as any).webhookSubscription.create({ data: { targetUrl, eventTypes, signingSecret: generateSecret() } });
  res.json({ data: sub });
});

router.patch('/webhooks/:id', async (req,res) => {
  const { id } = req.params;
  const { targetUrl, isActive, eventTypes } = req.body || {};
  const data: any = {};
  if (targetUrl) data.targetUrl = targetUrl;
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (Array.isArray(eventTypes)) data.eventTypes = eventTypes;
  const sub = await (prisma as any).webhookSubscription.update({ where: { id }, data }).catch(()=>null);
  if (!sub) return res.status(404).json({ error: 'not_found' });
  res.json({ data: sub });
});

router.delete('/webhooks/:id', async (req,res) => {
  const { id } = req.params;
  await (prisma as any).webhookSubscription.delete({ where: { id } }).catch(()=>null);
  res.json({ success: true });
});

// Manual test fire
router.post('/webhook-test', async (req,res) => {
  const { subscriptionId, eventType='test.event', payload = { ok:true } } = req.body || {};
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId_required' });
  const job = await enqueueWebhookDelivery({ subscriptionId, eventType, payload });
  res.json({ queued: true });
});

// Verification endpoint: send a challenge event to arbitrary URL without creating subscription
router.post('/webhooks/verify', async (req,res) => {
  const { url, eventType='webhook.challenge' } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url_required' });
  const body = JSON.stringify({ event: eventType, data: { challenge: true, timestamp: Date.now() } });
  const secret = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const started = Date.now();
  let status = 0; let error: any = null;
  try {
    const resp = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', 'X-Signature': `sha256=${sig}`, 'X-Timestamp': Date.now().toString(), 'X-Event-Type': eventType, 'X-Webhook-Verification': 'true' }, body });
    status = resp.status;
  } catch (e:any) { error = e.message; }
  const duration = Date.now() - started;
  res.json({ delivered: status >=200 && status < 300, status, durationMs: duration, error });
});

// Failures list with filters: subscriptionId, eventType, since, limit, offset
router.get('/webhook-failures', async (req,res) => {
  const { subscriptionId, eventType, since, limit='50', offset='0', includeResolved } = req.query as any;
  const take = Math.min(parseInt(limit) || 50, 200);
  const skip = parseInt(offset) || 0;
  const where: any = {};
  if (subscriptionId) where.subscriptionId = subscriptionId;
  if (eventType) where.eventType = eventType;
  if (since) where.createdAt = { gte: new Date(since) };
  if (!includeResolved) where.isResolved = false;
  const [rows, total] = await Promise.all([
    (prisma as any).webhookDeliveryFailure.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    (prisma as any).webhookDeliveryFailure.count({ where })
  ]);
  const enriched = rows.map((r: any) => ({
    ...r,
    attemptsMade: r.attempts,
    lastError: r.lastError || r.finalError,
    lastAttemptAt: r.lastAttemptAt || r.createdAt
  }));
  res.json({ data: enriched, total, limit: take, offset: skip });
});

// Delivery history listing
router.get('/webhook-deliveries', async (req,res) => {
  const { subscriptionId, eventType, status, isResolved, createdAfter, createdBefore, limit='50', offset='0' } = req.query as any;
  const take = Math.min(parseInt(limit) || 50, 200);
  const skip = parseInt(offset) || 0;
  const where: any = {};
  const filtersApplied: string[] = [];
  if (subscriptionId) { where.subscriptionId = subscriptionId; filtersApplied.push('subscriptionId'); }
  if (eventType) { where.eventType = eventType; filtersApplied.push('eventType'); }
  if (status) { where.status = status; filtersApplied.push('status'); }
  if (typeof isResolved !== 'undefined') { where.isResolved = isResolved === 'true'; filtersApplied.push('isResolved'); }
  if (createdAfter || createdBefore) {
    where.createdAt = {};
    if (createdAfter) { where.createdAt.gte = new Date(createdAfter); filtersApplied.push('createdAfter'); }
    if (createdBefore) { where.createdAt.lte = new Date(createdBefore); filtersApplied.push('createdBefore'); }
  }
  // Fail fast if model is missing (migration drift) to avoid cryptic undefined errors
  if (!(prisma as any).webhookDeliveryLog) {
    return res.status(500).json({ error: 'webhookDeliveryLog_model_missing', detail: 'Pending migration or schema drift detected' });
  }
  const [rows, total] = await Promise.all([
    (prisma as any).webhookDeliveryLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }).catch(()=>[]),
    (prisma as any).webhookDeliveryLog.count({ where }).catch(()=>0)
  ]);
  res.json({ data: rows, meta: { totalCount: total, filtersApplied, pagination: { limit: take, offset: skip } } });
});

// Retry single failure
router.post('/webhook-failures/:id/retry', async (req,res) => {
  const { id } = req.params;
  const failure = await (prisma as any).webhookDeliveryFailure.findUnique({ where: { id } });
  if (!failure) return res.status(404).json({ error: 'not_found' });
  // Fire again
  const job = await enqueueWebhookDelivery({ subscriptionId: failure.subscriptionId, eventType: failure.eventType, payload: failure.payload, failureId: failure.id });
  res.json({ retried: true, jobId: job.id });
});

// Bulk retry with optional filters
router.post('/webhook-failures/retry-all', async (req,res) => {
  const { subscriptionId, eventType } = req.body || {};
  const where: any = {};
  if (subscriptionId) where.subscriptionId = subscriptionId;
  if (eventType) where.eventType = eventType;
  const failures = await (prisma as any).webhookDeliveryFailure.findMany({ where, take: 500 });
  const jobs:any[] = [];
  for (const f of failures) {
    const job = await enqueueWebhookDelivery({ subscriptionId: f.subscriptionId, eventType: f.eventType, payload: f.payload, failureId: f.id });
    jobs.push(job.id);
  }
  res.json({ retried: failures.length, jobIds: jobs });
});

// Replay single failure (manual explicit replay distinct from retry)
router.post('/webhook-failures/:id/replay', async (req,res) => {
  const { id } = req.params;
  const failure = await (prisma as any).webhookDeliveryFailure.findUnique({ where: { id } });
  if (!failure) return res.status(404).json({ error: 'not_found' });
  if (failure.isResolved) return res.status(400).json({ error: 'already_resolved' });
  try {
  const job = await enqueueWebhookDelivery({ subscriptionId: failure.subscriptionId, eventType: failure.eventType, payload: failure.payload, failureId: failure.id, replayMode: 'single' as any });
    // Track replay attempt (we only mark resolved on success inside worker)
    (global as any).__WEBHOOK_REPLAY_PENDING__ = ((global as any).__WEBHOOK_REPLAY_PENDING__ || 0) + 1;
    res.json({ jobId: job.id, replayed: true });
  } catch (e: any) {
    res.status(500).json({ error: 'enqueue_failed', detail: e?.message });
  }
});

// Replay all unresolved failures matching optional filters
router.post('/webhook-failures/replay-all', async (req,res) => {
  const { subscriptionId, eventType } = req.body || {};
  const where: any = { isResolved: false };
  if (subscriptionId) where.subscriptionId = subscriptionId;
  if (eventType) where.eventType = eventType;
  const failures = await (prisma as any).webhookDeliveryFailure.findMany({ where, take: 500 });
  const jobIds: string[] = [];
  for (const f of failures) {
    try {
      const job = await enqueueWebhookDelivery({ subscriptionId: f.subscriptionId, eventType: f.eventType, payload: f.payload, failureId: f.id, replayMode: 'bulk' as any });
      jobIds.push(job.id!.toString());
    } catch {}
  }
  (global as any).__WEBHOOK_REPLAY_PENDING__ = ((global as any).__WEBHOOK_REPLAY_PENDING__ || 0) + jobIds.length;
  res.json({ replayed: jobIds.length, jobIds });
});

// Simple metrics exposition specific to webhooks (to be merged into global /metrics later)
router.get('/webhook-metrics', async (_req,res) => {
  const activeSubs = await (prisma as any).webhookSubscription.count({ where: { isActive: true } });
  res.json({ delivered: webhookMetrics.delivered, failed: webhookMetrics.failed, p50: percentile(webhookMetrics.durations,50), p95: percentile(webhookMetrics.durations,95), activeSubscriptions: activeSubs });
});

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  const idx = Math.floor((p/100) * (sorted.length - 1));
  return sorted[idx];
}

export default router;
