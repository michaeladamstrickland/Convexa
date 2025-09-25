import { Queue } from 'bullmq';
import { registerQueue } from './index';
export const ENRICHMENT_QUEUE_NAME = 'enrichment';
let _queue = global.__ENRICHMENT_QUEUE__ || null;
export function getEnrichmentQueue() {
    if (!_queue) {
        _queue = new Queue(ENRICHMENT_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
        global.__ENRICHMENT_QUEUE__ = _queue;
        try {
            registerQueue(_queue);
        }
        catch { }
    }
    return _queue;
}
export async function enqueueEnrichmentJob(payload) {
    const q = getEnrichmentQueue();
    return q.add('enrich', payload, { removeOnComplete: 100, removeOnFail: 25 });
}
export async function shutdownEnrichmentQueue() {
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
        delete global.__ENRICHMENT_QUEUE__;
    }
}
//# sourceMappingURL=enrichmentQueue.js.map