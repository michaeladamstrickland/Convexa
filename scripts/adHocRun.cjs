#!/usr/bin/env node
// Minimal ad-hoc batch runner that seeds skiptrace_runs/items, processes, and writes a report

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const { pathToFileURL } = require('url');

function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then((v) => { active--; resolve(v); next(); }).catch((e) => { active--; reject(e); next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

function parseCsvLine(line) {
  // naive CSV: LeadID,Address,Owner (no embedded commas)
  const parts = line.split(',').map(s => s.trim());
  const LeadID = parts[0];
  const Address = parts[1];
  const Owner = parts[2] || '';
  return [LeadID, Address, Owner];
}

(async () => {
  try {
    const CSV = process.argv[2];
    if (!CSV) {
      console.error('Usage: node scripts/adHocRun.cjs ./data/leads.csv');
      process.exit(1);
    }
  const PORT = process.env.PORT || 6001;
  const DIRECT = String(process.env.AD_HOC_DIRECT || '').toLowerCase() === 'true';
    const conc = Number(process.env.AD_HOC_CONC || 4);
    const runId = uuidv4();
    const dbPath = process.env.SQLITE_DB_PATH || path.join('backend','data','convexa.db');
    const db = new Database(dbPath);

    // Helper: dynamic import of ESM normalization to compute idem_key consistently
    async function importNormalization() {
      const modUrl = pathToFileURL(path.join(process.cwd(), 'backend', 'utils', 'normalization.js')).href;
      return await import(modUrl);
    }

    const raw = fs.readFileSync(CSV, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const header = lines[0];
    const rows = lines.slice(1); // assume header exists

    // Ensure tables exist (create minimal if missing)
    db.exec(`CREATE TABLE IF NOT EXISTS skiptrace_runs (
      run_id TEXT PRIMARY KEY,
      source_label TEXT,
      started_at DATETIME,
      finished_at DATETIME,
      total INTEGER DEFAULT 0,
      queued INTEGER DEFAULT 0,
      in_flight INTEGER DEFAULT 0,
      done INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      soft_paused INTEGER DEFAULT 0
    );`);
    db.exec(`CREATE TABLE IF NOT EXISTS skiptrace_run_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt INTEGER DEFAULT 0,
      idem_key TEXT,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );`);
      // Introspect skiptrace_run_items columns for schema tolerance
      let sriCols = [];
      try { sriCols = db.prepare(`PRAGMA table_info(skiptrace_run_items)`).all(); } catch (_) { sriCols = []; }
      const sriHas = (c) => Array.isArray(sriCols) && sriCols.some(x => x.name === c);

    // Dynamic insert into skiptrace_runs based on existing columns (schema-tolerant)
    let runCols = [];
    try { runCols = db.prepare(`PRAGMA table_info(skiptrace_runs)`).all(); } catch (_) { runCols = []; }
    const runColSet = new Set(Array.isArray(runCols) ? runCols.map(c => c.name) : []);
    // If soft_paused is missing, add it to enable pause/resume QA
    if (!runColSet.has('soft_paused')) {
      try { db.exec('ALTER TABLE skiptrace_runs ADD COLUMN soft_paused INTEGER DEFAULT 0'); runColSet.add('soft_paused'); } catch (_) {}
    }
    const runFieldMap = {
      run_id: runId,
      source_label: path.basename(CSV),
      total: rows.length,
      queued: rows.length,
      started_at: new Date().toISOString(),
      soft_paused: 0
    };
    const insertCols = [];
    const insertVals = [];
    for (const [k, v] of Object.entries(runFieldMap)) {
      if (runColSet.has(k)) { insertCols.push(k); insertVals.push(v); }
    }
    if (insertCols.length === 0) {
      throw new Error('skiptrace_runs has no expected columns to insert');
    }
    const placeholders = insertCols.map(() => '?').join(',');
    const insertSql = `INSERT INTO skiptrace_runs (${insertCols.join(',')}) VALUES (${placeholders})`;
    db.prepare(insertSql).run(...insertVals);

  // (old insItem definition removed in favor of dynamic builder below)
    // Dynamic insert for run items; include attempt only if present
    const itemCols = ['run_id','lead_id','status'];
    if (sriHas('attempt')) itemCols.push('attempt');
    if (sriHas('idem_key')) itemCols.push('idem_key');
    if (sriHas('last_error')) itemCols.push('last_error');
    const itemPlaceholders = itemCols.map(() => '?').join(',');
    const insItem = db.prepare(`INSERT INTO skiptrace_run_items (${itemCols.join(',')}) VALUES (${itemPlaceholders})`);
    const upsertLead = (leadId, address, owner) => {
      const row = db.prepare(`SELECT id FROM leads WHERE id = ?`).get(leadId);
      if (row) return;
      const now = new Date().toISOString();
      db.exec(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        owner_name TEXT,
        source_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        skip_trace_cache_until DATETIME,
        phones_count INTEGER DEFAULT 0,
        emails_count INTEGER DEFAULT 0,
        has_dnc INTEGER DEFAULT 0
      );`);
      db.prepare(`INSERT OR REPLACE INTO leads (id,address,owner_name,source_type,created_at,updated_at)
                  VALUES (?,?,?,?,?,?)`).run(leadId, address || '', owner || '', 'batch', now, now);
    };
    for (const line of rows) {
      const [LeadID, Address, Owner] = parseCsvLine(line);
      if (LeadID) {
        upsertLead(LeadID, Address, Owner);
    const vals = [runId, LeadID, 'queued'];
    if (sriHas('attempt')) vals.push(0);
    if (sriHas('idem_key')) vals.push('');
    if (sriHas('last_error')) vals.push(null);
    insItem.run(...vals);
      }
    }

  const limit = pLimit(conc);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let done = 0, failed = 0;

    const { buildSignatures } = await importNormalization();
    const nowIso = () => new Date().toISOString();

    const runHas = (c) => runColSet.has(c);
    await Promise.all(rows.map((line) => limit(async () => {
      const [LeadID] = parseCsvLine(line);
      if (!LeadID) return;
      // Respect soft_paused: do not dequeue when paused
      for (;;) {
        let isPaused = false;
        try {
          if (runHas('soft_paused')) {
            const paused = db.prepare(`SELECT soft_paused AS s FROM skiptrace_runs WHERE run_id = ?`).get(runId);
            isPaused = !!(paused && paused.s);
          }
        } catch (_) { isPaused = false; }
        if (!isPaused) break;
        await sleep(1000);
      }
      // Compute idem_key from normalized signature (primary)
      let idemKey = '';
      try {
        const leadRow = db.prepare(`SELECT id, address, owner_name FROM leads WHERE id = ?`).get(LeadID);
        if (leadRow) {
          const addrParts = String(leadRow.address || '').split(',').map(s => s.trim());
          let street = addrParts[0] || '';
          let city = addrParts[1] || '';
          let state = '';
          let zip = '';
          if (addrParts.length >= 3) {
            const m = (addrParts[2] || '').match(/([A-Z]{2})\s*(\d{5})(?:-\d{4})?/i);
            if (m) { state = (m[1]||'').toUpperCase(); zip = m[2] || ''; }
          }
          const [first, ...rest] = String(leadRow.owner_name || '').trim().split(/\s+/);
          const last = rest.length ? rest[rest.length-1] : '';
          const sigs = buildSignatures({ street, city, state, zip, first, last });
          idemKey = sigs.primary;
        }
      } catch (_) {}
      // Use a dedicated connection and keep DB locks minimal: commit before network call
      const dbx = new Database(dbPath);
      try { dbx.pragma('busy_timeout = 5000'); dbx.pragma('journal_mode = WAL'); } catch (_) {}
      // Mark in_flight in a very short transaction
      try {
        dbx.prepare('BEGIN IMMEDIATE').run();
          // Build dynamic UPDATE for in_flight
          const sets = ["status='in_flight'"];
          const vals2 = [];
          if (sriHas('attempt')) sets.push('attempt=attempt+1');
          if (sriHas('idem_key')) { sets.push('idem_key=?'); vals2.push(idemKey); }
    if (sriHas('updated_at')) { sets.push('updated_at=?'); vals2.push(nowIso()); }
          const sql = `UPDATE skiptrace_run_items SET ${sets.join(', ')} WHERE run_id=? AND lead_id=?`;
          vals2.push(runId, LeadID);
          dbx.prepare(sql).run(...vals2);
        dbx.prepare('COMMIT').run();
      } catch (txErr) {
        try { dbx.prepare('ROLLBACK').run(); } catch (_) {}
        throw txErr; // propagate to outer catch to record failure
      }

      let j;
      if (DIRECT) {
        // Call service in-process to avoid HTTP/server dependency
        try {
          const { default: SkipTraceService } = await import(pathToFileURL(path.join(process.cwd(), 'backend', 'services', 'skipTraceService.js')).href);
          const { initGuardrails } = await import(pathToFileURL(path.join(process.cwd(), 'infra', 'guardrails.js')).href);
          // Reuse the main db connection for service
          initGuardrails(db);
          const svc = new SkipTraceService(db);
          const r = await svc.skipTraceLeadById(LeadID, { forceRefresh: false, provider: 'batchdata', useFallback: false, maxRetries: 0, runId });
          j = { success: r && r.success, error: r && r.error };
        } catch (e) {
          j = { success: false, error: String(e && (e.message || e) || 'direct error') };
        }
      } else {
        try {
          const forceQ = 'false';
          const fallbackQ = 'false';
          const r = await fetch(`http://localhost:${PORT}/api/leads/${encodeURIComponent(LeadID)}/skiptrace?force=${forceQ}&fallback=${fallbackQ}&runId=${encodeURIComponent(runId)}`, { method: 'POST' });
          j = await r.json();
        } catch (netErr) {
          j = { success: false, error: String(netErr && (netErr.message || netErr) || 'network error') };
        }
      }

      // Apply outcome in a fresh short transaction
      try {
        dbx.prepare('BEGIN IMMEDIATE').run();
        if (j && j.success) {
          // done update
          const setsD = ["status='done'"]; const valsD = [];
          if (sriHas('last_error')) { setsD.push('last_error=NULL'); }
          if (sriHas('updated_at')) { setsD.push('updated_at=?'); valsD.push(nowIso()); }
          const sqlD = `UPDATE skiptrace_run_items SET ${setsD.join(', ')} WHERE run_id=? AND lead_id=?`;
          valsD.push(runId, LeadID);
          dbx.prepare(sqlD).run(...valsD);
          done++;
        } else if (j && /BudgetPause/i.test(String(j.error||''))) {
          // Set run to soft_paused, requeue this item, and back off
          if (runHas('soft_paused')) {
            dbx.prepare(`UPDATE skiptrace_runs SET soft_paused=1 WHERE run_id=?`).run(runId);
          }
          dbx.prepare(`UPDATE skiptrace_run_items SET status='queued', updated_at=? WHERE run_id=? AND lead_id=?`).run(nowIso(), runId, LeadID);
          // Wait until resume outside the transaction to avoid locks
        } else {
          const setsF = ["status='failed'"];
          const valsF = [];
          if (sriHas('last_error')) { setsF.push('last_error=?'); valsF.push(String(j && (j.error||j.message) || 'unknown')); }
          if (sriHas('updated_at')) { setsF.push('updated_at=?'); valsF.push(nowIso()); }
          const sqlF = `UPDATE skiptrace_run_items SET ${setsF.join(', ')} WHERE run_id=? AND lead_id=?`;
          valsF.push(runId, LeadID);
          dbx.prepare(sqlF).run(...valsF);
          failed++;
        }
        dbx.prepare('COMMIT').run();
      } catch (tx2Err) {
        try { dbx.prepare('ROLLBACK').run(); } catch (_) {}
        // Best-effort: count as failed
        failed++;
      }

      // If we paused, now poll for resume (no transaction held while sleeping)
      if (j && /BudgetPause/i.test(String(j.error||''))) {
        for (;;) {
          const paused = db.prepare(`SELECT soft_paused AS s FROM skiptrace_runs WHERE run_id = ?`).get(runId);
          if (!paused || !paused.s) break;
          await sleep(2000);
        }
      }

      try { dbx.close(); } catch (_) {}
    })));

    // Schema-tolerant update of run completion fields
    try {
      let runCols2 = [];
      try { runCols2 = db.prepare(`PRAGMA table_info(skiptrace_runs)`).all(); } catch (_) { runCols2 = []; }
      const has = (c) => Array.isArray(runCols2) && runCols2.some(x => x.name === c);
      const sets = [];
      const vals = [];
      if (has('done')) { sets.push('done=?'); vals.push(done); }
      if (has('failed')) { sets.push('failed=?'); vals.push(failed); }
      if (has('queued')) { sets.push('queued=?'); vals.push(0); }
      if (has('finished_at')) { sets.push("finished_at=datetime('now')"); }
      if (sets.length > 0) {
        const sql = `UPDATE skiptrace_runs SET ${sets.join(', ')} WHERE run_id=?`;
        vals.push(runId);
        db.prepare(sql).run(...vals);
      }
    } catch (_) {}
    // Write enriched CSV (dialer-ready columns with provenance)
    const outDir = path.join('run_reports', runId);
    fs.mkdirSync(outDir, { recursive: true });
    const csvPath = path.join(outDir, 'enriched.csv');
    const out = [];
    out.push(['LeadID','Address','Owner','Phone1','Phone2','Phone3','Email1','Email2','Email3','PhonesCount','EmailsCount','HasDNC','Provider','Cached'].join(','));
    // Determine the identifier column in skiptrace_run_items: lead_id | item_id | leadId
    let sriCols2 = [];
    try { sriCols2 = db.prepare('PRAGMA table_info(skiptrace_run_items)').all(); } catch (_) { sriCols2 = []; }
    const cols2Set = new Set(Array.isArray(sriCols2) ? sriCols2.map(c => c.name) : []);
    const sriLeadCol = cols2Set.has('lead_id') ? 'lead_id' : (cols2Set.has('item_id') ? 'item_id' : (cols2Set.has('leadId') ? 'leadId' : null));
    // Fallback: if no recognizable column, select by run_id from run items and then join via heuristics
    let rowsOut = [];
    if (sriLeadCol) {
      const sql = `SELECT l.id as lead_id, l.address, l.owner_name FROM leads l WHERE l.id IN (SELECT ${sriLeadCol} FROM skiptrace_run_items WHERE run_id = ?)`;
      try { rowsOut = db.prepare(sql).all(runId); } catch (_) { rowsOut = []; }
    } else {
      // No usable lead reference; fallback to all leads created recently
      try {
        rowsOut = db.prepare(`SELECT id as lead_id, address, owner_name FROM leads ORDER BY created_at DESC LIMIT 20`).all();
      } catch (_) { rowsOut = []; }
    }
    // Check optional columns on leads
    let leadsCols = [];
    try { leadsCols = db.prepare('PRAGMA table_info(leads)').all(); } catch (_) { leadsCols = []; }
    const leadsHas = (c) => Array.isArray(leadsCols) && leadsCols.some(x => x.name === c);
    // Prepare phone/email queries if tables and columns exist
    const hasTable = (name) => {
      try { return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name); } catch (_) { return false; }
    };
    const pnTable = hasTable('phone_numbers');
    let pnCols = [];
    if (pnTable) { try { pnCols = db.prepare('PRAGMA table_info(phone_numbers)').all(); } catch (_) { pnCols = []; } }
    const pnLeadCol = pnCols.some(c => c.name === 'lead_id') ? 'lead_id' : (pnCols.some(c => c.name === 'leadId') ? 'leadId' : null);
    const pnNumCol = pnCols.some(c => c.name === 'phone_number') ? 'phone_number' : (pnCols.some(c => c.name === 'phone') ? 'phone' : null);
    const qPhones = pnTable && pnLeadCol && pnNumCol
      ? db.prepare(`SELECT ${pnNumCol} as phone_number FROM phone_numbers WHERE ${pnLeadCol} = ? ORDER BY is_primary DESC, confidence DESC LIMIT 3`)
      : null;

    const emTable = hasTable('email_addresses');
    let emCols = [];
    if (emTable) { try { emCols = db.prepare('PRAGMA table_info(email_addresses)').all(); } catch (_) { emCols = []; } }
    const emLeadCol = emCols.some(c => c.name === 'lead_id') ? 'lead_id' : (emCols.some(c => c.name === 'leadId') ? 'leadId' : null);
    const emAddrCol = emCols.some(c => c.name === 'email_address') ? 'email_address' : (emCols.some(c => c.name === 'email') ? 'email' : null);
    const qEmails = emTable && emLeadCol && emAddrCol
      ? db.prepare(`SELECT ${emAddrCol} as email_address FROM email_addresses WHERE ${emLeadCol} = ? ORDER BY is_primary DESC, confidence DESC LIMIT 3`)
      : null;
    // Determine if 'cached' column exists in skip_trace_logs
    let stlCols = [];
    try { stlCols = db.prepare('PRAGMA table_info(skip_trace_logs)').all(); } catch (_) { stlCols = []; }
    const stlHas = (c) => Array.isArray(stlCols) && stlCols.some(x => x.name === c);
    const stlLeadCol = stlCols.some(c => c.name === 'lead_id') ? 'lead_id' : (stlCols.some(c => c.name === 'leadId') ? 'leadId' : null);
    const qProv = stlLeadCol ? (
      stlHas('cached')
        ? db.prepare(`SELECT provider, cached FROM skip_trace_logs WHERE ${stlLeadCol} = ? ORDER BY id DESC LIMIT 1`)
        : db.prepare(`SELECT provider FROM skip_trace_logs WHERE ${stlLeadCol} = ? ORDER BY id DESC LIMIT 1`)
    ) : null;
    for (const r of rowsOut) {
  const phones = qPhones ? qPhones.all(r.lead_id).map(row => row.phone_number) : [];
  const emails = qEmails ? qEmails.all(r.lead_id).map(row => row.email_address) : [];
  const provRow = qProv ? (qProv.get(r.lead_id) || {}) : {};
  const prov = { provider: provRow.provider || '', cached: stlHas('cached') ? (provRow.cached ? 1 : 0) : 0 };
      const phonesCount = leadsHas('phones_count') ? (db.prepare('SELECT phones_count as c FROM leads WHERE id = ?').get(r.lead_id)?.c || phones.length) : phones.length;
      const emailsCount = leadsHas('emails_count') ? (db.prepare('SELECT emails_count as c FROM leads WHERE id = ?').get(r.lead_id)?.c || emails.length) : emails.length;
      const hasDnc = leadsHas('has_dnc') ? (db.prepare('SELECT has_dnc as d FROM leads WHERE id = ?').get(r.lead_id)?.d || 0) : 0;
      out.push([
        r.lead_id,
        r.address || '',
        r.owner_name || '',
        phones[0] || '', phones[1] || '', phones[2] || '',
        emails[0] || '', emails[1] || '', emails[2] || '',
        phonesCount || 0,
        emailsCount || 0,
        hasDnc || 0,
        prov.provider || '',
        prov.cached ? 1 : 0
      ].join(','));
    }
    fs.writeFileSync(csvPath, out.join('\n'));

    db.close();

  const repRes = await fetch(`http://localhost:${PORT}/api/skiptrace-runs/${runId}/report`).catch(() => ({ ok:false, json: async()=>({}) }));
    const rep = await repRes.json();
    console.log('Run ID:', runId);
    console.log('Report written to:', path.join('run_reports', runId, 'report.json'));
    console.log('Totals:', rep && rep.totals);
    console.log('Hit rate:', rep && rep.hit_rate);
  } catch (e) {
    console.error('adHocRun failed:', e && e.stack || e);
    process.exit(1);
  }
})();
