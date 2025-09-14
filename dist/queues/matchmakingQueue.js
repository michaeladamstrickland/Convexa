"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATCHMAKING_QUEUE_NAME = void 0;
exports.getMatchmakingQueue = getMatchmakingQueue;
exports.enqueueMatchmakingJob = enqueueMatchmakingJob;
exports.shutdownMatchmakingQueue = shutdownMatchmakingQueue;
const bullmq_1 = require("bullmq");
const index_1 = require("./index");
exports.MATCHMAKING_QUEUE_NAME = 'matchmaking';
let _queue = global.__MATCHMAKING_QUEUE__ || null;
function getMatchmakingQueue() {
    if (!_queue) {
        _queue = new bullmq_1.Queue(exports.MATCHMAKING_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
        global.__MATCHMAKING_QUEUE__ = _queue;
        try {
            (0, index_1.registerQueue)(_queue);
        }
        catch { }
    }
    return _queue;
}
async function enqueueMatchmakingJob(matchmakingJobId) {
    const q = getMatchmakingQueue();
    return q.add('matchmaking', { matchmakingJobId }, { removeOnComplete: 100, removeOnFail: 25 });
}
async function shutdownMatchmakingQueue() {
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