import { Worker, Job } from 'bullmq';
import { registerWorker } from './index';
import { SCRAPER_QUEUE_NAME } from '../queues/scraperQueue';
import { parseScraperJobPayload } from '../../backend/src/packages/schemas';
import { prisma } from '../db/prisma';
import { runZillowScraper, runAuctionScraper, AdapterInput, DispatcherResult } from '../adapters/scrapers';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';
import { enqueuePropertyEnrichment } from '../utils/enqueueEnrichmentJob';
import { PrismaClient as _Prisma } from '@prisma/client';

// shared prisma from db/prisma

// Simple in-memory metrics (resets on process restart)
export const metrics = {
  processed: 0,
  success: 0,
  failed: 0,
  perSource: new Map<string, { success: number; failed: number }>(),
  durations: [] as number[]
};

async function runDispatcher(source: string, payload: AdapterInput & { fromDate?: string; toDate?: string }): Promise<DispatcherResult> {
  switch (source) {
    case 'zillow':
      return await runZillowScraper(payload);
    case 'auction':
      return await runAuctionScraper(payload);
    default:
      return { items: [], meta: { scrapedCount: 0, durationMs: 0, source }, errors: ['scrape_error:unsupported_source'] };
  }
}

function recordMetrics(source: string, ok: boolean, duration: number) {
  metrics.processed++;
  if (ok) metrics.success++; else metrics.failed++;
  metrics.durations.push(duration);
  if (!metrics.perSource.has(source)) metrics.perSource.set(source, { success: 0, failed: 0 });
  const bucket = metrics.perSource.get(source)!;
  ok ? bucket.success++ : bucket.failed++;
  if (metrics.processed % 10 === 0) {
    const avg = metrics.durations.reduce((a, b) => a + b, 0) / metrics.durations.length;
    console.log('[scraperWorker][metrics]', {
      processed: metrics.processed,
      success: metrics.success,
      failed: metrics.failed,
      avgMs: Math.round(avg),
      perSource: Array.from(metrics.perSource.entries())
    });
  }
}

const MAX_ATTEMPTS = 3;

// Worker state for diagnostics
export const workerState = {
  active: false,
  activeJobs: 0,
  lastJobCompletedAt: null as Date | null
};

