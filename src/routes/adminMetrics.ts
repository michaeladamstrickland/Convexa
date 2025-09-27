import { Router } from 'express';
import { prisma } from '../db/prisma';
import { enqueueMatchmakingJob } from '../queues/matchmakingQueue';
import { enqueuePropertyEnrichment } from '../utils/enqueueEnrichmentJob';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';
import { convexaImportRowsTotal } from '../server'; // Import the new metric
import csv from 'csv-parser';
import { Readable } from 'stream';

const router = Router();

// ---- CRM Activity Logging ----
const crmMetrics = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, webhook: { success: 0, fail: 0 } };
(global as any).__CRM_ACTIVITY_METRICS__ = crmMetrics;

// POST /api/admin/crm-activity — manual log + optional webhook emit
router.post('/crm-activity', async (req, res) => {
  try {
    const { type, propertyId, leadId, userId, metadata, emitWebhook = true } = req.body || {};
    if (!type) return res.status(400).json({ error: 'missing_type' });
    const p: any = prisma;
    const row = await p.crmActivity.create({ data: { type, propertyId, leadId, userId, metadata } });
    crmMetrics.total++;
    if (emitWebhook) {
      try {
        const subs: any[] = await p.webhookSubscription.findMany({ where: { isActive: true } }).catch(()=>[]);
        const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('crm.activity'));
        if (interested.length) {
          const payload = { id: row.id, type: row.type, propertyId: row.propertyId, leadId: row.leadId, userId: row.userId, metadata: row.metadata, createdAt: row.createdAt };
          await Promise.all(interested.map(s => enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'crm.activity', payload })));
          crmMetrics.webhook.success += interested.length;
        }
      } catch {
        crmMetrics.webhook.fail++;
      }
    }
    return res.status(201).json({ success: true, data: row });
  } catch (e: any) {
    return res.status(500).json({ error: 'crm_activity_create_failed', message: e?.message });
  }
});

