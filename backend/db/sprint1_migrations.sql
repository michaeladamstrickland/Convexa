-- Sprint 1 schema (for reference / optional use)

-- provider_calls additions and idempotency
CREATE TABLE IF NOT EXISTS provider_calls (
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
  request_id TEXT,
  request_json TEXT,
  response_json TEXT,
  payload_hash TEXT,
  status_code INTEGER,
  error_text TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_idem ON provider_calls(provider, idempotency_key);

-- L2 cache
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_cache_key ON skiptrace_cache(provider, idempotency_key);

-- Run lifecycle
CREATE TABLE IF NOT EXISTS skiptrace_runs (
  run_id TEXT PRIMARY KEY,
  source_label TEXT,
  total INT, queued INT, in_flight INT, done INT, failed INT,
  started_at DATETIME, finished_at DATETIME,
  soft_paused INT DEFAULT 0,
  reason TEXT
);
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
CREATE INDEX IF NOT EXISTS ix_run_items_run ON skiptrace_run_items(run_id);
