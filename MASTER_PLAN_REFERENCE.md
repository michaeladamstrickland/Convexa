# Master Implementation Brief — LeadFlow Data Platform (Enterprise, ML-Ready)

(This file was generated from the provided specification. It is a stable reference used for architectural alignment and audit-driven execution planning.)

## Mission
Integrate Zillow, Auction.com, County Records scrapers, and ATTOM enrichment into a single, production-grade pipeline that outputs de-duplicated, enriched, and ranked deals with transparent reasons. The design must be idempotent, compliant, observable, and ready for machine learning (feature store + labels + retraining hooks).

## Guardrails (Non-negotiable)
- Production quality: typed (TypeScript), documented, tests, linters, CI/CD, canary deploys, rollbacks.
- Idempotency & dedupe everywhere (address normalization + content hashes).
- Data lineage + full audit trail (raw → normalized → fused; source, timestamp, reliability).
- Observability: metrics, logs with correlation IDs, traces; red/black dashboards.
- Compliance: domain TOS registry, robots handling, per-domain rate limits, proxy governance, PII handling.
- ML-readiness: feature store schemas, label capture, SHAP-friendly features, offline/online parity.

## Target Tech Stack
| Layer | Target |
|-------|--------|
| Language | Node.js 20+ + TypeScript (strict) |
| HTTP | Fastify or Express + zod validation |
| Headless | Playwright (primary), Cheerio for HTML parsing |
| Storage | PostgreSQL 15+ (canonical + JSONB raw), S3/MinIO (artifacts), Redis (BullMQ queues) |
| Search/Analytics | (Optional) OpenSearch |
| Infra | Docker + docker-compose, Terraform (if cloud), GitHub Actions CI |
| Secrets | Doppler/Vault/GCP Secret Manager |
| Telemetry | OpenTelemetry → Grafana/Tempo/Prometheus/Loki (or Datadog) |
| Feature Store (Phase 2) | Postgres (online) + Parquet in S3 (offline) |

## Repository Layout (Target Monorepo Design)
```
/leadflow
  /apps
    /ingest-api
    /orchestrator
    /ml-gateway
  /packages
    /scrapers
    /attom
    /fusion
    /normalize
    /scoring
    /compliance
    /observability
    /persistence
    /queues
    /schemas
    /utils
  /infra
    /docker
    /terraform
    /grafana
  /docs
    ARCHITECTURE.md
    DATA_MODEL.md
    PLAYBOOKS.md
    COMPLIANCE.md
```

## Canonical Data Model (PostgreSQL)
### Table: `properties`
- id (uuid pk)
- address (JSONB: line1, city, state, zip, county_fips, lat, lng)
- address_hash (sha256 normalized, unique)
- ids (jsonb: apn, attomId, zpid?, auctionId?)
- owner (jsonb: name, name_norm, mailing_address_norm, absentee_flag)
- attributes (jsonb: beds, baths, sqft, lot, year_built, type)
- financials (jsonb: avm, avm_conf, tax_assessed, tax_year, est_rent)
- events (jsonb: last_sale, listings[], filings[], auctions[])
- distress_signals (jsonb[])
- contacts (jsonb[])
- sources (jsonb[]: {key, url?, captured_at, reliability})
- conflicts (jsonb)
- lead_score (int), temperature (text)
- created_at, updated_at

### Table: `_ingest_items`
- id (uuid)
- address_hash (text index)
- source_key (text)
- source_url (text)
- captured_at (timestamptz)
- payload (jsonb)
- raw_ref (text)
- hash (sha256 content)
- status (accepted|rejected|superseded)
- rejections (jsonb[])

### Table: `scrape_runs`
- id, source_key, params (jsonb), started_at, finished_at, status, error?

### Table: `labels`
- property_id, label_date, label_type, price_below_arv_pct, channel, notes

### Table: `features_online`
- property_id (pk), feature_json (jsonb), updated_at

