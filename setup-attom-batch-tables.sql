-- ATTOM Batch Integration Database Setup
-- This script creates the necessary tables for ATTOM batch integration

-- Batch Jobs Table
CREATE TABLE IF NOT EXISTS attom_batch_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  result_file_name TEXT,
  result_file_path TEXT,
  status TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  external_batch_id TEXT,
  response TEXT,
  error TEXT,
  attom_status TEXT,
  progress_percent INTEGER,
  records_found INTEGER,
  processed_records INTEGER,
  error_records INTEGER,
  leads_created INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  submitted_at TEXT,
  estimated_completion_time INTEGER,
  last_checked TEXT,
  downloaded_at TEXT,
  processing_started_at TEXT,
  processing_completed_at TEXT
);

-- Create indexes for batch jobs table
CREATE INDEX IF NOT EXISTS idx_batch_status ON attom_batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_external_id ON attom_batch_jobs(external_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_created_at ON attom_batch_jobs(created_at);

-- Property Records Table
CREATE TABLE IF NOT EXISTS property_records (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  property_hash TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Create indexes for property records table
CREATE INDEX IF NOT EXISTS idx_property_hash ON property_records(property_hash);
CREATE INDEX IF NOT EXISTS idx_property_address ON property_records(address, city, state, zip_code);
CREATE INDEX IF NOT EXISTS idx_property_source ON property_records(source, source_id);
CREATE INDEX IF NOT EXISTS idx_property_processed ON property_records(processed);

-- Add needed fields to leads table if they don't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivation_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS normalized_address TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature_tag TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS raw_data TEXT;
