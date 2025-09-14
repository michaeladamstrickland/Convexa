-- Add finalError column if missing
ALTER TABLE "webhook_delivery_failures" ADD COLUMN IF NOT EXISTS "finalError" TEXT;

-- Backfill finalError with lastError where null
UPDATE "webhook_delivery_failures" SET "finalError" = COALESCE("finalError", "lastError") WHERE "finalError" IS NULL;
