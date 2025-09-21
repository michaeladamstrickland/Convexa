const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

(async () => {
  const dbPath = path.join(__dirname, '..', 'backend', 'data', 'convexa_sixth.db');

  // Ensure the directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Delete the database file if it exists to ensure a clean slate
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`Deleted existing database: ${dbPath}`);
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Explicitly define and apply schema statements in correct order
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS provider_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT,
      endpoint TEXT,
      lead_id TEXT,
      status INTEGER,
      cost_cents INTEGER DEFAULT 0,
      response_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      idempotency_key TEXT,
      run_id TEXT,
      request_json TEXT,
      response_json TEXT,
      payload_hash TEXT,
      status_code INTEGER,
      error_text TEXT
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_idem ON provider_calls(provider, idempotency_key);`,
    `CREATE TABLE IF NOT EXISTS skiptrace_cache (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      response_json TEXT NOT NULL,
      parsed_contacts_json TEXT NOT NULL,
      ttl_expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_cache_key ON skiptrace_cache(provider, idempotency_key);`,
    `CREATE TABLE IF NOT EXISTS skiptrace_runs (
      run_id TEXT PRIMARY KEY,
      source_label TEXT,
      total INT, queued INT, in_flight INT, done INT, failed INT,
      started_at DATETIME, finished_at DATETIME,
      soft_paused INT DEFAULT 0,
      reason TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS skiptrace_run_items (
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
    );`,
    `CREATE INDEX IF NOT EXISTS ix_run_items_run ON skiptrace_run_items(run_id);`
  ];

  for (const statement of schemaStatements) {
    try {
      await db.exec(statement);
      console.log(`Executed schema statement: ${statement.substring(0, 50)}...`);
    } catch (e) {
      console.error(`Error executing schema statement: ${statement}`, e);
      process.exit(1);
    }
  }

  // Seed spend for today
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const insertSql = `
    INSERT INTO provider_calls (provider, idempotency_key, lead_id, run_id, cost_cents, status_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  const existingCall = await db.get(`SELECT * FROM provider_calls WHERE idempotency_key = 'BUDGET_SEED' AND created_at LIKE '${today}%'`);

  if (!existingCall) {
    await db.run(insertSql, ['batchdata', 'BUDGET_SEED', 'LIVE_SEED', 'seed', 2, 200]);
    console.log('Seeded 2 cents spend for today in convexa_sixth.db');
  } else {
    console.log('Spend already seeded for today in convexa_sixth.db');
  }

  await db.close();
})();
