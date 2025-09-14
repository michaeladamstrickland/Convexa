# LeadFlow Backlog (Execution Aligned to Master Plan)

Status Legend: [ ] not started · [~] in progress · [x] done · [!] blocked

## 0. Critical Blockers (Must Clear First)
- [ ] Remove or quarantine legacy `routes/scraper.ts` causing build break
  - Action: Rename to `routes/scraper.legacy.ts` and detach from server
  - Add: Migration note in `SCRAPER_DOCUMENTATION.md`
- [ ] Create minimal health & status route (`/healthz`) with build SHA + uptime
- [ ] Pin Node version & enforce via `.nvmrc` / engines in `package.json`
- [ ] Introduce TypeScript strict mode + fix resulting type errors (baseline quality gate)

## 1. Foundational Architecture
- [ ] Restructure repo initial step: create `/packages` folder with placeholder READMEs
- [ ] Add `schemas` package with zod definitions (`ScrapedProperty`, `ScrapeResult`)
- [ ] Add `persistence` package: Postgres client wrapper + migrations bootstrap
- [ ] Add `queues` package: BullMQ setup (connection factory + queue names enum)
- [ ] Docker: Add `docker-compose.dev.yml` (postgres, redis, minio, mailhog placeholder)
- [ ] Add `.env.example` with required variables (DB_URL, REDIS_URL, ATTOM_KEY, etc.)
- [ ] Implement centralized config loader (dotenv + runtime validation via zod)

## 2. Data Model & Migrations
- [ ] Create `migrations/0001_init.sql` with canonical tables: properties, ingest_items, scrape_runs, labels, features_online
- [ ] Add idempotent address normalization function (PL/pgSQL or JS helper) + tests
- [ ] Add unique index on `properties(address_hash)` and `_ingest_items(hash)`
- [ ] Add seed script to validate migrations run cleanly in CI

## 3. Scraper Layer Hardening
- [ ] Convert current enhanced/standard Zillow to unified interface (`runScrape(opts)`) returning `ScrapeResult`
- [ ] Migrate Puppeteer usages to Playwright (configurable stealth context)
- [ ] Add per-domain rate limiter + token bucket (in-memory first, Redis later)
- [ ] Implement rotating proxy abstraction (no-op stub now)
- [ ] Create error taxonomy (captcha, blocked, network, parse) and map in responses
- [ ] Persist each run to `scrape_runs` (start, end, status, counts, errors)
- [ ] Store raw HTML snapshots optionally (flag + S3/minio path stub)

## 4. Ingestion Pipeline (Queues)
- [ ] Define BullMQ queues: SCRAPE_RESULT, FUSE_PROPERTY, SCORE_PROPERTY, ATTOM_ENRICH
- [ ] Worker: Ingest — normalize, store `_ingest_items`, enqueue fusion tasks (dedupe aware)
- [ ] Implement content hashing + rejection reasons (duplicate, invalid-address, low-signal)
- [ ] Metrics counters for accepted vs rejected

## 5. Fusion Engine
- [ ] Implement merge precedence rules (ATTOM > Zillow > Auction > County)
- [ ] Conflict registry (store conflicting fields snapshot)
- [ ] Field lineage array on `properties.sources`
- [ ] Output triggers SCORE_PROPERTY enqueue

## 6. Scoring Engine (Heuristic Phase 1)
- [ ] Implement modular scorer functions (distress, equity proxy, time pressure, condition, liquidity)
- [ ] Compose score + reasons[] + temperature bucket
- [ ] Persist to `properties.lead_score`, `features_online`
- [ ] Expose `/api/properties/:id/score` recalculation endpoint

## 7. ATTOM Integration
- [ ] Create `attom` package: client with retry, backoff, rate limit, circuit breaker
- [ ] Add enrichment worker consuming ATTOM_ENRICH tasks
- [ ] Cache responses (table or Redis) keyed by APN/address hash
- [ ] Map ATTOM fields into fusion pipeline with reliability weight

## 8. County Records Pipeline (Skeleton)
- [ ] Define ingestion interface for PDFs / images
- [ ] Add OCR module (tesseract wrapper) with test fixture
- [ ] Regex + rules extraction for foreclosure / auction indicators
- [ ] Distress signals appended with confidence

## 9. Observability & Reliability
- [ ] Introduce pino + OpenTelemetry instrumentation scaffold
- [ ] Add correlation/request IDs (middleware) + propagate through queues
- [ ] Export Prometheus metrics endpoint `/metrics`
- [ ] Dashboard definitions (Grafana JSON) for scrape latency & pipeline throughput
- [ ] Add basic tracing spans (scrape→ingest→fusion→score)

## 10. Compliance & Governance
- [ ] Add `tos_registry.json` + loader + enforcement middleware
- [ ] robots.txt fetch/cache module (respect disallow for targeted paths)
- [ ] Per-domain rate limit config file
- [ ] Add global kill switch (`SCRAPING_DISABLED` env)

## 11. Security & Secrets
- [ ] Central secret accessor (throw if missing) + redact logging
- [ ] Role-based DB user plan (document until implemented)
- [ ] Hash PII fields if any stored (ownerName optional hashing config)

## 12. Frontend Enhancements
- [ ] Show run history (pull from `scrape_runs`) with status chips
- [ ] Add property list with score + reasons
- [ ] Provide manual reprocess button (re-enqueue SCORE_PROPERTY)
- [ ] Surface ATTOM enrichment status per property

