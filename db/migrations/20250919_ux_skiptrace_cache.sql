-- Idempotent index for skiptrace_cache provider/idempotency_key
-- Creates the unique index if it does not already exist
CREATE UNIQUE INDEX IF NOT EXISTS ux_skiptrace_cache
ON skiptrace_cache(provider, idempotency_key);
