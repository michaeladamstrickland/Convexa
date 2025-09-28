import { enqueueScraperJob } from '../queues/scraperQueue';
import { prisma } from '../db/prisma';
let started = false;
let lastRunDay = null;
const ranSourcesToday = new Set();
function todayKey() { return new Date().toISOString().slice(0, 10); }
function parseTargetTime() {
    const raw = process.env.SCHEDULER_DAILY_HHMM || '06:30';
    const m = raw.match(/^(\d{2}):(\d{2})$/);
    if (!m)
        return { hh: 6, mm: 30 };
    return { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) };
}
async function alreadyEnqueuedToday(source) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const existing = await prisma.scraperJob.findFirst({
        where: { source: source, createdAt: { gte: start } },
        select: { id: true }
    });
    return !!existing;
}
export async function triggerDailyScheduler(force = false) {
    const zip = process.env.DEFAULT_SCRAPE_ZIP || '08081';
    const sources = ['zillow', 'auction'];
    const enqueued = [];
    for (const source of sources) {
        const skipReason = [];
        let skipped = false;
        if (!force) {
            if (ranSourcesToday.has(source)) {
                skipped = true;
                skipReason.push('already_ran_in_memory');
            }
            else if (await alreadyEnqueuedToday(source)) {
                skipped = true;
                skipReason.push('already_enqueued_today');
            }
        }
        else if (ranSourcesToday.has(source)) {
            // even on force, prevent true duplicate inside same manual call cycle
            skipped = true;
            skipReason.push('duplicate_in_request');
        }
        if (skipped) {
            enqueued.push({ source, skipped: true, reason: skipReason.join(',') });
            continue;
        }
        try {
            const { id } = await enqueueScraperJob({ source, zip });
            ranSourcesToday.add(source);
            enqueued.push({ source, jobId: id, skipped: false });
        }
        catch (e) {
            enqueued.push({ source, skipped: true, reason: 'enqueue_failed:' + e.message });
        }
    }
    return { date: todayKey(), enqueued };
}
export function startDailyScheduler() {
    if (started)
        return;
    started = true;
    const { hh, mm } = parseTargetTime();
    console.log(`[SCHEDULER] Daily scheduler started target=${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);
    setInterval(async () => {
        try {
            const now = new Date();
            const key = todayKey();
            if (lastRunDay !== key) {
                // New day reset memory
                lastRunDay = key;
                ranSourcesToday.clear();
            }
            if (ranSourcesToday.size >= 2)
                return; // all sources done
            if (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm)) {
                const result = await triggerDailyScheduler(false);
                if (result.enqueued.some(r => !r.skipped)) {
                    console.log('[SCHEDULER] Triggered daily ingestion', result);
                }
            }
        }
        catch (e) {
            console.error('[SCHEDULER] Error in daily scheduler loop', e.message);
        }
    }, 60_000); // check every minute
}
//# sourceMappingURL=dailyScheduler.js.map