### Sprint FE9 – Frontend Completion & Polish

- [~] FE9-2 – Lead Management Workspace: Live CRM feed + composer, quick actions
  - Notes: CRM tab functional, composer wired; type cleanup deferred (Grid v2 migration ticket)

- [ ] FE9-3 – Replace Mocked Property Detail and Leads List with Live Data
  - Type: Feature | Priority: High | Sprint: FE9
  - Description: Replace any remaining mock data with live backend calls in Property Detail View and Leads List. Ensure pagination, loading/error states, and correct typing using React Query hooks.
  - Acceptance Criteria:
    - PropertyDetailPage.tsx uses real GET by attomId or leadId; shows loading/error/not-found; fully typed; no mock imports.
    - Leads.tsx + LeadsTable.tsx use canonical endpoints (leads/properties) with pagination/sort/filter in query key/params; mutations invalidate queries; no mock arrays.
    - API alignment documented in ENDPOINTS.md; leadsApi/propertyApi updated and typed.
  - Implementation Notes:
    - If attomId isn’t canonical, switch routes to leadId.
    - Provide shared useLeads() and useLead(id) hooks; consider zod parsing.
    - Verify backend lookup-by-id support.

### Sprint FE20 – Analytics & Insights

- [ ] FE20-1 – Render Call Metrics and CRM Summaries into Dashboard Analytics
  - Type: Feature | Priority: Medium | Sprint: FE20 (or end of FE9 overflow)
  - Description: Surface real-time call metrics and CRM insights by consuming Prometheus-style metrics and summary endpoints.
  - Acceptance Criteria:
    - Metrics Integration: Pull from /api/dev/metrics and/or /api/admin/dashboard-metrics; parse leadflow_call_summary_total{status}, leadflow_call_scoring_ms_bucket, leadflow_crm_activity_total{type}.
    - Charts + Summaries: Visualize summaries per day/week, avg scoring latency, CRM activity breakdown via Recharts; proper loading/error/empty states.
    - Dashboard UX: Embed in AdvancedAnalytics.tsx or new /analytics; reuse DashboardMetrics or create CallMetricsPanel; add “Call Intelligence” subsection.
    - Documentation: Document parsed metrics in VOICE_CALLS.md or ANALYTICS.md.
  - Implementation Notes:
    - Use react-query polling (10–30s).
    - Reuse Prometheus text parse helpers if present.
    - Keep layout simple (cards + small charts).

## 13. Developer Tooling & DX
- [ ] Add ESLint + Prettier + tsconfig strict + path mapping
- [ ] Add `justfile` or npm scripts for common flows (dev, lint, test, migrate, seed)
- [ ] Add Vitest/Jest + coverage threshold gates
- [ ] Pre-push git hook (lint + typecheck)

## 14. Testing Matrix
- [ ] Unit tests: normalizers, hashing, scorer components
- [ ] Integration: scrape → queue → ingest round trip
- [ ] Integration: fusion conflict resolution scenario
- [ ] Load test script (k6 or autocannon) for ingest endpoints
- [ ] Golden dataset regression test (JSON fixtures) for scoring stability

## 15. ML Readiness (Phase 2 Prep)
- [ ] Define feature extraction map (property → feature bag)
- [ ] Add offline export script (properties → parquet)
- [ ] Label capture endpoint + schema in `labels`
- [ ] Stub training pipeline script (no-op placeholder)

## 16. Documentation
- [ ] ARCHITECTURE.md (high-level + diagrams)
- [ ] DATA_MODEL.md (ERD + column definitions)
- [ ] PLAYBOOKS.md (oncall: restart workers, diagnose stuck queue)
- [ ] COMPLIANCE.md (robots/TOS policy, logging, retention)
- [ ] SCORING.md (heuristics, formula, reason codes)

## 17. Refactors (Non-Blocking but Important)
- [ ] Replace ad-hoc logging with structured logger wrapper
- [ ] Remove SQLite remnants & consolidate to Postgres
- [ ] Extract scraper shared utilities (selectors, parsing) into `/packages/scrapers`
- [ ] Replace in-memory job monitor with persisted + ephemeral cache (Redis)
- [ ] Consolidate duplicated scraper error handling logic into strategy object

## 18. Technical Debt (Identified)
- [ ] Legacy `routes/scraper.ts` unresolved syntax + architectural drift
- [ ] Mixed database access patterns (Prisma vs raw) — choose and standardize
- [ ] No consistent error envelope across endpoints
- [ ] Missing retry/backoff policies for network scrapes
- [ ] Hardcoded magic values (timeouts, selectors) without config centralization

## 19. Nice-to-Haves / Stretch
- [ ] WebSocket auth + JWT claim-based filtering
- [ ] UI live metrics (throughput, error rates)
- [ ] Pluggable scoring strategies (config file selects active)
- [ ] Canary scraper variant testing harness

## 20. Exit Criteria for Phase 1 (Backbone Complete)
- [ ] End-to-end flow: Trigger scrape → property fused → scored → visible in UI with reasons
- [ ] All core tables populated with at least one test dataset
- [ ] Metrics & health endpoints operational
- [ ] ATTOM enrichment integrated for at least one property
- [ ] Conflict resolution path produces lineage record

---
Generated backlog derived from current state gaps vs Master Implementation Brief. Update status in PRs; keep items atomic and reference this file in commit messages.
