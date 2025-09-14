"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scraperQueue = exports.SCRAPER_QUEUE_NAME = void 0;
exports.getScraperQueue = getScraperQueue;
exports.shutdownScraperQueue = shutdownScraperQueue;
exports.enqueueScraperJob = enqueueScraperJob;
const bullmq_1 = require("bullmq");
const index_1 = require("./index");
const schemas_1 = require("../../backend/src/packages/schemas");
const connection = {
    connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
};
exports.SCRAPER_QUEUE_NAME = 'scraper-jobs';
let _scraperQueue = global.__SCRAPER_QUEUE__ || null;
function getScraperQueue() {
    if (!_scraperQueue) {
        _scraperQueue = new bullmq_1.Queue(exports.SCRAPER_QUEUE_NAME, connection);
        global.__SCRAPER_QUEUE__ = _scraperQueue;
        try {
            (0, index_1.registerQueue)(_scraperQueue);
        }
        catch { }
    }
    return _scraperQueue;
}
exports.scraperQueue = getScraperQueue();
async function shutdownScraperQueue() {
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
async function enqueueScraperJob(raw) {
    const payload = (0, schemas_1.parseScraperJobPayload)(raw);
    const job = await exports.scraperQueue.add('scrape-job', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 2000
    });
    return { id: job.id, name: job.name };
}
//# sourceMappingURL=scraperQueue.js.map