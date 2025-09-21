# Sprint 1 — Cost & Reliability Guardrails + Verifiable Runs (Week 1)

**Date:** 2025-09-18
**Goal:** Ship a hardened skip-trace pipeline that (1) never double-bills, (2) runs within budget guardrails, and (3) produces a verifiable report for the 609-lead cohort and future runs.

## Success Criteria / KPIs

* [ ] Duplicate suppression ≥ 99.5% (pre-provider short-circuit).
* [ ] Cache hit ratio visible per run; ≥ 30% when re-running the same CSV.
* [ ] Budget soft-stop engages at configured daily spend; manual override resumes.
* [ ] Run report SLA: JSON + CSV emitted ≤ 60s after a 1k run completes.
* [ ] Auditability: run_id → lead_id → provider_call_id trace exists for every call.

**Out of scope this sprint**

* AI dialer, recordings, transcripts (Sprint 2).
* Map/Polygon lead generation (Stretch Sprint 4/5).
* Full CRM (deliver minimal contacts view/export).

---

## Environment & Defaults (set now)

* [ ] `PORT=6001`
* [ ] `SQLITE_DB_PATH=backend/data/convexa.db`
* [ ] `BATCHDATA_BASE_URL=https://api.batchdata.com`
* [ ] `BATCHDATA_SKIPTRACE_PATH=/api/v1/property/skip-trace`
* [ ] `BATCHDATA_AUTH_STYLE=bearer`
* [ ] `SKIP_TRACE_DAILY_BUDGET_USD=200.00`
* [ ] `SKIP_TRACE_RPS=4`                  # provider token bucket
* [ ] `SKIP_TRACE_CONCURRENCY=6`         # worker pool
* [ ] `CIRCUIT_BREAKER_ERROR_RATE=0.30`
* [ ] `CIRCUIT_MIN_SAMPLES=30`
* [ ] `CACHE_TTL_DAYS=7`
* [ ] `SANITIZED_RETRY_ENABLED=true`     # one retry when zero contacts + unit markers
* [ ] `SQLITE_BUSY_TIMEOUT_MS=5000`      # for WAL mode
* [ ] **Input**: path to the current 609-lead CSV

**SQLite runtime**

* [ ] Enable WAL: `PRAGMA journal_mode=WAL;`
* [ ] Busy timeout: `PRAGMA busy_timeout=5000;`
* [ ] Synchronous NORMAL: `PRAGMA synchronous=NORMAL;`

---

## Epic A — Idempotency & Caching (L1/L2)

**User story A1:** Re-running the same lead returns the same result **without** a provider call.

### Design

