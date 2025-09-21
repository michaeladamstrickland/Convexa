# API Surface Inventory — Convexa (2025-09-20)

This document inventories HTTP API routes detected in the workspace. It focuses on the integrated backend (`backend/integrated-server.js`) and notes additional TypeScript server routes for follow-up.

Legend
- File: handler source file
- Auth: none | admin (x-admin-token in prod) | bearer (future)
- Errors: Problem+JSON `{ code, field?, message }` on routes with validation/global handler; legacy `{ error }` remains on untouched endpoints
- Metrics: http_requests_total counter with labels (method, route, status) via prom-client (where enabled)

## Core

- GET /health
  - File: backend/integrated-server.js
  - Auth: none
  - Req: —
  - Res: { status, version, database, services[], timestamp }
  - Errors: —
  - Metrics: yes

- GET /metrics
  - File: backend/integrated-server.js
  - Auth: none (recommend gating in prod)
  - Req: —
  - Res: Prometheus exposition
  - Metrics: —

- GET /api/status
  - File: backend/integrated-server.js
  - Auth: none
  - Req: —
  - Res: { status, database, leadCount, services, timestamp }
  - Errors: { error }
  - Metrics: yes

## Search/Leads

- GET /api/zip-search-new/search
  - File: backend/integrated-server.js
  - Auth: none
  - Req (query): { query?, minValue?, maxValue?, city?, state?, zipCode?, propertyType?, source?, temperature?, limit?, page? }
  - Res: { leads: Lead[], pagination }
  - Errors: { error }
  - Metrics: yes

- POST /api/zip-search-new/search-zip
  - File: backend/integrated-server.js
  - Auth: none
  - Req (body): { zipCode: string }
  - Res: { leadCount, zipCode, leads[] }
  - Errors: 400 { error } when zipCode missing
  - Metrics: yes

- POST /api/zip-search-new/add-lead
  - File: backend/integrated-server.js
  - Auth: none
  - Req (body): LeadCreate (see dto)
  - Res: { success, message, leadId }
  - Errors: 400 { error } when address missing; 400 { success:false,message,existingId } if duplicate
  - Metrics: yes
  - Notes: Recommend zod validation + Problem+JSON

- POST /api/search
  - File: backend/integrated-server.js (searchRouter)
  - Auth: none
  - Req (body): { query?, city?, state?, zipCode?, source?, temperature?, status?, minValue?, maxValue?, limit?, page?, sortBy?, sortOrder? }
  - Res: { leads: Lead[], pagination }
  - Errors: { error }
  - Metrics: yes

- GET /api/search/analytics
  - File: backend/integrated-server.js
  - Auth: none
  - Req: —
  - Res: { analytics }
  - Errors: { error }
  - Metrics: yes

- POST /api/search/clear-cache
  - File: backend/integrated-server.js
  - Auth: none
  - Req: —
  - Res: { success, message }
  - Errors: { error }
  - Metrics: yes

- GET /api/leads/:id
  - File: backend/integrated-server.js
  - Auth: none
  - Req: params { id }
  - Res: { lead: { id, address, owner_name, city?, state?, zip?, created_at, updated_at } }
  - Errors: 404 { error }
  - Metrics: yes

## Skiptrace

- POST /api/leads/:id/skiptrace
  - File: backend/integrated-server.js
  - Auth: none
  - Req: params { id } + query/body { force?, provider?, fallback?, maxRetries?, runId? }
  - Res: { success, message, data: { leadId, phones[], emails[], cached, cost, provider }, error? }
  - Errors: 404 { success:false, message } when lead missing; 500 { success:false, message, error }
  - Metrics: yes

- GET /api/leads/:id/skiptrace
  - File: backend/integrated-server.js
  - Auth: none
  - Req: params { id }
  - Res: { success, message, data: { leadId, phones[], emails[], cost?, provider?, cached:true } } | { success:false, message, data: { phones:[], emails:[] } }
  - Errors: 404 { success:false, message } when lead missing; 500 { success:false, message, error }
  - Metrics: yes

