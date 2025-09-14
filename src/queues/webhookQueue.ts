import { Queue } from 'bullmq';
import { registerQueue } from './index';

export const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';

export interface WebhookJobPayload {
  subscriptionId: string;
  eventType: string;
  payload: any;
  failureId?: string; // when retrying a previously failed delivery
  replayMode?: 'single' | 'bulk';
}

// Lazy/global singleton. Jest creates isolated module contexts per test file, so we also stash on global to reuse connection.
let _queue: Queue | null = (global as any).__WEBHOOK_QUEUE__ || null;
export function getWebhookQueue() {
  if (!_queue) {
    _queue = new Queue(WEBHOOK_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
  (global as any).__WEBHOOK_QUEUE__ = _queue;
  try { registerQueue(_queue); } catch {}
  }
  return _queue;
}

export async function shutdownWebhookQueue() {
  if (_queue) {
    try { await (_queue as any).drain?.(); } catch {}
    try { await (_queue as any).close?.(); } catch {}
    try { await (_queue as any).client?.disconnect?.(); } catch {}
    try { await (_queue as any).events?.connection?.disconnect?.(); } catch {}
    _queue = null;
    if ((global as any).__WEBHOOK_QUEUE__) delete (global as any).__WEBHOOK_QUEUE__;
  }
}

function getAttempts() {
  return parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10);
}

function getBackoff() {
  if (process.env.NODE_ENV === 'test') return { type: 'fixed', delay: 50 } as any;
  return { type: 'exponential', delay: 1000 } as any;
}

export async function enqueueWebhookDelivery(payload: WebhookJobPayload) {
  const q = getWebhookQueue();
  const attempts = getAttempts();
  const backoff = getBackoff();
  return q.add('webhook', payload, { attempts, backoff, removeOnComplete: 100, removeOnFail: false });
}
