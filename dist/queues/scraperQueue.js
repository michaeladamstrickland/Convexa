import { Queue } from 'bullmq';
import { registerQueue } from './index';
import { parseScraperJobPayload } from '../../backend/src/packages/schemas';
import { queueDepth, dlqDepth } from '../server';
const connection = {
    connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
};
export const SCRAPER_QUEUE_NAME = 'scraper-jobs';
let _scraperQueue = global.__SCRAPER_QUEUE__ || null;
export function getScraperQueue() {
    if (!_scraperQueue) {
        _scraperQueue = new Queue(SCRAPER_QUEUE_NAME, connection);
        global.__SCRAPER_QUEUE__ = _scraperQueue;
        try {
            registerQueue(_scraperQueue);
        }
        catch { }
    }
    return _scraperQueue;
}
async function updateQueueMetrics() {
    try {
        const queue = getScraperQueue();
        const waitingCount = await queue.getWaitingCount();
        const failedCount = await queue.getFailedCount();
        queueDepth.set({ queue_name: SCRAPER_QUEUE_NAME }, waitingCount);
        dlqDepth.set({ queue_name: SCRAPER_QUEUE_NAME }, failedCount);
    }
    catch (error) {
        console.error('Error updating queue metrics:', error);
    }
}
// Start updating queue metrics periodically
setInterval(updateQueueMetrics, 15000); // Update every 15 seconds
export const scraperQueue = getScraperQueue();
export async function shutdownScraperQueue() {
    if (_scraperQueue) {
        try {
            await _scraperQueue.drain?.();
        }
        catch { }
        try {
            await _scraperQueue.close?.();
        }
        catch { }
        try {
            await _scraperQueue.client?.disconnect?.();
        }
        catch { }
        try {
            await _scraperQueue.events?.connection?.disconnect?.();
        }
        catch { }
        _scraperQueue = null;
        if (global.__SCRAPER_QUEUE__)
            delete global.__SCRAPER_QUEUE__;
    }
}
export async function enqueueScraperJob(raw, opts) {
    const payload = parseScraperJobPayload(raw);
    const job = await scraperQueue.add('scrape-job', payload, {
        jobId: opts?.jobId,
        attempts: opts?.attempts || 3,
        backoff: opts?.backoff || { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 2000
    });
    return { id: job.id, name: job.name };
}
//# sourceMappingURL=scraperQueue.js.map