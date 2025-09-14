# LeadFlow — Roadmap Delta

Timestamp (ET): 2025-08-16 12:00 ET

Purpose
- Identify where the current implementation diverges from the business/tech proposals and strategy docs in the repo (e.g., REAL_LEAD_GENERATION_ROADMAP.md, PHASE_4_TECHNICAL_IMPLEMENTATION.md, IMMEDIATE_IMPLEMENTATION_GUIDE.md, PHASE_4_DEVELOPER_ROADMAP.md), then recommend adjustments to reach production readiness with real leads and compliant outreach.

Referenced Vision/Plan Docs (non-exhaustive)
- REAL_LEAD_GENERATION_ROADMAP.md
- REAL_API_IMPLEMENTATION.md
- PHASE_4_TECHNICAL_IMPLEMENTATION.md
- PHASE_4_DEVELOPER_ROADMAP.md
- PHASE_3_COMPLETE_SUMMARY.md
- PHASE_4_IMPLEMENTATION_COMPLETE.md
- IMMEDIATE_MONEY_MAKERS.md
- MASTER_SETUP_GUIDE.md
- LEADFLOW_CHECKPOINT.md

Note: These documents set an ambitious end-state emphasizing end-to-end ingestion, enrichment, AI scoring, outreach automation, and compliance/observability.

---

## Delta Summary

1) Data Layer: Dual Prisma Schemas (SQLite vs PostgreSQL)
- Intended: Single authoritative schema with production-grade RDBMS (PostgreSQL), stable migrations.
- Current: Two separate Prisma schemas:
  - backend/prisma/schema.prisma (PostgreSQL, comprehensive CRM entities)
  - prisma/schema.prisma (SQLite, demo/alternate models)
- Risk: Migration drift, environment confusion, and runtime data shape divergence.

2) Compliance (DNC/TCPA) and Outreach Readiness
- Intended: Legally sound SMS/voice/email campaigns with DNC checks, consent logs, quiet hours, and opt-out handling.
- Current: Campaign routes are placeholders; Twilio library present but not wired; no DNC cache or consent storage; no quiet hours enforcement.

3) AuthN/Z Hardening and Session Lifecycle
- Intended: Robust JWT with refresh/rotation, revocation on logout, and org-based RBAC across routes.
- Current: Single JWT without refresh/rotation; restrictTo role guard exists; org scoping present in some controllers but not universally enforced.

4) Ingestion and Enrichment Guardrails (Costs/Reliability)
- Intended: Stable intake across ATTOM/DataTree/Zillow and scrapers, with caching, retries, timeouts, circuit breakers, and daily budget enforcement.
- Current: Service wrappers exist; budget concepts exist in masterConfig; missing uniform axios retry/backoff, caching per (zip, filters, day), and clear budget middleware. Puppeteer scraper lacks stealth/proxy rotation.

5) Observability and Operations
- Intended: Production observability (Sentry errors, metrics, traces, correlation IDs) with cost telemetry.
- Current: Winston/morgan only; Prometheus metrics and Sentry not implemented; no correlation ID propagation.

6) Frontend Auth & UX for Key Flows
- Intended: Persisted auth, protected routes, robust API client handling, forms with validation, analytics dashboards.
- Current: Local isAuthenticated state; no persisted session or refresh; some pages exist (Leads, Zip, Analytics) but UX/access control incomplete.

7) CI/CD and Build Health
- Intended: Automated lint/typecheck/tests/build, Prisma validate, and release-ready pipelines.
- Current: No CI workflows committed; tests exist only in backend; frontend has no configured test runner.

8) Flip Tracker Feature Set
- Intended: Budget, tasks, docs, P/L, photo log integrated in CRM.
- Current: Not implemented in backend; mentioned in strategy docs only.

9) Normalization & Deduplication
- Intended: Canonical normalizer producing uniform entities and property hashes across all ingestion routes/providers.
- Current: PropertyRecord has a hash and unique constraints; normalization logic is scattered across services and scraper, not centralized.

10) Admin/Operator Utilities
- Intended: Backfills, replays, migrations management, key rotation, and environment sanity checks.
- Current: Health and usage endpoints exist; broader operator tooling not implemented.

---

## Impacted Outcomes

- “Real leads flowing + campaigns live” is blocked by: schema duality, compliance gaps, missing campaign pipeline, and missing observability/guardrails.
- Cost exposure risk without caching and budget enforcement.
- Security risk without refresh token rotation and org-wide RBAC verification.

---

## Prioritized Remediation (Delta → Action)

D0 (Immediate)
- Consolidate Prisma on backend Postgres; mark root prisma as demo-only. Add .env.example and config validation.
- Persisted frontend auth; attach Authorization headers; global 401 handling.

D3
- Add axios guardrails (timeouts, retries, circuit breakers) and a cache layer for property search and address validation. Enforce daily budget middleware.
- Harden Puppeteer (stealth, proxy, randomized delays).

D7
- Implement DNC/TCPA baseline (DNCCheck, ConsentLog, quiet hours); Twilio SMS MVP with CampaignLog + STOP handling.
- Add idempotency keys for POST /api/leads and skip-trace.

D10
- Add Sentry, correlation IDs, Prometheus metrics, and /metrics endpoint.
- Set up GitHub Actions for lint/type/test/build and prisma validate.

(See PRIORITY_PLAYBOOK.md for detailed two-week schedule with owners and acceptance criteria.)

---

## Concrete Deltas vs. Proposal Themes

- Proposal: “Full compliance and multi-tenant security”
  - Delta: No DNC/TCPA or refresh/rotation; multi-tenancy filters not guaranteed across all routes.
  - Fix: Implement compliance items and enforce org filters globally.

- Proposal: “Production reliability and cost guardrails”
  - Delta: Missing cache/budget middleware, retries/backoff, and circuit breakers.
  - Fix: Central axios factory, cache, and budget enforcement middleware.

- Proposal: “End-to-end outreach and automation”
  - Delta: Campaign endpoints are placeholders.
  - Fix: Twilio SMS MVP with consent/DNC checks and throttling; add scheduler/queue later.

- Proposal: “Observability and analytics”
  - Delta: No Sentry/metrics/tracing; analytics pages rely on limited metrics endpoints.
  - Fix: Implement observability plan; expose API/provider costs in metrics and responses.

- Proposal: “Scalable ingestion and dedupe”
  - Delta: Normalizer not centralized; scraper lacks stealth/proxy rotation; API calls not cached.
  - Fix: Normalization module; puppeteer hardening; caching and de-dup across pipelines.

---

## Decision Requests

- Confirm authoritative Prisma schema (recommend backend/PostgreSQL).
- Select initial provider budget set (ATTOM + Zillow RapidAPI + Batch Skip Tracing + OpenAI + Google Maps) and target monthly caps.
- Approve MVP scope for campaigns: SMS-only with STOP/quiet hours and per-org throttling.
- Choose queue strategy (cron now; BullMQ/Redis later) and observability stack (Sentry + Prometheus/Grafana).

---

## Success Alignment

When the above deltas are addressed per PRIORITY_PLAYBOOK.md:
- Leads can be generated via real-estate endpoints with controlled cost.
- Outreach can be executed compliantly with minimal legal risk.
- Incidents can be triaged quickly via Sentry and metrics with correlation IDs.
- Builds are reproducible, type-safe, and enforced via CI.

Map these deliverables to measurable success in FEATURE_MATRIX.md and update progress weekly.
