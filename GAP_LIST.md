# LeadFlow — Gaps and Blockers

Timestamp (ET): 2025-08-16 12:00 ET

This document enumerates gaps/blockers found during the audit with severity, evidence, and proposed fixes. Items map to machine-readable issues in TODO.labels.json.

Severity scale: critical, high, medium, low.

---

## Critical

1) Dual Prisma schemas cause drift and deployment risk
- Severity: critical
- Evidence:
  - backend/prisma/schema.prisma → provider = postgresql, full CRM schema
  - prisma/schema.prisma → provider = sqlite, divergent models (Lead, ProbateCase, etc.)
- Impact: migrations, data shape, and runtime behavior differ by environment; seeds/tests ambiguous.
- Fix:
  - Choose backend Postgres schema as source of truth.
  - Deprecate root prisma directory or merge models formally.
  - Add .env.example with DATABASE_URL; add prisma validate in CI.
- Files: backend/prisma/schema.prisma, prisma/schema.prisma
- ETA: 1–2 days

2) DNC/TCPA compliance missing
- Severity: critical
- Evidence: No DNC cache per phone, no consent storage, no quiet hours enforcement; Twilio present but not wired end-to-end.
- Impact: Legal and financial risk; cannot operate outreach in production.
- Fix:
  - Create DNCCheck table, Consent table (leadId/phone/consentType/timestamp/source).
  - Enforce quiet hours in campaign send service.
  - Integrate DNC lookup provider (or cached registry).
- Files: backend/src/services/telephony.ts (new), backend/src/routes/campaigns.ts, backend/prisma/schema.prisma (new tables)
- ETA: 2–3 days

3) Auth hardening (refresh tokens, rotation, revocation) not implemented
- Severity: critical
- Evidence: middleware/auth.ts uses single JWT with expiry; no refresh flow or revocation.
- Impact: Session security risk; forced re-login on expiry; no server-side invalidation.
- Fix:
  - Add RefreshToken table (userId, tokenHash, expiresAt, revokedAt).
  - Implement refresh endpoint, rotation, and revoke on logout.
  - Add device metadata for session management; tests.
- Files: backend/src/middleware/auth.ts, backend/src/routes/auth.ts, backend/prisma/schema.prisma
- ETA: 1–2 days

4) Secrets and environment layering insufficient
- Severity: critical
- Evidence: process.env reads; no .env.example; no validation.
- Impact: Misconfig at deploy; missing keys only noticed at runtime.
- Fix:
  - Add .env.example; adopt zod-based config validation.
  - Document local/staging/prod envs; ensure masterConfig validation covers essentials.
- Files: backend/src/config/masterConfig.ts, root .env.example (new)
- ETA: 0.5 day

---

## High

5) Observability incomplete (Sentry/metrics/tracing missing)
- Severity: high
- Evidence: winston/morgan present; no Sentry or metrics; no correlation IDs.
- Impact: Incident response and root-cause analysis hindered; API cost attribution limited.
- Fix:
  - Add @sentry/node on backend with release + env tags; set up HTTP tracing.
  - Add correlationId middleware; Prometheus metrics for HTTP/external calls/costs.
- Files: backend/src/utils/logger.ts, backend/src/server.ts (middleware), new observability module
- ETA: 1–2 days

6) Reliability protections: timeouts/retries/circuit breaker/idempotency
- Severity: high
- Evidence: requestTimeout(30000) exists; axios calls lack standardized retry/backoff; mutating endpoints lack idempotency keys.
- Impact: Flaky behavior, duplicate writes under retries.
- Fix:
  - Axios instance with timeouts, retry (exponential backoff), and circuit-breaker for each provider.
  - Idempotency-Key support for POST /api/leads and skip-trace initiation.
