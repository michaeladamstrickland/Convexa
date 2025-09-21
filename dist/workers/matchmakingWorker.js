"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingWorker = exports.matchmakingMetrics = void 0;
exports.shutdownMatchmakingWorker = shutdownMatchmakingWorker;
const bullmq_1 = require("bullmq");
const prisma_1 = require("../db/prisma");
const matchmakingQueue_1 = require("../queues/matchmakingQueue");
const index_1 = require("./index");
const webhookQueue_1 = require("../queues/webhookQueue");
// shared prisma from db/prisma
exports.matchmakingMetrics = {
    durations: [],
    statusCounts: new Map(),
    webhookDeliveredTotal: 0,
};
function incrStatus(status) {
    exports.matchmakingMetrics.statusCounts.set(status, (exports.matchmakingMetrics.statusCounts.get(status) || 0) + 1);
}
exports.matchmakingWorker = new bullmq_1.Worker(matchmakingQueue_1.MATCHMAKING_QUEUE_NAME, async (job) => {
    const started = Date.now();
    const { matchmakingJobId } = job.data;
    try {
        const mm = await prisma_1.prisma.matchmakingJob.findUnique({ where: { id: matchmakingJobId } });
        if (!mm)
            return;
        // Mark running
        await prisma_1.prisma.matchmakingJob.update({ where: { id: matchmakingJobId }, data: { status: 'running' } });
        incrStatus('running');
        // Mock matching logic: count all enriched properties meeting basic score filter if present
        const filter = (mm.filterJSON || {});
        const minScore = typeof filter.minScore === 'number' ? filter.minScore : 0;
        const source = filter.source;
        const where = {};
        if (typeof minScore === 'number')
            where.investmentScore = { gte: minScore };
        // Only treat known scraper sources as property source filters; ignore job-origin markers like 'auto'|'admin'
        const validScraperSources = new Set(['zillow', 'auction']);
        if (source && validScraperSources.has(source))
            where.source = source;
        if (filter.propertyId)
            where.id = filter.propertyId;
        const matchedCount = await prisma_1.prisma.scrapedProperty.count({ where });
        await prisma_1.prisma.matchmakingJob.update({ where: { id: matchmakingJobId }, data: { status: 'completed', matchedCount, completedAt: new Date() } });
        incrStatus('completed');
        const durationMs = Date.now() - started;
        exports.matchmakingMetrics.durations.push(durationMs);
        console.log(JSON.stringify({ level: 'info', component: 'matchmaking', status: 'completed', matchmakingJobId, filterPreview: filter, matchedCount, durationMs, timestamp: new Date().toISOString() }));
        // CRM push webhook: emit matchmaking.completed for active subscribers
        try {
            const subs = await prisma_1.prisma.webhookSubscription.findMany({ where: { isActive: true } });
            const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('matchmaking.completed'));
            const payload = { jobId: matchmakingJobId, matchedCount, timestamp: new Date().toISOString() };
            await Promise.all(interested.map(s => (0, webhookQueue_1.enqueueWebhookDelivery)({ subscriptionId: s.id, eventType: 'matchmaking.completed', payload })));
            exports.matchmakingMetrics.webhookDeliveredTotal += interested.length;
        }
        catch (e) {
            console.log(JSON.stringify({ level: 'warn', component: 'matchmaking', action: 'webhook_emit_failed', matchmakingJobId, error: e?.message }));
        }
        // CRM Activity record + webhook (crm.activity)
        try {
            const activity = await prisma_1.prisma.crmActivity.create({ data: { type: 'matchmaking.completed', metadata: { matchmakingJobId, matchedCount } } });
            const cm = (global.__CRM_ACTIVITY_METRICS__ = global.__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map(), webhook: { success: 0, fail: 0 } });
            cm.total++;
            cm.perType.set('matchmaking.completed', (cm.perType.get?.('matchmaking.completed') || 0) + 1);
            try {
                const subs = await prisma_1.prisma.webhookSubscription.findMany({ where: { isActive: true } }).catch(() => []);
                const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('crm.activity'));
                if (interested.length) {
                    const payload = { id: activity.id, type: activity.type, propertyId: activity.propertyId, leadId: activity.leadId, userId: activity.userId, metadata: activity.metadata, createdAt: activity.createdAt };
                    await Promise.all(interested.map(s => (0, webhookQueue_1.enqueueWebhookDelivery)({ subscriptionId: s.id, eventType: 'crm.activity', payload })));
                    cm.webhook.success += interested.length;
                }
            }
            catch {
                cm.webhook.fail++;
            }
        }
        catch { }
    }
    catch (e) {
        await prisma_1.prisma.matchmakingJob.update({ where: { id: job.data.matchmakingJobId }, data: { status: 'failed' } }).catch(() => { });
        incrStatus('failed');
        console.log(JSON.stringify({ level: 'error', component: 'matchmaking', status: 'failed', matchmakingJobId: job.data.matchmakingJobId, error: e?.message, timestamp: new Date().toISOString() }));
        throw e;
    }
}, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' }, concurrency: 3 });
async function shutdownMatchmakingWorker() {
    try {
        await exports.matchmakingWorker.close?.();
    }
    catch { }
    try {
        await exports.matchmakingWorker.connection?.disconnect?.();
    }
    catch { }
}
try {
    (0, index_1.registerWorker)(exports.matchmakingWorker);
}
catch { }
console.log(JSON.stringify({ level: 'info', component: 'matchmakingWorker', msg: 'worker_started', queue: matchmakingQueue_1.MATCHMAKING_QUEUE_NAME, timestamp: new Date().toISOString() }));
//# sourceMappingURL=matchmakingWorker.js.map