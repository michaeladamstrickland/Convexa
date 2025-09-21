# Convexa Deep Audit — Execution TODO

Timezone: America/New_York (ET)

This checklist drives the deep audit and artifact generation for the Convexa monorepo. No destructive code changes; documentation artifacts only.

## Scope and Constraints
- Monorepo structure identified:
  - backend/ (Express + TypeScript, Prisma, routes, services, tests)
  - frontend/ (React + Vite + Tailwind)
  - prisma/ (separate schema/migrations & dev.db)
  - src/ (additional TS services and server implementations)
- Hard rules: read-only analysis; produce artifacts at repo root.

## Acceptance Criteria
- All required artifacts are created at repo root:
  - AUDIT_REPORT.md
  - FEATURE_MATRIX.md
  - GAP_LIST.md
  - PRIORITY_PLAYBOOK.md
  - ENDPOINTS.md
  - SCHEMA_MAP.md
  - INTEGRATIONS.md
  - TEST_PLAN.md
  - SECURITY_CHECKLIST.md
  - OBSERVABILITY.md
  - BUILD_HEALTH.md
  - TODO.labels.json
  - ROADMAP_DELTA.md
- Each feature is scored with defensible % complete.
- Playbook contains a D0/D3/D7/D10 two-week plan to reach “real leads flowing”.

---

## Task List

- [x] 0. Baseline plan confirmed
  - Methodology: repo inventory → dependency health → backend → frontend → scraping → data lifecycle → security → testing/CI → observability/cost → artifacts.

- [x] 1. Repository Inventory (condensed)
  - [x] Parse package.json (root/backend/frontend)
  - [x] Note tsconfig, eslint/prettier, jest, docker files
  - [x] Identify prisma schemas (backend/prisma and root/prisma)
  - [ ] Add condensed trees (backend/src, frontend/src) to AUDIT_REPORT.md

- [x] 2. Dependency Graph & Health
  - [x] Extract deps/devDeps for backend/frontend/root
  - [x] Identify overlaps, risks, type strictness, lint/format configs
  - [ ] Add risk notes to BUILD_HEALTH.md

- [x] 3. Backend Analysis
  - [x] Map route files and mounts (backend/src/server.ts)
  - [x] Read representative route files: leads.ts, auth.ts
  - [x] Inspect middleware: auth.ts, validation.ts, error handler (file exists)
  - [x] Inspect Prisma schema (backend/prisma/schema.prisma)
  - [x] Identify external services (ATTOM, DataTree, OpenAI, Skip trace, Zillow, Puppeteer)
  - [ ] Read remaining route files to finalize ENDPOINTS.md:
    - [ ] backend/src/routes/zipSearch.ts
    - [ ] backend/src/routes/realEstateRoutes.ts
    - [ ] backend/src/routes/masterRealEstateRoutes.ts
    - [ ] backend/src/routes/masterRoutes.ts
    - [ ] backend/src/routes/masterRoutes_new.ts
    - [ ] backend/src/routes/probateRoutes.ts
    - [ ] backend/src/routes/scraper.ts
    - [ ] backend/src/routes/campaigns.ts
    - [ ] backend/src/routes/calls.ts
    - [ ] backend/src/routes/organizations.ts
    - [ ] backend/src/routes/leadflowApi.ts
  - [ ] Add error handling, rate-limits, idempotency assessment to AUDIT_REPORT.md

- [x] 4. Frontend Analysis
  - [x] Inventory routing, pages, components:
    - frontend/src/App.tsx, main.tsx
    - frontend/src/pages/*, frontend/src/components/*
  - [x] Inspect API client usage: frontend/src/api/*
  - [x] Note auth flow, forms, loading/error states, accessibility, responsiveness
  - [x] Add findings to AUDIT_REPORT.md and FEATURE_MATRIX.md (frontend columns)

- [x] 5. Scraping/Enrichment
  - [x] Identify scraper (backend/src/scrapers/zillowScraper.ts)
  - [x] Inspect persistence (PropertyRecord), hashing/dedupe
  - [x] Check job scheduling: backend/src/jobs (scraperCron.ts referenced in scripts)
  - [x] Document pipelines in AUDIT_REPORT.md

- [x] 6. Data Model & Lifecycle
  - [x] Map core entities from backend/prisma/schema.prisma
  - [x] Prepare Mermaid ERD for SCHEMA_MAP.md
  - [ ] Elaborate lifecycle stages and event logging/audit trail support

- [x] 7. Security & Compliance
  - [x] AuthN/AuthZ review: JWT, roles, org ownership filters in queries
  - [x] PII fields and DNC/TCPA presence (gaps)
  - [x] Add checklist and gaps to SECURITY_CHECKLIST.md and GAP_LIST.md

- [x] 8. Testing & CI/CD
  - [x] Detect backend tests (jest, ts-jest) and existing tests
  - [ ] Determine missing unit/integration/e2e coverage targets
  - [ ] Add test plan to TEST_PLAN.md
  - [ ] Note CI/CD status and proposed pipeline in BUILD_HEALTH.md

- [x] 9. Observability & Cost
  - [x] Logging: winston/morgan present
  - [x] Cost controls in config (MasterConfigService costPerCall), rate limiting
  - [x] Add recommended Sentry/tracing/metrics to OBSERVABILITY.md

- [ ] 10. Generate Artifacts
  - [ ] AUDIT_REPORT.md
  - [ ] FEATURE_MATRIX.md
  - [ ] GAP_LIST.md
  - [ ] PRIORITY_PLAYBOOK.md
  - [ ] ENDPOINTS.md
  - [ ] SCHEMA_MAP.md
  - [ ] INTEGRATIONS.md
  - [ ] TEST_PLAN.md
  - [ ] SECURITY_CHECKLIST.md
  - [ ] OBSERVABILITY.md
  - [ ] BUILD_HEALTH.md
  - [ ] TODO.labels.json
  - [ ] ROADMAP_DELTA.md

- [ ] 11. Unknowns resolution
  - [ ] Add any uncertainties to GAP_LIST.md → Unknowns with proposed resolution (files to read, spikes to run).

---

## Notes and References

- Back-end mounts and system endpoints:
  - backend/src/server.ts mounts:
    - /health, /api/system/status, /api/system/cost-estimate
    - /api/auth, /api/leads, /api/campaigns, /api/calls, /api/scraper
    - /api/skip-trace, /api/analytics, /api/organizations, /api/zip-search, /api/real-estate, /api/master (conditional)
- Prisma schemas:
  - backend/prisma/schema.prisma (PostgreSQL provider)
  - prisma/schema.prisma (separate root schema; TBD — likely SQLite due to prisma/dev.db)
- External services present in code:
  - ATTOM, DataTree, Zillow (RapidAPI), OpenAI, Google Maps
  - Skip tracing providers (BatchSkipTracing, Whitepages; public records fallback)
  - Puppeteer for Zillow scraping
- Security:
  - JWT-based auth, restrictTo middleware, Zod and express-validator-based validation
  - Rate limiting, Helmet, CORS, input sanitization

---

## Next Commands (optional, manual)
- None required; documentation-only task. For future health checks:
  - npx prisma validate (both prisma roots if applicable)
  - rg to list routes and anys
  - ts-prune for dead exports (if installed)
