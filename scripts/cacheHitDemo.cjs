#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');
let BetterSqlite3 = null;
try { BetterSqlite3 = require('better-sqlite3'); } catch (_) { BetterSqlite3 = null; }
const sqlite3 = require('sqlite3');

async function main() {
  const port = Number(process.env.PORT || 6017);
  const dbPath = process.env.SQLITE_DB_PATH || path.join('backend','prisma','dev.db');
  const base = process.env.API_BASE || `http://127.0.0.1:${port}`;
  const http = axios.create({ baseURL: base, proxy: false, timeout: 15000 });
  const outPath = 'qa_cache_hit_receipt.json';
  // Create a fresh lead (tolerate 400 if address already exists)
  const add = await http.post(`/api/zip-search-new/add-lead`, {
    address: '301 Cache St, Collingswood, NJ 08108',
    owner_name: 'Cache Proof',
    source_type: 'qa'
  }, { validateStatus: () => true });
  let leadId = null;
  if (add.status === 200 && add.data && add.data.leadId) {
    leadId = add.data.leadId;
  } else if (add.status === 400 && add.data && add.data.existingId) {
    leadId = add.data.existingId;
  } else {
    throw new Error(`add-lead failed: status ${add.status}`);
  }
  // First call forced (bypass cache)
  const first = await http.post(`/api/leads/${encodeURIComponent(leadId)}/skiptrace?force=true`);
  // Count provider_calls
  // Query provider_calls count with either better-sqlite3 or sqlite3 fallback
  const countSql = 'SELECT COUNT(*) AS c FROM provider_calls WHERE lead_id = ?';
  async function countCalls(id) {
    if (BetterSqlite3) {
      try {
        const db = new BetterSqlite3(dbPath);
        const c = db.prepare(countSql).get(id)?.c || 0;
        db.close();
        return c;
      } catch (_) {
        // fall through to sqlite3
      }
    }
    // sqlite3 fallback (async)
    const db = new sqlite3.Database(dbPath);
    const c = await new Promise((resolve) => {
      db.get(countSql, [id], (err, row) => {
        if (err) return resolve(0);
        resolve((row && row.c) || 0);
      });
    });
    db.close();
    return c;
  }
  const c1 = await countCalls(leadId);
  // Second call (should be cached)
  const second = await http.post(`/api/leads/${encodeURIComponent(leadId)}/skiptrace`);
  const c2 = await countCalls(leadId);
  const receipt = {
    leadId,
    first: { success: !!(first.data && first.data.success), cached: !!(first.data && first.data.data && first.data.data.cached) },
    second: { success: !!(second.data && second.data.success), cached: !!(second.data && second.data.data && second.data.data.cached) },
    provider_calls_after_first: c1,
    provider_calls_after_second: c2,
    delta_calls: c2 - c1
  };
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch(e => { 
  const payload = { success:false, error: e && (e.stack || e.message) || String(e) };
  try { console.error(JSON.stringify(payload, null, 2)); } catch { console.error(String(e)); }
  process.exit(1); 
});
