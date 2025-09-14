# LeadFlow — Security & Compliance Checklist

Timestamp (ET): 2025-08-16 12:00 ET

Scope
- Authentication, authorization, secrets, PII handling, DNC/TCPA compliance, and environment hardening, based on current code in backend and frontend. Items are marked with Status and include remediation guidance and references.

Statuses: complete, partial, missing

---

## 1) Authentication & Authorization

1.1 Access tokens (JWT)
- Status: partial
- Evidence: backend/src/middleware/auth.ts uses JWT with exp; secret via process.env.JWT_SECRET; roles used with restrictTo()
- Gaps:
  - No refresh token/rotation
  - No revocation on logout or device/session management
- Actions:
  - Add RefreshToken table and rotation, revoke on logout; enforce token family invalidation
  - Short-living access token (15m–1h), refresh ~30–90d
- Files: backend/src/middleware/auth.ts, backend/src/routes/auth.ts, backend/prisma/schema.prisma
- Acceptance:
  - Refresh endpoint implemented; on rotation old refresh invalidated; tests pass

1.2 Authorization (RBAC)
- Status: partial
- Evidence: restrictTo('admin', 'manager') used on destructive endpoints; authenticate() required on critical routes
- Gaps:
  - Verify all routes enforce org-level scoping and RBAC
- Actions:
  - Audit each controller/route; add restrictTo where needed; add orgId filters consistently
