import { Worker } from 'bullmq';
import { prisma } from '../db/prisma';
import { MATCHMAKING_QUEUE_NAME, MatchmakingJobQueuePayload } from '../queues/matchmakingQueue';
import { registerWorker } from './index';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';

// shared prisma from db/prisma

export const matchmakingMetrics = {
  durations: [] as number[],
  statusCounts: new Map<string, number>(),
  webhookDeliveredTotal: 0,
};

function incrStatus(status: string) {
  matchmakingMetrics.statusCounts.set(status, (matchmakingMetrics.statusCounts.get(status) || 0) + 1);
}

export const matchmakingWorker = new Worker(MATCHMAKING_QUEUE_NAME, async job => {
  const started = Date.now();
  const { matchmakingJobId } = job.data as MatchmakingJobQueuePayload;
  try {
    const mm: any = await (prisma as any).matchmakingJob.findUnique({ where: { id: matchmakingJobId } });
    if (!mm) return;
    // Mark running
  await (prisma as any).matchmakingJob.update({ where: { id: matchmakingJobId }, data: { status: 'running' } });
  incrStatus('running');
    // Mock matching logic: count all enriched properties meeting basic score filter if present
  const filter = (mm.filterJSON || {}) as any;
    const minScore = typeof filter.minScore === 'number' ? filter.minScore : 0;
    const source = filter.source as string | undefined;
  const where: any = { };
  if (typeof minScore === 'number') where.investmentScore = { gte: minScore };
    // Only treat known scraper sources as property source filters; ignore job-origin markers like 'auto'|'admin'
    const validScraperSources = new Set(['zillow','auction']);
    if (source && validScraperSources.has(source)) where.source = source;
  if (filter.propertyId) where.id = filter.propertyId;
    const matchedCount = await (prisma as any).scrapedProperty.count({ where });
    await (prisma as any).matchmakingJob.update({ where: { id: matchmakingJobId }, data: { status: 'completed', matchedCount, completedAt: new Date() } });
    incrStatus('completed');
    const durationMs = Date.now() - started;
    matchmakingMetrics.durations.push(durationMs);
    console.log(JSON.stringify({ level:'info', component:'matchmaking', status:'completed', matchmakingJobId, filterPreview: filter, matchedCount, durationMs, timestamp: new Date().toISOString() }));

    // CRM push webhook: emit matchmaking.completed for active subscribers
    try {
      const subs: any[] = await (prisma as any).webhookSubscription.findMany({ where: { isActive: true } });
      const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('matchmaking.completed'));
      const payload = { jobId: matchmakingJobId, matchedCount, timestamp: new Date().toISOString() };
      await Promise.all(interested.map(s => enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'matchmaking.completed', payload })));
      matchmakingMetrics.webhookDeliveredTotal += interested.length;
    } catch (e:any) {
      console.log(JSON.stringify({ level:'warn', component:'matchmaking', action:'webhook_emit_failed', matchmakingJobId, error: e?.message }));
    }

    // CRM Activity record + webhook (crm.activity)
    try {
      const activity = await (prisma as any).crmActivity.create({ data: { type: 'matchmaking.completed', metadata: { matchmakingJobId, matchedCount } } });
      const cm = ((global as any).__CRM_ACTIVITY_METRICS__ = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map<string, number>(), webhook: { success: 0, fail: 0 } });
      cm.total++; cm.perType.set('matchmaking.completed', (cm.perType.get?.('matchmaking.completed') || 0) + 1);
      try {
        const subs: any[] = await (prisma as any).webhookSubscription.findMany({ where: { isActive: true } }).catch(()=>[]);
        const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('crm.activity'));
        if (interested.length) {
          const payload = { id: activity.id, type: activity.type, propertyId: activity.propertyId, leadId: activity.leadId, userId: activity.userId, metadata: activity.metadata, createdAt: activity.createdAt };
          await Promise.all(interested.map(s => enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'crm.activity', payload })));
          cm.webhook.success += interested.length;
        }
      } catch { cm.webhook.fail++; }
    } catch {}
  } catch (e: any) {
    await (prisma as any).matchmakingJob.update({ where: { id: (job.data as any).matchmakingJobId }, data: { status: 'failed' } }).catch(()=>{});
    incrStatus('failed');
    console.log(JSON.stringify({ level:'error', component:'matchmaking', status:'failed', matchmakingJobId: (job.data as any).matchmakingJobId, error: e?.message, timestamp: new Date().toISOString() }));
    throw e;
  }
}, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' }, concurrency: 3 });

export async function shutdownMatchmakingWorker() {
  try { await (matchmakingWorker as any).close?.(); } catch {}
  try { await (matchmakingWorker as any).connection?.disconnect?.(); } catch {}
}

try { registerWorker(matchmakingWorker); } catch {}
console.log(JSON.stringify({ level:'info', component:'matchmakingWorker', msg:'worker_started', queue:MATCHMAKING_QUEUE_NAME, timestamp:new Date().toISOString() }));
