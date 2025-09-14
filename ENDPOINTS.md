## CRM Activity (src/routes/adminMetrics.ts) [admin]

POST /api/admin/crm-activity
 - Description: Manually create a CRM activity entry; optionally emit crm.activity webhook.
 - Body: { type: string, propertyId?: string, leadId?: string, userId?: string, metadata?: object, emitWebhook?: boolean }
 - Response: { success: true, data: { id, type, propertyId, leadId, userId, metadata, createdAt } }

GET /api/admin/crm-activity
 - Description: List CRM activities with filters and cursor pagination.
 - Query: type, propertyId, leadId, userId, createdAt[from], createdAt[to], limit, cursor, order
 - Response: { data: Array<CrmActivity>, meta: { nextCursor, pagination: { limit } } }

Metrics Exposed (via /api/dev/metrics)
 - leadflow_crm_activity_total
 - leadflow_crm_activity_total{type="..."}
 - leadflow_crm_activity_webhook_total{status="success|fail"}

---
# LeadFlow REST API Surface

Timestamp (ET): 2025-08-16 12:00 ET
Base URL (local): http://localhost:3001

Notes
- Auth: Unless specified, protected routes require Authorization: Bearer <JWT>.
- Content-Type: application/json unless otherwise noted.
- Error format: middleware returns JSON with error and message; validation produces details array.

---

## Health & System

GET /health
- Description: Basic liveness probe.
- Example:
  - Request: GET /health
  - Response:
    {
      "status": "healthy" | "OK",
      "timestamp": "2025-08-16T16:00:00.000Z",
      "version": "1.0.0",
      "tier": "Starter|Professional|Enterprise",
      "apis_enabled": 5,
      "estimated_cost_per_search": 1.75,
      "daily_budget_limit": 100
    }

GET /api/system/status
- Description: System status, enabled APIs, missing credentials, configuration validity.
- Example:
  - Response:
    {
      "tier": "Starter",
      "totalAPIs": 18,
      "enabledAPIs": 5,
      "estimatedCostPerSearch": 1.75,
      "dailyBudgetLimit": 100,
      "maxMonthlySearches": 500,
      "features": ["basic_search", "contact_lookup", "distress_signals"],
      "available_apis": ["attomData","openAI","googleMaps"],
      "missing_api_keys": ["dataTree","propertyRadar", "..."],
      "configuration_valid": true
    }

GET /api/system/cost-estimate
- Description: Cost per search estimate and tier limits.
- Example:
  - Response:
    {
      "cost_per_search": 1.75,
      "daily_budget_limit": 100,
      "max_searches_per_day": 57,
      "tier": "Starter",
      "monthly_cost_range": { "min": 500, "max": 800 },
      "max_monthly_searches": 500
    }

---

## Auth (backend/src/routes/auth.ts)

POST /api/auth/register
- Description: Create organization and first admin user.
- Body:
  {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com",
    "password": "StrongPassw0rd!",
    "organizationName": "Ada Ventures"
  }
- Response:
  { "success": true, "token": "JWT", "data": { "user": { "id": "...", "email": "ada@example.com", "role": "admin", "organizationId": "..." } } }

POST /api/auth/login
- Description: Get JWT token.
- Body:
  { "email": "ada@example.com", "password": "StrongPassw0rd!" }
- Response:
  { "success": true, "token": "JWT", "data": { "user": { "id":"...", "email":"...", "role":"admin" } } }

POST /api/auth/forgot-password
- Description: Placeholder for reset email send.
- Response: { "success": true, "message": "Password reset email sent (placeholder)" }

POST /api/auth/reset-password
- Description: Placeholder reset.
- Response: { "success": true, "message": "Password reset successful (placeholder)" }

---

## Leads (backend/src/routes/leads.ts) [auth required]

GET /api/leads
- Description: Paginated lead search with filters.
- Query:
  ?page=1&amp;limit=20&amp;status=new&amp;priority=high&amp;search=phoenix
- Response:
  {
    "success": true,
    "data": {
      "leads": [ { "id": "...", "propertyAddress": "...", "_count": { "callLogs": 1, "leadNotes": 2, "skipTraceRecords": 0 } } ],
      "pagination": { "total": 124, "page": 1, "limit": 20, "totalPages": 7 }
    }
  }

POST /api/leads
- Description: Create lead. Triggers background AI analysis if valuation fields present.
- Body (example minimal):
  {
    "firstName": "John",
    "lastName": "Doe",
    "propertyAddress": "123 Main St",
    "city": "Phoenix",
    "state": "AZ",
    "zipCode": "85001",
    "propertyType": "single_family",
    "leadSource": "manual"
  }
- Response: { "success": true, "data": { "id": "...", "assignedTo": { "id": "...", "email": "..." } } }

