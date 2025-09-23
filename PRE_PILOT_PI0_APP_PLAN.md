# Pre-Pilot PI-0 — App Plan (PI0-APP-1..8)

This document tracks scope, acceptance criteria, approach, dependencies, and proof artifacts for PI-0 app tickets. Changes should be additive, use Zod for DTOs, return consistent Problem+JSON on errors, produce signed URLs for downloadable bundles, and keep zero spend.

Authoritative server: `backend/integrated-server.js` (Node 20, Express, better-sqlite3, prom-client). Storage: LOCAL_STORAGE_PATH (default `/data/run_storage`). Artifacts: under `run_reports/` and surfaced via `/admin/artifacts` with signed URLs.

---

## Priorities (execute in order)
1) PI0-APP-1 — CSV Import + Dedupe + Audit
2) PI0-APP-4 — Operator UI filters/detail
3) PI0-APP-2 — Export CSV + Weekly bundle (signed)
4) PI0-APP-3 — RBAC + Route guard
5) PI0-APP-5 — Problem+JSON consistency (mutations touched)
6) PI0-APP-6 — CI smokes + artifact upload
7) PI0-APP-7 — Alert hooks (+ /ops/alerts/test)
8) PI0-APP-8 — Restore-friendly boot

---

## Common contracts and conventions

- Problem+JSON for errors (mutations):
  - Shape: `{ code: string, message: string, field?: string, details?: any }`
  - Status mapping: 400 validation_error, 401 unauthorized, 403 forbidden, 429 rate_limited.
  - Content-Type: `application/problem+json`.
- Signed URLs: existing signer with 24h TTL; expose via `/admin/artifacts` JSON and link from Operator UI.
- RBAC:
  - Roles: `admin`, `operator` (derive from basic auth user or `X-Role` in dev).
  - Admin-only: all `/admin/*`, `/metrics`, export bundle creation.
  - Operator: read-only UI; sensitive actions hidden/disabled when not admin.
- Zod DTOs: schemas colocated with route handlers in `backend/integrated-server.js` (or a small `backend/schemas/*.js` if needed), ensuring parse-safe `.safeParse` with standardized 400 emit.
- Persistence: SQLite (`better-sqlite3`) with WAL, busy_timeout, `synchronous=NORMAL`. New tables are additive (no breaking schema changes).

---

## Ticket tracker

### PI0-APP-1 — CSV Import + Dedupe + Audit
- Status: [x] In progress
- Labels: import, ui, zod
- Depends on: PI0-OPS-6 (secrets/gating confirmed)
- Acceptance Criteria
  - POST `/admin/import/csv` accepts CSV (address required), validates via Zod, can return preview (N errors/warnings), and supports a `commit` flag.
  - Dedupe on `(normalized_address + (owner_name | email | phone))`; report shows rows kept/merged/skipped.
  - Audit JSON saved to `run_reports/import_<timestamp>/audit.json`; downloadable via signed URL.
  - Operator UI: `/ops/import` page (upload → preview → commit → link to audit & leads).
- Implementation notes
  - Endpoints:
    - POST `/admin/import/csv?mode=preview|commit` multipart/form-data (field `file`).
    - GET `/ops/import` renders upload form + preview table + commit action (admin-only).
  - Zod validation:
    - Row schema: `{ address: string; city?: string; state?: string; zip?: string; owner_name?: string; email?: string; phone?: string; notes?: string }` with address required and normalization step.
    - Preview returns `{ total, valid, warnings, errors, sample: [...] }`.
  - Dedupe strategy:
    - Normalize address (trim, uppercase, collapse whitespace, standardize street suffixes where simple).
    - Composite key: `addr_key = norm_address + '|' + (owner_name || email || phone || '')`.
    - If an existing lead matches `addr_key`, mark as merge/skip; otherwise insert new.
  - Persistence & artifacts:
    - Insert/merge into `leads` table (existing). Track counts and ids affected.
    - Write `run_reports/import_<ts>/audit.json` summarizing kept/merged/skipped with row indices and reasons.
    - Surface audit in `/admin/artifacts` and link from `/ops/import`.
  - Operator UI:
    - `/ops/import`: stepper-like flow: Upload → Preview (table w/ dedupe indicators) → Commit → Links (audit + leads search by label).
- Tests & proof
  - Upload sample CSV (≈100 rows, 10 dupes). Verify counts in preview and after commit.
  - Artifact exists and signed URL downloads audit.json.
  - CI route test: invalid CSV → 400 validation_error (Problem+JSON).
- Artifacts to attach
  - Logs of POST preview/commit; screenshot/GIF of `/ops/import` flow; `audit.json` sample.

---

### PI0-APP-2 — Export (CSV + Signed Bundle)
- Status: [ ] Not started
- Labels: export, artifacts
- Acceptance Criteria
  - GET `/admin/export/leads.csv` supports filters (`q`, `status`, `score_min`, `score_max`).
  - POST `/admin/export/bundle` creates bundle (CSV + report.json) and returns signed URL (24h TTL).
  - Operator UI: “Export CSV” on `/ops/leads`, “Weekly bundle” on `/ops/artifacts`.
- Implementation notes
  - CSV export queries with same filters as `/ops/leads`. Stream CSV with header row.
  - Bundle:
    - Create `run_reports/export_<ts>/leads.csv` and `report.json` (counts, filters, generated_at).
    - Return signed URL via existing signer; list in `/admin/artifacts` with `bundleUrl`.
  - UI wiring: buttons that link to CSV (admin only) and trigger bundle creation.
- Tests & proof
  - Filtered export returns matching row count and correct headers.
  - Bundle signed URL downloads a zip/tar or directory files via signed endpoints.
