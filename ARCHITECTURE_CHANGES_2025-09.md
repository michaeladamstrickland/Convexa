# Architecture Changes (Sept 2025)

This document translates the plan into concrete code changes with file-level pointers and acceptance criteria.

## 1) Single DB path + migration
- Problem: Two SQLite paths are in use: `backend/data/convexa.db` and `backend/backend/data/convexa.db`.
- Decision: Canonicalize to `backend/data/convexa.db`.
- Changes:
  - Config: Introduce `SQLITE_DB_PATH` default to `backend/data/convexa.db` in `.env` and enforce in `backend/integrated-server.js` and all scripts.
  - Add a migration script `scripts/migrate-db-path.cjs` to detect active DB (largest and newest), back it up to `backups/convexa-<timestamp>.db`, move to canonical path, and VACUUM.
  - Code audit: Search for hard-coded paths and replace with env-based resolution (Node: path.resolve projectRoot, env fallback).
- Acceptance:
  - Server boots and logs single DB path; no duplicate files grow post-migration.
  - Backfill, debug endpoints, and CSV exporters all read/write the canonical DB.

## 2) Provider adapters: v1 primary, v2 feature flag
- Problem: v1 and v2 differ (path, auth header, response shapes).
- Decision: Keep v1 default; add `BATCHDATA_API_VERSION=1|2` feature-flag.
- Changes:
  - `backend/services/batchDataAdapter.js`: branch building URL/headers and response parsing by version.
  - Contract tests: fixture-based tests for both versions; mask secrets.
  - Config validation on boot prints selected version and path.
- Acceptance:
  - Switchable via env without code changes; both pass adapter tests.

## 3) Idempotency + cache de-dupe
- Decision: Compute idempotency key = SHA256(normalized street+city+state+zip+owner_first+owner_last+provider) and persist per lead.
- Changes:
  - Add column on leads: `skiptrace_key` (unique, nullable) and table `idempotency_keys(key TEXT PRIMARY KEY, lead_id TEXT, provider TEXT, last_seen TEXT)`.
  - Before provider call: check key; if present and fresh -> return cached normalized contacts.
  - On success: update normalized phone/emails tables and `skip_trace_results`; set cache TTL.
- Acceptance:
  - Re-running backfill does not re-call provider when key unchanged within TTL; provider_calls count stable.

## 4) Observability (metrics + logs)
- Decision: Expose Prometheus metrics in `/metrics` (guarded in prod behind auth/IP allowlist).
- Metrics:
  - Counters: `skiptrace_requests_total{provider,source}`, `skiptrace_errors_total{provider,code}`
  - Histograms: `skiptrace_latency_seconds{provider}`, `skiptrace_cost_usd{provider}` (summary)
  - Gauges: `quota_used{provider}`, `cache_hit_ratio`
- Logs:
  - Add `correlationId` (runId) for batch runs; structured JSON logs.
- Acceptance:
  - Grafana board shows rates, latency, errors; alerts for error-rate>5%, quota>80%.

## 5) Security & compliance
- Decision: Lock debug routes in prod; secrets via env only; PII export control.
- Changes:
  - Gate `/api/debug/*` behind `NODE_ENV!=='production'` or admin token.
  - Ensure token masking in any serialized `_debug` payloads (already present; add tests).
  - CSV exporters: add `--redact` flag to drop emails or last-4 of phones if needed.
- Acceptance:
  - Security scan finds no secrets in logs; debug routes inaccessible externally in prod.

## 6) Backfill runner polish
- Decision: Make backfills resumable, observable, and cost-safe.
- Changes:
  - `scripts/backfillCsvContacts.cjs`: add `--runid`, per-run state file (JSON) for resume, retry budget, and final `run_reports/<runid>.json`.
  - `scripts/verifySkiptraceRun.cjs`: enrich with provider costs, cache ratio, top errors.
- Acceptance:
  - Killing a run and resuming finishes without duplicating provider calls; run report present.

## 7) Frontend UX for contacts
- Decision: Show top 3 phones/emails with provenance + quick actions.
- Changes:
  - Lead detail pane: read from normalized tables; show provider, date, cost; call/email buttons.
  - Bulk export UI: filter + export; archive artifact history.
- Acceptance:
  - Operator can browse enriched contacts and export subsets without using CLI.
