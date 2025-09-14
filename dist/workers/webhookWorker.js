"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookWorker = exports.webhookMetrics = void 0;
exports.shutdownWebhookWorker = shutdownWebhookWorker;
const bullmq_1 = require("bullmq");
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../db/prisma");
const webhookQueue_1 = require("../queues/webhookQueue");
const index_1 = require("./index");
// Simple in-memory metrics for Prometheus exposition
exports.webhookMetrics = {
    delivered: 0,
    failed: 0,
    durations: [],
};
exports.webhookWorker = new bullmq_1.Worker(webhookQueue_1.WEBHOOK_QUEUE_NAME, async (job) => {
    const started = Date.now();
    const data = job.data;
    const maxAttempts = job.opts.attempts || parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10);
    try {
        const sub = await prisma_1.prisma.webhookSubscription.findUnique({ where: { id: data.subscriptionId } });
        if (!sub || !sub.isActive)
            return;
        const body = JSON.stringify({ event: data.eventType, data: data.payload });
        const ts = Date.now().toString();
        const sig = crypto_1.default.createHmac('sha256', sub.signingSecret).update(body).digest('hex');
        const resp = await (0, node_fetch_1.default)(sub.targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': `sha256=${sig}`,
                'X-Timestamp': ts,
                'X-Webhook-Id': job.id.toString(),
                'X-Event-Type': data.eventType
            },
            body,
            timeout: 10000
        });
        if (!resp.ok)
            throw new Error(`status_${resp.status}`);
        const successAttempts = job.attemptsMade + 1;
        console.log(JSON.stringify({
            level: 'info',
            component: 'webhookDelivery',
            status: 'success',
            subscriptionId: data.subscriptionId,
            eventType: data.eventType,
            attempt: successAttempts,
            maxAttempts,
            jobId: job.id,
            durationMs: Date.now() - started,
            timestamp: new Date().toISOString()
        }));
        // Log delivery success (one row per successful delivery event)
        await prisma_1.prisma.webhookDeliveryLog.create({
            data: {
                subscriptionId: data.subscriptionId,
                eventType: data.eventType,
                status: 'delivered',
                attemptsMade: successAttempts,
                jobId: job.id.toString(),
                lastAttemptAt: new Date(),
            }
        }).catch(() => { });
        if (data.failureId) {
            // Successful replay/resolution
            await prisma_1.prisma.webhookDeliveryFailure.update({ where: { id: data.failureId }, data: { isResolved: true, replayedAt: new Date(), replayJobId: job.id.toString() } }).catch(() => { });
            await prisma_1.prisma.webhookDeliveryLog.updateMany({ where: { subscriptionId: data.subscriptionId, eventType: data.eventType, status: 'failed', isResolved: false }, data: { isResolved: true } }).catch(() => { });
            const mode = data.replayMode === 'bulk' ? 'bulk' : 'single';
            const metrics = ensureReplayMetricStore();
            metrics[mode].success++;
            console.log(JSON.stringify({ level: 'info', component: 'webhookReplay', status: 'resolved', failureId: data.failureId, replayJobId: job.id, subscriptionId: data.subscriptionId, eventType: data.eventType, timestamp: new Date().toISOString() }));
        }
        exports.webhookMetrics.delivered++;
        exports.webhookMetrics.durations.push(Date.now() - started);
    }
    catch (e) {
        const attemptsMade = job.attemptsMade + 1; // includes this attempt
        if (attemptsMade >= maxAttempts) {
            exports.webhookMetrics.failed++;
            exports.webhookMetrics.durations.push(Date.now() - started);
            await prisma_1.prisma.webhookDeliveryFailure.create({
                data: {
                    subscriptionId: data.subscriptionId,
                    eventType: data.eventType,
                    payload: data.payload,
                    attempts: attemptsMade,
                    finalError: e?.message || 'unknown_error',
                    lastError: e?.message || 'unknown_error',
                    lastAttemptAt: new Date()
                }
            }).catch(() => { });
            // Insert failure log row
            await prisma_1.prisma.webhookDeliveryLog.create({
                data: {
                    subscriptionId: data.subscriptionId,
                    eventType: data.eventType,
                    status: 'failed',
                    attemptsMade,
                    jobId: job.id.toString(),
                    lastError: e?.message || 'unknown_error',
                    lastAttemptAt: new Date(),
                }
            }).catch(() => { });
            console.log(JSON.stringify({ level: 'error', component: 'webhookDelivery', status: 'dead-letter', subscriptionId: data.subscriptionId, eventType: data.eventType, attempts: attemptsMade, error: e?.message, jobId: job.id, durationMs: Date.now() - started, timestamp: new Date().toISOString() }));
            if (data.failureId) {
                const mode = data.replayMode === 'bulk' ? 'bulk' : 'single';
                const metrics = ensureReplayMetricStore();
                metrics[mode].failed++;
                console.log(JSON.stringify({ level: 'error', component: 'webhookReplay', status: 'failed', failureId: data.failureId, jobId: job.id, subscriptionId: data.subscriptionId, eventType: data.eventType, error: e?.message, timestamp: new Date().toISOString() }));
            }
        }
        throw e; // let BullMQ handle retry
    }
}, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
function ensureReplayMetricStore() {
    if (!global.__WEBHOOK_REPLAY_METRICS__) {
        global.__WEBHOOK_REPLAY_METRICS__ = { single: { success: 0, failed: 0 }, bulk: { success: 0, failed: 0 } };
    }
    return global.__WEBHOOK_REPLAY_METRICS__;
}
async function shutdownWebhookWorker() {
    try {
        await exports.webhookWorker.close?.();
    }
    catch { }
    try {
        await exports.webhookWorker.connection?.disconnect?.();
    }
    catch { }
}
try {
    (0, index_1.registerWorker)(exports.webhookWorker);
}
catch { }
console.log(JSON.stringify({ level: 'info', component: 'webhookWorker', msg: 'worker_started', queue: webhookQueue_1.WEBHOOK_QUEUE_NAME, timestamp: new Date().toISOString() }));
//# sourceMappingURL=webhookWorker.js.map