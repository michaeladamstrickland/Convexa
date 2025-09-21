Sprint-1 QA Refresh (Run f8b168ef-c6ec-40ce-b570-02ae15fe6d9e)

What changed
- Regenerated report.json using canonical DB backend/data/convexa.db and folder run_reports/<run_id>/.
- Corrected hit-rate logic to read from normalized tables:
  - phone_any_pct: distinct leads in phone_numbers (joined to this run).
  - email_any_pct: distinct leads in email_addresses (joined to this run).
- Cache hit ratio computed purely from provider_calls and done counts (no CSV heuristics).

Artifacts
- report.json: Totals, hit-rates, budgets, cache hit ratio.
- enriched.csv: Unchanged (source export of 609 records).
- qa_cache_hit_offline.json: If present, a two-call offline proof where the second request reads from cache and provider delta is 0.
- guardrails_snapshot.json: If present, captured from /admin/guardrails-state. If missing, environment did not expose an admin endpoint during this refresh.

Notes
- Guardrails snapshot capture is best-effort only; no values are fabricated. If an admin endpoint becomes available, re-run the capture and repackage.
- Migration added: unique cache index ux_skiptrace_cache on (provider, idempotency_key) (idempotent).
