import { Queue } from 'bullmq';
import { registerQueue } from './index';
export const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';
// Lazy/global singleton. Jest creates isolated module contexts per test file, so we also stash on global to reuse connection.
let _queue = global.__WEBHOOK_QUEUE__ || null;
export function getWebhookQueue() {
    if (!_queue) {
        _queue = new Queue(WEBHOOK_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
        global.__WEBHOOK_QUEUE__ = _queue;
        try {
            registerQueue(_queue);
        }
        catch { }
    }
    return _queue;
}
export async function shutdownWebhookQueue() {
    if (_queue) {
        try {
            await _queue.drain?.();
        }
        catch { }
        try {
            await _queue.close?.();
        }
        catch { }
        try {
            await _queue.client?.disconnect?.();
        }
        catch { }
        try {
            await _queue.events?.connection?.disconnect?.();
        }
        catch { }
        _queue = null;
        if (global.__WEBHOOK_QUEUE__)
            delete global.__WEBHOOK_QUEUE__;
    }
}
function getAttempts() {
    return parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10);
}
function getBackoff() {
    if (process.env.NODE_ENV === 'test')
        return { type: 'fixed', delay: 50 };
    return { type: 'exponential', delay: 1000 };
}
export async function enqueueWebhookDelivery(payload) {
    const q = getWebhookQueue();
    const attempts = getAttempts();
    const backoff = getBackoff();
    return q.add('webhook', payload, { attempts, backoff, removeOnComplete: 100, removeOnFail: false });
}
//# sourceMappingURL=webhookQueue.js.map