#!/usr/bin/env node
// Usage: node scripts/getLatestRunId.cjs [dbPath]
// Prints the most recent run_id by started_at
try {
  const path = require('path');
  const DBPath = process.argv[2] || path.join('backend','data','convexa.db');
  const Database = require('better-sqlite3');
  const db = new Database(DBPath);
  const row = db.prepare('SELECT run_id FROM skiptrace_runs ORDER BY started_at DESC LIMIT 1').get();
  if (row && row.run_id) {
    process.stdout.write(String(row.run_id));
  }
  db.close();
} catch (e) {
  process.stderr.write(String(e && (e.message || e)) + '\n');
  process.exit(1);
}
