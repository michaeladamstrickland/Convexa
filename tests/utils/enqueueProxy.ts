import type { WebhookJobPayload } from '../../src/queues/webhookQueue';
import { getWebhookQueue } from '../../src/queues/webhookQueue';

export async function enqueueWebhookDelivery(payload: WebhookJobPayload) {
  let q: any = (global as any).__WEBHOOK_QUEUE__;
  if (!q) {
    // Lazy init via queue getter (ensures consistent attempts/backoff logic)
    q = getWebhookQueue();
  }
  const attempts = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '3', 10);
  return q.add('webhook', payload, {
    attempts,
    backoff: { type: 'fixed', delay: 50 },
    removeOnComplete: 100,
    removeOnFail: false
  });
}

// Utility to fetch a job by id for assertions/debug in tests
export async function getWebhookJob(jobId: string) {
  const q: any = (global as any).__WEBHOOK_QUEUE__ || getWebhookQueue();
  return q.getJob(jobId);
}