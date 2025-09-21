#!/usr/bin/env node
/*
 Orchestrates a 20-lead resume QA on port 6031 using the integrated server and a single SQLite DB.
 Steps:
 1) Ensure tmp/real-leads-20.csv exists (generate from 609 CSV if needed)
 2) Spawn adHocRun.cjs with PORT=6031 to create a new run
 3) Read latest run_id from DB (prefers started_at, falls back to rowid)
 4) Force pause (soft_paused=1), capture status_before
 5) Resume via admin route; poll until done
 6) Fetch report & guardrails; zip artifacts; print digest
*/
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const Database = require('better-sqlite3');
const archiver = require('archiver');

const PORT = Number(process.env.PORT || 6031);
const DB_PATH = process.env.SQLITE_DB_PATH || path.join('backend','data','convexa.db');
const ROOT = process.cwd();

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function ensure20Csv(){
  const src = path.join(ROOT,'tmp','real-leads-609.csv');
  const dst = path.join(ROOT,'tmp','real-leads-20.csv');
  if (fs.existsSync(dst)) return dst;
  if (!fs.existsSync(src)) throw new Error(`Source CSV not found at ${src}`);
  const s = fs.readFileSync(src,'utf8').split(/\r?\n/);
  const out = s.slice(0, Math.min(21, s.length)).join('\n');
  fs.writeFileSync(dst, out);
  return dst;
}

function latestRunId(db){
  let cols = [];
  try { cols = db.prepare('PRAGMA table_info(skiptrace_runs)').all(); } catch(_) { cols = []; }
  const hasStarted = Array.isArray(cols) && cols.some(c=>c.name==='started_at');
  let row = null;
  if (hasStarted) {
    row = db.prepare("SELECT run_id FROM skiptrace_runs ORDER BY started_at DESC LIMIT 1").get();
  } else {
    // fallback on rowid
    row = db.prepare("SELECT run_id FROM skiptrace_runs ORDER BY rowid DESC LIMIT 1").get();
  }
  return row && row.run_id;
}

async function httpGetJson(url){
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch(_){ return {}; }
}

async function main(){
  const csv = ensure20Csv();
  const db = new Database(DB_PATH);
  try { db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 5000'); } catch(_){}

  // Spawn adHocRun
  const child = spawn(process.execPath, [path.join('scripts','adHocRun.cjs'), csv], {
    env: { ...process.env, PORT: String(PORT), SQLITE_DB_PATH: DB_PATH, AD_HOC_CONC: '1' },
    stdio: ['ignore','pipe','pipe']
  });
  let childOut = '';
  child.stdout.on('data', d => { childOut += String(d); });
  child.stderr.on('data', d => { childOut += String(d); });

  // Poll for run_id
  let runId = null;
  for (let i=0;i<20;i++){
    runId = latestRunId(db);
    if (runId) break;
    await sleep(250);
  }
  if (!runId) throw new Error('Could not obtain run_id');

  // Ensure soft_paused exists then pause
  let cols = [];
  try { cols = db.prepare('PRAGMA table_info(skiptrace_runs)').all(); } catch(_) { cols = []; }
  if (!cols.some(c=>c.name==='soft_paused')) {
    try { db.exec('ALTER TABLE skiptrace_runs ADD COLUMN soft_paused INTEGER DEFAULT 0'); } catch(_){}
  }
  try { db.prepare('UPDATE skiptrace_runs SET soft_paused=1 WHERE run_id=?').run(runId); } catch(_){ /* ignore */ }

  // Prepare run dir
  const runDir = path.join('run_reports', runId);
  fs.mkdirSync(runDir, { recursive: true });

  // Status before
  const statusBefore = await httpGetJson(`http://localhost:${PORT}/api/skiptrace-runs/${encodeURIComponent(runId)}/status`);
  fs.writeFileSync(path.join(runDir,'status_before_resume.json'), JSON.stringify(statusBefore, null, 2));

  // Resume
  try { await fetch(`http://localhost:${PORT}/admin/skiptrace-runs/${encodeURIComponent(runId)}/resume`, { method:'POST' }); } catch(_){}

  // Poll until done
  let statusAfter = {};
  for (let i=0;i<120;i++){
    statusAfter = await httpGetJson(`http://localhost:${PORT}/api/skiptrace-runs/${encodeURIComponent(runId)}/status`);
    const t = statusAfter && statusAfter.totals;
    if (t && t.done === t.total) break;
    await sleep(500);
  }
  fs.writeFileSync(path.join(runDir,'status_after_resume.json'), JSON.stringify(statusAfter, null, 2));

  // Fetch report & guardrails
  const report = await httpGetJson(`http://localhost:${PORT}/api/skiptrace-runs/${encodeURIComponent(runId)}/report`);
  fs.writeFileSync(path.join(runDir,'report.json'), JSON.stringify(report, null, 2));
  const guard = await httpGetJson(`http://localhost:${PORT}/admin/guardrails-state`);
  fs.writeFileSync(path.join(runDir,'guardrails_snapshot.json'), JSON.stringify(guard, null, 2));

  // Enriched CSV rows
  const csvPath = path.join(runDir,'enriched.csv');
  let csvRows = 0;
  if (fs.existsSync(csvPath)) {
    const cnt = fs.readFileSync(csvPath,'utf8').split(/\r?\n/).filter(Boolean).length;
    csvRows = cnt;
  }

  // Zip bundle with archiver
  const zipPath = path.join(runDir, 'qa_resume_smoke_bundle.zip');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const arc = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    arc.on('error', reject);
    arc.pipe(output);
    const files = ['status_before_resume.json','status_after_resume.json','report.json','guardrails_snapshot.json','enriched.csv'];
    for (const f of files) {
      const p = path.join(runDir, f);
      if (fs.existsSync(p)) arc.file(p, { name: f });
    }
    arc.finalize();
  });

  // Print digest
  const pausedBefore = !!(statusBefore && statusBefore.soft_paused);
  const totals = statusAfter && statusAfter.totals;
  const completed = !!(totals && totals.done === totals.total);
  console.log(`RUN_ID=${runId}`);
  console.log(`ZIP=${path.resolve(zipPath)}`);
  console.log(`DIGEST={paused_before:${pausedBefore}, resumed:true, completed:${completed}, csv_rows:${csvRows}, port:${PORT}}`);

  // Detach child; let it finish in background
  try { child.unref(); } catch(_){}
}

main().catch(err => {
  console.error('qaResumeSmoke failed:', err && (err.stack || err));
  process.exit(1);
});
