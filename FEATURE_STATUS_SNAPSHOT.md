# Convexa AI — Feature Status Snapshot (2025-08-19)

Purpose: Single-page inventory of features, current completion % (rubric below), what’s working, and where to focus next. Based on code and docs in this repo.

Completion rubric
- 0%: no code
- 25%: scaffolding + stubs
- 50%: works locally; missing validation/edge cases/tests
- 75%: E2E happy path + validation + basic tests
- 100%: production-ready (docs, edge cases, alerts, rollback)

High-level summary
- UI present: Yes (React + Vite) with multiple pages and a working Zip Code Lead Search connected to backend endpoints.
- Backend present: Yes (Express + TypeScript). Real endpoints for real-estate searches, plus a “master” orchestration layer.
- Real APIs: Wiring for Zillow (RapidAPI), ATTOM, RealtyMole, Batch Skip Tracing and others. Some calls are implemented; several signals are stubbed or TODO (probate, code violations, bankruptcy, vacancy, etc.).
- Tests: Basic structure present; not comprehensive.

Key features and status
- Ingestion (APIs)
  - Backend: RealPropertyDataService calls Zillow, ATTOM, RealtyMole; skip tracing via Batch; cost tracking. Several signal sources are stubbed.
  - Frontend: ZipCodeLeadSearch calls real endpoints; MasterLeadGeneration UI built.
  - Completion: 60-65% (working searches + cost tracking; gaps: retries, timeouts per-source, caching, missing sources)

- Ingestion (Scrapers)
  - Backend: Puppeteer-based Zillow FSBO present with scripts; cron job scaffolding.
  - UI: Scraper page present (demo data).
  - Completion: ~50% (needs proxy/stealth, storage of raw HTML snapshots, scheduler hardening, error handling)

- Deduplication
  - Backend: Address-based normalize/dedupe in master service; unique constraints implied via Prisma (not fully verified here).
  - Completion: ~50% (unify across all pipelines and DB constraints)

- Address validation/geocode
  - Backend: AddressValidationService referenced in master service; not fully wired in real property pipeline.
  - Frontend: No explicit form validation using service.
  - Completion: ~35%

- Enrichment (Skip-trace/contact discovery)
  - Backend: Batch Skip Tracing integrated in RealPropertyDataService; enrichment pipeline in master service with TODOs.
  - Frontend: Not surfaced beyond lead rows.
  - Completion: ~50%

- Owner match/normalization
  - Backend: Types and partial mappings; confidence model not formalized.
  - Completion: ~40%

- AI Lead Scoring
  - Backend: Master service posts to OpenAI; RealPropertyDataService computes heuristic scores. Prompting/scoring implemented; some defaults on failure.
  - Frontend: Scores displayed in UI.
  - Completion: ~60%

- Lead views/filters
  - Backend: Leads routes mounted; not audited end-to-end here.
  - Frontend: Dashboard/Leads pages present (some mock data); Zip search table is functional against real search endpoints.
  - Completion: ~45-50%

- Campaigns (SMS/Voice/Mail)
  - Backend: Twilio dependency, routes scaffolded; no end-to-end flows verified.
  - Frontend: No flows exposed.
  - Completion: ~25%

- DNC/TCPA guardrails
  - Backend: Not implemented.
  - Completion: ~10%

- CRM tasks/timeline (notes, calls, logs)
  - Backend: Routes/models indicated; not verified in UI.
  - Completion: ~40%

- User/org auth
  - Backend: JWT-based routes mounted; org scoping hinted.
  - Frontend: Login page with demo creds; no persistent session.
  - Completion: ~60-65%

- Billing limits / cost guardrails
  - Backend: Master service enforces daily budget limit; real property service tracks costs (no hard cutoff).
  - Completion: ~45-50%

- File uploads
  - Backend: Multer installed; no flows.
  - Frontend: None.
  - Completion: ~10%

- Flip Tracker (budget, tasks, P/L, photo log)
  - Docs only; endpoints not present.
  - Completion: ~10%

- Analytics dashboards
  - Backend: Analytics routes mounted; metrics wiring not validated.
  - Frontend: Analytics/AdvancedAnalytics pages (demo data).
  - Completion: ~35%

- Admin ops
  - Backend: System status, cost estimate, API usage stats, reset counters present.
  - Completion: ~30-40%

Front-end (UI) status
- Exists: Yes. Vite + React app with routing and pages.
- Notable screens/components
  - Pages: EmpireDashboard, Dashboard, Leads, Analytics, AdvancedAnalytics, Scraper, Login
  - Lead Generation: ZipCodeLeadSearch (wired to real endpoints), MasterLeadGeneration (wired to /api/master/*)
  - Styling: Tailwind; lucide-react icons; React Query setup
- Assessment: ~70% (UI built and navigable; some pages still use mock data; login uses demo credentials; needs auth persistence, toasts, and tighter error states)

Back-end endpoints (selected)
- Real searches (implemented):
  - POST /api/real-estate/search-real-zip
  - POST /api/real-estate/search-real-multiple-zips
  - POST /api/real-estate/search-real-target-area
  - GET  /api/real-estate/api-usage-stats
  - POST /api/real-estate/reset-counters
- Master searches (implemented, some data sources stubbed):
  - POST /api/master/ultimate-search
  - POST /api/master/probate-leads
  - POST /api/master/foreclosure-leads
  - POST /api/master/high-equity-leads
- System:
  - GET  /api/system/status
  - GET  /api/system/cost-estimate

Evidence (code paths)
- Frontend
  - frontend/src/App.tsx — routes and layout
  - frontend/src/components/ZipCodeLeadSearch.tsx — real search UI calling /api/real-estate/*
  - frontend/src/components/MasterLeadGeneration.tsx — master searches calling /api/master/*
  - frontend/src/services/realEstateAPI.ts — API client methods and typings
- Backend
  - backend/src/routes/realEstateRoutes.ts — real search routes (axios to Zillow/ATTOM/RealtyMole/Batch)
  - backend/src/routes/masterRealEstateRoutes.ts — master orchestration endpoints
  - backend/src/services/realPropertyDataService.ts — real API client implementations + enrichment stubs
  - backend/src/services/masterRealEstateService.ts — multi-source pipeline with several TODOs
  - backend/src/server.ts — mounts routes and system endpoints

Gaps and recommended next steps (top 8)
1) Fill enrichment stubs in RealPropertyDataService: probate, code violations, vacancy, foreclosure feeds; add retries/timeouts per-source.
2) Master service: implement tax/bankruptcy/probate filings, contact enrichment, market/legal data; persist costBySource + callsPerSource.
3) Add caching (per-address, per-zip) and idempotency to cut API spend; persist to DB.
4) Persist auth sessions (refresh tokens), secure cookie; wire frontend auth to backend.
5) Replace mock data on UI pages; connect Leads/Analytics pages to real endpoints with pagination and filters.
6) Add DNC/TCPA guardrails, consent logging, quiet hours, and suppressions.
7) Tests: add integration tests for /api/real-estate/* and /api/master/*; seed minimal fixtures; CI gate.
8) Observability: per-source error metrics, alerting on budget exceed, and backoff policies.

Notes
- Real API keys required in .env for live runs. Several endpoints will return empty data without keys.
- Some docs assert “production ready”; code shows many sources still stubbed — treat as advanced beta until stubs are implemented and tested.
