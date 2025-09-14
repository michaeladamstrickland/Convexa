-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "propertyId" TEXT,
    "leadId" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transcripts" (
    "id" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT,
    "audioUrl" TEXT,
    "transcript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_analyses" (
    "id" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_activities_type_idx" ON "crm_activities"("type");

-- CreateIndex
CREATE INDEX "crm_activities_propertyId_idx" ON "crm_activities"("propertyId");

-- CreateIndex
CREATE INDEX "crm_activities_userId_idx" ON "crm_activities"("userId");

-- CreateIndex
CREATE INDEX "crm_activities_createdAt_idx" ON "crm_activities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "call_transcripts_callSid_key" ON "call_transcripts"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "call_analyses_callSid_key" ON "call_analyses"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "call_analyses_transcriptId_key" ON "call_analyses"("transcriptId");
