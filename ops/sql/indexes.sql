CREATE INDEX IF NOT EXISTS idx_skip_trace_logs_lead_created ON skip_trace_logs(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_calls_created        ON provider_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_lead            ON phone_numbers(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_lead          ON email_addresses(lead_id);
