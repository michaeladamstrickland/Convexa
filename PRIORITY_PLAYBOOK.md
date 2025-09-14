# LeadFlow — 2-Week Priority Playbook (D0, D3, D7, D10)

Timestamp (ET): 2025-08-16 12:00 ET
Goal: Reach “real leads flowing + campaigns live” with production-grade guardrails.

Constraints
- No destructive rewrites. Use PRs with small, testable diffs.
- Environments: local (dev), staging (if configured), production target DigitalOcean + AWS S3.

Success Criteria
- Real property search endpoints deliver leads with caching and cost controls.
- DNC/TCPA baseline enforced for SMS campaigns.
- JWT auth hardened with refresh/rotation; org scoping consistent.
- Observability in place (Sentry + metrics).
- CI runs lint/typecheck/tests/build and prisma validate.
- Documentation artifacts updated.

Repo anchors (for reference)
- Backend server: backend/src/server.ts
- Routes: backend/src/routes/*
- Prisma (authoritative target): backend/prisma/schema.prisma (PostgreSQL)
- Services: backend/src/services/*
- Frontend: frontend/src/*
- Config: backend/src/config/masterConfig.ts

---

## Day 0–2 (D0): Foundation — Data, Auth, Env

Objective: Eliminate drift, enable reliable dev workflows, and persist auth on frontend.

Backend
1. Prisma unification
   - Decision: choose backend/prisma/schema.prisma (PostgreSQL) as source of truth.
   - Task: deprecate root prisma usage (keep files, add README note). Ensure DATABASE_URL is set.
   - Command checklist (manual):
     - cd backend && npx prisma generate && npx prisma validate
     - npx prisma migrate dev -n "init"
   - Add prisma validate to CI.

2. Env & config hardening
   - Add .env.example with all required keys:
     - DATABASE_URL, JWT_SECRET, LEADFLOW_TIER, DAILY_BUDGET_LIMIT, CORS_ORIGIN
     - ATTOM*, DATA_TREE*, ZILLOW_RAPIDAPI_KEY, OPENAI_API_KEY, GOOGLE_MAPS_API_KEY, TWILIO_*
   - Add config validation (zod) at startup; fail fast with clear messages.

3. AuthN/Z improvements (phase 1)
   - Add refresh token model/table and endpoints (issue, rotate, revoke on logout).
   - Update middleware/auth.ts to check revocation and rotation rules.
   - Tests: add unit tests for auth flows; ensure organizationId row scoping in controllers (leads, campaigns, analytics).

Frontend
4. Persisted auth and API client
   - frontend/src/api/client.ts: attach Authorization header from localStorage.
   - Handle 401/403 globally; redirect to login; token refresh when implemented.
   - Protect routes (App.tsx); add logout; show basic user profile info.

Deliverables
- PRs: prisma-unify, env-example, auth-refresh, fe-auth-persistence
- CI: prisma validate, lint, typecheck, test, build

---

## Day 3–5 (D3): Real Leads Intake + Cost Guardrails

Objective: Generate high-quality leads via APIs with caching and budget protection.

Backend
1. RealPropertyDataService guardrails
   - Central axios instance with:
     - timeouts (e.g., 10s), retries (exponential backoff), circuit breaker per provider
     - cost tracking per request; return costs in metadata
   - Add LRU cache keyed by (zip, filters, day) to avoid duplicate API spend.
   - Respect daily budget limits from masterConfig.getDailyBudgetLimit().

2. Idempotency and input validation
   - Add Idempotency-Key support for mutating endpoints:
     - POST /api/leads
     - POST /api/leads/:id/skip-trace
   - Strengthen zod schemas (validation.ts) coverage across routes.

3. Scraper stability
   - Add puppeteer-extra-plugin-stealth, proxy support, randomized timing.
   - Ensure PropertyRecord hashing consistent; save sample raw HTML snippet for failures.

Frontend
4. Real search UX
   - Zip search and “real-estate” search forms with filters.
   - Display cost metadata and data sources used.
   - Loading, error states; basic pagination.

Deliverables
- PRs: api-guardrails, idempotency, scraper-hardening, fe-real-search
- Endpoints validated: /api/real-estate/search-real-zip, /api/real-estate/search-real-multiple-zips
- Update ENDPOINTS.md with idempotency header usage.

---

## Day 6–8 (D7): Outreach MVP — DNC/TCPA + Twilio SMS

Objective: Legal guardrails and basic campaign execution.

Backend
1. DNC/TCPA baseline
   - Schema additions:
     - DNCCheck (phone, result, checkedAt, source)
     - ConsentLog (leadId, phone, consentType, source, timestamp)
   - Enforcement:
     - Middleware for outbound messages checks DNC and consent.
     - Quiet hours per org time zone (default ET 8am–9pm).
   - Store TCPA acceptance events and “STOP” opt-out handling.

2. Twilio SMS MVP
   - Service: telephony.ts with sendSMS(), receive webhook for replies/STOP.
   - Route: POST /api/campaigns/send (or scheduler job triggers sends).
   - Persist CampaignLog entries (status sent/delivered/replied/failed).

3. Rate limits and throttling
   - Per org campaign send rates (e.g., 1 msg/sec); backoff on Twilio errors.

Frontend
4. Campaign UI
   - Create a basic campaign creation form (type SMS, message template, filters).
   - Show campaign status and latest logs.

Deliverables
- PRs: dnc-tcpa-baseline, twilio-sms-mvp, fe-campaigns
- Update SECURITY_CHECKLIST.md, ENDPOINTS.md
- Tests: unit tests for DNC checks and SMS send logic; integration (mock Twilio)

---

## Day 9–11 (D10): Observability, Reliability, Docs

Objective: Ensure ops readiness, metrics, docs, and polish.

Backend
1. Observability
   - Sentry (@sentry/node): capture errors, request context, release tags.
   - Metrics (Prometheus): http requests, latencies, external API costs, cache hit rate.
   - Correlation IDs: middleware that sets X-Request-Id; include in logs and responses.

2. Reliability improvements
   - Standard error response shape across services; enrich errorHandler.
   - Retry semantics documented; circuit breaker metrics exposed.
   - Worker/cron: schedule scrapes/enrichment with node-cron (or BullMQ if Redis available).

3. CI/CD
   - GitHub Actions: lint, typecheck, test (unit+integration), prisma validate, build.
   - Optional: Docker build and Trivy scan.

Frontend
4. UX polish
   - Error boundaries; skeleton loaders; accessibility pass on forms/tables.
   - Analytics page consumes backend stats with chart placeholders.

Docs
5. Keep artifacts up to date
   - Update ENDPOINTS.md, INTEGRATIONS.md, TEST_PLAN.md.
   - Add OpenAPI draft for core routes (optional).

Deliverables
- PRs: observability, reliability, ci-cd, fe-ux-polish
- Dashboards: basic metrics endpoint /metrics; Sentry DSN in envs.

---

## Dependencies & Sequencing

- D0 must precede D3 (Prisma/Env blockers).
- D3 precedes D7 (intake/cost controls before messaging).
- D7 precedes D10 (observability captures real usage and campaigns).

---

## Risk Register

- External API keys not available → Mock providers, enable dry-run mode, and cache sample responses for dev.
- Twilio compliance complexity → Start with minimal viable TCPA requirements; legal review in parallel.
- Cost overruns → Strong caching, rate limits, and daily budget enforcement.

---

## Measurement

- Leads throughput: results.leadCount per day per org.
- Cost per lead: totalCost/leadCount from metadata.
- Campaign effectiveness: sent, delivered, replied; reply rate target > 5%.
- Error rate: < 1% 5xx on primary routes.
- Latency: P95 < 1.5s for read endpoints; write endpoints < 2s (async jobs decoupled).

---

## Rollback

- Feature flags for:
  - Real search execution (disable on budget breach).
  - Campaign sends (kill switch).
- DB migrations backward-compatible; keep old columns for 1 release.
