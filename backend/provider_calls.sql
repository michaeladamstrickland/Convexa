CREATE TABLE IF NOT EXISTS provider_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  lead_id TEXT,
  status INTEGER,
  cost_cents INTEGER DEFAULT 0,
  response_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_provider_calls_created_at ON provider_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_calls_provider_created ON provider_calls(provider, created_at);
