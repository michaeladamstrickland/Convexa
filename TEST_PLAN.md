# Convexa — Test Plan

Timestamp (ET): 2025-08-16 12:00 ET

Objective
- Establish unit, integration, and e2e coverage targets and enumerate concrete tests for backend and frontend. Focus on correctness, reliability, security, and cost guardrails for production readiness.

Coverage Targets
- Backend
  - Unit: 70%+ statements, 70%+ branches on controllers, middleware, utilities, and most services with heavy mocking of external APIs.
  - Integration: 15–25 core endpoint flows (auth, leads, zip search, real-estate search in dry-run), with in-memory DB or test Postgres; 60% lines across routes.
  - e2e (optional short set): 5–8 smoke tests with supertest for key happy paths.
- Frontend
  - Unit: 60%+ statements for components with logic (forms, API hooks, table filters).
  - Integration: 10–15 tests for routed pages and API interactions using MSW.
- Non-functional
  - Security: auth flows incl. refresh/rotation (once implemented), validation failures, RBAC checks.
  - Resilience: timeouts/retries (mocked), idempotency for mutating endpoints (once implemented).
  - Compliance: DNC/TCPA enforcement (once implemented).

Tooling
- Backend: Jest, ts-jest, supertest, MSW (node) or nock for HTTP mocks.
- Frontend: Vitest or Jest + @testing-library/react, MSW for API mocks.
- Static: ESLint, TypeScript strict mode, ts-prune (dead exports), dependency audit.

Environments
- Local tests should not call paid external APIs. Use MSW/nock fixtures.
- DB: 
  - Primary target: Postgres (backend/prisma). For integration tests, prefer a disposable Postgres (testcontainers) or a dedicated test database with migrations.
  - If necessary interim: sqlite prisma adapter in-memory for unit-level repository tests (avoid for production flows).

Commands (examples)
- Backend:
  - npm run test (in backend/)
  - jest --coverage --runInBand
- Frontend:
  - npm run test (configure if missing) or vitest run --coverage
- Lint/typecheck:
  - npm run lint, tsc -p tsconfig.json

---

## Backend Test Suite

1) Auth Routes (backend/src/routes/auth.ts)
- register: 201, sets organization and admin role; duplicate email → 400
- login: 200 with token for valid credentials; invalid email/pw → 401
- login updates lastLoginAt
- token structure: exp presence, signature verifiable (without verifying secret in tests)
- Negative: missing fields → 400 (zod validator)

2) Auth Middleware (backend/src/middleware/auth.ts)
- authenticate: 
  - missing token → 401
  - invalid token → 401
  - valid token loads req.user and passes
- restrictTo:
  - role mismatch → 403
  - role allowed → next()
- apiKeyAuth:
  - missing/invalid key → 401
  - valid key → next()

3) Validation Middleware (backend/src/middleware/validation.ts)
- sanitizeInput strips scripts and dangerous attributes
- validateSchema returns 400 with detailed field errors (zod)
- express-validator: leadValidation rules catch invalid inputs

4) Leads Controller (backend/src/controllers/leadController.ts)
- getLeads:
  - returns paginated results with filters applied
  - search OR across address/owner/city works
- createLead:
  - 201 with assignedToId defaulting to current user
  - triggers aiService.analyzeLeadPotential (mocked) and updates lead with AI fields
- updateLead:
  - 200 with updated fields; lead not found → 404
- deleteLead:
  - soft delete sets isActive=false; 200 success
- runSkipTrace:
  - returns cached recent result if available (<=30 days)
  - if none, calls skipTraceService.runSkipTrace (mocked) and updates lead phone/email if present
- addLeadNote:
  - 201; lead not found → 404
- getLeadStats:
  - returns counts and averages for timeframe
- generateCallScript:
  - aiService.generateCallScript (mocked) returns string; lead not found → 404

5) Zip Search Routes (backend/src/routes/zipSearch.ts)
- search-zip: requires zipCode; returns sorted results by aiScore then marketValue
- search-multiple-zips: requires array; OR filtering logic
- search-target-area: returns all leads
- zip-stats: groups by zip; computes stats fields; city inference basic
- lead/:id: 404 when missing; success path returns lead
- lead/:id/status: patch updates fields; P2025 → 404