- Artifacts
  - CSV sample; bundle URL log; screenshot of UI buttons.

---

### PI0-APP-3 — RBAC (Admin vs Operator) + Route Guard
- Status: [ ] Not started
- Labels: security, rbac
- Depends on: PI0-OPS-6 (gating/secrets)
- Acceptance Criteria
  - All `/admin/*` and `/metrics` require admin token or basic auth in staging.
  - Operator UI sensitive actions hidden/disabled when not admin.
  - 401/403 return Problem+JSON.
- Implementation notes
  - Add a lightweight role resolver: `{ user, role }` set on `req.context` from auth.
  - Middleware: `requireAdmin` for `/admin/*` and `/metrics`, `maybeAdmin` to set flags for UI rendering.
  - Standardize 401/403 Problem+JSON responses.
- Tests & proof
  - Exercise `/admin/artifacts`, `/admin/export/bundle`, `/metrics` with/without admin.
  - Verify UI hides admin-only buttons for non-admin.

---

### PI0-APP-4 — Operator UI: Leads List + Filters + Detail
- Status: [ ] Not started
- Labels: ui, leads
- Acceptance Criteria
  - `/ops/leads`: supports `q`, `status`, `score_min`, `score_max`, `page`, `limit`; sort by `created_at` or `score`; empty state handled.
  - `/ops/leads/:id`: normalized fields, disposition history, artifacts links.
- Implementation notes
  - Extend current `/ops/leads` server-render with filter form, sorting headers, paging controls.
  - Detail page: show normalized address/owner/contact, related dispositions/notes, artifact links (report, csv, bundles).
  - Reuse backend query functions; add simple SQL ORDER BY and WHERE clauses with bounds checking.
- Tests & proof
  - UI smoke validates filters and paging on staging.
  - Route tests: HTML includes expected elements for empty and non-empty states.

---

### PI0-APP-5 — Problem+JSON Consistency (Mutations)
- Status: [ ] Not started
- Labels: errors, consistency, tests
- Acceptance Criteria
  - 400/401/403/429 use `{ code, message, field? }` consistently for routes touched in PI-0.
  - Unit tests for representative routes: import, export, dial notes/disposition.
- Implementation notes
  - Wrap Zod `.safeParse` results and emit standardized 400 with first failing `path` as `field`.
  - Centralize helpers: `problem(res, status, code, message, extra?)`.
- Tests & proof
  - Intentionally invalid payloads return expected shapes.

---

### PI0-APP-6 — CI Route Smokes + Artifact Upload
- Status: [ ] Not started
- Labels: ci, smoke
- Depends on: PI0-OPS-1 (prom), PI0-OPS-6 (secrets)
- Acceptance Criteria
  - CI job runs `test:routes`, `test:smoke:tiny`, and `scripts/uiSmoke.cjs` (against staging if env present).
  - `actions/upload-artifact` stores outputs under `ci_artifacts/<run_id>/`.
- Implementation notes
  - Add a CI job calling the tiny smokes; pass STAGING_URL and BASIC auth if configured.
  - Collect logs, JSON outputs, and any generated screenshots.
- Tests & proof
  - Green CI on main; artifacts are visible and downloadable.

---

### PI0-APP-7 — Alert Hooks (App → Ops Email)
- Status: [ ] Not started
- Labels: alerts, ops-integration
- Depends on: PI0-OPS-4 (email infra)
- Acceptance Criteria
  - Emit `app.alert` events internally (or call `/ops/alerts/emit`) for: error-rate spike, webhook failure spike, daily digest.
  - `/ops/alerts/test` returns 200 and emits a test event (OPS receives email per OPS ticket).
- Implementation notes
  - Add a tiny alert emitter util; integrate with prom metrics and thresholds.
  - Implement `/ops/alerts/test` (admin only) to emit a sample event.
- Tests & proof
  - Route returns 200; OPS confirms receipt (log in app for cross-check).

---

### PI0-APP-8 — Restore-Friendly Boot
- Status: [ ] Not started
- Labels: reliability, restore
- Depends on: PI0-OPS-3 (restore drill data)
- Acceptance Criteria
  - Boot after DB restore has no unhandled exceptions (WAL, busy_timeout, PRAGMAs set).
  - Artifacts listing survives missing files (graceful omissions).
- Implementation notes
  - Harden boot sequence (idempotent schema init). Wrap artifact scans with try/catch and continue.
  - Extend `/health` to include a `restored_ok: true` hint when tables and PRAGMAs validate.
- Tests & proof
  - Start app with restored snapshot; hit `/health`, `/ops/leads`, `/admin/artifacts` without errors.

---

## Delivery checklist (roll-up)
- [ ] Problem+JSON helper wired into all new/changed mutation routes
- [ ] RBAC guards in place; UI elements gated
- [ ] `/admin/import/csv` preview/commit + `/ops/import` flow
- [ ] Export routes + UI buttons; bundle signed URL
- [ ] Operator UI filters/sorting/paging + detail page
- [ ] CI tiny smokes and artifact upload
- [ ] `/ops/alerts/test` implemented
- [ ] Restore-friendly boot validated

## Artifacts to attach per ticket
- Console logs (request/response) for core flows
- Screenshots/GIFs of Operator UI pages
- Downloaded artifacts: `audit.json`, exported CSVs, bundle URLs
- CI run page link with uploaded artifacts

## Assumptions
- Staging is protected via basic auth; admin role derived from credentials.
- No paid third-party API calls (demo/guardrails remain enforced).
- Existing signer and `/admin/artifacts` listing are authoritative for downloads.

---

Updated: 2025-09-23
