# Scraper Subsystem Documentation

## 1. Overview
The original `routes/scraper.ts` implemented a multi-source scraping API (Zillow FSBO, Auction.com, County placeholder) with direct SQLite persistence, ad-hoc job tracking tables, and WebSocket broadcast hooks. This legacy design tightly coupled HTTP request handling, job orchestration, persistence, and transformation logic in a single large file, producing fragility and blocking refactors.

## 2. Deprecation Rationale
| Issue | Impact | Resolution Path |
|-------|--------|-----------------|
| Mixed concerns (routing + orchestration + persistence) | Hard to test / extend | Decompose into queue-based pipeline (scrape → ingest → fuse → score) |
| Direct SQLite usage bypassing canonical data model | Divergent storage layer | Move to Postgres migrations + repositories |
| Fire-and-forget `setTimeout` job spawning | No reliability / retries | Replace with BullMQ queues |
| Inconsistent return types (void vs array) | Client ambiguity | Standardize `ScrapeResult` schema |
| Syntax corruption (unbalanced blocks) | Broke build | Quarantined as `scraper.legacy.ts` |
| Manual JSON parsing + minimal validation | Runtime errors | Introduce zod schemas |

## 3. Legacy Routes & Behavior
| Route | Method | Purpose | Replacement |
|-------|--------|---------|-------------|
| `/api/scraper/zillow` | POST | Start Zillow scrape (standard/enhanced) | `/api/scraper/zillow` (simplified route) |
| `/api/scraper/auction` | POST | Start Auction.com scrape | Simplified auction route (to be refactored) |
| `/api/scraper/county` | POST | Simulated county job | Future county ingest pipeline |
| `/api/scraper/jobs` | GET | List scraping jobs (SQLite) | Future `/api/scrape-runs` (Postgres) |
| `/api/scraper/jobs/:id` | GET | Job detail | Future `/api/scrape-runs/:id` |
| `/api/scraper/property-records` | GET | Raw property rows | Replace with ingest_items / properties views |
| `/api/scraper/process-records` | POST | Transform raw -> leads | Superseded by ingest/fusion pipeline |
| `/api/scraper/schedule` | GET/POST | Basic schedule settings | Orchestrator service + cron/queue |

## 4. Migration Plan
1. Quarantine file (`scraper.legacy.ts`) behind `ENABLE_LEGACY_SCRAPER` flag.
2. Stand up new simplified routes (already done for Zillow) calling unified scraper interface returning `ScrapeResult`.
3. Implement queue ingestion (INGEST_BATCH) replacing direct DB writes.
4. Persist runs to `scrape_runs` instead of `scraping_jobs`.
5. Remove SQLite dev.db reliance; add Postgres migrations.
6. Replace `property_records` with normalized `ingest_items` + fused `properties`.
7. Drop schedule logic in favor of orchestrator + BullMQ repeatable jobs.

## 5. Data Mapping (Legacy → Canonical)
| Legacy Table | Canonical Target | Notes |
|--------------|------------------|-------|
| scraping_jobs | scrape_runs | status, timing preserved |
| property_records | ingest_items + properties | Move rawData JSON → payload/raw_ref |
| scraping_schedules | orchestrator config store | Represent via config or scheduled jobs |

## 6. Retirement Criteria
- All new scrapes flow through Playwright-based scrapers → queues.
- Postgres tables contain authoritative run & item data.
- Frontend no longer queries legacy job endpoints.
- County pipeline implemented in new architecture.
- Documentation & tests reference only new paths.

## 7. Flag Usage
Set `ENABLE_LEGACY_SCRAPER=true` (temporary) to re-enable legacy routes for emergency fallback. Default: disabled.

## 8. Current Status
Status: QUARANTINED (do not modify for new features).
Next Actions:
- Remove import from `server.ts` (completed)
- Provide migration script for any residual data if needed
- Delete file post-M1 backbone completion

---
Maintainer: Platform Engineering
Last Updated: (auto-generated)
