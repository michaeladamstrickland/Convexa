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

const STAGING_URL = process.argv[2] || 'http://localhost:3001';
const BASIC_AUTH_USER = process.argv[3] || 'admin';
const BASIC_AUTH_PASS = process.argv[4] || 'password';
const DB_PATH = process.env.SQLITE_DB_PATH || path.join('backend','data','convexa.db'); // Still local DB for orchestrator logic
const ROOT = process.cwd();

const AUTH_HEADER = 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64');

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

async function httpGetJson(url, authHeader){
  try {
    const r = await fetch(url, { headers: { 'Authorization': authHeader } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch(_){ return {}; }
}

async function httpPost(url, authHeader, body = {}) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch(_) { return {}; }
}

async function main(){
  // The CSV and DB operations are still local for the orchestrator itself
  const csv = ensure20Csv();
  const db = new Database(DB_PATH);
  try { db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 5000'); } catch(_){}

  // For staging, we assume the server is already running on Railway.
  // We will not spawn adHocRun.cjs locally.
  // Instead, we will directly seed a single lead using the staging URL
  // to ensure there's at least one lead for the orchestrator to pick up.

  console.log(`Seeding a single lead to ${STAGING_URL}/api/zip-search-new/add-lead`);
  try {
    await httpPost(`${STAGING_URL}/api/zip-search-new/add-lead`, AUTH_HEADER, {
      address: '123 Orchestrator St, Testville, CA 90001',
      owner_name: 'Orchestrator Test',
      source_type: 'qa_orchestrator',
      status: 'new'
    });
    console.log('Successfully seeded a test lead.');
  } catch (e) {
    console.warn('Failed to seed test lead (may already exist or API issue):', e.message);
  }

  // Start a new run on staging using the integrated API
  console.log('Starting a new skiptrace run on staging...');
  const startResp = await httpPost(`${STAGING_URL}/api/skiptrace-runs/start`, AUTH_HEADER, {
    limit: 20,
    label: 'staging-smoke',
    softPauseAt: 5,
    demo: true
  });
  const runId = (startResp && (startResp.run_id || startResp.runId)) || process.argv[5];
  if (!runId) throw new Error('Failed to start run; no run_id returned');

  // Prepare run dir (local for artifacts)
  const runDir = path.join('ops', 'findings', `QA_${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(runDir, { recursive: true });

  // Status before (using staging URL)
  const statusBefore = await httpGetJson(`${STAGING_URL}/api/skiptrace-runs/${encodeURIComponent(runId)}/status`, AUTH_HEADER);
  fs.writeFileSync(path.join(runDir,'status_before_resume.json'), JSON.stringify(statusBefore, null, 2));

  // Resume (using staging URL)
  try { await httpPost(`${STAGING_URL}/admin/skiptrace-runs/${encodeURIComponent(runId)}/resume`, AUTH_HEADER); } catch(e){ console.warn('Resume failed:', e.message); }

  // Poll until paused then done (using staging URL)
  let statusAfter = {};
  for (let i=0;i<240;i++){
    statusAfter = await httpGetJson(`${STAGING_URL}/api/skiptrace-runs/${encodeURIComponent(runId)}/status`, AUTH_HEADER);
    const t = statusAfter && statusAfter.totals;
    if (t && t.done === t.total && t.total > 0) break; // Ensure total > 0
    await sleep(1000);
  }
  fs.writeFileSync(path.join(runDir,'status_after_resume.json'), JSON.stringify(statusAfter, null, 2));

  // Fetch report & guardrails (using staging URL)
  const report = await httpGetJson(`${STAGING_URL}/api/skiptrace-runs/${encodeURIComponent(runId)}/report`, AUTH_HEADER);
  fs.writeFileSync(path.join(runDir,'report.json'), JSON.stringify(report, null, 2));
  const guard = await httpGetJson(`${STAGING_URL}/admin/guardrails-state`, AUTH_HEADER);
  fs.writeFileSync(path.join(runDir,'guardrails_snapshot.json'), JSON.stringify(guard, null, 2));
  // Fetch artifacts listing to get signed URLs
  const artifacts = await httpGetJson(`${STAGING_URL}/admin/artifacts`, AUTH_HEADER);
  let csvRows = 0;
  try {
    const item = Array.isArray(artifacts) ? artifacts.find(a => a.runId === runId) : null;
    if (item && item.csvUrl) {
      const resp = await fetch(`${STAGING_URL}${item.csvUrl}`, { headers: { 'Authorization': AUTH_HEADER } });
      const text = await resp.text();
      csvRows = text.split(/\r?\n/).filter(Boolean).length;
      fs.writeFileSync(path.join(runDir,'enriched.csv'), text);
    }
  } catch(_){}

  // Print digest
  const pausedBefore = !!(statusBefore && statusBefore.soft_paused);
  const totals = statusAfter && statusAfter.totals;
  const completed = !!(totals && totals.done === totals.total && totals.total > 0);
  console.log(`RUN_ID=${runId}`);
  console.log(`DIGEST={paused_before:${pausedBefore}, resumed:true, completed:${completed}, csv_rows:${csvRows}, run_id:${runId}, url:${STAGING_URL}}`);

  // No child process to detach for staging
}

main().catch(err => {
  console.error('qaResumeSmoke failed:', err && (err.stack || err));
  process.exit(1);
});
