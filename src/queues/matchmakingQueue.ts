import { Queue } from 'bullmq';
import { registerQueue } from './index';

export const MATCHMAKING_QUEUE_NAME = 'matchmaking';

export interface MatchmakingJobQueuePayload { matchmakingJobId: string; }

let _queue: Queue | null = (global as any).__MATCHMAKING_QUEUE__ || null;
export function getMatchmakingQueue() {
  if (!_queue) {
    _queue = new Queue(MATCHMAKING_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
  (global as any).__MATCHMAKING_QUEUE__ = _queue;
  try { registerQueue(_queue); } catch {}
  }
  return _queue;
}

export async function enqueueMatchmakingJob(matchmakingJobId: string) {
  const q = getMatchmakingQueue();
  return q.add('matchmaking', { matchmakingJobId }, { removeOnComplete: 100, removeOnFail: 25 });
}

export async function shutdownMatchmakingQueue() {
  if (_queue) {
    try { await (_queue as any).drain?.(); } catch {}
    try { await (_queue as any).close?.(); } catch {}
    try { await (_queue as any).client?.disconnect?.(); } catch {}
    try { await (_queue as any).events?.connection?.disconnect?.(); } catch {}
    _queue = null;
    delete (global as any).__MATCHMAKING_QUEUE__;
  }
}
