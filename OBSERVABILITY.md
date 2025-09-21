# Convexa — Observability Plan (Logging, Metrics, Tracing)

Timestamp (ET): 2025-08-16 12:00 ET

Objective
- Provide production-grade visibility into Convexa’s behavior and costs (API spend), with fast incident triage and actionable telemetry. This plan outlines logging, error reporting, metrics, tracing, and correlation IDs for backend services, with a light footprint suitable for DigitalOcean + AWS S3 deployments. Frontend logging is limited to client-side error capture and UX performance.

Scope
- Backend (Express + TypeScript) in backend/src/*
- Frontend (React + Vite) in frontend/src/*
- External providers: ATTOM, DataTree, RapidAPI (Zillow/Realtor), OpenAI, Google Maps, Twilio, Batch Skip Tracing, Whitepages

Principles
- Correlate: Every request and downstream API call carries a correlation ID.
- Minimize PII: Avoid logging phone/email/full addresses; mask or hash when needed.
- Cost-aware: Track per-request costs and daily budget with metrics and alerts.
- Fail fast: Exceptions captured and grouped with stack traces and request context.

---

## 1) Structured Logging

Backend
- Logger: Winston (already present) + morgan (HTTP access logs).
- Structure:
  - level: info|warn|error
  - message
  - timestamp (ISO)
  - correlationId (X-Request-Id)
  - userId, organizationId (if authenticated)
  - http: { method, url, status, durationMs }
  - error: { name, message, stack, code }
  - provider: { name, endpoint, status, durationMs, cost }
- Redaction:
  - Mask phone (`*****1234`), email (`a***@domain.com`), JWTs, API keys.
- Log sinks:
  - Console for container logs
  - File (rotating) for DO droplet if required; consider log forwarding to hosted solution

Implementation sketch
- backend/src/server.ts
  - Add correlationId middleware (uuid v4); set response header X-Request-Id
  - Replace plain morgan with a custom morgan format that includes correlationId
- backend/src/utils/logger.ts
  - Export logger with JSON format + redact function for PII
- Services
  - Wrap axios instances to log request/response metadata and cost per call at info level, and errors at error level

Frontend
- Minimal console.error suppressed; install lightweight client reporter only if needed (e.g., Sentry for React)

---

## 2) Error Reporting

Backend
- Use @sentry/node with express integration
  - DSN via SENTRY_DSN
  - Release and environment tags (GIT_SHA, NODE_ENV)
  - Capture uncaught exceptions and unhandled rejections
  - Include request context (path, params sanitized, userId/orgId if available), correlationId
- Non-fatal errors: still return standardized JSON error with correlationId header

Frontend
- Optional @sentry/react with ErrorBoundary
  - capture errors and performance issues (slow routes)
  - redact PII from breadcrumbs

Configuration
- Env:
  - SENTRY_DSN (backend and optionally frontend)
  - SENTRY_ENVIRONMENT (development|staging|production)
  - SENTRY_RELEASE (git sha)

---

## 3) Metrics

Style
- Prometheus exposition at /metrics (backend only; behind auth or internal)
- Use prom-client for Node
- Metrics to expose:
  - http_requests_total{method, route, status}
  - http_request_duration_seconds_bucket (histograms by route)
  - external_api_requests_total{provider, status}
  - external_api_request_duration_seconds_bucket{provider}
  - external_api_cost_total{provider} (counter in dollars)
  - cache_hits_total{cache="zipSearch|address|skipTrace|ai"}
  - rate_limit_hits_total{route}
  - background_jobs_total{job="scrape|enrich", status}
  - prisma_query_duration_seconds_bucket (optional if instrumented)
- Resource metrics:
  - process_cpu_user_seconds_total, process_resident_memory_bytes
- Alerts (out-of-band via dashboard):
  - High 5xx rates
  - High provider error rates (open circuit breakers)
  - Budget threshold (80% of daily budget), block at 100%

Implementation sketch
- backend/src/server.ts
  - Register prom-client registry; initialize histograms and counters
  - Add middleware to record http durations
- backend/src/services/* (axios wrappers)
  - On request/response/error, update provider metrics and cost counters
- Budget guard
  - A singleton budget tracker exposes budget_used_total; checked in middleware before expensive endpoints

---

## 4) Tracing

Approach
- Lightweight tracing with correlationId propagated through internal calls
- Optional OpenTelemetry tracing if operationally feasible
  - Node SDK for HTTP server + axios instrumentation
  - Exporters: OTLP to an APM (e.g., Uptrace/Jaeger/Tempo/Lighstep) or Sentry performance tracing

MVP (recommended)
- CorrelationId propagation in logs and response headers
- Include provider call spans as log entries with parent correlationId

Stretch (optional)
- Add OpenTelemetry SDK to capture spans automatically and export to a collector

---

## 5) Cost Accounting

Goals
- Quantify spend per provider and per request; enforce daily budget limits.

Plan
- masterConfig provides costPerCall for APIs
- For each provider call:
  - Increment external_api_cost_total{provider} by computed cost
  - Attach cost to response metadata where relevant (already present in real-estate routes)
- Daily budget middleware:
  - If cost_used_today > dailyBudgetLimit × alertThreshold (default 0.8): return warning header X-Budget-Warning: true
  - If >= 1.0 × dailyBudgetLimit: return 429 with friendly message and retry-after
- Caching:
  - Cache keys: (zip, filter hash, yyyy-mm-dd), (address normalized), (leadId for skip trace for 30 days), (AI prompt hash 7 days)
  - Track cache hits via cache_hits_total

---

## 6) Dashboarding

- Self-hosted Grafana or hosted dashboards
  - Panels: HTTP rate/latency/err%, provider errors and cost, cache hits, queue/job status
- Sentry dashboards for error trends, releases, suspect commits
- Logs: ship to Loki or another centralized sink if needed

---

## 7) Runbook & On-call

- Incident triage:
  1) Check Sentry for spikes and stack traces (use correlationId to drill into logs)
  2) Review /metrics graphs for provider error spikes and cost anomalies
  3) If budget exceeded, feature-flag real search off and rely on cached responses
- Escalations:
  - API provider rate limits/429s → backoff, cache, and switch providers
  - Twilio messaging failures → throttle and retry, check A2P compliance status
- Postmortems:
  - Record incident, add action items to TODO.labels.json with owner and ETA

---

## 8) Actionable Tasks

- OBS-001: Add correlationId middleware and include in logs and responses
- OBS-002: Integrate Sentry for backend with release/environment tags
- OBS-003: Add prom-client metrics and /metrics endpoint (secured)
- OBS-004: Wrap axios with logging, metrics, retries, and cost counters
- OBS-005: Implement budget guard + warning headers and hard cap
- OBS-006: Add cache for zip/address/skip-trace/AI with hit counters
- OBS-007: Frontend error boundary and optional Sentry

References
- backend/src/utils/logger.ts
- backend/src/server.ts
- backend/src/services/* (axios clients)
- backend/src/config/masterConfig.ts (budget)