## Contracts (`/packages/schemas`)
```
export interface ScrapedProperty {
  sourceKey: "zillow" | "auction-com" | `county-${string}`;
  sourceUrl?: string;
  capturedAt: string; // ISO
  address: { line1: string; city?: string; state?: string; zip?: string };
  parcelId?: string;
  apn?: string;
  ownerName?: string;
  attributes?: Record<string, string|number|boolean|null>;
  priceHint?: number;
  lastEventDate?: string;
  distressSignals: ("FSBO"|"AUCTION"|"PRE_FORECLOSURE"|"CODE_VIOLATION"|"TAX_DELINQUENT"|"PROBATE"|"EVICTION")[];
  contacts?: { type: "phone"|"email"; value: string; confidence?: number; source?: string }[];
  attachments?: { kind: "img"|"pdf"|"html"; s3Key?: string; sha256?: string }[];
}
export interface ScrapeResult { ok: boolean; errors?: string[]; items: ScrapedProperty[]; }
```

## End-to-End Flow (Target)
1. Scrapers → produce `ScrapeResult` batches + store raw artifacts (S3) + enqueue `INGEST_BATCH` (BullMQ)
2. Ingest Worker → normalize address, ensure idempotency, persist to `ingest_items`, enqueue `FUSE_PROPERTY`
3. Fusion Worker → gather source items + ATTOM enrichment, resolve fields by reliability, update `properties`, enqueue `SCORE_PROPERTY`
4. Scoring Worker → compute heuristic features & reasons, update `properties` + `features_online`, emit event
5. API (`/apps/ingest-api`) → browse, reprocess, batch intake
6. Orchestrator → schedules scrapes, manages retries / proxy pool / backoff

## ATTOM Enrichment Requirements
- Circuit breaker + caching
- Reliability priority > other sources
- Raw response persistence (JSONB or side cache table)

## County Records Pipeline
- OCR (Tesseract / fallback Vision API)
- NLP extraction (regex + lightweight LLM prompt)
- Distress signal derivation
- Confidence scoring & snippet retention

## Heuristic Scoring (Phase 1)
- Distress (≤40), Equity (≤20), Time Pressure (≤12), Owner Profile (≤10), Condition (≤8), Liquidity (≤10)
- Output: score 0–100 + temperature + reasons[] (explainability baseline)

## Phase 2 (ML Readiness)
- Feature parity offline/online
- Label ingestion path
- Training pipeline (XGBoost/LightGBM) + SHAP
- A/B flag-based rollout

## Compliance
- `tos_registry.json`
- robots.txt caching & enforcement
- Per-domain rate limit + proxy assignment
- Audit logs for each fetch
- Global kill switch

## Observability & SLOs
- Metrics: scrape_runs_total, ingest_items_total, fusion_conflicts_total, properties_scored_total, lead_score histogram, attom_enrichment_total
- Tracing: scraper→ingest→fusion→score chain
- SLO: 95% batch latency < 5m

## Security
- Least privilege DB roles
- Encrypted artifact storage
- RBAC for PII
- Secrets never logged

## Testing Strategy
- Unit (normalizers, parsers, scorer math)
- Contract (zod schema enforcement)
- Integration (queue round-trips)
- Resilience (network, 429s, CAPTCHA)
- Data Quality (golden set)
- Performance (10k batch < 10m)

## CI/CD
- Pipeline: lint → test → build → docker → security scan → push
- Migration gating & dry-run
- Canary rollout + auto rollback

## Milestones
- M1: Backbone + E2E ingestion/fusion/scoring
- M2: County pipeline + refresh operations
- M3: Reliability + operational hardening
- M4: ML scaffolding and feature parity

## Definition of Done (Global)
- Idempotent ingestion (address_hash stable)
- Field lineage & conflict visibility
- Reason codes for score
- Fast scraper integration (<1 day)
- ML swap is a configuration change

## Inputs Needed / External Dependencies
- ATTOM credentials & limits
- Proxy provider credentials
- County sample documents
- CRM outcome schema for labels

---
**Reference End.** This document should not be manually altered without architectural review.
