-- Create webhook_delivery_logs table
CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscriptionId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attemptsMade" INT NOT NULL,
  "jobId" TEXT NOT NULL,
  "lastAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "wdl_subscription_idx" ON "webhook_delivery_logs" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "wdl_event_idx" ON "webhook_delivery_logs" ("eventType");
CREATE INDEX IF NOT EXISTS "wdl_created_idx" ON "webhook_delivery_logs" ("createdAt");
