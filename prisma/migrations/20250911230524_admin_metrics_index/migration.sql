-- CreateTable
CREATE TABLE "scraped_properties" (
    "id" TEXT NOT NULL,
    "source" "ScraperSource" NOT NULL,
    "zip" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "price" INTEGER,
    "beds" INTEGER,
    "sqft" INTEGER,
    "propertyType" TEXT,
    "link" TEXT,
    "imageUrl" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraped_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scraped_properties_source_idx" ON "scraped_properties"("source");

-- CreateIndex
CREATE INDEX "scraped_properties_zip_idx" ON "scraped_properties"("zip");

-- CreateIndex
CREATE INDEX "scraped_properties_beds_idx" ON "scraped_properties"("beds");

-- CreateIndex
CREATE INDEX "scraped_properties_propertyType_idx" ON "scraped_properties"("propertyType");

-- CreateIndex
CREATE INDEX "scraped_properties_createdAt_idx" ON "scraped_properties"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scraped_properties_source_zip_address_key" ON "scraped_properties"("source", "zip", "address");

-- CreateIndex
CREATE INDEX "scraper_jobs_source_idx" ON "scraper_jobs"("source");
