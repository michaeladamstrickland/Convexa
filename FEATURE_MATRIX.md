# Convexa — Feature Matrix

Timestamp (ET): 2025-08-16 12:00 ET

Legend
- Backend/Frontend: brief status
- Tests: unit/integration/e2e status
- Completion % rubric:
  - 0%: no code
  - 25%: scaffolding + stubs
  - 50%: works locally; missing validation/edge cases/tests
  - 75%: E2E happy path + validation + basic tests
  - 100%: production-ready (docs, edge cases, alerts, rollback)

| Feature                    | Backend                                                                 | Frontend                                               | Tests             | Completion % | Notes                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ----------------- | -----------: | -------------------------------------------------------------------------------------------------------------------- |
| Ingestion (APIs)           | RealPropertyDataService + Master service wiring; ATTOM/DataTree/Zillow  | UI flows started (MasterLeadGeneration, Zip search)    | Integration only  |          55 | Keys/env missing; add caching, timeouts/retries, cost guardrails                                                     |
| Ingestion (Scrapers)       | Puppeteer Zillow FSBO + PropertyRecord persistence + dedupe hash       | Trigger not exposed                                    | none              |          50 | Add proxy/stealth, job scheduler, persistence of raw HTML samples                                                    |
| Deduplication              | Hash + unique constraints (PropertyRecord)                              | n/a                                                    | none              |          50 | Unify dedupe across ingestion pipelines                                                                              |
| Address validation         | addressValidationService (Google Geocode)                               | No forms using it                                      | none              |          35 | Integrate into createLead & enrichment                                                                               |
| Enrichment (skip-trace)    | skipTraceService (Batch/Whitepages/public) + SkipTraceRecord           | Not surfaced                                           | none              |          50 | Add DNC cache and UI to view history                                                                                 |
| Owner match                | Present in enrichment types; basic mapping                              | n/a                                                    | none              |          40 | Formalize normalization + confidence                                                                                 |
| Lead scoring (AI)          | aiService/aiAnalysisService (OpenAI) + async updates on create         | Display not verified                                   | none              |          60 | Add caching, model/version config, tests                                                                             |
| Lead views/filters         | Leads CRUD + search, stats endpoints                                    | Leads page exists; basic table/filters                 | none              |          45 | Persisted auth needed; enrich filters + server pagination                                                            |
| Campaigns (SMS/voice/mail) | Routes stubs; Campaign/CampaignLog schema                               | No flows                                               | none              |          25 | Implement Twilio SMS MVP with opt-out + throttling                                                                   |
| DNC/TCPA guardrails        | Not implemented                                                         | n/a                                                    | none              |          10 | DNC cache per phone, consent storage, quiet hours, audit                                                             |
| CRM tasks/timeline         | LeadNotes, CallLog, CampaignLog models; routes partial                  | Timeline UI not verified                               | none              |          40 | Add event log unification + UI                                                                                        |
| User/org auth              | JWT auth, roles, restrictTo, org scoping in queries                     | Login page; no persisted session                       | partial (backend) |          65 | Add refresh tokens, rotation, revoke on logout                                                                       |
| Billing limits             | masterConfig tier limits + costPerCall                                  | n/a                                                    | none              |          40 | Enforce via middleware + daily budget enforcement                                                                    |
| File uploads               | Multer installed                                                        | No UI                                                  | none              |          10 | Add S3 or local storage adapter + validation                                                                         |
| Flip Tracker               | Mentioned in docs; no concrete endpoints                                | n/a                                                    | none              |          10 | Define MVP: budget, tasks, docs, P/L, photo log                                                                      |
| Analytics dashboards       | Zip stats, revenue analytics endpoints                                  | Analytics pages exist                                  | none              |          35 | Back with real metrics and timeseries                                                                                |
| Admin ops                  | Reset counters, health/system status                                    | n/a                                                    | none              |          30 | Add backfills/replay jobs, key rotation admin                                                                        |

Additional Notes
- Multi-tenancy: org-level scoping present in key queries; verify coverage across all routes.
- Environments: No .env.example; add typed config validation.
- Dual Prisma contexts: backend Postgres vs root SQLite; unify to backend.