- Files: backend/src/services/*.ts, backend/src/server.ts (middleware), leads routes/controller
- ETA: 1–2 days

7) Campaigns not end-to-end
- Severity: high
- Evidence: routes/campaigns.ts placeholder; schema exists (Campaign, CampaignLog) but no send pipeline.
- Impact: Cannot send real outreach.
- Fix:
  - Implement campaign scheduler → Twilio SMS sending → CampaignLog persistence.
  - Throttling, per-org limits, opt-out (STOP), link tracked redirects (basic).
- Files: backend/src/routes/campaigns.ts, services/telephony.ts (new), jobs/scheduler.ts (new)
- ETA: 2–3 days

8) Puppeteer and API costs guardrails
- Severity: high
- Evidence: Scraper without stealth/proxy/budget gates; service calls without central cost cache.
- Impact: Blocks at scale; cost overruns.
- Fix:
  - puppeteer-extra-plugin-stealth; proxy rotation; scrape budget per org/day.
  - Cache per zip/address results; concurrency limits; global cost aggregator.
- Files: backend/src/scrapers/zillowScraper.ts, realPropertyDataService.ts, masterRealEstateService.ts
- ETA: 1–2 days

---

## Medium

9) Frontend auth/session not persisted
- Severity: medium
- Evidence: App.tsx toggles auth state locally; no token persistence or refresh; no 401 handling.
- Impact: UX breaks; cannot keep user sessions; protected routes not enforced.
- Fix:
  - Persist token (localStorage/secure storage); axios interceptor adds Authorization; 401 → logout/refresh.
  - Route guards; basic user context.
- Files: frontend/src/api/client.ts, frontend/src/App.tsx, frontend/src/pages/Login.tsx
- ETA: 1 day

10) Data normalization and dedupe consistency
- Severity: medium
- Evidence: PropertyRecord uses propertyHash; ingestion paths may diverge; no canonical normalizer.
- Impact: Duplicates across sources; inconsistent data shapes.
- Fix:
  - Central normalizeProperty() function; consistent hash keys; enforce unique constraints.
- Files: backend/src/services/realPropertyDataService.ts, masterRealEstateService.ts, scrapers/zillowScraper.ts
- ETA: 1 day

11) Missing file upload pipeline
- Severity: medium
- Evidence: Multer present; no configured storage (S3) or validation routes.
- Impact: Flip tracker/docs/photos not supported.
- Fix:
  - Implement S3 adapter (or local for dev); max size/type validation; signed URLs.
- Files: backend/src/routes/uploads.ts (new), backend/src/services/storage.ts (new)
- ETA: 1–2 days

12) CI/CD missing
- Severity: medium
- Evidence: No workflows.
- Impact: Regressions slip; inconsistent builds.
- Fix:
  - GitHub Actions: install, lint, typecheck, test, prisma validate, build; optional docker build + Trivy scan.
- Files: .github/workflows/ci.yml (new)
- ETA: 0.5–1 day

---

## Low

13) TypeScript strictness not enforced globally
- Severity: low
- Evidence: tsconfig.json not confirmed strict; any usage unknown.
- Impact: Type safety gaps.
- Fix:
  - Enable "strict": true; fix resultant errors; run ts-prune for dead code.
- Files: backend/tsconfig.json, frontend/tsconfig.json, root tsconfig.json
- ETA: 0.5–1 day

14) API documentation drift
- Severity: low
- Evidence: Many endpoints; no OpenAPI spec.
- Impact: Integration friction.
- Fix:
  - Generate OpenAPI with tsoa/express-oas-generator or hand-author; publish via Redoc.
- Files: backend/openapi.yaml (new), doc generator (optional)
- ETA: 1 day

---

## Unknowns

- Authoritative Prisma schema decision (backend Postgres recommended). Need confirmation.
- Which external providers will be funded at launch (ATTOM, DataTree, Twilio, DNC provider).
- Deployment target: DigitalOcean droplet + managed Postgres + AWS S3? Confirm to finalize infra IaC.
- Queue selection: BullMQ with Redis vs managed alternative; cron sufficiency.
- TCPA compliance counsel requirements (recordkeeping period, right-to-delete workflow).

Proposed Resolution
- Add RFC short doc to /docs/ for schema unification decision with rollout plan.
- Create .env.example and collect keys per provider; short-term sandbox keys for dev.
- Draft infra diagram; pick Redis/BullMQ; stub Dockerfiles if needed.
- Legal checklist in SECURITY_CHECKLIST.md with owners and deadlines.
