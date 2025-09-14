-- CreateEnum
CREATE TYPE "TemperatureTag" AS ENUM ('DEAD', 'COLD', 'WARM', 'HOT', 'ON_FIRE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCostCents" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiScore" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiScoredAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dncFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailsJson" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "equity" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "estimatedValue" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "normalizedAddress" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phonesJson" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "skipTraceProvider" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "skipTraceCostCents" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "skipTracedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "temperatureTag" "TemperatureTag" DEFAULT 'WARM';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_normalizedAddress_ownerName_idx" ON "Lead"("normalizedAddress", "ownerName");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiCost" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "costCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlationId" TEXT,
  "leadId" TEXT,

  CONSTRAINT "ApiCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCost_provider_createdAt_idx" ON "ApiCost"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCost_leadId_idx" ON "ApiCost"("leadId");

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
