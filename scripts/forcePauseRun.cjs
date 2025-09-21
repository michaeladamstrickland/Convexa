#!/usr/bin/env node
// Usage: node scripts/forcePauseRun.cjs <run_id> [dbPath]
// Sets soft_paused=1 for the given run_id
try {
  const runId = process.argv[2];
  if (!runId) {
    console.error('Usage: node scripts/forcePauseRun.cjs <run_id> [dbPath]');
    process.exit(1);
  }
  const path = require('path');
  const DBPath = process.argv[3] || path.join('backend','data','convexa.db');
  const Database = require('better-sqlite3');
  const db = new Database(DBPath);
  const exists = db.prepare('SELECT 1 FROM skiptrace_runs WHERE run_id = ?').get(runId);
  if (!exists) {
    console.error('Run not found:', runId);
    process.exit(2);
  }
  db.prepare('UPDATE skiptrace_runs SET soft_paused=1 WHERE run_id = ?').run(runId);
  db.close();
  console.log('Paused', runId);
} catch (e) {
  console.error(e && (e.message || e));
  process.exit(1);
}