- Files: backend/src/routes/*.ts, backend/src/controllers/*.ts
- Acceptance:
  - All mutating endpoints require auth; admin-only where appropriate; tests verifying 403 for unauthorized roles

1.3 Multi-tenancy row isolation
- Status: partial
- Evidence: leadController queries filter by organizationId
- Gaps:
  - Ensure all list/get/update paths include organizationId filter
- Actions:
  - Add a Prisma middleware or repository wrapper enforcing organizationId per request
- Files: backend/src/controllers/*, backend/src/routes/*
- Acceptance:
  - Tests confirm tenant isolation; any missing filters fixed

---

## 2) Secrets & Configuration

2.1 Secrets in env
- Status: partial
- Evidence: dotenv used; process.env.* across services; no .env.example committed
- Actions:
  - Add .env.example with all required keys; use a typed config loader with zod validation; fail-fast on missing/invalid config
- Files: backend/src/config/masterConfig.ts (extend), root .env.example (new)
- Acceptance:
  - Boot fails with descriptive error when required env missing; .env.example covers all secrets

2.2 Environment separation
- Status: missing
- Actions:
  - Establish .env.local, .env.staging, .env.production with documented differences; never commit secrets
- Acceptance:
  - Docs updated; build/deploy scripts load correct env set

2.3 Secret rotation
- Status: missing
- Actions:
  - Document rotation procedure for JWT_SECRET, Twilio tokens, API keys; schedule reminders; store in secret manager if available
- Acceptance:
  - Runbook exists; rotation rehearsal completed in staging

---

## 3) Data Security & PII

3.1 PII inventory
- Status: partial
- Evidence: Lead contains ownerName, ownerPhone, ownerEmail, ownerAddress; SkipTraceRecord stores request/response
- Actions:
  - Minimize PII fields in SkipTraceRecord.responseData; encrypt at rest if policy requires; add data retention (e.g., purge after N days)
- Files: backend/prisma/schema.prisma, backend/src/services/skipTraceService.ts
- Acceptance:
  - PII retention window documented and enforced by scheduled task; fields minimized

3.2 Transport security
- Status: partial
- Evidence: HTTP server; TLS termination not shown (assumed infra)
- Actions:
  - Enforce HTTPS in production via reverse proxy; set secure cookies if cookies introduced; set HSTS headers
- Files: infra (reverse proxy), backend/src/server.ts (helmet HSTS config)
- Acceptance:
  - Production behind HTTPS; HSTS enabled

3.3 Input validation/XSS/Injection
- Status: partial
- Evidence: Zod validation; sanitizeInput in validation.ts; Prisma parameterization
- Gaps:
  - Ensure validation on all mutating routes; HTML/script injections in free-text notes
- Actions:
  - Expand schemas; sanitize notes/comments; add content-length limits
- Files: backend/src/middleware/validation.ts, backend/src/routes/*
- Acceptance:
  - Tests cover invalid payloads; sanitization verified

3.4 Audit/event logs
- Status: partial
- Evidence: LeadNote, CampaignLog, CallLog; AppError logging via logger
- Gaps:
  - No unified EventLog with actor/correlationId
- Actions:
  - Introduce EventLog table or enrich existing logs with correlationId; include userId/orgId
- Acceptance:
  - Key state changes auditable; logs searchable with request IDs

---

## 4) DNC/TCPA Compliance

4.1 DNC checks
- Status: missing
- Actions:
  - Implement DNCCheck table (phone, result, checkedAt, source); check before sending SMS/voice; cache results
- Files: backend/prisma/schema.prisma, backend/src/services/telephony.ts (new), backend/src/routes/campaigns.ts
- Acceptance:
  - Sends blocked for DNC-listed numbers; tests in place

4.2 Consent logging
- Status: missing
- Actions:
  - ConsentLog table (leadId, phone, consentType, source, timestamp); store opt-in/out events; STOP handler
- Files: backend/prisma/schema.prisma, backend/src/routes/campaigns.ts, inbound webhook handler (new)
- Acceptance:
  - Outbound messages require consent or permissible use; STOP toggles opt-out

4.3 Quiet hours
- Status: missing
- Actions:
  - Enforce quiet hours (e.g., 8am–9pm local time of recipient or org); configurable per org
- Files: backend/src/services/telephony.ts (send pipeline)
- Acceptance:
  - Sends outside quiet hours queued/deferred

---

## 5) Reliability & Abuse Prevention

5.1 Rate limiting & request size
- Status: partial
- Evidence: express-rate-limit on /api/; request size limits in server.ts
- Actions:
  - Fine-tune per-route and per-org limits; add burst handling; stricter limits on expensive endpoints
- Acceptance:
  - No 429 regressions under normal usage; protects from abuse

5.2 Timeouts/retries/circuit breakers
- Status: missing/partial
- Actions:
  - Adopt axios instance with default timeouts, retry on transient errors, and circuit-breakers per integration
- Files: backend/src/services/*.ts
- Acceptance:
  - External outage does not cascade; metrics visible

5.3 Idempotency
- Status: missing
- Actions:
  - Enforce Idempotency-Key on POST /api/leads and skip-trace; store request hash + ttl
- Files: backend/src/server.ts (middleware), backend/src/controllers/leadController.ts
- Acceptance:
  - Retries do not duplicate resources

---

## 6) Storage & Uploads

6.1 File uploads
- Status: partial
- Evidence: multer installed; no S3 storage adapter yet
- Actions:
  - Add S3 (or DO Spaces) adapter; validate type/size; signed URLs; malware scanning if needed
- Files: backend/src/services/storage.ts (new), backend/src/routes/uploads.ts (new)
- Acceptance:
  - Secure upload/download with access controls

---

## 7) Frontend Security

7.1 Auth token storage and CSRF
- Status: missing/partial
- Evidence: isAuthenticated state only; no persisted JWT; no CSRF since cookies not used
- Actions:
  - Store token securely (localStorage acceptable for SPA + pure Authorization header); consider refresh flow; sanitize all user inputs; avoid dangerouslySetInnerHTML
- Files: frontend/src/api/client.ts, frontend/src/pages/Login.tsx
- Acceptance:
  - 401 handling and logout; no PII in localStorage beyond token/user id

7.2 Dependency hygiene
- Status: partial
- Actions:
  - Enable npm audit step in CI; renovate or equivalent for updates
- Acceptance:
  - Routine patch/minor updates applied

---

## 8) Infrastructure & Backups

8.1 Backups and retention
- Status: missing
- Actions:
  - Configure Postgres automated backups; retention policy; export encryption
- Acceptance:
  - Restore test documented and rehearsed

8.2 Logging retention and PII
- Status: partial
- Actions:
  - Avoid logging PII; mask phone/email in logs; set log retention limits
- Files: backend/src/utils/logger.ts
- Acceptance:
  - Logs comply with PII policy

---

## 9) Actionable PRs (Security)

- SEC-001: JWT refresh & rotation (critical)
- SEC-002: .env.example + zod config validation (critical)
- SEC-003: DNC/TCPA baseline (critical)
- SEC-004: Idempotency keys on POST (high)
- SEC-005: Correlation IDs + Sentry integration (high)
- SEC-006: Org row-level enforcement audit (high)

See TODO.labels.json for structured issues.