// GET /api/admin/crm-activity — cursor pagination
router.get('/crm-activity', async (req, res) => {
  try {
    const { type, propertyId, userId, leadId, 'createdAt[from]': from, 'createdAt[to]': to, limit = '50', cursor, order = 'desc' } = req.query as Record<string,string>;
    const take = Math.min(parseInt(limit)||50, 200);
    const where: any = {};
    if (type) where.type = type;
    if (propertyId) where.propertyId = propertyId;
    if (userId) where.userId = userId;
    if (leadId) where.leadId = leadId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const orderBy = { createdAt: (String(order).toLowerCase() === 'asc' ? 'asc' : 'desc') } as any;
    const p: any = prisma;
    const rows: any[] = await p.crmActivity.findMany({ where, orderBy, take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const nextCursor = rows.length > take ? rows[take].id : null;
    const data = rows.slice(0, take);
    res.json({ data, meta: { nextCursor, pagination: { limit: take } } });
  } catch (e:any) {
    res.status(500).json({ error: 'crm_activity_query_failed', message: e?.message });
  }
});

function parseDate(d?: string): Date | null { if (!d) return null; const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt; }

// GET /api/admin/dashboard-metrics
router.get('/dashboard-metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query as Record<string,string>;
    const end = (parseDate(endDate) || new Date());
    const start = parseDate(startDate) || new Date(end.getTime() - 7*24*60*60*1000);

    // constrain
    const whereJobs: any = { createdAt: { gte: start, lte: end } };

    const p: any = prisma;

    // Aggregate jobs basic counts
    const jobsProcessed = await p.scraperJob.count({ where: whereJobs });

    // listingsScraped & dedupedCount via resultPayload meta (JSON paths -> scan subset) fallback: load limited set
    // To avoid full table scan, project only needed fields with select & timeframe filter
    const recentJobs = await p.scraperJob.findMany({ where: whereJobs, select: { id: true, source: true, resultPayload: true, startedAt: true, finishedAt: true, status: true, error: true } });

    let listingsScraped = 0;
    let dedupedCount = 0;
    let errorCount = 0;
    const perSource: Record<string, { jobs: number; listings: number; durations: number[]; errorCount: number }> = {};

    for (const j of recentJobs as any[]) {
      const meta = j.resultPayload?.meta || {};
      const scr = meta.scrapedCount || meta.totalItems || 0;
      const ded = meta.dedupedCount || 0;
      listingsScraped += scr;
      dedupedCount += ded;
      if (j.status === 'failed' || j.error) errorCount++;
      if (!perSource[j.source]) perSource[j.source] = { jobs: 0, listings: 0, durations: [], errorCount: 0 };
      perSource[j.source].jobs++;
      perSource[j.source].listings += scr;
      const dur = (j.finishedAt && j.startedAt) ? (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) : (meta.scrapeDurationMs || 0);
      if (dur) perSource[j.source].durations.push(dur);
      if (j.status === 'failed') perSource[j.source].errorCount++;
    }

    const avgListingsPerJob = jobsProcessed ? listingsScraped / jobsProcessed : 0;
    // overall avg duration
    let totalDuration = 0; let durationSamples = 0;
    Object.values(perSource).forEach(s => { s.durations.forEach(d=>{ totalDuration+=d; durationSamples++; }); });
    const avgDurationMs = durationSamples ? Math.round(totalDuration / durationSamples) : 0;

    const sources: any = {};
    for (const [src, v] of Object.entries(perSource)) {
      const avgDur = v.durations.length ? Math.round(v.durations.reduce((a,b)=>a+b,0)/v.durations.length) : 0;
      sources[src] = { jobs: v.jobs, listings: v.listings, avgDurationMs: avgDur, errorCount: v.errorCount };
    }

    // top zips by property count in window
    const topZipRows = await p.scrapedProperty.groupBy({
      by: ['zip'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 10
    }).catch(()=>[]);

    const topZips = topZipRows.map((r: any) => ({ zip: r.zip, count: r._count._all }));

    res.json({ jobsProcessed, listingsScraped, dedupedCount, avgListingsPerJob, avgDurationMs, errorCount, sources, topZips });
  } catch (e: any) {
    res.status(500).json({ error: 'dashboard_metrics_failed', message: e?.message });
  }
});

// GET /api/admin/jobs/timeline
router.get('/jobs/timeline', async (req, res) => {
  try {
    const { limit='50', offset='0', sortBy='createdAt' } = req.query as Record<string,string>;
    const take = Math.min(parseInt(limit)||50, 200);
    const skip = parseInt(offset)||0;
    const validSort = ['createdAt','duration','listings'];
    const sortSel = validSort.includes(sortBy) ? sortBy : 'createdAt';

    const p: any = prisma;

    const jobs = await p.scraperJob.findMany({
      orderBy: sortSel === 'createdAt' ? { createdAt: 'desc' } : undefined,
      take, skip,
      select: { id: true, createdAt: true, status: true, source: true, inputPayload: true, resultPayload: true, startedAt: true, finishedAt: true, error: true }
    });

    // compute derived metrics client side (still limited window)
    const mapped = jobs.map((j: any) => {
      const meta = j.resultPayload?.meta || {};
      const durationMs = (j.finishedAt && j.startedAt) ? (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) : (meta.scrapeDurationMs || 0);
      return {
        id: j.id,
        createdAt: j.createdAt,
        status: j.status,
        source: j.source,
        zip: j.inputPayload?.zip || j.inputPayload?.payload?.zip || 'unknown',
        durationMs,
        totalItems: meta.scrapedCount || meta.totalItems || 0,
        dedupedCount: meta.dedupedCount || 0,
        errorsCount: meta.errorsCount || (j.error?1:0)
      };
    });

  if (sortSel === 'duration') mapped.sort((a: any,b: any)=>b.durationMs - a.durationMs);
  else if (sortSel === 'listings') mapped.sort((a: any,b: any)=>b.totalItems - a.totalItems);

    const totalCount = await p.scraperJob.count();
    res.json({ data: mapped, meta: { totalCount, pagination: { limit: take, offset: skip } } });
  } catch (e: any) {
    res.status(500).json({ error: 'jobs_timeline_failed', message: e?.message });
  }
});

// In-memory export metrics (simple counters + durations for histogram)
const exportMetrics = {
  totalJson: 0,
  totalCsv: 0,
  durations: [] as number[],
};

// GET /api/admin/export-leads
router.get('/export-leads', async (req, res) => {
  const started = Date.now();
  try {
  const { format = 'json', source, zip, condition, minScore, tag, tagReasons, limit='100', offset='0', sortBy='createdAt' } = req.query as Record<string,string>;
    const take = Math.min(Math.max(parseInt(limit)||100,1), 1000);
    const skip = parseInt(offset)||0;
    const filtersApplied: Record<string, any> = {};
    const where: any = {};
    if (source) { where.source = source; filtersApplied.source = source; }
    if (zip) { where.zip = zip; filtersApplied.zip = zip; }
    if (condition) { where.condition = condition; filtersApplied.condition = condition; }
    if (minScore) { const ms = parseInt(minScore,10); if (!isNaN(ms)) { where.investmentScore = { gte: ms }; filtersApplied.minScore = ms; } }
    if (tag) { // array contains tag
      where.enrichmentTags = { has: tag };
      filtersApplied.tag = tag;
    }
    if (tagReasons) {
      // Approximate: treat tagReasons tokens as tag names when they match known tags; apply hasEvery for AND semantics
      const tokens = String(tagReasons).split(',').map(s=>s.trim()).filter(Boolean);
      const knownTags = ['high-potential','low-margin','fixer','rental','equity','high-ROI'];
      const mapped = tokens.filter(t => knownTags.includes(t));
      if (mapped.length) {
        where.enrichmentTags = where.enrichmentTags ? { ...where.enrichmentTags, hasEvery: mapped } : { hasEvery: mapped };
      }
      filtersApplied.tagReasons = tokens;
    }
    const sortable = ['createdAt','investmentScore','price'];
    const orderBy = sortable.includes(sortBy) ? { [sortBy]: 'desc' } : { createdAt: 'desc' };

    const p: any = prisma;
    const [rows, totalCount] = await Promise.all([
      p.scrapedProperty.findMany({ where, orderBy, take, skip }),
      p.scrapedProperty.count({ where })
    ]);

    // enforce hard cap
    const MAX_EXPORT = 10000;
    if (totalCount > MAX_EXPORT) {
      return res.status(400).json({ error: 'result_too_large', message: `Result size ${totalCount} exceeds max ${MAX_EXPORT}. Please refine filters.` });
    }

    const serializer = (r: any) => ({
      id: r.id,
      source: r.source,
      zip: r.zip,
      price: r.price,
      beds: r.beds,
      sqft: r.sqft,
      propertyType: r.propertyType,
      investmentScore: r.investmentScore,
      condition: r.condition,
      enrichmentTags: (r.enrichmentTags||[]).join(','),
      reasons: Array.isArray(r.reasons) ? r.reasons.join('|') : '',
      tagReasons: r.tagReasons ? JSON.stringify(r.tagReasons) : '',
      createdAt: r.createdAt
    });

    if (format === 'csv') {
      exportMetrics.totalCsv++;
      const serialized = rows.map(serializer);
      const headers = Object.keys(serialized[0] || {});
      const csvLines = [headers.join(',')];
      for (const row of serialized) {
        csvLines.push(headers.map(h => {
          const val = (row as any)[h];
          if (val == null) return '';
            const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
        }).join(','));
      }
      const csv = csvLines.join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export-leads-${Date.now()}.csv"`);
  console.log(JSON.stringify({ level:'info', component:'export', format:'csv', rows: rows.length, filtersApplied, tag_filter_applied: Boolean(tag || tagReasons), durationMs: Date.now() - started, timestamp: new Date().toISOString() }));
      exportMetrics.durations.push(Date.now() - started);
      return res.status(200).send(csv);
    }
    if (format !== 'json') {
      return res.status(400).json({ error: 'unsupported_format', supported: ['json','csv'] });
    }
    exportMetrics.totalJson++;
    const data = rows.map(serializer);
  console.log(JSON.stringify({ level:'info', component:'export', format:'json', rows: rows.length, filtersApplied, tag_filter_applied: Boolean(tag || tagReasons), durationMs: Date.now() - started, timestamp: new Date().toISOString() }));
    exportMetrics.durations.push(Date.now() - started);
    return res.json({ data, meta: { filtersApplied, totalCount, pagination: { limit: take, offset: skip } } });
  } catch (e: any) {
    return res.status(500).json({ error: 'export_failed', message: e?.message });
  }
});

// POST /api/admin/matchmaking-jobs
router.post('/matchmaking-jobs', async (req, res) => {
  try {
    const filterJSON = req.body?.filterJSON || {};
    const job: any = await (prisma as any).matchmakingJob.create({ data: { filterJSON, status: 'queued' } });
  try { const { matchmakingMetrics } = await import('../workers/matchmakingWorker'); (matchmakingMetrics as any).statusCounts.set('queued', ((matchmakingMetrics as any).statusCounts.get('queued') || 0) + 1); } catch {}
  await enqueueMatchmakingJob(job.id);
    console.log(JSON.stringify({ level:'info', component:'matchmaking', action:'enqueued', matchmakingJobId: job.id, filterPreview: filterJSON, timestamp: new Date().toISOString() }));
  // metrics
  (global as any).__MATCHMAKING_METRICS__ = (global as any).__MATCHMAKING_METRICS__ || { triggeredTotal: 0, autoTriggeredTotal: 0, replayTotal: 0 };
  (global as any).__MATCHMAKING_METRICS__.triggeredTotal++;
    res.status(201).json({ success: true, jobId: job.id });
  } catch (e: any) {
    res.status(500).json({ success:false, error: 'matchmaking_enqueue_failed', message: e?.message });
  }
});

// POST /api/admin/enrich/:propertyId
router.post('/enrich/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params as { propertyId: string };
    if (!propertyId) return res.status(400).json({ success: false, error: 'missing_property_id' });
    const prop = await (prisma as any).scrapedProperty.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!prop) return res.status(404).json({ success: false, error: 'property_not_found' });
    await enqueuePropertyEnrichment(propertyId);
    console.log(JSON.stringify({ level:'info', component:'enrichment', action:'enqueued_manual', propertyId, timestamp: new Date().toISOString() }));
    return res.status(202).json({ success: true, enqueued: true, propertyId });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'enrichment_enqueue_failed', message: e?.message });
  }
});

