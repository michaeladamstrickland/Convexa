import { Worker } from 'bullmq';
import { prisma } from '../db/prisma';
import { ENRICHMENT_QUEUE_NAME } from '../queues/enrichmentQueue';
import { recordEnrichment } from '../metrics/enrichment';
import { computeScoreAndTags } from '../enrichment/scoring';
import { registerWorker } from './index';
import { enqueueMatchmakingJob } from '../queues/matchmakingQueue';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';
// shared prisma from db/prisma
export const enrichmentWorker = new Worker(ENRICHMENT_QUEUE_NAME, async (job) => {
    const started = Date.now();
    const { propertyId } = job.data;
    try {
        const prop = await prisma.scrapedProperty.findUnique({ where: { id: propertyId } });
        if (!prop)
            return;
        // Skip if already enriched
        if ((prop.enrichmentTags && prop.enrichmentTags.length > 0) || prop.investmentScore !== null) {
            return;
        }
        const { score: investmentScore, tags, condition, reasons, tagReasons } = computeScoreAndTags({ price: prop.price, sqft: prop.sqft, condition: prop.condition });
        await prisma.scrapedProperty.update({
            where: { id: propertyId },
            data: { enrichmentTags: tags, investmentScore, condition, reasons: reasons || [], tagReasons: tagReasons || [] }
        });
        // Record CRM activity + emit webhook
        try {
            const activity = await prisma.crmActivity.create({ data: { type: 'enrichment.completed', propertyId, metadata: { investmentScore, tags, condition, reasons, tagReasons } } });
            // Metrics
            const cm = (global.__CRM_ACTIVITY_METRICS__ = global.__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map(), webhook: { success: 0, fail: 0 } });
            cm.total++;
            cm.perType.set('enrichment.completed', (cm.perType.get?.('enrichment.completed') || 0) + 1);
            // Emit crm.activity webhook to interested subscribers
            try {
                const subs = await prisma.webhookSubscription.findMany({ where: { isActive: true } }).catch(() => []);
                const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('crm.activity'));
                if (interested.length) {
                    const payload = { id: activity.id, type: activity.type, propertyId: activity.propertyId, leadId: activity.leadId, userId: activity.userId, metadata: activity.metadata, createdAt: activity.createdAt };
                    await Promise.all(interested.map(s => enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'crm.activity', payload })));
                    cm.webhook.success += interested.length;
                }
            }
            catch {
                cm.webhook.fail++;
            }
        }
        catch { }
        // Auto-matchmaking trigger: score>=85 or tags include highIntent|urgentSeller
        const trigger = (investmentScore >= 85) || (tags.includes('highIntent') || tags.includes('urgentSeller'));
        if (trigger) {
            try {
                // Create a matchmaking job focused on this property via filterJSON; annotate source=auto
                const mm = await prisma.matchmakingJob.create({ data: { filterJSON: { propertyId, source: 'auto' }, status: 'queued' } });
                await enqueueMatchmakingJob(mm.id);
                // mark property flag best-effort
                try {
                    await prisma.scrapedProperty.update({ where: { id: propertyId }, data: { data: { ...(prop.data || {}), autoMatchTriggered: true } } });
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
        recordEnrichment(durationMs);
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
export async function shutdownEnrichmentWorker() {
    try {
        await enrichmentWorker.close?.();
    }
    catch { }
    try {
        await enrichmentWorker.connection?.disconnect?.();
    }
    catch { }
}
try {
    registerWorker(enrichmentWorker);
}
catch { }
console.log(JSON.stringify({ level: 'info', component: 'enrichmentWorker', msg: 'worker_started', queue: ENRICHMENT_QUEUE_NAME, timestamp: new Date().toISOString() }));
//# sourceMappingURL=enrichmentWorker.js.map