- POST /api/leads/bulk/skiptrace
  - File: backend/integrated-server.js
  - Auth: none
  - Req (body): { leadIds: string[] }
  - Res: { success, message, data: Result[], totalCost, quota }
  - Errors: 400 invalid array; 429 insufficient quota; 500 { message, error }
  - Metrics: yes

- GET /api/skiptrace/quota
  - File: backend/integrated-server.js
  - Auth: none
  - Res: { success, data: quota }
  - Metrics: yes

- GET /api/skiptrace/analytics
  - File: backend/integrated-server.js
  - Auth: none
  - Req (query): { startDate?, endDate? }
  - Res: { success, data: { totalCost, totalCount, averageCost, dailyCosts[], dateRange } }
  - Metrics: yes

- GET /api/skiptrace-runs/:runId/status
  - File: backend/integrated-server.js
  - Auth: none
  - Res: { success, run_id, soft_paused, started_at, finished_at, totals }
  - Errors: 404 { success:false, error }
  - Metrics: yes

- GET /api/skiptrace-runs/:runId/report
  - File: backend/integrated-server.js
  - Auth: none
  - Res: report JSON (shape defined by reportService)
  - Errors: 404 { error } when not found; 500 { error }
  - Metrics: yes

- POST /admin/skiptrace-runs/:runId/resume
  - File: backend/routes/adminGuardrails.js (mounted)
  - Auth: admin (x-admin-token in prod)
  - Res: { success }
  - Metrics: yes

## ATTOM Proxy

- GET /api/attom/status
- GET /api/attom/property/address
- GET /api/attom/property/zip
- GET /api/attom/property/:attomId
- GET /api/attom/property/:attomId/valuation
  - File: backend/integrated-server.js
  - Auth: none
  - Errors: { error } on upstream issues
  - Metrics: yes

## Debug

- GET /api/debug/config
- GET /api/debug/provider-calls-today
- GET /api/debug/errors-today
- GET /api/debug/skiptrace-latest
- GET /api/debug/attempt-reasons-today
- GET /api/debug/zip-hints-today
  - File: backend/integrated-server.js
  - Auth: admin middleware in prod
  - Metrics: yes

## New/updated routes (additive)

- POST /dial
  - File: backend/integrated-server.js
  - Auth: admin (TBD)
  - Req (body): DialRequest (see dto)
  - Res: DialResponse
  - Errors: Problem+JSON
  - Metrics: dial_attempts_total{provider,status}

- POST /twilio/recording-complete
  - File: backend/integrated-server.js
  - Auth: Twilio signature (X-Twilio-Signature)
  - Req: Twilio RecordingWebhook (form-encoded)
  - Res: { success: true }
  - Errors: 401 Problem+JSON on bad signature; validation Problem+JSON
  - Metrics: webhook_errors_total{type}

- POST /dial/:dialId/asr-complete
  - File: backend/integrated-server.js
  - Auth: internal
  - Req (body): AsrComplete
  - Res: { success: true }
  - Errors: Problem+JSON
  - Metrics: asr_latency_seconds (histogram)

- GET /admin/artifacts
  - File: backend/integrated-server.js
  - Lists run artifacts with signed (24h) download links
  - DTO: { artifacts: [{ runId, createdAt, size, signedUrl }] }
  - Auth: admin

- GET /admin/artifact-download
  - File: backend/integrated-server.js
  - Auth: signed URL only (HMAC, ttl)
  - Errors: 403 invalid/expired signature; 404 not found

## Proposed routes (scaffold only)

- GET /admin/artifacts
  - Lists run artifacts with signed (24h) download links
  - DTO: ArtifactListResponse
  - Auth: admin

- GET /leads?query=&status=&page=&limit=
  - Alias for /api/zip-search-new/search with consistent DTO

- GET /leads/:id
  - Already exists; align DTO shape with `Lead` schema

## DTOs

See `src/dto/v1/*.ts` for zod schemas and TypeScript types.

## Gaps noted

- Standardize error shape on untouched legacy routes.
- `/metrics` likely should be gated in prod.
