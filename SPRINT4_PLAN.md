# Sprint 4: Enrichment & Delivery Infrastructure

(Imported from user spec; acting as living implementation guide.)

## Deliverables
- [x] 4.1 Webhook Replay (endpoints + test + metrics) ✅
- [x] 4.2 Enrichment Pipeline MVP (schema, queue/worker, mock enrichment, metrics, test) ✅
- [x] 4.3 CRM Export Endpoint (JSON + CSV, filters, test) ✅
- [x] 4.4 Matchmaking Job Scaffolding (model, queue/worker, endpoint, test) ✅
- [ ] 4.5 Observability Upgrades (metrics keys, histogram, docs, test) (in-progress)

## Data Model Changes
Added to `ScrapedProperty`:
- enrichmentTags String[] @default([])
- investmentScore Int?
- condition PropertyCondition?

New enums:
- PropertyCondition { Excellent Fair NeedsWork }

New model:
- MatchmakingJob(id, filterJSON, status, createdAt, completedAt, matchedCount)

## Queues (planned)
- enrichment (BullMQ) -> enrichmentWorker
- matchmaking (BullMQ) -> matchmakingWorker

## Tests (planned)
| Test | Focus |
| ---- | ----- |
| webhook-replay.test.ts | Replay endpoints resolve failure |
| enrichment.test.ts | Enrich property & assert fields |
| export-leads.test.ts | CSV + JSON export w/ filters |
| matchmaking.test.ts | Enqueue & mock match logging |
| metrics.test.ts | Presence of new metrics |

## Metrics (implemented)
- leadflow_webhook_replay_total{status}
- leadflow_webhook_deliveries_total{status,eventType}
- leadflow_webhook_delivery_duration_ms_* histogram
- leadflow_enrichment_processed_total
- leadflow_enrichment_duration_ms_* histogram
- leadflow_properties_enriched_gauge
- leadflow_export_total{format}
- leadflow_export_duration_ms_* histogram
- leadflow_matchmaking_jobs_total{status}
- leadflow_matchmaking_duration_ms_* histogram

## Open Questions
- Should enrichment rerun be idempotent or append tags? (Assume overwrite.)
- CSV export size limits? (Assume pagination enforcement.)
- Replay endpoints separate from retry? (Yes: replay = explicit manual trigger.)

## Implementation Order
1. Migrations (schema push) & model client regen.
2. Replay endpoints (reuse existing queue logic).
3. Enrichment queue + worker + auto-enqueue stub.
4. Export endpoint.
5. Matchmaking scaffolding.
6. Metrics wiring.
7. Tests & docs.

## Done Definition Recap
All endpoints + workers operational, tests green, metrics exposed, no open handles, docs updated. Sprint 4.5 finalizes documentation & E2E flow test.
