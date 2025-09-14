-- Resilient migration: ensure columns exist before applying NOT NULL/type changes
-- Add columns if missing (idempotent when rerun)
ALTER TABLE "webhook_delivery_failures"
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isResolved" BOOLEAN;

-- Backfill nulls to safe defaults
UPDATE "webhook_delivery_failures" SET "lastAttemptAt" = COALESCE("lastAttemptAt", "createdAt") WHERE "lastAttemptAt" IS NULL;
UPDATE "webhook_delivery_failures" SET "isResolved" = COALESCE("isResolved", FALSE) WHERE "isResolved" IS NULL;

-- Enforce constraints
ALTER TABLE "webhook_delivery_failures" 
  ALTER COLUMN "lastAttemptAt" SET NOT NULL,
  ALTER COLUMN "isResolved" SET NOT NULL;
