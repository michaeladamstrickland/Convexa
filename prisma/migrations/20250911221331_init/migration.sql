-- CreateEnum
CREATE TYPE "ScraperSource" AS ENUM ('zillow', 'auction');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "api_cost_entries" (
    "id" SERIAL NOT NULL,
    "apiType" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "owner_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "source_type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "motivation_score" INTEGER NOT NULL DEFAULT 0,
    "estimated_value" DOUBLE PRECISION,
    "equity" DOUBLE PRECISION,
    "condition_score" INTEGER NOT NULL DEFAULT 50,
    "tax_debt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "violations" INTEGER NOT NULL DEFAULT 0,
    "is_probate" BOOLEAN NOT NULL DEFAULT false,
    "is_vacant" BOOLEAN NOT NULL DEFAULT false,
    "days_on_market" INTEGER,
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "aiScore" INTEGER,
    "feedback_good" INTEGER NOT NULL DEFAULT 0,
    "feedback_bad" INTEGER NOT NULL DEFAULT 0,
    "phones" TEXT NOT NULL DEFAULT '[]',
    "emails" TEXT NOT NULL DEFAULT '[]',
    "raw_data" TEXT,
    "temperature_tag" TEXT NOT NULL DEFAULT 'DEAD',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "skip_traced_at" TIMESTAMP(3),
    "dnc_flag" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "activity_log_json" TEXT,
    "skip_trace_provider" TEXT,
    "skip_trace_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "ai_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "ai_scored_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probate_cases" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "deceased_name" TEXT NOT NULL,
    "filing_date" TIMESTAMP(3) NOT NULL,
    "case_status" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "estimated_estate_value" DOUBLE PRECISION,
    "properties_json" TEXT,
    "heirs_json" TEXT,
    "urgency_score" INTEGER NOT NULL DEFAULT 0,
    "deal_potential_score" INTEGER NOT NULL DEFAULT 0,
    "next_hearing_date" TIMESTAMP(3),
    "attorney_name" TEXT,
    "attorney_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "probate_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_violations" (
    "id" TEXT NOT NULL,
    "property_address" TEXT NOT NULL,
    "violation_type" TEXT NOT NULL,
    "severity_score" INTEGER NOT NULL,
    "repeat_offender" BOOLEAN NOT NULL DEFAULT false,
    "financial_burden" DOUBLE PRECISION NOT NULL,
    "compliance_deadline" TIMESTAMP(3) NOT NULL,
    "enforcement_stage" TEXT NOT NULL,
    "deal_potential" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "response_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_analysis" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "analysis_json" TEXT NOT NULL,
    "arv" DOUBLE PRECISION,
    "budget" DOUBLE PRECISION,
    "total_investment" DOUBLE PRECISION,
    "net_profit" DOUBLE PRECISION,
    "roi_pct" DOUBLE PRECISION,
    "risk_score" INTEGER,
    "recommendation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "logs" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_records" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "source" TEXT NOT NULL,
    "rawData" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "scrapingJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_schedules" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT,
    "time" TEXT,
    "day" TEXT,
    "sources" TEXT NOT NULL,
    "zipCodes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_jobs" (
    "id" TEXT NOT NULL,
    "source" "ScraperSource" NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "status" "JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "probate_cases_case_number_key" ON "probate_cases"("case_number");

-- CreateIndex
CREATE INDEX "dealanalysis_lead_idx" ON "deal_analysis"("lead_id");

-- AddForeignKey
ALTER TABLE "property_records" ADD CONSTRAINT "property_records_scrapingJobId_fkey" FOREIGN KEY ("scrapingJobId") REFERENCES "scraping_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
