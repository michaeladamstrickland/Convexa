# Code & API Audit — Convexa (2025-09-20)

This document summarizes the current API surface, validation posture, test/coverage baseline, and safe scaffolds proposed for Leads Board M1, Artifacts/Guardrails UI, and a Dialer v1 vertical slice. Changes are strictly additive and low-risk.

## Executive summary

- Project type: TypeScript-first (ESM) with a few CommonJS CLI utilities (.cjs). Root package.json has "type": "module".
- Servers: Primary TS server in `src/` (e.g., `src/server.ts`) and an integrated Express server at `backend/integrated-server.js` (ESM JS). Multiple route modules exist under `src/routes` and `backend/src/routes`.
- DB: SQLite (better-sqlite3) used by integrated server; Prisma exists in the TS app. Single canonical path is `backend/data/convexa.db` (operationally enforced).
- Observability: prom-client available; `/metrics` served in the integrated server.
- Validation: No consistent runtime schema validation across routes. Introducing zod DTOs + a `validateBody` middleware is recommended (scaffold provided).
- Tests: Jest config present historically; Vitest scaffolding added for unit/contract/snapshot with coverage. Tests are additive and pass by default.

## API inventory (high-level)

Authoritative, detailed listing is in `docs/API_SURFACE.md`. Highlights:

- Health: GET `/health` (backend/integrated-server.js)
- Status & Debug:
  - GET `/api/status`
  - GET `/api/debug/*` (provider calls, errors, skiptrace latest, attempt reasons, zip hints)
  - GET `/metrics`
- Search/Leads:
  - GET `/api/zip-search-new/search`
  - POST `/api/zip-search-new/search-zip`
  - POST `/api/zip-search-new/add-lead`
  - POST `/api/search` (TS server has separate routes too)
- Leads read:
  - GET `/api/leads/:id`
- Skiptrace:
  - POST `/api/leads/:id/skiptrace`
  - GET `/api/leads/:id/skiptrace`
  - POST `/api/leads/bulk/skiptrace`
  - GET `/api/skiptrace/quota`
  - GET `/api/skiptrace/analytics`
  - GET `/api/skiptrace-runs/:runId/status`
  - GET `/api/skiptrace-runs/:runId/report`
  - POST `/admin/skiptrace-runs/:runId/resume` (mounted via admin router)
- ATTOM proxy:
  - GET `/api/attom/property/address`
  - GET `/api/attom/property/zip`
  - GET `/api/attom/property/:attomId`
  - GET `/api/attom/property/:attomId/valuation`

## Validation posture

- Many routes accept JSON and query params without standardized validation or error shape.
- Proposed: `src/dto/v1/*.ts` with zod schemas and type inference; `src/middleware/validateBody.ts` to enforce body validation when wired.
- Error format: Problem+JSON style `{ code, field?, message }` suggested for consistency.

## Tests & coverage (baseline)

- Added Vitest config and scripts. Minimal passing tests included to produce a coverage baseline without touching core flows.
- Test types added:
  - Contract tests (skeleton) for provider adapters (retry/backoff semantics noted).
  - Idempotency/cache unit test (skeleton) for cache key stability and miss/hit.
  - Snapshot tests for enriched.csv header escaping and report.json minimal shape (synthetic samples).

Run locally:

```sh
npm run coverage
```

This produces `coverage/coverage-summary.json`. Initial coverage will be low; modules with 0% are listed in the output.

### Coverage baseline (2025-09-20)

- Total lines: 30,824 — covered: 67 (0.21%)
- Functions: 185 — covered: 21 (11.35%)
- Branches: 187 — covered: 24 (12.83%)

Notes:
- Our new scaffolds are included and green: `src/dto/v1/leads.ts` at 100%, `src/middleware/validateBody.ts` ~53%.
- Core modules remain at 0% until we backfill targeted tests. This is expected; we intentionally scoped Vitest to new suites to avoid disturbing legacy Jest tests.

## Operator UI scaffolds (safe, doc-first)

Proposed structure (docs-only for now):

- Leads Board M1
  - Pages: `/leads`, `/leads/:id`
  - API usage:
    - GET `/api/zip-search-new/search?query=&status=&page=&limit=`
    - GET `/api/leads/:id`
  - DTOs: `Lead`, `LeadListResponse`, `Pagination` (see `src/dto/v1/leads.ts`).

- Artifacts & Guardrails UI
  - Pages: `/admin/artifacts`, `/admin/guardrails`
  - API usage:
    - GET `/admin/artifacts` (list) [thin route stub recommended]
    - GET `/admin/guardrails/state` (already via admin router)
  - DTOs: `Artifact`, `ArtifactListResponse`, `GuardrailsState`.

Thin route stubs are suggested but not added to avoid touching running servers; see `docs/API_SURFACE.md` for proposed signatures.

## Dialer v1 (design-only)

See `docs/DIALER_V1.md` for endpoints, DTOs, metrics, compliance, and pseudocode.

## Quality & hygiene findings

- ESM/CJS interop: Mixed ecosystem (ESM root + .cjs scripts). Keep Node-based wrappers for Windows compatibility.
- Unhandled promise rejections: ensure `await`ed calls in route handlers are try/catch wrapped (skiptrace routes comply; others should be verified).
- Blocking I/O: Some endpoints query SQLite synchronously (better-sqlite3). Acceptable for current needs; avoid heavy loops per-request.
- Any types: TS code generally typed; validation at runtime is sparse (address via zod DTOs over time).

## Quick wins (surgical diffs recommended)

- Add `validateBody` usage to mutating routes (e.g., POST add-lead, skiptrace) with corresponding DTOs.
- Standardize error shape `{ code, field?, message }` and set `res.type('application/problem+json')`.
- Emit per-route metrics (label: method, route, status) — already scaffolded in integrated server.
- Add DB indices (as planned) and confirm WAL + busy_timeout PRAGMAs (already in place).

## Prioritized TODOs

1) Wire zod validators on write endpoints (opt-in, route by route).
2) Add minimal `/admin/artifacts` route returning known bundles with signed URLs (24h TTL); leverage existing `run_reports/` structure.
3) Implement Grafana panels for calls, costs, cache hit-rate, latency, quota fraction; add alert thresholds.
4) Expand contract tests to load adapter fixtures and simulate 429/5xx backoffs.