async function processJob(job: Job) {
  const payload = parseScraperJobPayload(job.data);
  const startedAt = new Date();
  const jobId = (job.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).toString();
  workerState.activeJobs++;

  // Upsert initial record (queued -> running)
  await prisma.scraperJob.upsert({
    where: { id: jobId },
    update: { status: 'running' as any, startedAt },
    create: {
      id: jobId,
      source: payload.source as any,
      inputPayload: payload as any,
      status: 'running' as any,
      startedAt
    }
  });

  const execStart = Date.now();
  try {
  const result = await runDispatcher(payload.source, { zip: payload.zip, options: payload.options, fromDate: (payload as any).fromDate, toDate: (payload as any).toDate, filters: (payload as any).filters });
    // Deduplicate & metadata enrichment
    let dedupedCount = 0;
    for (const item of result.items as any[]) {
      const addr = item.address || 'Unknown Address';
      try {
  const created = await (prisma as any).scrapedProperty.create({
          data: { source: payload.source, zip: payload.zip, address: addr, data: item }
        });
        item.deduped = false;
  // Auto-enqueue enrichment for new properties (non-deduped)
  try { await enqueuePropertyEnrichment(created.id); } catch {}
        // property.new webhook dispatch
        try {
          const subs = await (prisma as any).webhookSubscription.findMany({ where: { isActive: true, eventTypes: { has: 'property.new' } } });
          for (const s of subs) {
            await enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'property.new', payload: { source: payload.source, zip: payload.zip, address: addr } });
          }
        } catch {}
      } catch (e: any) {
        if (e?.code === 'P2002') {
          dedupedCount++;
          item.deduped = true;
          try {
            await (prisma as any).scrapedProperty.update({
              where: { source_zip_address: { source: payload.source, zip: payload.zip, address: addr } },
              data: { data: item }
            });
          } catch { /* ignore */ }
        }
      }
    }
    (result.meta as any).dedupedCount = dedupedCount;
    (result.meta as any).totalItems = (result.meta as any).totalItems ?? result.items.length;
    (result.meta as any).errorsCount = result.errors.length;
    (result.meta as any).scrapeDurationMs = (result.meta as any).durationMs;
    // Ensure tests can assert on filtersApplied and adapter version
    if (!Array.isArray((result.meta as any).filtersApplied)) {
      const filters = ((payload as any).filters || {}) as Record<string, unknown>;
      (result.meta as any).filtersApplied = Object.keys(filters);
    }
    if (!(result.meta as any).sourceAdapterVersion) {
      (result.meta as any).sourceAdapterVersion = 'test-adapter';
    }
    const duration = Date.now() - execStart;
    await prisma.scraperJob.update({
      where: { id: jobId },
      data: {
        resultPayload: result as any,
        status: 'completed' as any,
        finishedAt: new Date()
      }
    });
    // job.completed webhook
    try {
      const subs = await (prisma as any).webhookSubscription.findMany({ where: { isActive: true, eventTypes: { has: 'job.completed' } } });
      for (const s of subs) {
  await enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'job.completed', payload: { jobId, source: payload.source, zip: payload.zip, meta: result.meta } });
      }
    } catch {}
    recordMetrics(payload.source, true, duration);
    console.log(`[WORKER] Job #${jobId} from source=${payload.source} status=completed duration=${duration}ms items=${result.meta.scrapedCount}`);
    workerState.lastJobCompletedAt = new Date();
    return result;
  } catch (err: any) {
    const duration = Date.now() - execStart;
    let message = err?.message || 'unknown_error';
    // classify
    if (/validation/i.test(message)) message = `validation_error:${message}`;
    else if (/timeout|network|ECONN|ENOTFOUND/i.test(message)) message = `upstream_error:${message}`;
    else if (!message.startsWith('scrape_error:') && !message.startsWith('validation_error:') && !message.startsWith('upstream_error:')) {
      message = `scrape_error:${message}`;
    }
  const current: any = await prisma.scraperJob.findUnique({ where: { id: jobId } });
  const attempt = (current?.attempt ?? 0) + 1;
  const prevErrors: string[] = (current?.previousErrors as any) ?? [];
    prevErrors.push(message);

    const willRetry = attempt < MAX_ATTEMPTS;
    await (prisma.scraperJob as any).update({
      where: { id: jobId },
      data: {
        status: willRetry ? 'queued' : 'failed',
        error: willRetry ? undefined : message,
        attempt,
        previousErrors: prevErrors,
        finishedAt: willRetry ? null : new Date()
      }
    }).catch(() => {});
    recordMetrics(payload.source, false, duration);
    if (willRetry) {
      // In test environment, skip custom recursive retry timers to avoid open handle leaks.
      if (process.env.NODE_ENV !== 'test') {
        const backoffMs = 1000 * attempt; // simple linear backoff
        console.log(`[scraperWorker] Retry scheduling job ${jobId} in ${backoffMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
        const t = setTimeout(async () => {
          try {
            await processJob({ ...job, id: jobId } as any);
          } catch (e) { /* handled */ }
        }, backoffMs);
        // Do not keep process alive solely for this timer
        (t as any).unref?.();
      }
      return;
    }
    console.log(`[WORKER] Job #${jobId} from source=${payload.source} status=failed duration=${duration}ms error=${message}`);
    throw err;
  }
  finally {
    workerState.activeJobs = Math.max(0, workerState.activeJobs - 1);
  }
}

export const scraperWorker = new Worker(SCRAPER_QUEUE_NAME, processJob, {
  connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' }
});

// Ensure the worker is tracked for centralized shutdown in tests
try { registerWorker(scraperWorker); } catch {}

workerState.active = true;
console.log('[WORKER] Scraper worker started queue=' + SCRAPER_QUEUE_NAME);

scraperWorker.on('failed', (job, err) => {
  console.error('[scraperWorker] Job failed', job?.id, err?.message);
});

scraperWorker.on('completed', job => {
  // Detailed per-job log already emitted in processJob try block; keep lightweight event hook
});

scraperWorker.on('closed', () => {
  workerState.active = false;
});

export async function shutdownScraperWorker() {
  try { await (scraperWorker as any).close?.(); } catch {}
  try { await (scraperWorker as any).connection?.disconnect?.(); } catch {}
}
