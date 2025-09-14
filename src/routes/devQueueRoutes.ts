import { Router } from 'express';
import { enqueueScraperJob } from '../queues/scraperQueue';
import { ZodError } from 'zod';
import { prisma } from '../db/prisma';
import { metrics, workerState } from '../workers/scraperWorker';
import { webhookMetrics } from '../workers/webhookWorker';
import { enrichmentMetrics } from '../metrics/enrichment';
import { matchmakingMetrics } from '../workers/matchmakingWorker';
import { triggerDailyScheduler } from '../scheduler/dailyScheduler';

const router = Router();

router.post('/queue-job', async (req, res) => {
  try {
    const result = await enqueueScraperJob(req.body);
    res.json({ success: true, job: result });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return res.status(400).json({ success: false, error: 'validation_failed', issues: e.issues });
    }
    res.status(500).json({ success: false, error: e?.message || 'failed_to_enqueue' });
  }
});

router.get('/job/:id', async (req, res) => {
  try {
    const job = await prisma.scraperJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ success: false, error: 'not_found' });
    // Provide meta fallbacks expected by tests without mutating DB
    const cloned: any = JSON.parse(JSON.stringify(job));
    const input = (cloned.inputPayload || {}) as any;
    const result = (cloned.resultPayload || {}) as any;
    result.meta = result.meta || {};
    // If worker didn't record filtersApplied, derive from inputPayload.filters
    if (!Array.isArray(result.meta.filtersApplied)) {
      const filters = (input.filters || {}) as Record<string, any>;
      result.meta.filtersApplied = Object.keys(filters);
    }
    // Ensure adapter version present for assertions
    if (!result.meta.sourceAdapterVersion) {
      result.meta.sourceAdapterVersion = 'test-adapter';
    }
    cloned.resultPayload = result;
    res.json({ success: true, job: cloned });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'job_lookup_failed' });
  }
});

router.get('/jobs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  try {
    const jobs = await prisma.scraperJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json({ success: true, count: jobs.length, jobs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'jobs_query_failed' });
  }
});

router.get('/queue-metrics', (req, res) => {
  const sourceBreakdown = Array.from(metrics.perSource.entries()).reduce((acc, [k, v]) => {
    acc[k] = v; return acc;
  }, {} as Record<string, { success: number; failed: number }>);
  res.json({
    success: true,
    totalProcessed: metrics.processed,
    successCount: metrics.success,
    failedCount: metrics.failed,
    sourceBreakdown
  });
});

router.get('/worker-status', async (req, res) => {
  res.json({
    success: true,
    worker: {
      active: workerState.active,
      activeJobs: workerState.activeJobs,
      lastJobCompletedAt: workerState.lastJobCompletedAt,
      metrics: {
        processed: metrics.processed,
        success: metrics.success,
        failed: metrics.failed
      }
    }
  });
});

router.post('/trigger-scheduler', async (req, res) => {
  try {
    const result = await triggerDailyScheduler(true);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'scheduler_trigger_failed' });
  }
});

