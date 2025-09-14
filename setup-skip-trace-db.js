/**
 * Initialize Skip Trace database schema
 */
import { fileURLToPath } from 'url';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'skip_trace.db');

console.log('Setting up skip trace database at:', dbPath);

// Connect to database
const db = new BetterSqlite3(dbPath);

// Create phone_numbers table
db.exec(`
  CREATE TABLE IF NOT EXISTS phone_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    number TEXT NOT NULL,
    type TEXT,
    is_primary INTEGER DEFAULT 0,
    provider TEXT,
    confidence INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, number)
  )
`);
console.log('Created phone_numbers table');

// Create email_addresses table
db.exec(`
  CREATE TABLE IF NOT EXISTS email_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    address TEXT NOT NULL,
    type TEXT,
    is_primary INTEGER DEFAULT 0,
    provider TEXT,
    confidence INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, address)
  )
`);
console.log('Created email_addresses table');

// Create skip_trace_logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS skip_trace_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    success INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )
`);
console.log('Created skip_trace_logs table');

// Create contact_attempts table
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    contact_type TEXT NOT NULL,
    contact_id INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0,
    notes TEXT
  )
`);
console.log('Created contact_attempts table');

// Create provider_quota_usage table
db.exec(`
  CREATE TABLE IF NOT EXISTS provider_quota_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,
    calls_today INTEGER DEFAULT 0,
    calls_month INTEGER DEFAULT 0,
    cost_today REAL DEFAULT 0,
    cost_month REAL DEFAULT 0,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('Created provider_quota_usage table');

// Insert initial provider records
const providers = ['batch', 'whitepages'];
const insertProvider = db.prepare(`
  INSERT OR IGNORE INTO provider_quota_usage (provider)
  VALUES (?)
`);

for (const provider of providers) {
  insertProvider.run(provider);
}
console.log('Added initial provider records');

// Create some indexes for performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_phone_lead_id ON phone_numbers(lead_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_email_lead_id ON email_addresses(lead_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_lead_id ON skip_trace_logs(lead_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_attempts_lead_id ON contact_attempts(lead_id)`);
console.log('Created performance indexes');

// Close the database
db.close();

console.log('Skip trace database setup complete! ✅');