// GET /api/admin/matchmaking-jobs
router.get('/matchmaking-jobs', async (req, res) => {
  try {
    const { status, propertyId, source, 'createdAt[from]': from, 'createdAt[to]': to, limit='50', offset='0' } = req.query as Record<string,string>;
    const take = Math.min(parseInt(limit)||50, 200);
    const skip = parseInt(offset)||0;
    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    // Filter by propertyId/source if encoded in filterJSON
    if (propertyId || source) {
      // naive: fetch and filter in memory due to JSON path limitations in some Prisma versions
      const rows = await (prisma as any).matchmakingJob.findMany({ orderBy: { createdAt: 'desc' }, take, skip });
      const filtered = rows.filter((r:any)=>{
        try { const f = r.filterJSON || {}; return (!propertyId || f.propertyId===propertyId) && (!source || f.source===source); } catch { return true; }
      });
      const total = await (prisma as any).matchmakingJob.count({});
      return res.json({ data: filtered, meta: { totalCount: total, pagination: { limit: take, offset: skip } } });
    }
    const [rows, total] = await Promise.all([
      (prisma as any).matchmakingJob.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      (prisma as any).matchmakingJob.count({ where })
    ]);
    res.json({ data: rows, meta: { totalCount: total, pagination: { limit: take, offset: skip } } });
  } catch (e:any) {
    res.status(500).json({ error:'matchmaking_list_failed', message: e?.message });
  }
});