GET /api/leads/stats
- Description: Lead statistics (distribution and averages).
- Query: ?timeframe=30d
- Response:
  {
    "success": true,
    "data": {
      "totalLeads": 120,
      "newLeads": 25,
      "statusDistribution": [{ "status":"new", "_count":10 }],
      "sourceDistribution": [{ "source":"zillow_fsbo", "_count":7 }],
      "priorityDistribution": [{ "priority":"high", "_count":3 }],
      "averageAIScore": 72.3,
      "averageMotivationScore": 65.1
    }
  }

GET /api/leads/:id
- Description: Lead details with last logs.
- Response: { "success": true, "data": { "id": "...", "leadNotes":[...], "callLogs":[...], "skipTraceRecords":[...], "campaignLogs":[...] } }

PATCH /api/leads/:id
- Description: Update lead fields.
- Body: Partial fields validated by zod.

DELETE /api/leads/:id
- Description: Soft delete lead (isActive = false). Roles: admin, manager.

POST /api/leads/:id/skip-trace
- Description: Run skip trace with provider fallback; returns phones/emails and persists SkipTraceRecord.
- Response:
  { "success": true, "data": { "success": true, "data": { "phones": [{ "number": "555-..." }], "emails": [{ "address":"..." }] } } }

POST /api/leads/:id/notes
- Description: Add note to a lead.
- Body: { "content": "Left voicemail", "type": "call" }

GET /api/leads/:id/call-script
- Description: AI-generated call script for the lead.
- Response: { "success": true, "data": { "script": "Hi John..." } }

---

## Zip Search & Analytics (backend/src/routes/zipSearch.ts) [auth status not enforced in file; secure in server mounts if needed]

POST /api/zip-search/search-zip
- Body: { "zipCode": "85001" }
- Response: { "success": true, "zipCode": "85001", "leadCount": 12, "leads": [...] }

POST /api/zip-search/search-multiple-zips
- Body: { "zipCodes": ["85001","85002"] }

POST /api/zip-search/search-target-area
- Description: Returns all leads (Phoenix Metro area concept).

GET /api/zip-search/zip-stats
- Description: Aggregations per zip (avg value, scores, callable leads).
- Response:
  { "success": true, "stats": [ { "zipCode": "85001", "city":"Phoenix", "leadCount": 43, "avgValue": 312000 } ] }

GET /api/zip-search/lead/:id
- Description: Lead details by ID.

PATCH /api/zip-search/lead/:id/status
- Body: { "status": "contacted", "notes": "Spoke to owner" }

GET /api/zip-search/revenue-analytics
- Description: Revenue potential analytics.

GET /api/zip-search/lead/:id/contact-script
- Description: Basic script generation using heuristics.

---

## Real Estate APIs (backend/src/routes/realEstateRoutes.ts) [auth required]

POST /api/real-estate/search-real-zip
- Description: Search one zip using premium APIs with enrichment.
- Body:
  {
    "zipCode": "85001",
    "filters": {
      "minValue": 150000,
      "maxValue": 1000000,
      "minEquityPercent": 25,
      "requireDistressSignals": false,
      "includeForeclosures": true,
      "includeProbate": true,
      "includeTaxDelinquent": true,
      "includeVacant": true,
      "includeAbsenteeOwners": true,
      "limit": 50
    }
  }
- Response:
  {
    "success": true,
    "zipCode": "85001",
    "leadCount": 37,
    "leads": [
      {
        "id": "12345678",
        "propertyAddress": "123 Main St, Phoenix, AZ 85001",
        "ownerName": "Jane Smith",
        "ownerPhone": "555-123-4567",
        "ownerEmail": null,
        "marketValue": 425000,
        "aiScore": 82,
        "motivationScore": 75,
        "status": "new",
        "tags": ["high_equity","absentee_owner"]
      }
    ],
    "metadata": { "totalCost": 2.55, "dataSourcesUsed": ["attom","zillow","skip_trace"] },
    "aggregations": { "byPropertyType": { "single_family": 25 } },
    "message": "Found 37 REAL properties in zip code 85001 using premium APIs"
  }

POST /api/real-estate/search-real-multiple-zips
- Body: { "zipCodes": ["85001","85002","85003"], "filters": { ... } }

POST /api/real-estate/search-real-target-area
- Description: Phoenix Metro predefined zip set; filters focused on motivated sellers.

GET /api/real-estate/api-usage-stats
- Response:
  {
    "success": true,
    "stats": {
      "totalCosts": 12.7,
      "requestCount": 45,
      "costBreakdown": {
        "zillow": "Charged per property lookup",
        "attomData": "Property details and ownership",
        "batchSkipTracing": "Phone/email discovery"
      },
      "recommendations": [ "Use filters to reduce API calls", "Focus on high-equity properties" ]
    }
  }

POST /api/real-estate/reset-counters
- Description: Reset internal cost counters.

---

## Master Real Estate APIs (backend/src/routes/masterRealEstateRoutes.ts) [auth required]

POST /api/master/ultimate-search
- Description: Comprehensive, multi-source master search.
- Body (sample minimal):
  {
    "zipCodes": ["85001","85002"],
    "minValue": 100000,
    "maxValue": 2000000,
    "minEquityPercent": 20,
    "includeForeclosures": true,
    "includeProbate": true,
    "skipTraceRequired": false,
    "limit": 100,
    "sortBy": "overallScore"
  }
