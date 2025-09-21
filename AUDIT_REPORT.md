# Convexa Codebase Deep Audit — Executive Readout

Timestamp (ET): 2025-08-16 12:00 ET  
Scope: Full monorepo (backend, frontend, prisma, src, scripts, docs)

This audit inspects, measures, and reports on the current state of LeadFlow’s codebase to reach production quality for generating real leads. It includes repository inventory, dependency health, backend and frontend analysis, scraping/enrichment, data lifecycle, security/compliance, testing/CI/CD, observability/cost, and a prioritized plan. All recommended changes are non-destructive and documented as PR-ready diffs in artifacts.

References to code are file-scoped with routes and service names; line numbers omitted where structure is straightforward.

---

## 0) Executive Summary

Readiness
- Backend: Rich Express + TypeScript service with Prisma, JWT auth, rate limiting, validation (Zod + express-validator), and multiple data integrations scaffolded (ATTOM, DataTree, Zillow, OpenAI, Google Maps). Working endpoints for leads, auth, zip searches, and real-estate “premium” search orchestration. A Zillow Puppeteer scraper persists PropertyRecord entries with deduplication.
- Frontend: Vite + React + Tailwind with pages and components for dashboards, leads, zip search, analytics. API client present; basic login gate held in local state (no persisted session yet).
- Data: Two Prisma contexts detected: backend/prisma (PostgreSQL) and root/prisma (SQLite). This split is risky and needs unification to avoid migration drift and runtime confusion.
- Tests: Backend Jest config and integration tests exist; unit/e2e coverage not comprehensive.
- Security/compliance: JWT-only, no refresh/rotation; no explicit DNC/TCPA enforcement paths; secrets via process.env but no .env.example committed; validation layers in place.

Key Gaps (see GAP_LIST.md for details)
- Dual Prisma schemas (Postgres vs SQLite) causing data model drift risk.
- Missing documented .env.example and environment layering (local/staging/prod).
- DNC/TCPA compliance (DNC cache, consent logging, quiet hours) not implemented.
- Auth hardening (refresh tokens, rotation, revoke on logout), authorization guard coverage, multi-tenancy row-level enforcement in all queries.
- Campaigns (SMS/voice/email) mostly placeholders; Twilio not wired through end-to-end.
- Observability (Sentry, metrics, trace IDs) not configured; logging mostly morgan+winston.
- CI/CD pipeline not present; release/migrations strategy not documented.

Fastest Path to “real leads + campaigns live”
1) Data correctness: unify Prisma to one provider/environment; run migrations and seed.
2) Intake/enrichment: stabilize RealPropertyDataService with keys; enable cautious caching to control API spend; wire skip trace flow with idempotent writes.
3) Compliance: implement DNC/TCPA minimal viable guardrails; add consent logging and quiet hours.
4) Outreach: wire Twilio SMS with opt-out flows and throttling; add simple campaign scheduler; persist message logs.
5) Reliability: add request timeouts/retries, idempotency keys on write endpoints; structured error responses.
6) Security: JWT refresh/rotation; organization row-level scopes across all queries.

Estimated Engineering Time (business days)
- Prisma unification and env layering: 1–2
- DNC/TCPA baseline + Twilio wiring + campaign logs: 2–4
- Auth hardening (refresh/rotation) + tests: 1–2
- Observability, rate-limits/timeouts/retries, idempotency: 2–3
- Frontend auth + leads views/filters polish: 2–3  
Total critical path to production: ~8–14 days (see PRIORITY_PLAYBOOK.md)

---

## 1) Repository Inventory

Monorepo layout
- backend/ (Express + TS, Prisma, routes, services, middleware, tests)
  - package.json, tsconfig.json, jest.config.js, .eslintrc.js, .prettierrc, docker-compose.yml
  - prisma/schema.prisma (PostgreSQL)
  - src/
    - server.ts, server-master.ts, demoServer.ts
    - config/masterConfig.ts
    - controllers/leadController.ts
    - middleware/{auth.ts,errorHandler.ts,security.ts,validation.ts}
    - routes/
      - auth.ts, leads.ts, campaigns.ts, calls.ts, organizations.ts, analytics.ts
      - zipSearch.ts, realEstateRoutes.ts, scraper.ts, skipTrace.ts
      - masterRealEstateRoutes.ts, masterRoutes.ts, masterRoutes_new.ts, probateRoutes.ts
    - scrapers/zillowScraper.ts
    - services/
      - realPropertyDataService.ts, masterRealEstateService.ts
      - attomDataService.ts, dataTreeService.ts, addressValidationService.ts
      - aiService.ts, aiAnalysisService.ts, probateService.ts, skipTraceService.ts
    - tests/{integration.test.ts, masterConfigTest.ts, setup.ts}
    - utils/logger.ts
