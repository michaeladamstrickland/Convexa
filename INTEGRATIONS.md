# LeadFlow — External Integrations, Health, and Cost Guardrails

Timestamp (ET): 2025-08-16 12:00 ET

Scope
- Catalog of external APIs, SDKs, and providers referenced in code.
- Current wiring status, environment keys, typical costs, and recommended guardrails (caching, retries, concurrency, budgets).
- Target deploy: DigitalOcean for app/DB + AWS S3 for assets (assumption based on objective).

---

## Summary Table

- Property Data: ATTOM, Estated, PropMix, DataTree, Zillow (RapidAPI), RentSpree, RealtyMole, Regrid (mentioned).
- Listings/MLS: MLS Grid, CoreLogic Trestle, Realtor (RapidAPI), Redfin (scraper/planned).
- Distress/Legal: PropertyRadar, Foreclosure.com, PACER (planned), local county sites.
- Probate/Deceased: US Obituary API, ObitAPI, Tributes API.
- Contact/Skip-trace/Enrichment: Batch Skip Tracing, Whitepages Pro, PeopleDataLabs, Clearbit, FullContact, IDI/LexisNexis (requires contracts).
- AI: OpenAI (chat completions).
- Maps/Geo: Google Maps Geocoding.
- Telephony: Twilio SMS/Voice (libs present).
- Storage: S3 not yet implemented in code (recommended for uploads).
- Observability: Winston/morgan (present), Sentry/metrics (recommended).

---

## Detailed Integrations

### ATTOM Data
- Code: backend/src/services/attomDataService.ts, backend/src/services/masterRealEstateService.ts, backend/src/routes/realEstateRoutes.ts, backend/src/routes/masterRealEstateRoutes.ts
- Env: ATTOM_API_KEY or ATTOM_DATA_API_KEY; base URL varies (api.gateway.attomdata.com/...).
- Usage: Property details and ownership; costPerRequest ~ $0.25–$0.50.
- Risks: Key exhaustion, costs on broad queries.
- Guardrails:
  - Cache by (address) for 7–14 days.
  - Axios timeouts (10s), retries (max 2 with expo backoff).
  - Budget cap via masterConfig dailyBudgetLimit.

### DataTree
- Code: backend/src/services/dataTreeService.ts, masterRealEstateService.ts config, realEstateRoutes.ts
- Env: DATA_TREE_API_KEY; base URL: https://api.datatree.com/api
- Usage: Probate cases, ownership history; contractual access.
- Guardrails: Use only with targeted filters; throttle; cache results; track per-request costs.

### Zillow (RapidAPI)
- Code: backend/src/services/realPropertyDataService.ts, realEstateRoutes.ts, masterRealEstateRoutes.ts
- Env: ZILLOW_API_KEY or ZILLOW_RAPIDAPI_KEY; base URL: zillow-com1.p.rapidapi.com
- Usage: Estimates, property data.
- Guardrails: Cache by address; handle RapidAPI rate limits; monitor 429s.

### RentSpree (MLS)
- Code: realPropertyDataService.ts wiring
- Env: RENTSPREE_API_KEY
- Usage: MLS-like listing data.
- Guardrails: Respect rate limits; avoid broad searches.

### RealtyMole
- Code: realPropertyDataService.ts wiring
- Env: REALTY_MOLE_API_KEY
- Usage: Valuations/comps.
- Guardrails: Cache and throttle.

### PropertyRadar, Foreclosure.com
- Code: masterRealEstateRoutes.ts config; realEstateRoutes.ts mentions PropertyRadar
- Env: PROPERTY_RADAR_API_KEY, FORECLOSURE_COM_API_KEY
- Usage: Distress signals (foreclosure notices).
- Guardrails: Deduplicate by propertyHash; persist minimal fields if costs are high.

### Skip Tracing (Batch, Whitepages)
- Code: backend/src/services/skipTraceService.ts
- Env: BATCH_SKIP_TRACING_API_KEY, WHITEPAGES_PRO_API_KEY
- Usage: Phones/emails; Whitepages person search.
- Guardrails:
  - Idempotent lookups (per lead, 30-day reuse).
  - Persist SkipTraceRecord; return cached results if recent.

### PeopleDataLabs / Clearbit / FullContact (Enrichment)
- Code: probateService.ts, masterRealEstateRoutes.ts configs
- Env: PEOPLE_DATA_LABS_API_KEY, CLEARBIT_API_KEY, FULLCONTACT_API_KEY
- Usage: Contact enrichment; confirm licensing.
- Guardrails: Use only on qualified leads; cache results.