- Response:
  {
    "success": true,
    "searchType": "ultimate_comprehensive",
    "totalResults": 120,
    "properties": [ ... ],
    "searchMetadata": { "totalCost": 5.4, "dataSourcesUsed": ["attom","openAI","skip_trace"] },
    "costBreakdown": { "attomData": 0.50, "openAI": 0.02, "...": 0.25 }
  }

POST /api/master/probate-leads
- Description: Probate-focused high-equity and motivated sellers.

POST /api/master/foreclosure-leads
- Description: Distress-focused (foreclosure/tax delinquency/code violations).

POST /api/master/high-equity-leads
- Description: High equity + absentee/vacant filters.

GET /api/master/master-usage-stats
- Description: Master service costs and data sources overview.

POST /api/master/reset-master-counters
- Description: Reset master counters.

---

## Skip Trace (backend/src/routes/skipTrace.ts) [auth required]
- Index route present; full provider orchestration is via Leads controller and services/skipTraceService.ts.
- Known endpoints (from mounts and search):
  - GET /api/skip-trace/
  - Future: provider-specific routes (TBD).

Example Response (root index):
{ "success": true, "message": "Skip Trace API" }

---

## Scraper (backend/src/routes/scraper.ts) [auth required, admin/manager for mutating]

POST /api/scraper/zillow
- Description: Run Zillow FSBO scraper by zip(s).
- Roles: admin, manager.

GET /api/scraper/jobs
- Description: List scraping jobs.

GET /api/scraper/jobs/:id
- Description: Job detail.

POST /api/scraper/process-records
- Description: Transform persisted PropertyRecord rows into Leads.
- Roles: admin, manager.

GET /api/scraper/property-records
- Description: Retrieve PropertyRecord entries.

---

## Campaigns (backend/src/routes/campaigns.ts) [auth required]
- Placeholder endpoints.
- GET /api/campaigns/
  { "success": true, "message": "Campaigns API" }

## Calls (backend/src/routes/calls.ts) [auth required]
- Placeholder endpoints.
- GET /api/calls/
  { "success": true, "message": "Calls API" }

## Organizations (backend/src/routes/organizations.ts) [auth required]
- Placeholder endpoints.
- GET /api/organizations/
  { "success": true, "message": "Organizations API" }

## Analytics (backend/src/routes/analytics.ts) [auth required]
- Placeholder endpoints.
- GET /api/analytics/
  { "success": true, "message": "Analytics API" }

---

## Legacy/Mock Routes (backend/src/routes/masterRoutes.ts, masterRoutes_new.ts, leadflowApi.ts, probateRoutes.ts)
- mock/system status & cost-estimate under /api/master or /api paths.
- mock ultimate/probate/foreclosure/high-equity searches (for demo).
- probateRoutes.ts exposes specialized probate endpoints (requires auth) such as:
  - POST /probate/comprehensive-search
  - POST /probate/quick-search
  - POST /probate/analyze-property
  - POST /probate/find-contacts
  - GET /probate/market-analysis/:zipCode
  - GET /probate/system-status

These are intended for demo/testing and may not be wired in production server mounts. Validate availability via GET /api/system/status and code mounts.

---

## Curl Examples

Login and call leads
- Get token:
  curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"ada@example.com","password":"StrongPassw0rd!"}'
- List leads:
  curl -s http://localhost:3001/api/leads?page=1&amp;limit=20 -H "Authorization: Bearer <JWT>"

Search real zip
  curl -s -X POST http://localhost:3001/api/real-estate/search-real-zip \
    -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
    -d '{"zipCode":"85001","filters":{"minEquityPercent":25,"includeProbate":true}}'

Run skip trace
  curl -s -X POST http://localhost:3001/api/leads/<LEAD_ID>/skip-trace -H "Authorization: Bearer <JWT>"

---

Change Log
- This API reference is generated from code in backend/src/server.ts and backend/src/routes/*.ts at audit time.

---

## New in Sprint 7 (LeadFlow AI): Call Ingestion & Analysis (src/routes/callRoutes.ts)

Public server mounts under /api/calls:
- POST /api/calls/start { callSid, leadId?, userId?, audioUrl? }
- POST /api/calls/complete { callSid, audioUrl? }
- POST /api/calls/transcript { callSid, transcript, leadId?, userId?, audioUrl? }
- POST /api/calls/analyze { callSid }

Behavior
- Stores CallTranscript rows on start/transcript.
- Analyzes transcript to produce summary/score/tags and persists CallAnalysis.
- Creates CrmActivity type "call.summary" with metadata { callSid, summary, score, tags }.
- Emits crm.activity webhook to active subscriptions.

Metrics (via GET /api/dev/metrics)
- leadflow_call_started_total
- leadflow_call_completed_total
- leadflow_call_summary_total{status="success|fail"}
- leadflow_call_transcription_ms_* histogram
- leadflow_call_scoring_ms_* histogram