// GET /api/admin/trigger-500-error - for testing alerts
router.get('/trigger-500-error', (req, res) => {
  throw new Error('Test 500 error triggered by admin endpoint');
});

// POST /api/admin/import/csv - for testing import metrics
router.post('/import/csv', async (req, res) => {
  if (!req.body || typeof req.body !== 'string') {
    return res.status(400).json({ error: 'missing_csv_data' });
  }

  let rowsProcessed = 0;
  const stream = Readable.from([req.body]);

  stream.pipe(csv())
    .on('data', (row) => {
      rowsProcessed++;
      convexaImportRowsTotal.inc({ result: 'success' }); // Increment for each row
    })
    .on('end', () => {
      res.json({ success: true, message: `Processed ${rowsProcessed} rows.`, rowsProcessed });
    })
    .on('error', (err) => {
      convexaImportRowsTotal.inc({ result: 'failure' });
      res.status(500).json({ error: 'csv_processing_failed', message: err.message });
    });
});

// POST /api/admin/matchmaking-jobs/:id/replay
router.post('/matchmaking-jobs/:id/replay', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const mm = await (prisma as any).matchmakingJob.findUnique({ where: { id } });
    if (!mm) return res.status(404).json({ error: 'not_found' });
    // Requeue
    await (prisma as any).matchmakingJob.update({ where: { id }, data: { status: 'queued', completedAt: null } });
    await enqueueMatchmakingJob(id);
    (global as any).__MATCHMAKING_METRICS__ = (global as any).__MATCHMAKING_METRICS__ || { triggeredTotal: 0, autoTriggeredTotal: 0, replayTotal: 0 };
    (global as any).__MATCHMAKING_METRICS__.replayTotal++;
    res.json({ success: true, replayed: true, id });
  } catch (e:any) {
    res.status(500).json({ error: 'matchmaking_replay_failed', message: e?.message });
  }
});

