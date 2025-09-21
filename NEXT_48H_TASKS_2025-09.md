# Next 48 Hours: Action Plan (Owners + Success Criteria)

1) Unify DB path (Owner: Eng)
   - Success: Server and scripts read `backend/data/convexa.db`. Backup created and verified. Old path no longer written to.
2) Add idempotency key + pre-call check (Owner: Eng)
   - Success: Re-running the same lead within TTL emits cache hit; provider_calls unchanged.
3) Metrics endpoint + starter dashboard (Owner: Eng/Ops)
   - Success: `/metrics` exposes counters/histograms; Grafana panel shows rates/latency/errors; two alerts active.
4) Backfill runner `--runid` + resume (Owner: Eng)
   - Success: Interrupted run resumes; `run_reports/<runid>.json` generated.
5) Contract tests for BatchData v1/v2 (Owner: Eng)
   - Success: Both adapters pass fixtures; CI green.
6) Debug routes gating (Owner: Eng)
   - Success: In prod, `/api/debug/*` requires admin token/IP allowlist; smoke test proves denial by default.
7) Exporter polish (Owner: Eng)
   - Success: CSV exporter flag `--redact` hides emails or phone last-4; outputs documented in README.
8) Create ops docs (Owner: Ops)
   - Success: One-page runbook for backfill, verify, export, and report collection.
