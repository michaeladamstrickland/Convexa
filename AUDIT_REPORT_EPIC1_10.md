# Convexa (Leadflow AI) – Full Codebase Audit: Epics 1–10

Last updated: 2025-09-14

## Runtime snapshot

- Frontend fast build: PASS (typecheck deferred; 468 TS errors remain)
- API base (frontend axios): http://localhost:5001/api
- Backend on 5001: healthy; ATTOM proxy enabled at /api/attom/*
- ATTOM status: GET /api/attom/status → online: true, apiConfigured: true
- Metrics: /api/dev/metrics currently NOT exposed by the active server (requires wiring)

## Audit matrix by epic

### Epic 1–3: Bootstrapping
- PostgreSQL + Prisma: PRESENT in repo (.env DATABASE_URL points to Postgres); runtime not validated against live DB yet
- Entities: Lead/User/Org/SkipTrace/Campaign/CRM: Prisma models and routes found; full CRUD not verified in this run
- REST scaffolding: Present under src/routes and backend variants
- Express + Vite: Present and working (dev/fast-build OK)
- Keys from .env: ATTOM, OpenAI, Twilio, BatchData, Google Maps present (values require validation)
- Docker Compose: File exists; not executed in this pass

Status: Partial/needs validation against live DB

### Epic 4–5: Lead Management
- /leads list/detail: Present under src/routes/leadRoutes.ts; not fully exercised end-to-end
- LeadsTable UI: Present; runtime gated by TS errors but not strictly blocked
- LeadDetailPage: Present; requires live backend run-through
- Skiptrace & CRM activity: adminMetrics routes implement CRM activity; skiptrace endpoints present in integrated server; needs E2E check

Status: Partial; appears wired, requires E2E confirmation

### Epic 6–7: CRM + Voice Calls
- Endpoints: callRoutes present; webhook/CRM activity present
- Transcripts → summary via OpenAI: OpenAI key present; not invoked in this run
- Metrics increments: Tests reference leadflow_*; metrics endpoint missing on active server → needs wiring

Status: Partial; metrics exposure missing in active runtime

### Epic 8: Analytics Panel
- DashboardMetrics/CallInsightsPanel present; parser utils present in docs/tests
- Recharts installed
- /api/dev/metrics: Not responding on the active server (Cannot GET); implement route or run the server variant that provides it

Status: Partial; backend metrics missing

### Epic 9: Mock Removal and DTO Normalization
- MOCK flags: No active global mocks found; ATTOM integrated server is live
- DTO alignment: Some FE types mismatch (e.g., radius number vs string; latitude string vs number) cause TS errors
- Skiptrace cache invalidation: Not verified
- AttomPropertyService uses shared axios client: YES

Status: Partial; type mismatches remain

### Epic 10: Observability and Export
- CallInsightsPanel shows histogram/percentiles: Component ready; requires metrics
- Filters/links/export: Present in FE, pending backend metrics
- METRICS_GUIDE.md: Present
- /metrics/history: Deferred by design

Status: Partial; needs /api/dev/metrics

## API client and endpoint validation

- /leads, /leads/:id: Routes exist; not exercised here
- /leads/:id/skip-trace: Present in integrated servers; not invoked
- /crm-activity create+list: Present at /api/admin/crm-activity (tested only by reading code)
- AttomPropertyService: Uses shared base; endpoints live at /api/attom/*
- ATTOM endpoints: Status confirmed; actual property queries depend on valid key

## Prometheus and Analytics panel

- Expected metrics: leadflow_call_* and histograms; not exposed at /api/dev/metrics on active server
- Percentiles and recharts: FE ready but blocked by missing metrics
- Filters and deep links: in FE; blocked by missing metrics text

## DTO/type alignment

Key mismatches causing TS errors (frontend Build Typecheck):
- PropertySearchWorkspace: radius number vs string; lat/long string vs number
- MUI components: Grid/ListItem prop usage misaligned with MUI v5 typings
- Missing types file for skiptrace service

Recommendation: Harmonize AttomPropertyService types with UI DTOs; standardize numeric vs string fields; correct MUI v5 prop usage (Grid item/xs, ListItem selected prop)

## Cache invalidation

- useSkipTrace invalidations: Not verified; search for react-query keys needed
- useCreateCrmActivity invalidations: Not verified

Action: Add tests/grep to confirm invalidation keys or wire them in the hooks

## API keys + live integration audit

From .env (present):
- ATTOM_API_KEY: PRESENT (value redacted)
- BATCHDATA_API_KEY: PRESENT
- WHITEPAGES_API_KEY: PRESENT (fallback)
- GOOGLE_MAPS_API_KEY: PRESENT
- OPENAI_API_KEY: PRESENT
- TWILIO_*: PRESENT
- SMTP_*: NOT FOUND in .env (optional)

Recommendation: Validate keys in a secrets manager; avoid committing secrets to Git

## Smoke test plan and findings

Planned workflow:
1) ZIP search via /api/attom/property/zip
2) Select a result and fetch /detail
3) Skiptrace → CRM log
4) Add CRM note via /api/admin/crm-activity
5) Analytics panel → verify counters in /api/dev/metrics

Current blockers:
- /api/dev/metrics missing → analytics blocked
- Frontend TS errors prevent full type-safe build (fast build OK for smoke)
- Not all endpoints were hit due to time constraints

## Confirmed working
- ATTOM server live behind /api/attom/*
- Health endpoint on 5001
- Frontend fast build bundles

## Partial / needs cleanup
- FE type mismatches (MUI props, DTO conversions)
- Missing /api/dev/metrics exposition in active backend
- Hooks invalidation verification

## Broken / not found
- None of the listed epics were completely absent; however, metrics endpoint not responding blocks analytics

## API key/proxy blockers
- Keys are in .env; should be moved out of repo and validated
- ATTOM proxy is working; actual data depends on valid API key rate limits

## Prometheus gaps
- /api/dev/metrics: Not exposed on the active process
- No histograms visible to FE

## DTO/type gaps
- radius: number vs string
- latitude/longitude: number vs string in different layers
- Missing types/skiptrace

## Launch Readiness Score
- 72% — Core flows present with working ATTOM proxy and health. Analytics and FE type safety need resolution; promise good viability after small backend metrics wiring + TS cleanup.

## Immediate fixes recommended
- Expose /api/dev/metrics in the active server (or mount admin/middleware that provides it)
- Resolve top 20 TS errors (MUI Grid/ListItem usage; Property DTO alignment) to allow full build
- Audit hooks for cache invalidation; add unit tests
- Remove secrets from .env in repo and use env var injection