// GET /api/admin/delivery-history
// Filters: subscriptionId, eventType, status, propertyId (from payload if present)
// Sorting: createdAt desc (default)
router.get('/delivery-history', async (req, res) => {
  try {
    const { subscriptionId, eventType, status, propertyId, targetUrl, limit = '50', offset = '0', sortBy = 'createdAt' } = req.query as Record<string,string>;
    const take = Math.min(parseInt(limit)||50, 200);
    const skip = parseInt(offset)||0;
    const where: any = {};
    const filtersApplied: Record<string, any> = {};
    if (subscriptionId) { where.subscriptionId = subscriptionId; filtersApplied.subscriptionId = subscriptionId; }
    if (eventType) { where.eventType = eventType; filtersApplied.eventType = eventType; }
    if (status) { where.status = status; filtersApplied.status = status; }
    if (targetUrl) {
      // Map targetUrl to subscription ids and filter
      const subs = await (prisma as any).webhookSubscription.findMany({ where: { targetUrl } }).catch(()=>[]);
      const ids = subs.map((s:any)=>s.id);
      if (ids.length === 0) return res.json({ data: [], meta: { totalCount: 0, filtersApplied: { ...filtersApplied, targetUrl }, pagination: { limit: take, offset: skip }, sortBy: 'createdAt' } });
      where.subscriptionId = { in: ids };
      filtersApplied.targetUrl = targetUrl;
    }
    // propertyId filter: best effort by scanning recent failures with payload or logs with jobId mapping (if present)
    // Here, extend to search DeliveryLog where payload contained propertyId serialized in a separate table is not available; skip if unsupported.
    const orderBy = { createdAt: 'desc' as const };
    const p: any = prisma;
    // Wire details fields needed by UI: include jobId, attemptsMade, timestamps
  const [rows, total] = await Promise.all([
      p.webhookDeliveryLog.findMany({ where, orderBy, take, skip }).catch(()=>[]),
      p.webhookDeliveryLog.count({ where }).catch(()=>0)
    ]);
    // Try to enrich with subscription targets
    const subIds = Array.from(new Set(rows.map((r:any)=>r.subscriptionId)));
    const subs = await p.webhookSubscription.findMany({ where: { id: { in: subIds } }, select: { id: true, targetUrl: true } }).catch(()=>[]);
    const subMap = new Map(subs.map((s:any)=>[s.id, s.targetUrl]));
    const data = rows.map((r:any)=>({
      id: r.id,
      subscriptionId: r.subscriptionId,
      eventType: r.eventType,
      status: r.status,
      attempts: r.attemptsMade,
      jobId: r.jobId,
      lastAttemptAt: r.lastAttemptAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      targetUrl: subMap.get(r.subscriptionId) || null,
      headers: { 'X-Webhook-Id': r.jobId, 'X-Event-Type': r.eventType },
      timestamp: r.createdAt,
    }));
  // increment metric
  try { ((global as any).__DELIVERY_HISTORY_METRICS__ = (global as any).__DELIVERY_HISTORY_METRICS__ || { servedTotal: 0 }).servedTotal++; } catch {}
  res.json({ data, meta: { totalCount: total, filtersApplied, pagination: { limit: take, offset: skip, nextOffset: Math.min(total, skip + data.length) }, sortBy: 'createdAt' } });
  } catch (e:any) {
    res.status(500).json({ error: 'delivery_history_failed', message: e?.message });
  }
});


// Expose metrics reference for devQueueRoutes metrics endpoint to scrape
(global as any).__EXPORT_METRICS__ = exportMetrics;

export default router;
