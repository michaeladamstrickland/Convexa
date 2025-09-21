import fs from 'fs';
import path from 'path';

export function generateRunReport(db, runId) {
  // db is a better-sqlite3 Database instance
  const meta = db.prepare(`
    SELECT run_id, source_label, started_at, finished_at,
           total, queued, in_flight, done, failed, soft_paused
    FROM skiptrace_runs WHERE run_id = ?
  `).get(runId);
  if (!meta) {
    const err = new Error(`Run not found: ${runId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Detect schema: cost_cents may not exist on older DBs; fall back to SUM(cost)
  let hasCostCents = false;
  try {
    const cols = db.prepare(`PRAGMA table_info(provider_calls)`).all();
    hasCostCents = Array.isArray(cols) && cols.some(c => String(c.name) === 'cost_cents');
  } catch (_) { /* ignore and assume legacy */ }

  let totals;
  if (hasCostCents) {
    totals = db.prepare(`
      SELECT COUNT(*) as provider_calls, IFNULL(SUM(cost_cents),0) as cost_cents
      FROM provider_calls WHERE run_id = ?
    `).get(runId) || { provider_calls: 0, cost_cents: 0 };
  } else {
    const t = db.prepare(`
      SELECT COUNT(*) as provider_calls, IFNULL(SUM(cost),0) as cost_usd
      FROM provider_calls WHERE run_id = ?
    `).get(runId) || { provider_calls: 0, cost_usd: 0 };
    totals = { provider_calls: t.provider_calls || 0, cost_cents: Math.round(100 * (t.cost_usd || 0)) };
  }

  const doneRow = db.prepare(`SELECT done FROM skiptrace_runs WHERE run_id = ?`).get(runId) || { done: 0 };
  const cache_hits = Math.max((doneRow.done || 0) - (totals.provider_calls || 0), 0);
  const cache_hit_ratio = (doneRow.done || 0) > 0 ? cache_hits / doneRow.done : 0;

  const hits = db.prepare(`
    SELECT
      SUM(CASE WHEN EXISTS (SELECT 1 FROM phone_numbers p WHERE p.lead_id = i.lead_id) THEN 1 ELSE 0 END) as phone_hits,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM email_addresses e WHERE e.lead_id = i.lead_id) THEN 1 ELSE 0 END) as email_hits,
      COUNT(*) as total_items
    FROM skiptrace_run_items i WHERE i.run_id = ? AND i.status = 'done'
  `).get(runId) || { phone_hits: 0, email_hits: 0, total_items: 0 };

  const errors = db.prepare(`
    SELECT COALESCE(last_error,'') as reason, COUNT(*) as count
    FROM skiptrace_run_items
    WHERE run_id = ? AND status = 'failed'
    GROUP BY reason ORDER BY count DESC LIMIT 10
  `).all(runId);

  const sampleEnriched = db.prepare(`
    SELECT i.lead_id
    FROM skiptrace_run_items i
    WHERE i.run_id = ? AND i.status='done'
    LIMIT 3
  `).all(runId);

  const sampleFailed = db.prepare(`
    SELECT i.lead_id, i.last_error
    FROM skiptrace_run_items i
    WHERE i.run_id = ? AND i.status='failed'
    LIMIT 3
  `).all(runId);

  const started = meta?.started_at ? new Date(meta.started_at) : null;
  const finished = meta?.finished_at ? new Date(meta.finished_at) : null;
  const duration_s = (started && finished) ? Math.round((finished - started) / 1000) : null;

  const report = {
    run_id: runId,
    source_label: meta?.source_label || '',
    started_at: meta?.started_at || null,
    finished_at: meta?.finished_at || null,
    duration_s,
    totals: {
      total: meta?.total || 0,
      done: meta?.done || 0,
      failed: meta?.failed || 0,
      cached_hits: cache_hits,
      provider_calls: totals?.provider_calls || 0,
      cost_usd: Number(((totals?.cost_cents || 0) / 100).toFixed(2))
    },
    hit_rate: {
      phone_any_pct: (hits?.total_items || 0) ? Number((100 * (hits.phone_hits || 0) / hits.total_items).toFixed(1)) : 0,
      email_any_pct: (hits?.total_items || 0) ? Number((100 * (hits.email_hits || 0) / hits.total_items).toFixed(1)) : 0
    },
    cache_hit_ratio: Number(cache_hit_ratio.toFixed(2)),
    budgets: {
      daily_cap_usd: Number(process.env.SKIP_TRACE_DAILY_BUDGET_USD || 0),
      spent_usd: Number(((totals?.cost_cents || 0) / 100).toFixed(2)),
      soft_paused: !!meta?.soft_paused
    },
    errors,
    samples: {
      enriched: sampleEnriched,
      failed: sampleFailed
    }
  };

  // Persist artifact
  const dir = path.join('run_reports', runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}
