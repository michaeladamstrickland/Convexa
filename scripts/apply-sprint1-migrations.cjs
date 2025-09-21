#!/usr/bin/env node
// Sprint 1 DB migrations + WAL/PRAGMA setup

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), 'backend', '.env') });

async function main() {
  const BetterSqlite3 = (await import('better-sqlite3')).default;

  const dbPath = process.env.SQLITE_DB_PATH || path.resolve('backend', 'data', 'convexa.db');
  const busyMs = parseInt(process.env.SQLITE_BUSY_TIMEOUT_MS || '5000', 10);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  console.log(`[migrate] Using DB at ${dbPath}`);
  const db = new BetterSqlite3(dbPath);

  try {
    // PRAGMAs
    const mode = db.pragma('journal_mode = WAL', { simple: true });
    db.pragma(`busy_timeout = ${busyMs}`);
    db.pragma('synchronous = NORMAL');
    console.log(`[migrate] PRAGMA journal_mode=${Array.isArray(mode) ? mode[0].journal_mode : 'wal'} busy_timeout=${busyMs} synchronous=NORMAL`);

    // provider_calls — ensure required columns exist, create if missing
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT,
        endpoint TEXT,
        lead_id TEXT,
        status INTEGER,
        cost_cents INTEGER DEFAULT 0,
        response_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add/ensure new columns for Sprint-1 audit/idempotency
    const ensureColumn = (table, col, type) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        console.log(`[migrate] Added ${table}.${col}`);
      }
    };

    ensureColumn('provider_calls', 'idempotency_key', 'TEXT');
    ensureColumn('provider_calls', 'run_id', 'TEXT');
    ensureColumn('provider_calls', 'request_json', 'TEXT');
    ensureColumn('provider_calls', 'response_json', 'TEXT');
    ensureColumn('provider_calls', 'payload_hash', 'TEXT');
    ensureColumn('provider_calls', 'status_code', 'INTEGER');
    ensureColumn('provider_calls', 'error_text', 'TEXT');

    // Unique index for idempotency (ignore if already exists)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_idem ON provider_calls(provider, idempotency_key);`);

    // L2 cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS skiptrace_cache (
        id INTEGER PRIMARY KEY,
        provider TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        response_json TEXT NOT NULL,
        parsed_contacts_json TEXT NOT NULL,
        ttl_expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME
      );
    `);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_cache_key ON skiptrace_cache(provider, idempotency_key);`);

    // Run lifecycle tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS skiptrace_runs (
        run_id TEXT PRIMARY KEY,
        source_label TEXT,
        total INT, queued INT, in_flight INT, done INT, failed INT,
        started_at DATETIME, finished_at DATETIME,
        soft_paused INT DEFAULT 0,
        reason TEXT
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS skiptrace_run_items (
        id INTEGER PRIMARY KEY,
        run_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('queued','in_flight','done','failed')) NOT NULL,
        attempt INT DEFAULT 0,
        idem_key TEXT NOT NULL,
        normalized_address TEXT,
        normalized_person TEXT,
        last_error TEXT,
        FOREIGN KEY(run_id) REFERENCES skiptrace_runs(run_id)
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS ix_run_items_run ON skiptrace_run_items(run_id);`);

    // Ensure updated_at column exists for bookkeeping
    try {
      const colsSRI = db.prepare(`PRAGMA table_info(skiptrace_run_items)`).all().map(c => c.name);
      if (!colsSRI.includes('updated_at')) {
        db.exec(`ALTER TABLE skiptrace_run_items ADD COLUMN updated_at DATETIME`);
        console.log('[migrate] Added skiptrace_run_items.updated_at');
      }
    } catch (e) {
      console.warn('[migrate] Could not ensure updated_at on skiptrace_run_items:', e?.message || e);
    }

    // Ensure helpful indexes on phone/email tables for contacts UI
    try { db.exec(`CREATE INDEX IF NOT EXISTS ix_phone_numbers_lead ON phone_numbers(lead_id, is_primary DESC, confidence DESC);`); } catch {}
    try { db.exec(`CREATE INDEX IF NOT EXISTS ix_email_addresses_lead ON email_addresses(lead_id, is_primary DESC, confidence DESC);`); } catch {}

    // Create run_reports directory
    const reportsDir = path.resolve('run_reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log(`[migrate] Ensured run_reports directory at ${reportsDir}`);

    console.log('[migrate] Sprint 1 migrations complete.');
  } finally {
    db.close();
  }
}

main().catch(err => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