6) Real Estate Routes (backend/src/routes/realEstateRoutes.ts)
- search-real-zip:
  - valid body generates PropertySearchParams; propertyService.searchProperties mocked
  - response maps to leads structure and returns metadata and aggregations
  - missing zipCode → 400
- search-real-multiple-zips:
  - validates array; mocks service; returns aggregated results
- search-real-target-area:
  - uses predefined Phoenix zips; mocks service; returns enriched tags mapping
- api-usage-stats:
  - returns cost counters (mock propertyService)
- reset-counters:
  - returns success

7) Master Real Estate Routes (backend/src/routes/masterRealEstateRoutes.ts)
- ultimate-search/probate-leads/foreclosure-leads/high-equity-leads:
  - mocks masterService.masterPropertySearch with canned dataset; filters applied where applicable
- master-usage-stats/reset-master-counters:
  - success paths with mocked cost and data sources

8) Services
- aiService / aiAnalysisService:
  - generateCallScript, analyzeLeadPotential return structured outputs; OpenAI SDK mocked; handles error path
- skipTraceService:
  - runSkipTrace tries providers in order; persists SkipTraceRecord; returns failed result when all providers fail
  - saveSkipTraceRecord stores request/response and logs; test error handling
- realPropertyDataService:
  - enrichPropertyData assembles RealPropertyData; calculators for equity/equityPercent; handles nulls; axios clients mocked
- addressValidationService:
  - validateAddress success/failure; caches if implemented
- dataTreeService / attomDataService:
  - basic GET wrappers with headers; timeout/retry behavior once introduced

9) Config & Startup
- masterConfig:
  - getSystemStatus returns consistent counts based on enabled API keys
  - invalid LEADFLOW_TIER throws at startup
  - getEstimatedCostPerSearch sums enabled api costPerCall

10) Error Handler
- AppError usage produces consistent shape and codes
- Global errorHandler returns 500 with message for unexpected errors

Integration Tests (supertest)
- /api/auth/register, /api/auth/login
- Auth-protected route: /api/leads requires Authorization header
- /api/leads CRUD happy paths
- /api/zip-search/search-zip happy path
- /api/real-estate/search-real-zip with service mocked behind dependency injection (module mocking)

Fixtures and Mocks
- MSW/nock fixtures for ATTOM, Zillow (RapidAPI), Google Maps, OpenAI, Batch Skip Tracing, Whitepages.
- Prisma: test database setup with migrations per run; cleanup in afterAll.

---

## Frontend Test Suite

1) Auth/Login Page
- renders form; validation errors
- successful login stores token, sets auth state, navigates to dashboard
- failed login shows error message
- logout clears token and returns to login

2) App Routing (src/App.tsx)
- unauthenticated → Login
- authenticated → renders Layout with routes
- route protection works for /leads, /analytics, /zip-search

3) ZipCodeLeadSearch Component
- submits valid zip; shows loading → results table
- handles API error gracefully
- pagination/limits (if present); displays metadata (leadCount)

4) Leads Page
- fetches /api/leads with query params; renders table
- filters by status/propertyType; shows empty state

5) Analytics Pages
- renders charts/metrics placeholders from backend /zip-search/revenue-analytics and /zip-search/zip-stats (mocked)

6) API Client (frontend/src/api/client.ts)
- attaches Authorization header from storage
- handles 401 → triggers logout/redirect
- retries disabled by default (reliability handled backend)

---

## Test Data and Seeding

- Minimal seed:
  - Organization, admin user, 3–5 leads across two zip codes, 1–2 LeadNotes each, a SkipTraceRecord completed within last 30 days for one lead
- For frontend MSW: canned JSON mirrors backend responses

---

## CI Gates (to include in BUILD_HEALTH.md workflow)

- lint (backend, frontend)
- typecheck (tsc)
- test (backend unit + integration; frontend unit)
- prisma generate/validate
- build
- artifacts: coverage reports uploaded

---

## Roadmap Tests (post-implementation)

- DNC/TCPA enforcement:
  - Sending during quiet hours blocked
  - DNC cache prevents send
  - ConsentLog presence allows send
- Auth refresh/rotation:
  - Access token expiry → refresh path works; revoked refresh fails
- Idempotency:
  - Repeated POST with same Idempotency-Key creates only one resource
- Observability:
  - Correlation ID present in logs and returned in headers
  - /metrics exposes HTTP histograms and external API counters
