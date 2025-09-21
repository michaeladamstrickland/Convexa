-- Skip Trace Schema Updates
-- Run this SQL to update your database schema for enhanced skip tracing features

-- 1. Create phone_numbers table (normalized E.164 format)
CREATE TABLE IF NOT EXISTS phone_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  phone_type TEXT,
  is_primary BOOLEAN DEFAULT 0,
  is_dnc BOOLEAN DEFAULT 0,
  confidence INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lead_id, phone_number, source)
);

-- 2. Create email_addresses table
CREATE TABLE IF NOT EXISTS email_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  email_address TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT 0,
  confidence INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lead_id, email_address, source)
);

-- 3. Create skip_trace_logs table for audit and cost tracking
CREATE TABLE IF NOT EXISTS skip_trace_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  success BOOLEAN DEFAULT 0,
  cost REAL NOT NULL,
  phones_found INTEGER DEFAULT 0,
  emails_found INTEGER DEFAULT 0,
  cached BOOLEAN DEFAULT 0,
  error TEXT,
  request_payload TEXT,
  response_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create contact_attempts table for compliance tracking
CREATE TABLE IF NOT EXISTS contact_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  contact_type TEXT NOT NULL, -- 'CALL', 'TEXT', 'EMAIL'
  phone_number TEXT,
  email_address TEXT,
  user_id TEXT,
  notes TEXT,
  override_reason TEXT, -- If user overrides DNC or quiet hours
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create provider_quota_usage table
CREATE TABLE IF NOT EXISTS provider_quota_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  date TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  quota INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, date)
);

-- 6. Update leads table with new columns (idempotent)
-- NOTE: SQLite does not support IF NOT EXISTS for ALTER COLUMN.
-- These ALTER statements can fail if columns already exist; callers should
-- either ignore errors or ensure columns via PRAGMA in application code.
-- To keep CI green, we omit ALTERs here; integrated-server.js ensures these
-- columns at runtime when creating a fresh DB.
