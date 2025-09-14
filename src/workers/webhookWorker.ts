import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { WEBHOOK_QUEUE_NAME, WebhookJobPayload } from '../queues/webhookQueue';
import { registerWorker } from './index';


// Simple in-memory metrics for Prometheus exposition
export const webhookMetrics = {
  delivered: 0,
  failed: 0,
  durations: [] as number[],
};

export const webhookWorker = new Worker(WEBHOOK_QUEUE_NAME, async job => {
  const started = Date.now();
  const data = job.data as WebhookJobPayload;
  const maxAttempts = job.opts.attempts || parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10);
  try {
    const sub: any = await (prisma as any).webhookSubscription.findUnique({ where: { id: data.subscriptionId } });
    if (!sub || !sub.isActive) return;
    const body = JSON.stringify({ event: data.eventType, data: data.payload });
    const ts = Date.now().toString();
    const sig = crypto.createHmac('sha256', sub.signingSecret).update(body).digest('hex');
    const resp = await fetch(sub.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${sig}`,
        'X-Timestamp': ts,
        'X-Webhook-Id': job.id!.toString(),
        'X-Event-Type': data.eventType
      },
      body,
      timeout: 10000 as any
    });
  if (!resp.ok) throw new Error(`status_${resp.status}`);
    const successAttempts = job.attemptsMade + 1;
    console.log(JSON.stringify({
      level: 'info',
      component: 'webhookDelivery',
      status: 'success',
      subscriptionId: data.subscriptionId,
      eventType: data.eventType,
      attempt: successAttempts,
      maxAttempts,
      jobId: job.id,
      durationMs: Date.now() - started,
      timestamp: new Date().toISOString()
    }));
    // Log delivery success (one row per successful delivery event)
    await (prisma as any).webhookDeliveryLog.create({
      data: {
        subscriptionId: data.subscriptionId,
        eventType: data.eventType,
        status: 'delivered',
        attemptsMade: successAttempts,
        jobId: job.id!.toString(),
        lastAttemptAt: new Date(),
      }
    }).catch(()=>{});
    if (data.failureId) {
      // Successful replay/resolution
      await (prisma as any).webhookDeliveryFailure.update({ where: { id: data.failureId }, data: { isResolved: true, replayedAt: new Date(), replayJobId: job.id!.toString() } }).catch(()=>{});
      await (prisma as any).webhookDeliveryLog.updateMany({ where: { subscriptionId: data.subscriptionId, eventType: data.eventType, status: 'failed', isResolved: false }, data: { isResolved: true } }).catch(()=>{});
      const mode = (data as any).replayMode === 'bulk' ? 'bulk' : 'single';
      const metrics = ensureReplayMetricStore();
      metrics[mode].success++;
      console.log(JSON.stringify({ level: 'info', component: 'webhookReplay', status: 'resolved', failureId: data.failureId, replayJobId: job.id, subscriptionId: data.subscriptionId, eventType: data.eventType, timestamp: new Date().toISOString() }));
    }
    webhookMetrics.delivered++;
    webhookMetrics.durations.push(Date.now() - started);
  } catch (e: any) {
    const attemptsMade = job.attemptsMade + 1; // includes this attempt
    if (attemptsMade >= maxAttempts) {
      webhookMetrics.failed++;
      webhookMetrics.durations.push(Date.now() - started);
      await (prisma as any).webhookDeliveryFailure.create({
        data: {
          subscriptionId: data.subscriptionId,
          eventType: data.eventType,
          payload: data.payload,
          attempts: attemptsMade,
          finalError: e?.message || 'unknown_error',
          lastError: e?.message || 'unknown_error',
          lastAttemptAt: new Date()
        }
      }).catch(()=>{});
      // Insert failure log row
      await (prisma as any).webhookDeliveryLog.create({
        data: {
          subscriptionId: data.subscriptionId,
          eventType: data.eventType,
          status: 'failed',
          attemptsMade,
          jobId: job.id!.toString(),
          lastError: e?.message || 'unknown_error',
          lastAttemptAt: new Date(),
        }
      }).catch(()=>{});
      console.log(JSON.stringify({ level: 'error', component: 'webhookDelivery', status: 'dead-letter', subscriptionId: data.subscriptionId, eventType: data.eventType, attempts: attemptsMade, error: e?.message, jobId: job.id, durationMs: Date.now() - started, timestamp: new Date().toISOString() }));
      if (data.failureId) {
        const mode = (data as any).replayMode === 'bulk' ? 'bulk' : 'single';
        const metrics = ensureReplayMetricStore();
        metrics[mode].failed++;
        console.log(JSON.stringify({ level: 'error', component: 'webhookReplay', status: 'failed', failureId: data.failureId, jobId: job.id, subscriptionId: data.subscriptionId, eventType: data.eventType, error: e?.message, timestamp: new Date().toISOString() }));
      }
    }
    throw e; // let BullMQ handle retry
  }
}, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });

function ensureReplayMetricStore() {
  if (!(global as any).__WEBHOOK_REPLAY_METRICS__) {
    (global as any).__WEBHOOK_REPLAY_METRICS__ = { single: { success: 0, failed: 0 }, bulk: { success: 0, failed: 0 } };
  }
  return (global as any).__WEBHOOK_REPLAY_METRICS__;
}

export async function shutdownWebhookWorker() {
  try { await (webhookWorker as any).close?.(); } catch {}
  try { await (webhookWorker as any).connection?.disconnect?.(); } catch {}
}

try { registerWorker(webhookWorker); } catch {}
console.log(JSON.stringify({ level: 'info', component: 'webhookWorker', msg: 'worker_started', queue: WEBHOOK_QUEUE_NAME, timestamp: new Date().toISOString() }));