* **Normalization**

  * `normalizeStreet`: uppercase, strip punctuation, collapse whitespace, expand ST/AVE/BLVD, **preserve house number**.
  * City/state/zip: uppercase, trim; zip → 5 digits if 9.
  * Person: `first||''` + `last||''` → uppercase, trimmed.
  * Primary signature: `input_signature = sha256(normalized_address + '#' + normalized_person)`
  * Secondary (sanitized) signature: same but with **unit tokens removed** (UNIT|APT|STE|#|FL|FLOOR).
* **Idempotency**

  * `idempotency_key = sha256(input_signature)`.
  * DB unique on `(provider, idempotency_key)`.
* **Caches**

  * L1 (in-memory) TTL=10m, key `provider:idempotency_key`.
  * L2 (SQLite) TTL=`CACHE_TTL_DAYS`, payload_hash (sha256 of raw provider JSON), parsed_contacts_json.

### DB migrations (apply)

```sql
-- provider_calls (idempotent write, auditable)
CREATE TABLE IF NOT EXISTS provider_calls (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  run_id TEXT,
  request_json TEXT NOT NULL,      -- sanitized
  response_json TEXT,              -- sanitized
  payload_hash TEXT,               -- sha256 of response_json (for dedupe/provenance)
  status_code INTEGER,
  cost_cents INTEGER DEFAULT 0,    -- actual provider spend for THIS call
  error_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_idem
  ON provider_calls(provider, idempotency_key);

-- L2 cache (TTL + write-through)
CREATE TABLE IF NOT EXISTS skiptrace_cache (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,     -- sanitized provider JSON
  parsed_contacts_json TEXT NOT NULL,
  ttl_expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cache_key
  ON skiptrace_cache(provider, idempotency_key);
```

### Service tasks

* [ ] `getOrSkiptrace(input)`:

  1. compute `idempotency_key` → check L1 → L2 (not expired) → return cache;
  2. else call provider;
  3. on success, write provider_calls row (1 per provider call), write-through L2, refresh L1;
  4. return `{contacts, cached:false, payload_hash}`.
* [ ] Sanitized retry:

  * Trigger **only** when (a) zero contacts **and** (b) unit markers present.
  * **Log** `attempt_reason="address_sanitized"`.
  * Both provider_calls are recorded; **budget sums both provider calls** (both cost money). The final contacts should be attributed to the winning attempt and the first labeled `sanitized_retry_predecessor` in reports.

### Acceptance

* [ ] Re-posting identical normalized input does **not** create a new `provider_calls` row (unique holds).
* [ ] Cache TTL respected; expired entries re-fetched once.

---

## Epic B — Run Lifecycle, Reports, Resume

**User story B1:** Start a run for a CSV, watch progress, **resume** failures, download report + enriched CSV.

### DB migrations (apply)

```sql
CREATE TABLE IF NOT EXISTS skiptrace_runs (
  run_id TEXT PRIMARY KEY,
  source_label TEXT,
  total INT, queued INT, in_flight INT, done INT, failed INT,
  started_at DATETIME, finished_at DATETIME,
  soft_paused INT DEFAULT 0,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS skiptrace_run_items (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT CHECK(status IN ('queued','in_flight','done','failed')) NOT NULL,
  attempt INT DEFAULT 0,
  idem_key TEXT NOT NULL,
  normalized_address TEXT,
  normalized_person TEXT,
  last_error TEXT,
  FOREIGN KEY(run_id) REFERENCES skiptrace_runs(run_id)
);
CREATE INDEX IF NOT EXISTS ix_run_items_run ON skiptrace_run_items(run_id);
```

### API / CLI

* [ ] `POST /api/skiptrace-runs` → `200 { run_id }`

  * body: `{ source_label, leads: Lead[], policy: { force:boolean, fallback:boolean, retry_sanitized:boolean } }`
* [ ] `GET /api/skiptrace-runs/:run_id/status` → progress counters
* [ ] `POST /api/skiptrace-runs/:run_id/resume?overrideBudget=0|1`
* [ ] `GET /api/skiptrace-runs/:run_id/report` → JSON (schema below)
* [ ] `GET /api/skiptrace-runs/:run_id/artifacts` → signed URLs (CSV + JSON)

**Report JSON schema**

```json
{
  "run_id": "string",
  "source_label": "string",
  "started_at": "ISO",
  "finished_at": "ISO",
  "duration_s": 0,
  "totals": {
    "total": 0, "done": 0, "failed": 0,
    "cached_hits": 0, "provider_calls": 0, "cost_usd": 0
  },
  "hit_rate": { "phone_any_pct": 0, "email_any_pct": 0 },
  "cache_hit_ratio": 0,
  "budgets": { "daily_cap_usd": 0, "spent_usd": 0, "soft_paused": false },
  "errors": [ { "reason": "string", "count": 0, "samples": ["lead_id"] } ],
  "samples": {
    "enriched": [ { "lead_id": "...", "phones": ["..."], "emails": ["..."] } ],
    "failed":   [ { "lead_id": "...", "last_error": "..." } ]
  }
}
```

### Acceptance

* [ ] 200-row run creates rows in both tables; emits report JSON and enriched CSV under `run_reports/<run_id>/`.
* [ ] `resume` only processes `failed` or `queued`.

---

## Epic C — Budget Guard, Rate Limits, Circuit Breaker

**User story C1:** Never exceed a daily budget; throttle and pause safely.

### Tasks

* [ ] Token bucket limiter @ provider wrapper (respect `SKIP_TRACE_RPS`).
* [ ] Concurrency gate @ run worker (respect `SKIP_TRACE_CONCURRENCY`).
* [ ] Budget accumulator:

  * Sum **actual** provider spend from `provider_calls.cost_cents` **excluding** cache hits.
  * On threshold, set `skiptrace_runs.soft_paused=1`, stop dequeues, return `429 BudgetPause` to new attempts (`{ retry_after: seconds, reason: 'daily_budget' }`).
  * `resume?overrideBudget=1` bypasses soft pause for that run.
* [ ] Circuit breaker (closed → open → half-open):

  * Window: sliding N=`CIRCUIT_MIN_SAMPLES` calls; open when error_rate ≥ `CIRCUIT_BREAKER_ERROR_RATE`.
  * While open: drop provider calls, return `503 CircuitOpen`.
  * Half-open: allow 1 probe/60s; close on 200.

### Acceptance

* [ ] Budget cap pauses dequeues; override resumes.
* [ ] Error spike trips breaker; probe cadence visible in logs.

---

## Epic D — Minimal Contacts View & Export (internal)

**User story D1:** Search a lead, view phones/emails with provenance; export a CSV that matches the dialer.

### API/UI

* [ ] `GET /api/leads/:id/contacts` →

  ```json
  {
    "leadId":"...", "cached":true|false, "updatedAt":"ISO",
    "phones":[{"number":"+1...", "type":"Mobile|Land Line|Unknown", "isDoNotCall":true|false, "confidence":0..100, "source":"batchdata"}],
    "emails":[{"address":"...", "isPrimary":true|false, "confidence":0, "source":"batchdata"}]
  }
  ```
* [ ] `/admin/contacts` (internal)

  * Filters: Has Phone, Has Email, Updated Since…, Source=BatchData, Cached Only.
  * Columns: LeadID, Address, Owner, Phone1..3, Email1..3, UpdatedAt, Cached.
  * Export: same header format you already use (LeadID,Address,Owner,Phone1..3,Email1..3).
    *Add “Phone1_source”, “Email1_source”, “Cached” columns at the end for ops visibility.*

### Acceptance

* [ ] Lead view shows contacts + **Cached** badge when applicable.
* [ ] Export opens cleanly in Excel/Google Sheets; columns in exact dialer order.

---

## Provider Wrapper — BatchData v1 specifics (lock for this sprint)

* Keep `Authorization: Bearer ****` and `Content-Type: application/json`.
* **Payload (v1)** respected.
* Parse:

  * phones: `results.persons[].phoneNumbers[].number` (map `dnc`→`isDoNotCall`, `score`→`confidence`)
  * emails: `results.persons[].emails[].email`
  * diagnostics: `meta.results.matchCount`
* **DNC rule (forward-looking):** Persist `isDoNotCall`; AI dialer (Sprint 2) must **not** dial `isDoNotCall=true`.

---

## Metrics, Health, Security

* [ ] `GET /api/health` → `{ ok:true, db:true, provider:"ready|circuit_open" }`
* [ ] `GET /api/metrics` →

  ```json
  {
    "provider_calls_total": {"2xx":0,"4xx":0,"5xx":0},
    "cache_hits_total": 0,
    "budget_spent_cents_total": 0,
    "circuit_state": "closed|open|half_open",
    "rps_current": 0,
    "queue_depth": 0
  }
  ```
* [ ] Admin routes gated by an admin token; redact auth in logs; **never** log raw emails/phones at info level (debug only, sanitized).

---

## Testing & QA

**Unit**

* [ ] Normalization: signatures with/without unit tokens produce intended primary/secondary.
* [ ] Idempotency: 2 identical inputs → 1 provider call; 2nd served from cache.
* [ ] TTL expiry: after expiry, next call refreshes cache.

**Integration (provider stub)**

* [ ] Happy path: 10 leads → 10 provider calls → report totals correct.
* [ ] Duplicate cohort: same 10 again → ≤ 1 provider call; cache hits recorded.
* [ ] Budget guard: set budget to $0.10; simulate 2×$0.25 → soft pause.
* [ ] Circuit breaker: fail 10 of 20 → opens; probe cadence verified.

**Manual (live token)**

* [ ] Server on 6001 prints BatchData URL + masked auth.
* [ ] Single-lead probe: phones/emails present.
* [ ] `/api/debug/skiptrace-latest?limit=1` shows sanitized req/resp and `matchCount`.
* [ ] Run 50 leads; fetch `status`, `report`, `artifacts`.
* [ ] Re-run same 50; cache hit ≥ 30%, provider_calls flat.
* [ ] Trigger budget soft pause; override resume works.

---

## Deliverables (end of sprint)

* [ ] DB migrations applied; WAL enabled.
* [ ] Env template updated.
* [ ] Endpoints live:

  * `POST /api/skiptrace-runs`
  * `GET /api/skiptrace-runs/:run_id/{status,report,artifacts}`
  * `GET /api/leads/:id/contacts`
  * `GET /api/health`, `GET /api/metrics`
* [ ] Report JSON & enriched CSV under `run_reports/<run_id>/`.
* [ ] `/admin/contacts` internal page.
* [ ] README runbook: start a run, pause on budget, resume, export.

---

## Day-by-Day Timeline (7 calendar days)

**Day 1**

* Migrations (Epics A & B), normalization helpers.
* Idempotency unique index; L2 cache schema; enable WAL/PRAGMAs.

**Day 2**

* Implement `getOrSkiptrace()` L1/L2 + write-through.
* Sanitized retry behind flag; payload_hash handling.

**Day 3**

* Run lifecycle endpoints, worker queue, resume.
* Report generator (JSON first).

**Day 4**

* Rate limiter, concurrency gate, budget accumulator + soft pause.
* Circuit breaker (rolling window).

**Day 5**

* CSV artifact writer (dialer columns + provenance tail).
* `/admin/contacts` + `GET /api/leads/:id/contacts`.

**Day 6**

* Unit + integration tests; manual 5-lead live validation.
* README runbook.

**Day 7**

* 50-lead smoke run; publish report + CSV.
* Retro + prepare Sprint 2 backlog.

---

## First 48 Hours — Kickoff Script (do this immediately)

1. **Apply migrations** and enable WAL:

```
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
```

2. **Implement normalization & idempotency** (primary + sanitized signatures).
3. **Wire L1/L2 caches** and `getOrSkiptrace()` with write-through.
4. **Add rate limiter** (RPS) and **concurrency gate**.
5. **Introduce run_id** plumbing + `/status`.
6. **Draft report JSON** (write to `run_reports/<run_id>/report.json`).
7. **Set envs** above; validate with a 5-lead dry run.
8. **Prove duplicate suppression**: call the same lead twice and verify 1 provider call.

---

## Budget & Cost Accounting Rules (explicit)

* Count **only** actual provider calls toward budget: sum `provider_calls.cost_cents`.
* Cache hits add **zero** to budget.
* Sanitized retry can create 2 provider_calls rows; both persist, and **budget reflects both real calls**. The report should attribute final contacts to the winning attempt and label the first as `sanitized_retry_predecessor`.

---

## Risk & Mitigation

* Provider schema drift → fail closed, trip circuit; parser hotfix.
* Credit burn via retries → one sanitized retry only; budget guard active.
* SQLite contention → concurrency=6, WAL, busy timeout, batch inserts.

---

## Sprint 2 “Ready” Gate (define now so we don’t move early)

* [ ] 50-lead smoke run completed with report & CSV.
* [ ] Cache hit ≥ 30% on immediate re-run.
* [ ] Budget soft pause/override works in prod-like settings.
* [ ] Contacts UI functional; export usable by dialer.
* [ ] DNC flags present in stored phones (for dialer to honor).

---

**Why these tweaks?** They tighten reliability (WAL/timeouts), make ops safer (health/metrics, explicit cost accounting), and ensure Sprint-2 dialer can rely on DNC and provenance on day one.
