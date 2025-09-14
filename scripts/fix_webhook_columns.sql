-- Manual patch to align webhook_delivery_failures table with Prisma schema
ALTER TABLE "webhook_delivery_failures" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE "webhook_delivery_failures" ADD COLUMN IF NOT EXISTS "isResolved" BOOLEAN DEFAULT FALSE;
ALTER TABLE "webhook_delivery_failures" ADD COLUMN IF NOT EXISTS "finalError" TEXT;
ALTER TABLE "webhook_delivery_failures" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
-- Backfill logical defaults
UPDATE "webhook_delivery_failures" SET "lastAttemptAt" = COALESCE("lastAttemptAt", "createdAt");
UPDATE "webhook_delivery_failures" SET "lastError" = COALESCE("lastError", "finalError") WHERE "lastError" IS NULL;
UPDATE "webhook_delivery_failures" SET "finalError" = COALESCE("finalError", "lastError") WHERE "finalError" IS NULL;
