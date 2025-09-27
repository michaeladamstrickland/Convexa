import { Queue } from 'bullmq';
import { registerQueue } from './index';
export const MATCHMAKING_QUEUE_NAME = 'matchmaking';
let _queue = global.__MATCHMAKING_QUEUE__ || null;
export function getMatchmakingQueue() {
    if (!_queue) {
        _queue = new Queue(MATCHMAKING_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
        global.__MATCHMAKING_QUEUE__ = _queue;
        try {
            registerQueue(_queue);
        }
        catch { }
    }
    return _queue;
}
export async function enqueueMatchmakingJob(matchmakingJobId) {
    const q = getMatchmakingQueue();
    return q.add('matchmaking', { matchmakingJobId }, { removeOnComplete: 100, removeOnFail: 25 });
}
export async function shutdownMatchmakingQueue() {
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
        delete global.__MATCHMAKING_QUEUE__;
    }
}
//# sourceMappingURL=matchmakingQueue.js.map