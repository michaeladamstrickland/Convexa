-- Migration: webhook_failure_enhancements
ALTER TABLE "webhook_delivery_failures"
    ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "isResolved" BOOLEAN DEFAULT FALSE;

-- Backfill existing rows where needed
UPDATE "webhook_delivery_failures" SET "lastAttemptAt" = "createdAt" WHERE "lastAttemptAt" IS NULL;