- frontend/ (Vite + React + TS + Tailwind)
  - package.json, tsconfig.json, tailwind config, vite.config.ts
  - src/
    - App.tsx, main.tsx, index.css
    - api/{auth.ts, client.ts, index.ts, leads.ts}
    - components/{Layout.tsx, ZipCodeLeadSearch.tsx, AdvancedProbateLeads.tsx, MasterLeadGeneration.tsx}
    - pages/{Dashboard.tsx, EmpireDashboard.tsx, Leads.tsx, Scraper.tsx, Analytics.tsx, AdvancedAnalytics.tsx, Login.tsx}
    - hooks/, services/realEstateAPI.ts, utils/
- prisma/ (separate)
  - schema.prisma (SQLite)
  - dev.db, migrations/20250806193904_init
- src/ (additional TS server/services parallel to backend)
  - server.ts, realServer.ts, index.ts, phase3-launcher.ts
  - services/{realDataService.ts, realDataScraper.ts, workingRealDataScraper.ts, databaseService.ts, zipCodeLeadGenerator.ts}
  - many “intelligence/automation” modules
- root scripts/docs: setup scripts, extensive guides and roadmaps

Configs and Tools
- Package managers: npm (package-lock.json present in root/backend/frontend).
- TypeScript configs: root tsconfig.json, backend/tsconfig.json, frontend/tsconfig.json.
- Lint/format: backend (.eslintrc.js, .prettierrc), frontend (eslint via package.json); root has eslint dependencies.
- Tests: backend/jest.config.js; integration tests in backend.
- Docker: backend/docker-compose.yml.
- .env*: Not committed; dotenv is used (backend/src/server.ts and others). No .env.example found.
- Prisma:
  - backend/prisma/schema.prisma → provider = postgresql, url = env("DATABASE_URL")
  - prisma/schema.prisma → provider = sqlite, file dev.db (seed + local demos)
  - Risk: dual schemas diverge; models differ significantly.

Condensed tree — backend/src (key areas only)
- server.ts (primary Express app with mounts, rate limiting, helmet, morgan, health/system endpoints)
- server-master.ts (alternate server wiring)
- config/masterConfig.ts (tier, API registry, cost per call, rate limiting)
- controllers/leadController.ts (CRUD, AI background analysis, skip trace integration)
- middleware/{auth.ts (JWT), validation.ts (Zod/validators), errorHandler.ts, security.ts}
- routes/{auth.ts, leads.ts, campaigns.ts, calls.ts, organizations.ts, analytics.ts}
- routes/{zipSearch.ts, realEstateRoutes.ts, skipTrace.ts, scraper.ts}
- routes/{masterRealEstateRoutes.ts, masterRoutes.ts, masterRoutes_new.ts, probateRoutes.ts}
- services/{realPropertyDataService.ts, masterRealEstateService.ts, attomDataService.ts, dataTreeService.ts, aiService.ts, aiAnalysisService.ts, probateService.ts, skipTraceService.ts}
- scrapers/zillowScraper.ts
- tests/{integration.test.ts, masterConfigTest.ts}
- utils/logger.ts

Condensed tree — frontend/src
- App.tsx (routes), main.tsx, index.css
- api/{client.ts, auth.ts, leads.ts, index.ts}
- components/{Layout.tsx, ZipCodeLeadSearch.tsx, MasterLeadGeneration.tsx, AdvancedProbateLeads.tsx}
- pages/{Dashboard.tsx, EmpireDashboard.tsx, Leads.tsx, Scraper.tsx, Analytics.tsx, AdvancedAnalytics.tsx, Login.tsx}
- services/realEstateAPI.ts

---

## 2) Dependency Graph & Health

Roots
- Root package.json (server + scripts)
  - deps: express, @prisma/client, axios, puppeteer (^24.16.0), openai, sqlite3, winston, cors, dotenv
  - dev: prisma, typescript, eslint stack, tsx
- Backend package.json (primary API)
  - deps: express, @prisma/client, zod, openai, twilio, puppeteer (^21.9.0), axios, node-cron, winston, helmet, rate-limit, compression, express-validator, multer, morgan, dotenv, cors, jsonwebtoken, bcryptjs
  - dev: jest + ts-jest, eslint stack, prisma, tsx, types
