-- AlterTable
ALTER TABLE "scraper_jobs" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previousErrors" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "scraper_jobs_createdAt_idx" ON "scraper_jobs"("createdAt");
