"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENRICHMENT_QUEUE_NAME = void 0;
exports.getEnrichmentQueue = getEnrichmentQueue;
exports.enqueueEnrichmentJob = enqueueEnrichmentJob;
exports.shutdownEnrichmentQueue = shutdownEnrichmentQueue;
const bullmq_1 = require("bullmq");
const index_1 = require("./index");
exports.ENRICHMENT_QUEUE_NAME = 'enrichment';
let _queue = global.__ENRICHMENT_QUEUE__ || null;
function getEnrichmentQueue() {
    if (!_queue) {
        _queue = new bullmq_1.Queue(exports.ENRICHMENT_QUEUE_NAME, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
        global.__ENRICHMENT_QUEUE__ = _queue;
        try {
            (0, index_1.registerQueue)(_queue);
        }
        catch { }
    }
    return _queue;
}
async function enqueueEnrichmentJob(payload) {
    const q = getEnrichmentQueue();
    return q.add('enrich', payload, { removeOnComplete: 100, removeOnFail: 25 });
}
async function shutdownEnrichmentQueue() {
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