### OpenAI (Chat Completions)
- Code: backend/src/services/aiService.ts, aiAnalysisService.ts, tests, masterRealEstateService.ts
- Env: OPENAI_API_KEY, OPENAI_BASE_URL (optional)
- Usage: Lead scoring, call scripts, analysis.
- Guardrails:
  - Model pin (e.g., gpt-4o-mini for cost); token limits; retries; caching of outputs by (prompt hash).
  - Cost counters in metadata.

### Google Maps (Geocoding)
- Code: backend/src/services/addressValidationService.ts, masterRealEstateService.ts config
- Env: GOOGLE_MAPS_API_KEY
- Usage: Address validation; geocode normalization.
- Guardrails: Cache validated addresses; respect quotas.

### Twilio (SMS/Voice)
- Code: Packages include twilio; routes/campaigns.ts are placeholders
- Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID (recommended)
- Usage: Campaign messaging and call logs integration.
- Guardrails:
  - DNC/TCPA enforcement; opt-out (STOP); per-org throttles; error backoff.

### Puppeteer (Zillow Scraper)
- Code: backend/src/scrapers/zillowScraper.ts
- Env: PUPPETEER_HEADLESS (true/false)
- Usage: FSBO scraping and PropertyRecord ingestion.
- Guardrails:
  - puppeteer-extra-plugin-stealth; proxy rotation; randomized delays; budget checks; robots/ToS awareness.

---

## Cost Guardrails (Cross-Cutting)

- Daily Budget: masterConfig.getDailyBudgetLimit() — enforce denylist of expensive calls when >80% budget (alert threshold) and block at 100%.
- Caching:
  - Zip search: cache (zip, filters fingerprint, yyyy-mm-dd) → results with totalCost and dataSourcesUsed.
  - Address validation: cache by normalized address for 30 days.
  - Skip trace: reuse within 30 days per lead.
  - AI outputs: cache on prompt hash (lead attributes subset) for 7 days.
- Concurrency:
  - Limit concurrent external calls per org to prevent bursts (e.g., 5–10).
- Retries/Timeouts:
  - Axios defaults: timeout 10s, maxRetries 2, backoff 250ms→1s; do not retry on 4xx (except 429 with Retry-After).
- Idempotency:
  - Require Idempotency-Key for POST /api/leads and POST skip-trace to prevent duplicates during retries.
- Fallbacks:
  - If ATTOM fails → Estated/PropMix fallback (when enabled).
  - If Batch Skip Tracing fails → Whitepages/public records fallback.
- Spend Tracking:
  - Track cost per provider and per request; return in response metadata where relevant; expose /api-usage-stats endpoints (present for real-estate and master).

---

## Environment Variables Inventory (Non-exhaustive)

- Core: DATABASE_URL, JWT_SECRET, LEADFLOW_TIER, DAILY_BUDGET_LIMIT, CORS_ORIGIN
- Property Data: ATTOM_API_KEY or ATTOM_DATA_API_KEY, ATTOM_BASE_URL, DATA_TREE_API_KEY, ZILLOW_RAPIDAPI_KEY, RENTSPREE_API_KEY, REALTY_MOLE_API_KEY, PROPERTY_RADAR_API_KEY
- Probate/Legal: US_OBITUARY_API_KEY, PDL_API_KEY, LEGACY_TREE_API_KEY, TRUE_PEOPLE_SEARCH_API_KEY
- AI/Geo: OPENAI_API_KEY, OPENAI_BASE_URL (optional), GOOGLE_MAPS_API_KEY
- Telephony: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID
- Skip Trace: BATCH_SKIP_TRACING_API_KEY, WHITEPAGES_PRO_API_KEY
- Scraping: PUPPETEER_HEADLESS
- Observability: SENTRY_DSN (recommended), LOG_LEVEL

Add these to .env.example and document in README.

---

## Provider Health Notes

- ATTOM/DataTree: contract support required; sandbox keys vs production must be separated per env.
- RapidAPI (Zillow/Realtor): rate limits fluctuate; prefer first-party when contracts exist.
- Twilio: ensure A2P 10DLC registration and campaign approval for SMS throughput; set Messaging Service SID.
- Whitepages/IDI/LexisNexis: strict compliance and auditability; minimize PII exposure and store minimal necessary data.
- OpenAI: prefer server-to-server (do not expose key to frontend); set low-cost model for summaries; add safety around prompt lengths to control cost.

---

## Open Items

- Select one enrichment provider path for MVP (Batch + PDL) and add DNC provider.
- Decide on cache backing store (in-memory LRU + Redis in production).
- Add central cost/budget middleware and wire feature flags (disable real search when budget exceeded).
