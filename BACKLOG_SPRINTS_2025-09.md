# Backlog by Sprint (Sept–Nov 2025)

Estimates use story points (SP). Each sprint ~2 weeks, ~30–40 SP capacity.

## Sprint 1: Stabilize skiptrace core
1) DB path unification (8 SP)
   - AC: Single `SQLITE_DB_PATH` used everywhere; migration moves active DB; server and scripts operate on one file.
2) Idempotency key + TTL cache (8 SP)
   - AC: Re-running same lead within TTL triggers cache; provider_calls not incremented.
3) BatchData v1/v2 feature-flag (5 SP)
   - AC: Switching flag changes request path/auth and parser; tests pass for both versions.
4) Metrics endpoint + basic dashboard (5 SP)
   - AC: Prom metrics exposed; Grafana shows rates/latency/errors.
5) Backfill resume + run reports (5 SP)
   - AC: `--runid` resumes; report written to `run_reports/`.
6) Unit/integration tests baseline (5 SP)
   - AC: Adapter, cache, exporter tests green in CI.

## Sprint 2: UX + operator tooling
1) Lead detail contact panel (8 SP)
   - AC: Top 3 phones/emails with provenance and copy/call/email actions.
2) Bulk export UI + artifact history (8 SP)
   - AC: Filtered export; artifacts tracked and download-able.
3) Quota + cost dashboard (5 SP)
   - AC: Daily provider usage and costs with thresholds.
4) Error drill-down (5 SP)
   - AC: Top errors list with links to leads and raw logs.
5) Alerting (4 SP)
   - AC: Error-rate and quota alerts firing in dev.

## Sprint 3: Scale & performance
1) Rate-aware concurrency controller (8 SP)
   - AC: Token-bucket per provider; reduced 429s; stable latency.
2) Pipelined backfill w/ checkpoints (8 SP)
   - AC: Large files run with consistent throughput; restarts pick up.
3) DB indices & tuning (5 SP)
   - AC: Added indices reduce query times; verify with explain/metrics.
4) Cache TTL policy tuning (5 SP)
   - AC: Hit ratios observed; configurable TTL by source.

## Sprint 4: Compliance + enrichment
1) Debug route gating + auth (5 SP)
   - AC: `/api/debug/*` blocked without admin in prod.
2) Secondary provider optional fallback (8 SP)
   - AC: Flag enables fallback; usage/cost tracked; A/B reporting.
3) Email validation + DNC basics (5 SP)
   - AC: Flags in normalized tables; export filters.
4) DSR export + redaction in CSV (5 SP)
   - AC: CLI/UI switch to redact PII; generate per-lead data export.
