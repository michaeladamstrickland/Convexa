/*
  Warnings:

  - The primary key for the `webhook_delivery_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('Excellent', 'Fair', 'NeedsWork');

-- AlterTable
ALTER TABLE "scraped_properties" ADD COLUMN     "condition" "PropertyCondition",
ADD COLUMN     "enrichmentTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "investmentScore" INTEGER,
ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tagReasons" JSONB;

-- AlterTable
ALTER TABLE "webhook_delivery_failures" ADD COLUMN     "replayJobId" TEXT,
ADD COLUMN     "replayedAt" TIMESTAMP(3),
ALTER COLUMN "lastAttemptAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "isResolved" SET DEFAULT false;

-- AlterTable
ALTER TABLE "webhook_delivery_logs" DROP CONSTRAINT "webhook_delivery_logs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "subscriptionId" SET DATA TYPE TEXT,
ALTER COLUMN "lastAttemptAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "matchmaking_jobs" (
    "id" TEXT NOT NULL,
    "filterJSON" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "matchedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "matchmaking_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matchmaking_jobs_status_idx" ON "matchmaking_jobs"("status");

-- RenameIndex
ALTER INDEX "wdl_created_idx" RENAME TO "webhook_delivery_logs_createdAt_idx";

-- RenameIndex
ALTER INDEX "wdl_event_idx" RENAME TO "webhook_delivery_logs_eventType_idx";

-- RenameIndex
ALTER INDEX "wdl_subscription_idx" RENAME TO "webhook_delivery_logs_subscriptionId_idx";