- Frontend package.json
  - deps: react, react-router-dom, @tanstack/react-query, axios, zod, headlessui, icons, form libs
  - dev: vite, tailwind, eslint plugins, typescript

Findings
- Puppeteer version mismatch (root: ^24.x vs backend: ^21.x). Risk: incompatible browser features or duplicated downloads. Recommend one canonical location (backend only) and align versions.
- Axios duplicated (root/backend/frontend). Acceptable, but ensure consistent retry/interceptor patterns in backend.
- Prisma in both root and backend; dual schemas/providers (Postgres vs SQLite) create drift, complicate migrations. Consolidate to single source of truth (recommend: backend).
- TypeScript config strictness unknown (tsconfig not yet inspected in detail). Recommend setting "strict": true, "noImplicitAny": true across packages.
- ESLint/Prettier present in backend/frontend; enforce in CI.
- Security updates: check JWT, bcryptjs, helmet versions periodically; keep puppeteer pinned to LTS major to reduce Chromium churn.

---

## 3) Backend Analysis

App/Server
- backend/src/server.ts
  - Helmet, CORS, express-rate-limit, morgan configured
  - Health: GET /health, System: GET /api/system/status, GET /api/system/cost-estimate
  - Mounts:
    - /api/auth → routes/auth.ts
    - /api/leads → routes/leads.ts
    - /api/campaigns → routes/campaigns.ts
    - /api/calls → routes/calls.ts
    - /api/scraper → routes/scraper.ts
    - /api/skip-trace → routes/skipTrace.ts
    - /api/analytics → routes/analytics.ts
    - /api/organizations → routes/organizations.ts
    - /api/zip-search → routes/zipSearch.ts
    - /api/real-estate → routes/realEstateRoutes.ts
    - (optional) /api/master → routes/masterRealEstateRoutes.ts
  - Error handling: middleware/errorHandler.ts; 404 catch-all with known endpoints list

Auth & Security
- middleware/auth.ts
  - authenticate: Bearer JWT verification, user load with organization include; sets req.user
  - restrictTo: role guard
  - apiKeyAuth: x-api-key header check
- middleware/validation.ts
  - Zod schema validation wrapper and express-validator rules; sanitizeInput for basic XSS protection
- middleware/security.ts (applies helmet, compression, request size limits, timeout)
- Rate limiting via express-rate-limit on /api/

Routes (selected)
- routes/auth.ts: register/login/forgot/reset with Prisma. Password hashing via bcryptjs; login updates lastLoginAt. JWT sign via secret; token expiration configurable. Logging via utils/logger.ts.
- routes/leads.ts: All routes require authenticate(); CRUD, stats, call-script; runSkipTrace delegates to services/skipTraceService.ts
- routes/zipSearch.ts: Search leads by zip, multi-zip, target-area; zip-stats; ad-hoc revenue analytics; contact script by id
- routes/realEstateRoutes.ts: “Production implementation” wiring multiple APIs (Zillow/RapidAPI, RentSpree, ATTOM, RealtyMole, BatchSkipTracing, Whitepages Pro, PropertyRadar, DataTree) via RealPropertyDataService; endpoints:
  - POST /search-real-zip
  - POST /search-real-multiple-zips
  - POST /search-real-target-area
  - GET /api-usage-stats
  - POST /reset-counters
- routes/masterRealEstateRoutes.ts: “Comprehensive” master orchestration with broader API catalog and costs, endpoints include:
  - POST /ultimate-search
  - POST /probate-leads
  - POST /foreclosure-leads
  - POST /high-equity-leads
  - GET /master-usage-stats
  - POST /reset-master-counters
- Additional routes exist for campaigns, calls, organizations, analytics (stubs/basic responses)

Controllers/Services
- controllers/leadController.ts
  - getLeads with filters, includes assignedTo, counts; getLead (joins), createLead (runs async AI analysis update), updateLead, soft delete, runSkipTrace (checks recent completion within 30 days; falls back to multiple providers), addLeadNote, getLeadStats (aggregations), generateCallScript via aiService
