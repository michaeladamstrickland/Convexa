import { Queue } from 'bullmq';
import { registerQueue } from './index';
import { parseScraperJobPayload, ScraperJobPayload } from '../../backend/src/packages/schemas';

const connection = { 
  connection: { 
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};

export const SCRAPER_QUEUE_NAME = 'scraper-jobs';

export interface EnqueueResult { id: string; name: string; }

let _scraperQueue: Queue | null = (global as any).__SCRAPER_QUEUE__ || null;
export function getScraperQueue() {
  if (!_scraperQueue) {
    _scraperQueue = new Queue(SCRAPER_QUEUE_NAME, connection);
    (global as any).__SCRAPER_QUEUE__ = _scraperQueue;
  try { registerQueue(_scraperQueue); } catch {}
  }
  return _scraperQueue;
}
export const scraperQueue = getScraperQueue();

export async function shutdownScraperQueue() {
  if (_scraperQueue) {
    try { await (_scraperQueue as any).drain?.(); } catch {}
    try { await (_scraperQueue as any).close?.(); } catch {}
    try { await (_scraperQueue as any).client?.disconnect?.(); } catch {}
    try { await (_scraperQueue as any).events?.connection?.disconnect?.(); } catch {}
    _scraperQueue = null;
    if ((global as any).__SCRAPER_QUEUE__) delete (global as any).__SCRAPER_QUEUE__;
  }
}

export async function enqueueScraperJob(raw: unknown) {
  const payload: ScraperJobPayload = parseScraperJobPayload(raw);
  const job = await scraperQueue.add('scrape-job', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 2000
  });
  return { id: job.id, name: job.name };
}
