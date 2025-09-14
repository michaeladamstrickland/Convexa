"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichmentWorker = void 0;
exports.shutdownEnrichmentWorker = shutdownEnrichmentWorker;
const bullmq_1 = require("bullmq");
const prisma_1 = require("../db/prisma");
const enrichmentQueue_1 = require("../queues/enrichmentQueue");
const enrichment_1 = require("../metrics/enrichment");
const scoring_1 = require("../enrichment/scoring");
const index_1 = require("./index");
const matchmakingQueue_1 = require("../queues/matchmakingQueue");
// shared prisma from db/prisma
exports.enrichmentWorker = new bullmq_1.Worker(enrichmentQueue_1.ENRICHMENT_QUEUE_NAME, async (job) => {
    const started = Date.now();
    const { propertyId } = job.data;
    try {
        const prop = await prisma_1.prisma.scrapedProperty.findUnique({ where: { id: propertyId } });
        if (!prop)
            return;
        // Skip if already enriched
        if ((prop.enrichmentTags && prop.enrichmentTags.length > 0) || prop.investmentScore !== null) {
            return;
        }
        const { score: investmentScore, tags, condition, reasons, tagReasons } = (0, scoring_1.computeScoreAndTags)({ price: prop.price, sqft: prop.sqft, condition: prop.condition });
        await prisma_1.prisma.scrapedProperty.update({
            where: { id: propertyId },
            data: { enrichmentTags: tags, investmentScore, condition, reasons: reasons || [], tagReasons: tagReasons || [] }
        });
        // Auto-matchmaking trigger: score>=85 or tags include highIntent|urgentSeller
        const trigger = (investmentScore >= 85) || (tags.includes('highIntent') || tags.includes('urgentSeller'));
        if (trigger) {
            try {
                // Create a matchmaking job focused on this property via filterJSON; annotate source=auto
                const mm = await prisma_1.prisma.matchmakingJob.create({ data: { filterJSON: { propertyId, source: 'auto' }, status: 'queued' } });
                await (0, matchmakingQueue_1.enqueueMatchmakingJob)(mm.id);
                // mark property flag best-effort
                try {
                    await prisma_1.prisma.scrapedProperty.update({ where: { id: propertyId }, data: { data: { ...(prop.data || {}), autoMatchTriggered: true } } });
                }
                catch { }
                // metrics
                global.__MATCHMAKING_METRICS__ = global.__MATCHMAKING_METRICS__ || { triggeredTotal: 0, autoTriggeredTotal: 0, replayTotal: 0 };
                global.__MATCHMAKING_METRICS__.triggeredTotal++;
                global.__MATCHMAKING_METRICS__.autoTriggeredTotal++;
                console.log(JSON.stringify({ level: 'info', component: 'matchmaking', action: 'auto_trigger', propertyId, reason: investmentScore >= 85 ? 'score>=85' : 'tag_match', score: investmentScore, tags, timestamp: new Date().toISOString() }));
            }
            catch (e) {
                console.log(JSON.stringify({ level: 'warn', component: 'matchmaking', action: 'auto_trigger_failed', propertyId, error: e?.message }));
            }
        }
        const durationMs = Date.now() - started;
        (0, enrichment_1.recordEnrichment)(durationMs);
        console.log(JSON.stringify({
            level: 'info', component: 'enrichment', status: 'processed', propertyId,
            tags, investmentScore, condition, reasons, tagReasons, durationMs, timestamp: new Date().toISOString()
        }));
    }
    catch (e) {
        console.log(JSON.stringify({ level: 'error', component: 'enrichment', status: 'failed', propertyId, error: e?.message, timestamp: new Date().toISOString() }));
        throw e;
    }
}, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' }, concurrency: 5 });
async function shutdownEnrichmentWorker() {
    try {
        await exports.enrichmentWorker.close?.();
    }
    catch { }
    try {
        await exports.enrichmentWorker.connection?.disconnect?.();
    }
    catch { }
}
try {
    (0, index_1.registerWorker)(exports.enrichmentWorker);
}
catch { }
console.log(JSON.stringify({ level: 'info', component: 'enrichmentWorker', msg: 'worker_started', queue: enrichmentQueue_1.ENRICHMENT_QUEUE_NAME, timestamp: new Date().toISOString() }));
//# sourceMappingURL=enrichmentWorker.js.map