- services/*
  - aiService.ts / aiAnalysisService.ts: OpenAI chat completions for scoring/analysis and call scripts
  - realPropertyDataService.ts: Axios clients for Zillow, RentSpree, ATTOM, RealtyMole, Batch Skip Tracing, PropertyRadar; enrichment pipeline computes equity, ownership flags, aggregations; cost tracking and rate-limit placeholders
  - masterRealEstateService.ts: Orchestration class wrapping multiple sources; tracks costs; provides masterPropertySearch with data sources and fallback handling
  - skipTraceService.ts: Multi-provider with fallback (Batch, Whitepages, public records), persists SkipTraceRecord via Prisma, simple cost estimation
  - addressValidationService.ts: Google Geocode API integration
  - attomDataService.ts / dataTreeService.ts: simple Axios wrappers for endpoints

Scraping
- scrapers/zillowScraper.ts
  - Puppeteer-based FSBO scraping against Zillow; saves to PropertyRecord with upsert keyed by (source = zillow_fsbo, sourceId = zpid), with propertyHash for dedupe. Supports pagination and per-zip scanning. Logs and error handling present, but stealth/proxy rotation not implemented.

Prisma schema (backend/prisma/schema.prisma, PostgreSQL)
- Entities: Organization, User, Lead, LeadNote, SkipTraceRecord, Campaign, CampaignLog, CallLog, ScrapingJob, PropertyRecord, DailyMetric
- Strong alignment with CRM-like capabilities: logs, campaigns, calls; tags string[] on Lead; soft delete isActive; various metrics tables

Error handling, timeouts, retries, idempotency
- Error middleware centralizes AppError; uniform structure recommended across services
- Timeouts present in security.ts (requestTimeout(30000))
- Retries: ad-hoc; recommend Axios retry strategy with backoff and circuit-breaker around external APIs
- Idempotency: Not implemented for mutating endpoints (POST/PUT/PATCH). Recommend Idempotency-Key header for createLead and skip-trace initiation to avoid duplicate writes

Secrets management and environments
- process.env used throughout; dotenv loaded
- No .env.example committed; no explicit staging config; tier and budget read via masterConfig
- Recommend: .env.example, .env.local, .env.staging, .env.production with typed config loader and validation

Background jobs/queues
- node-cron dependency present; jobs/ exists; no queue system (e.g., BullMQ) observed
- Recommend: add async queue for scraping/enrichment and rate-limit compliance

---

## 4) Frontend Analysis (React/Vite)

Routing and state
- src/App.tsx routes:
  - "/", "/dashboard", "/leads", "/zip-search", "/scraper", "/analytics", "/basic-analytics"
- Local isAuthenticated state gates Login screen; no persisted JWT/session or refresh flow implemented
- @tanstack/react-query present for data fetching (good foundation); API clients in src/api/

UI/UX
- Tailwind CSS with headlessui/icons
- Components for ZipCodeLeadSearch, AdvancedProbateLeads, MasterLeadGeneration indicate intended flows
- Loading/skeletons/error boundaries not systematically present; accessibility basics (aria) not audited in this pass

Auth
- Login form exists; backend JWT endpoints are ready
- Missing: Persist token (localStorage/secure storage), attach Authorization header, refresh/expiration handling, logout flow

Data tables/filters
- Leads page exists; need to confirm use of server-side pagination/filters (backend supports lead search/filters)

Uploads
- Multer in backend; no explicit frontend upload flows seen

Responsiveness/accessibility
- Tailwind generally responsive; ensure mobile nav and aria attributes where interactive

Bundle and performance
- Vite baseline; code splitting not explicitly configured; source-map explorer not applied

---

## 5) Scraping/Intake & Enrichment

Scraping
- Puppeteer Zillow FSBO scraper persists PropertyRecord with dedupe hash; no proxy rotation nor stealth plugin; robots/ToS considerations not documented
- Recommend: add puppeteer-extra-plugin-stealth, proxy config, randomization; persist raw HTML snippets selectively for debugging

Enrichment
- SkipTraceService with providers and persistence; cost tracking stubbed
- Address validation via Google Maps service; not integrated into lead creation pipeline by default

De-duplication
- PropertyRecord has propertyHash with index; ensure consistent hash generation and collision handling across pipelines

---

## 6) Data Model & Lifecycle

Lifecycle target
ingested → normalized → enriched → scored → contacted → responded → scheduled → under_contract → closed

Current support
- Ingestion: Zillow scraper and “real-estate API” aggregations (realPropertyDataService); manual lead creation endpoint exists
- Normalization: realPropertyDataService maps API results into common shape; more explicit normalization module recommended
- Enrichment: skip trace + address validation exist; tie into post-ingestion hooks
- Scoring: AI analysis computed async on lead creation (dealScore, motivation, factors)
- Contacted/Timeline: CampaignLog and CallLog schemas exist; routes for campaigns/calls are stubs
- Audit trail: LeadNote, CampaignLog, CallLog capture basic timeline; EventLog equivalent not present; recommend unified EventLog with correlationId

Scoring fields (equity, distress, vacancy, violations, delinquency, probate)
- Fields available across services; formalize on Lead as computed attributes updated by enrichment jobs

---

## 7) Security & Compliance

AuthN/Z
- JWT with roles; no refresh tokens or rotation; no revocation list; org-scoped queries used in key controllers (e.g., leads) but coverage must be validated across all routes

PII handling
- PII in Lead (ownerName, email, phone). No encryption-at-rest at app level (leave to DB). Transport security relies on external TLS termination; ensure HTTPS-only in production

DNC/TCPA
- No DNC cache results stored per phone, no consent records, no quiet hours; blockers for production outreach

Secrets
- No .env.example; secrets referenced directly via process.env; recommend dotenv-safe or zod schema for config validation and typed config module

Input validation
- Zod schemas for many endpoints; sanitizeInput applied. Ensure validation present on all mutating endpoints (campaigns, uploads)

---

## 8) Testing & CI/CD

Tests
- backend/src/tests/{integration.test.ts, masterConfigTest.ts} exist; integration tests hit real APIs if keys present (flaky/expensive)
- Unit tests largely missing for controllers/services; e2e not present

CI
- No CI pipeline committed; recommend GitHub Actions covering:
  - install, lint, typecheck, test, build
  - prisma generate/validate
  - optional: docker build scan

Release
- Docker compose exists; migrations flow documented via npm scripts; blue/green or simple restart not defined

Seed/Fixtures
- prisma/seed.ts present at root; consider backend-focused seed aligned to Postgres schema or unify schemas first

---

## 9) Observability & Cost

Logging
- winston logger and morgan used; request logging present; recommend structured logs with correlationId (traceId) and user/org identifiers

Error reporting
- No Sentry or equivalent; add @sentry/node to backend with per-request context

Metrics/Tracing
- No Prometheus/OpenTelemetry; add basic process metrics (CPU/mem), HTTP request counters/histograms, and external API call meters with costs

Cost Guardrails
- masterConfig defines costPerCall and daily budget limits per tier
- Recommend: central cost aggregator middleware + cache layer (per zip/address) to reduce duplicate API spend; concurrency limits on scrapers and enrichment; bulk batching

---

## 10) Architectural Debts

- Dual server entry points (root/src and backend/src) and dual Prisma schemas (SQLite vs PostgreSQL) create ambiguity and risk
- RealPropertyDataService and MasterRealEstateService overlap; deduplicate responsibilities into orchestrator + provider adapters
- No queue for long-running scraping/enrichment; synchronous endpoints may exceed timeouts
- Inconsistent puppeteer versions; Chromium downloads duplicated
- Frontend auth session/state incomplete; no refresh or error handling on 401

---

## 11) Completion Scoring (see FEATURE_MATRIX.md for grid)

Highlights (backend/frontend/tests %)
- Ingestion (APIs & scrapers): 55% (working endpoints, enrichment pipeline partial, scraper present)
- Deduplication: 50% (hash/persistence present; unify across pipelines)
- Address validation: 35% (service exists; not integrated broadly)
- Enrichment (skip-trace, owner match): 50% (service + persistence; UI integration minimal)
- Lead scoring (AI): 60% (OpenAI wired; background update on creation)
- Lead views/filters: 45% (pages present; auth/session and richer filters TBD)
- Campaigns (SMS/voice/email): 25% (stubs; wiring and DNC missing)
- DNC/TCPA guardrails: 10% (gaps)
- CRM tasks/timeline: 40% (schemas + notes/logs; UI incomplete)
- User/org auth: 65% (JWT + roles; refresh/rotation missing)
- Billing limits: 40% (tier/cost config present; enforcement/caching TBD)
- File uploads: 10% (multer present; routes/UI not implemented)
- Flip Tracker: 10% (docs mention; no concrete backend feature)
- Analytics dashboards: 35% (routes and pages exist; metrics not real)
- Admin ops: 30% (reset counters, health, usage stats; no replay/backfills)

---

## 12) Fastest Path to Production (“real leads + campaigns live”)

D0–D3
- Unify Prisma to backend Postgres; migrate root SQLite models that matter or deprecate root prisma; commit .env.example
- Implement frontend auth persistence (JWT storage, attach headers, logout), protect routes, handle 401
- Wire RealPropertyDataService endpoints with API keys; add cache per zip/address/day to control spend; add global Axios interceptors with timeouts/retries

D3–D7
- Implement Twilio SMS campaign MVP:
  - Campaign entity to scheduled job → message sends → CampaignLog entries
  - Opt-out (STOP), link tracking placeholder, per-org throttle
- Implement DNC/TCPA baseline:
  - DNC check cache per phone (provider TBD) and consent logging; enforce quiet hours

D7–D10
- Observability: add Sentry, correlation IDs, basic Prometheus metrics
- Auth hardening: refresh tokens + rotation + revoke on logout; test coverage for auth
- Reliability: idempotency keys for createLead and skip traces; bulk batching where possible

See PRIORITY_PLAYBOOK.md for the full two-week schedule.

---

## 13) Unknowns and Open Questions

- Which environment will be authoritative for Prisma? (backend Postgres recommended)
- Which exact external APIs will be funded for production (ATTOM, DataTree, Twilio)? Replace placeholders with contracts/keys.
- Frontend design for campaigns, opt-out flows, and dashboards — wireframes/UX decisions needed.
- Queue/worker selection (BullMQ/Redis vs. simple cron) based on deployment constraints (DigitalOcean vs. managed Redis).
- Compliance counsel requirements for TCPA and data handling specifics (retention, right-to-delete workflow).

Remediation paths are listed in GAP_LIST.md → Unknowns with proposed next steps.

---

## 14) Documented API Surface Snapshot

Mounted (backend/src/server.ts):
- GET /health
- GET /api/system/status
- GET /api/system/cost-estimate
- /api/auth (register, login, forgot-password, reset-password)
- /api/leads (CRUD, stats, call-script, notes, skip-trace)
- /api/campaigns (placeholder)
- /api/calls (placeholder)
- /api/scraper (zillow, jobs, process-records)
- /api/skip-trace (placeholder index)
- /api/analytics (placeholder index)
- /api/organizations (placeholder index)
- /api/zip-search (search-zip, search-multiple-zips, search-target-area, zip-stats, revenue-analytics, lead/:id, lead/:id/status, lead/:id/contact-script)
- /api/real-estate (search-real-zip, search-real-multiple-zips, search-real-target-area, api-usage-stats, reset-counters)
- /api/master (ultimate-search, probate-leads, foreclosure-leads, high-equity-leads, master-usage-stats, reset-master-counters)

Complete details in ENDPOINTS.md with example requests/responses.

---

## 15) Integrations and Costs

Present in code (service wrappers exist or configs in masterConfig)
- Property data: ATTOM, Estated, PropMix, DataTree, Zillow/RapidAPI, RentSpree, RealtyMole, PropertyRadar
- Probate/deceased: US Obituary API, court records stubs
- Skip trace/contact: Batch Skip Tracing, Whitepages Pro, Clearbit (planned), PeopleDataLabs
- AI: OpenAI (chat completions used)
- Maps/Geo: Google Maps (geocode)
- Telephony: Twilio SMS/Voice planned (libs installed)
- Observability: Winston/morgan; Sentry not yet

Costs and guardrails summarized in INTEGRATIONS.md and OBSERVABILITY.md.

---

## 16) Build Health and Governance

- Lint/typecheck/test not enforced in CI (no workflow present)
- Dead code and dual implementations (server.ts in root vs backend) add confusion
- Bundle sizes not measured; no source-map-explorer reports
- License compliance unknown; add license-checker if needed

See BUILD_HEALTH.md for specifics and PR-ready tasks.

---

This report is complemented by:
- FEATURE_MATRIX.md — status grid with completion %
- GAP_LIST.md — gaps/blockers with severity and fixes
- PRIORITY_PLAYBOOK.md — two-week engineering plan (D0, D3, D7, D10)
- ENDPOINTS.md — REST API surface with examples
- SCHEMA_MAP.md — Mermaid ERD and relation notes
- INTEGRATIONS.md — external APIs, health, and cost guardrails
- TEST_PLAN.md — targets and enumerated tests
- SECURITY_CHECKLIST.md — auth, secrets, PII/DNC/TCPA compliance checks
- OBSERVABILITY.md — logging/metrics/tracing plan
- BUILD_HEALTH.md — CI/CD, linting, type-safety, dead code, bundle size
- TODO.labels.json — machine-readable issues
- ROADMAP_DELTA.md — divergence from proposal and recommended pivots
