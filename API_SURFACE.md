# API Surface (Staging Authority)

Authoritative server: `backend/integrated-server.js`

## Route aliases (compat)
- GET `/api/search` → GET `/api/zip-search-new/search`
- POST `/api/leads` → POST `/api/zip-search-new/add-lead`

## Skiptrace runs
- POST `/api/skiptrace-runs/start` { leadIds?, limit=20, label, softPauseAt=5, demo=true, seedOnly=false } → { success, run_id, countSeeded }
- GET `/api/skiptrace-runs/:runId/status` → { success, soft_paused, totals }
- POST `/admin/skiptrace-runs/:runId/resume` → clears soft_paused
- GET `/api/skiptrace-runs/:runId/report` → run report JSON
- GET `/admin/artifacts` → [{ runId, signedUrl (report.json), reportUrl, csvUrl }]
- GET `/admin/artifact-download?path=...&exp=...&sig=...` → signed download

## Operator UI (read-only HTML)
- GET `/ops/leads` — search, page, limit
- GET `/ops/leads/:id` — normalized detail
- GET `/ops/artifacts` — list bundles with report and CSV download links

## Dialer endpoints
- POST `/dial` — queue a dial attempt (stub)
- POST `/dial/:dialId/asr-complete` — persist transcript ref
- POST `/dial/:dialId/notes` — append free-text note
- POST `/dial/:dialId/disposition` — enum {no_answer, voicemail, bad_number, interested, not_interested, follow_up}

## PI1 Dialer Outcomes & Follow-ups
- POST `/dial/:dialId/disposition` — Record call disposition with grade label tracking
- POST `/leads/:id/followups` — Create follow-up task (admin-gated)
- PATCH `/followups/:id` — Update follow-up status (done/snoozed/canceled)
- GET `/followups` — List follow-ups with filters (status, priority, assignee)
- GET `/leads/:id/timeline` — Lead activity timeline (newest first, limit 50)

## Metrics
- `/metrics` — Prometheus (Basic Auth gated if configured)
- Counters include: http_requests_total, dial_attempts_total, webhook_errors_total
- PI1 metrics: dialer_disposition_total{type,grade_label}, followups_created_total{channel,priority}, followups_completed_total{status}, followups_due_gauge, followups_overdue_gauge, timeline_events_total{kind}

## Notes
- SQLite DB path unified by SQLITE_DB_PATH env.
- Artifacts root: STORAGE_ROOT/run_reports (LOCAL_STORAGE_PATH overrides STORAGE_ROOT).
- Problem+JSON-style errors: { code, message, field? }.
