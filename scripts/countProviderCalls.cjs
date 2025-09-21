#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: node scripts/countProviderCalls.cjs <leadId>');
    process.exit(1);
  }
  const dbPath = process.env.SQLITE_DB_PATH || path.join('backend','prisma','dev.db');
  const db = new Database(dbPath);
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM provider_calls WHERE lead_id = ?').get(leadId);
    console.log(JSON.stringify({ leadId, count: (row && row.c) || 0 }, null, 2));
  } finally { db.close(); }
}

main();
#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: node scripts/countProviderCalls.cjs <leadId>');
    process.exit(1);
  }
  const dbPath = process.env.SQLITE_DB_PATH || path.join('backend','prisma','dev.db');
  const db = new Database(dbPath);
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM provider_calls WHERE lead_id = ?`).get(leadId);
    console.log(JSON.stringify({ success: true, leadId, count: row && row.c || 0, dbPath }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e && e.message || String(e) }, null, 2));
    process.exit(1);
  } finally {
    try { db.close(); } catch (_) {}
  }
}

main();