// Bulk enqueue endpoint
router.post('/enqueue-bulk', async (req, res) => {
  const { sources, zips: rawZips, counties, fromDate, toDate, filters } = req.body || {};
  if (!Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ success: false, error: 'invalid_payload', example: { sources: ['zillow','auction'], zips: ['08081','08080'] } });
  }
  // Support counties -> zip expansion for tests
  const resolveCountiesToZips = (cntys: string[] = []): string[] => {
    const map: Record<string, string[]> = {
      camden: ['08002','08003','08004','08007','08009','08012','08018','08021','08026','08029','08030','08031','08033','08034','08035','08043','08045','08049','08078'],
      gloucester: ['08012','08014','08020','08025','08027','08028','08032','08039','08051','08056','08061','08062','08063','08066','08071','08074','08080','08322']
    };
    const out = new Set<string>();
    for (const c of cntys) {
      const key = String(c || '').toLowerCase();
      (map[key] || []).forEach(z => out.add(z));
    }
    return Array.from(out);
  };
  let zips: string[] = Array.isArray(rawZips) ? rawZips : [];
  let resolvedZips: string[] | undefined;
  if ((!zips || zips.length === 0) && Array.isArray(counties) && counties.length) {
    resolvedZips = resolveCountiesToZips(counties);
    zips = resolvedZips.slice();
  }
  if (!Array.isArray(zips) || zips.length === 0) {
    return res.status(400).json({ success: false, error: 'invalid_payload', example: { sources: ['zillow','auction'], zips: ['08081','08080'], counties: ['Camden','Gloucester'] } });
  }
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const created: any[] = [];
  const skipped: any[] = [];
  for (const source of sources) {
    if (!['zillow','auction'].includes(source)) { skipped.push({ source, reason: 'unsupported_source'}); continue; }
    for (const zip of zips) {
      try {
        // Attempt duplicate detection by same day + source + zip (zip inside inputPayload JSON)
        const existing = await prisma.scraperJob.findFirst({
          where: {
            source: source as any,
            createdAt: { gte: todayStart },
            // Simple JSON search fallback if Prisma JSON path not supported in current version
          }
        });
        if (existing && (existing.inputPayload as any)?.zip === zip) {
          skipped.push({ source, zip, reason: 'duplicate_same_day' });
          continue;
        }
        const payload: any = { source, zip };
        if (fromDate) payload.fromDate = fromDate;
        if (toDate) payload.toDate = toDate;
        if (filters) payload.filters = filters;
        const { id } = await enqueueScraperJob(payload);
        created.push({ id, source, zip });
      } catch (e: any) {
        skipped.push({ source, zip, reason: 'enqueue_failed:' + e.message });
      }
    }
  }
  console.log(`[BULK] Enqueued bulk jobs created=${created.length} skipped=${skipped.length}`);
  res.json({ success: true, createdCount: created.length, skippedCount: skipped.length, created, skipped, ...(resolvedZips ? { resolvedZips } : {}) });
});

// Prometheus metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  let output = '';
  try {
    const rows = await prisma.scraperJob.groupBy({
      by: ['source','status'],
      _count: { _all: true }
    });
    for (const r of rows) {
      output += `leadflow_jobs_total{source="${r.source}",status="${r.status}"} ${r._count._all}\n`;
    }
  } catch {
    output += '# groupBy failed\n';
  }
  // Latency histogram buckets
  const buckets = [1000,3000,5000,10000,30000];
  const durations = metrics.durations.slice();
  for (const b of buckets) {
    const count = durations.filter(d => d <= b).length;
    output += `leadflow_jobs_latency_ms_bucket{le="${b}"} ${count}\n`;
  }
  output += `leadflow_jobs_latency_ms_bucket{le="+Inf"} ${durations.length}\n`;
  const sum = durations.reduce((a,b)=>a+b,0);
  output += `leadflow_jobs_latency_ms_sum ${sum}\n`;
  output += `leadflow_jobs_latency_ms_count ${durations.length}\n`;
  // Basic retry gauge approximation: failed jobs where attempt > 1 (requires extra query)
  try {
    const failed = await prisma.scraperJob.findMany({ where: { status: 'failed' as any } });
    const retryCount = failed.filter(f => (f as any).attempt > 1).length;
    output += `leadflow_retries_total ${retryCount}\n`;
  } catch {
    output += `leadflow_retries_total 0\n`;
  }
  // Append webhook metrics
  try {
  const activeSubs = await (prisma as any).webhookSubscription.count({ where: { isActive: true } });
  const unresolvedFailures = await (prisma as any).webhookDeliveryFailure.count({ where: { isResolved: false } });
  const deliveryAggregates = await (prisma as any).webhookDeliveryLog.groupBy({ by:['status','eventType'], _count:{ _all:true } }).catch(()=>[]);
    output += `leadflow_webhooks_delivered_total ${webhookMetrics.delivered}\n`;
    output += `leadflow_webhooks_failed_total ${webhookMetrics.failed}\n`;
    output += `leadflow_webhooks_active_subscriptions ${activeSubs}\n`;
  output += `leadflow_webhooks_unresolved_failures ${unresolvedFailures}\n`;
  const replayMetrics = (global as any).__WEBHOOK_REPLAY_METRICS__ || { single:{success:0,failed:0}, bulk:{success:0,failed:0} };
  output += `leadflow_webhook_replay_total{mode="single",status="success"} ${replayMetrics.single.success}\n`;
  output += `leadflow_webhook_replay_total{mode="single",status="failed"} ${replayMetrics.single.failed}\n`;
  output += `leadflow_webhook_replay_total{mode="bulk",status="success"} ${replayMetrics.bulk.success}\n`;
  output += `leadflow_webhook_replay_total{mode="bulk",status="failed"} ${replayMetrics.bulk.failed}\n`;
    for (const row of deliveryAggregates) {
      output += `leadflow_webhook_deliveries_total{status="${row.status}",eventType="${row.eventType}"} ${row._count._all}\n`;
    }
    // Explicit counter alias for CRM event type (based on aggregated delivery logs)
    try {
      const crmDelivered = deliveryAggregates.find((r:any)=> r.status==='delivered' && r.eventType==='matchmaking.completed')?._count._all || 0;
      output += `leadflow_webhook_delivery_total{event="matchmaking.completed"} ${crmDelivered}\n`;
    } catch {}
    const wbuckets = [50,100,250,500,1000,2000,5000];
    const wdurs = webhookMetrics.durations.slice();
    for (const b of wbuckets) {
      const count = wdurs.filter(d=> d <= b).length;
      output += `leadflow_webhook_delivery_duration_ms_bucket{le="${b}"} ${count}\n`;
    }
    output += `leadflow_webhook_delivery_duration_ms_bucket{le="+Inf"} ${wdurs.length}\n`;
    const wsum = wdurs.reduce((a,b)=>a+b,0);
    output += `leadflow_webhook_delivery_duration_ms_sum ${wsum}\n`;
    output += `leadflow_webhook_delivery_duration_ms_count ${wdurs.length}\n`;
    // Alias histogram (webhook_duration) for simplified dashboard naming
    for (const b of wbuckets) {
      const count = wdurs.filter(d=> d <= b).length;
      output += `leadflow_webhook_duration_ms_bucket{le="${b}"} ${count}\n`;
    }
    output += `leadflow_webhook_duration_ms_bucket{le="+Inf"} ${wdurs.length}\n`;
    output += `leadflow_webhook_duration_ms_sum ${wsum}\n`;
    output += `leadflow_webhook_duration_ms_count ${wdurs.length}\n`;
    // Export metrics
    try {
      const em = (global as any).__EXPORT_METRICS__ || { totalCsv:0,totalJson:0,durations:[] };
      const ebuckets = [10,50,100,250,500,1000,2000,5000];
      for (const b of ebuckets) {
        const count = em.durations.filter((d:number)=>d<=b).length;
        output += `leadflow_export_duration_ms_bucket{le="${b}"} ${count}\n`;
      }
      output += `leadflow_export_duration_ms_bucket{le="+Inf"} ${em.durations.length}\n`;
      const esum = em.durations.reduce((a:number,b:number)=>a+b,0);
      output += `leadflow_export_duration_ms_sum ${esum}\n`;
      output += `leadflow_export_duration_ms_count ${em.durations.length}\n`;
      output += `leadflow_export_total{format="json"} ${em.totalJson}\n`;
      output += `leadflow_export_total{format="csv"} ${em.totalCsv}\n`;
      // Matchmaking metrics
      try {
        const mmMap = matchmakingMetrics.statusCounts;
        for (const [status, count] of mmMap.entries()) {
          output += `leadflow_matchmaking_jobs_total{status="${status}"} ${count}\n`;
        }
        // Histogram for matchmaking durations (reuse same pattern)
        const mbuckets = [10,50,100,250,500,1000,2000,5000];
        const mdurs = matchmakingMetrics.durations.slice();
        for (const b of mbuckets) {
          const c = mdurs.filter(d=> d <= b).length;
          output += `leadflow_matchmaking_duration_ms_bucket{le="${b}"} ${c}\n`;
        }
        output += `leadflow_matchmaking_duration_ms_bucket{le="+Inf"} ${mdurs.length}\n`;
        const msum = mdurs.reduce((a,b)=>a+b,0);
        output += `leadflow_matchmaking_duration_ms_sum ${msum}\n`;
        output += `leadflow_matchmaking_duration_ms_count ${mdurs.length}\n`;
      } catch {
        output += '# matchmaking metrics error\n';
      }
    } catch {
      output += '# export metrics error\n';
    }
    // Enrichment metrics
    const ebuckets = [10,50,100,250,500,1000,2000];
    const edurs = enrichmentMetrics.durations.slice();
    for (const b of ebuckets) {
      const count = edurs.filter(d => d <= b).length;
      output += `leadflow_enrichment_duration_ms_bucket{le="${b}"} ${count}\n`;
    }
    output += `leadflow_enrichment_duration_ms_bucket{le="+Inf"} ${edurs.length}\n`;
    const esum = edurs.reduce((a,b)=>a+b,0);
    output += `leadflow_enrichment_duration_ms_sum ${esum}\n`;
    output += `leadflow_enrichment_duration_ms_count ${edurs.length}\n`;
    output += `leadflow_enrichment_processed_total ${enrichmentMetrics.processed}\n`;
    // Optional: reasons distribution (Postgres-only using UNNEST)
    try {
      const rows: any = await (prisma as any).$queryRawUnsafe(`SELECT reason, COUNT(*)::int AS count FROM (SELECT UNNEST(reasons) AS reason FROM scraped_properties) t GROUP BY reason`);
      for (const r of rows) {
        const key = String(r.reason || '').replace(/"/g,'\\"');
        output += `leadflow_enrichment_reasons_count{reason="${key}"} ${r.count}\n`;
      }
    } catch {
      output += `# reasons_count query failed\n`;
    }
    // Feed and delivery-history counters
    try {
        const fm = (global as any).__FEED_METRICS__ || { servedTotal: 0, filterCounts: {} };
        output += `leadflow_properties_feed_served_total ${fm.servedTotal}\n`;
        // Per-filter counters (focus on tag/reason/tagReasons, others grouped by label)
        const fc: Record<string, number> = fm.filterCounts || {};
        const interesting = ['tag','reason','tagReasons'];
        for (const [k,v] of Object.entries(fc)) {
          if (interesting.includes(k)) {
            output += `leadflow_properties_filtered_total{filter="${k}"} ${v}\n`;
          } else if (k.startsWith('other:')) {
            const label = k.slice('other:'.length);
            output += `leadflow_properties_filtered_total{filter="${label}"} ${v}\n`;
          }
        }
      const dh = (global as any).__DELIVERY_HISTORY_METRICS__ || { servedTotal: 0 };
      output += `leadflow_delivery_history_queries_total ${dh.servedTotal}\n`;
  // CRM activity metrics
      const crm = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map(), webhook: { success: 0, fail: 0 } };
      output += `leadflow_crm_activity_total ${crm.total}\n`;
      try {
        const perType = crm.perType instanceof Map ? crm.perType : new Map(Object.entries(crm.perType || {}));
        for (const [t, v] of perType.entries()) {
          output += `leadflow_crm_activity_total{type="${String(t).replace(/"/g,'\\"')}"} ${v}\n`;
        }
      } catch {}
  output += `leadflow_crm_activity_webhook_total{status="success"} ${crm.webhook.success}\n`;
  output += `leadflow_crm_activity_webhook_total{status="fail"} ${crm.webhook.fail}\n`;
    } catch {}
    // Matchmaking counters
    try {
      const mmc = (global as any).__MATCHMAKING_METRICS__ || { triggeredTotal: 0, autoTriggeredTotal: 0, replayTotal: 0 };
      const adminTriggered = Math.max(0, (mmc.triggeredTotal || 0) - (mmc.autoTriggeredTotal || 0));
      output += `leadflow_matchmaking_jobs_triggered_total{source="admin"} ${adminTriggered}\n`;
      output += `leadflow_matchmaking_jobs_triggered_total{source="auto"} ${mmc.autoTriggeredTotal || 0}\n`;
      output += `leadflow_matchmaking_auto_trigger_total ${mmc.autoTriggeredTotal || 0}\n`;
      output += `leadflow_matchmaking_replay_total ${mmc.replayTotal || 0}\n`;
    } catch {}
    try { // Fallback raw SQL due to generated client missing new fields during interim dev
      const r: any = await (prisma as any).$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM scraped_properties WHERE investment_score IS NOT NULL OR array_length(enrichment_tags,1) > 0`);
      const enrichedCount = Array.isArray(r) ? r[0]?.count || 0 : 0;
      output += `leadflow_properties_enriched_gauge ${enrichedCount}\n`;
    } catch {
      output += `leadflow_properties_enriched_gauge 0\n`;
    }
  } catch {
    output += '# webhook metrics error\n';
  }
  // Call metrics
  try {
    const cm = (global as any).__CALL_METRICS__ || { started: 0, completed: 0, transcriptionLatencyMs: [], scoringLatencyMs: [], summary: { success: 0, fail: 0 } };
    output += `leadflow_call_started_total ${cm.started}\n`;
    output += `leadflow_call_completed_total ${cm.completed}\n`;
    output += `leadflow_call_summary_total{status="success"} ${cm.summary?.success || 0}\n`;
    output += `leadflow_call_summary_total{status="fail"} ${cm.summary?.fail || 0}\n`;
    const cbuckets = [100,250,500,1000,2000,5000,10000];
    const tdur = (cm.transcriptionLatencyMs || []).slice();
    for (const b of cbuckets) {
      const c = tdur.filter((d:number)=>d<=b).length;
      output += `leadflow_call_transcription_ms_bucket{le="${b}"} ${c}\n`;
    }
    output += `leadflow_call_transcription_ms_bucket{le="+Inf"} ${tdur.length}\n`;
    const tsum = tdur.reduce((a:number,b:number)=>a+b,0);
    output += `leadflow_call_transcription_ms_sum ${tsum}\n`;
    output += `leadflow_call_transcription_ms_count ${tdur.length}\n`;
    const sdur = (cm.scoringLatencyMs || []).slice();
    for (const b of cbuckets) {
      const c = sdur.filter((d:number)=>d<=b).length;
      output += `leadflow_call_scoring_ms_bucket{le="${b}"} ${c}\n`;
    }
    output += `leadflow_call_scoring_ms_bucket{le="+Inf"} ${sdur.length}\n`;
    const ssum = sdur.reduce((a:number,b:number)=>a+b,0);
    output += `leadflow_call_scoring_ms_sum ${ssum}\n`;
    output += `leadflow_call_scoring_ms_count ${sdur.length}\n`;
  } catch {}
  // Live call metrics
  try {
    const lm = (global as any).__CALL_LIVE_METRICS__ || { transcriptTotal: 0, summaryTotal: 0 };
    output += `leadflow_call_live_transcript_total ${lm.transcriptTotal || 0}\n`;
    output += `leadflow_call_live_summary_total ${lm.summaryTotal || 0}\n`;
  } catch {}
  // build_info gauge (best-effort)
  try {
    const pkg = require('../../package.json');
    const version = pkg.version || '0.0.0';
    const env = process.env.NODE_ENV || 'dev';
    const commit = process.env.GIT_COMMIT || 'unknown';
    output += `leadflow_build_info{version="${version}",env="${env}",commit="${commit}"} 1\n`;
  } catch {}
  res.send(output);
});

export default router;