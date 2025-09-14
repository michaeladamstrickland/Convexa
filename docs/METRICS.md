# LeadFlow Metrics Reference

Canonical source: `/api/dev/metrics` (Prometheus exposition format)

## Conventions
- Counters: monotonically increasing (suffix `_total`)
- Histograms: `_bucket`, `_sum`, `_count`
- Gauges: current snapshot values
- Durations measured in milliseconds

---
## Scraper Jobs
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_jobs_total` | counter | `source`, `status` | Total scraper jobs by source and status (queued/running/completed/failed) |
| `leadflow_jobs_latency_ms_bucket` | histogram | `le` | Job duration distribution buckets (ms) |
| `leadflow_jobs_latency_ms_sum` | histogram sum | – | Sum of all observed job durations |
| `leadflow_jobs_latency_ms_count` | histogram count | – | Count of observed job durations |
| `leadflow_retries_total` | counter | – | Approx count of failed jobs with attempt > 1 (best-effort) |

## Webhooks
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_webhooks_delivered_total` | counter | – | Successfully delivered webhook attempts |
| `leadflow_webhooks_failed_total` | counter | – | Dead-lettered webhook attempts (after max attempts) |
| `leadflow_webhooks_active_subscriptions` | gauge | – | Current active webhook subscriptions |
| `leadflow_webhooks_unresolved_failures` | gauge | – | Unresolved dead-letter failures remaining |
| `leadflow_webhook_replay_total` | counter | `mode` (single|bulk), `status` (success|failed) | Replay attempts outcomes segmented by manual single vs bulk replay |
| `leadflow_webhook_deliveries_total` | counter | `status`, `eventType` | Unified delivery log rows (delivered/failed) |
| `leadflow_webhook_delivery_duration_ms_bucket` | histogram | `le` | Delivery attempt latency distribution (ms) |
| `leadflow_webhook_delivery_duration_ms_sum` | histogram sum | – | Sum of delivery latencies |
| `leadflow_webhook_delivery_duration_ms_count` | histogram count | – | Count of delivery latencies |
| `leadflow_webhook_duration_ms_bucket` | histogram (alias) | `le` | Alias of delivery latency histogram for simplified dashboards |
| `leadflow_webhook_duration_ms_sum` | histogram sum (alias) | – | Sum alias |
| `leadflow_webhook_duration_ms_count` | histogram count (alias) | – | Count alias |

## Enrichment
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_enrichment_processed_total` | counter | – | Number of enrichment jobs that completed (skipped items not counted) |
| `leadflow_enrichment_duration_ms_bucket` | histogram | `le` | Enrichment worker processing duration (ms) |
| `leadflow_enrichment_duration_ms_sum` | histogram sum | – | Sum of enrichment durations |
| `leadflow_enrichment_duration_ms_count` | histogram count | – | Count of enrichment durations |
| `leadflow_properties_enriched_gauge` | gauge | – | Properties having either an investmentScore or non-empty enrichmentTags |

## Export
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_export_total` | counter | `format` (json|csv) | Export endpoint invocations by result format |
| `leadflow_export_duration_ms_bucket` | histogram | `le` | Export endpoint processing duration (ms) |
| `leadflow_export_duration_ms_sum` | histogram sum | – | Sum of export durations |
| `leadflow_export_duration_ms_count` | histogram count | – | Count of export duration samples |

## Matchmaking
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_matchmaking_jobs_total` | counter | `status` (queued|running|completed|failed) | Matchmaking job lifecycle events counted per status transition |
| `leadflow_matchmaking_duration_ms_bucket` | histogram | `le` | Matchmaking job processing duration (ms) |
| `leadflow_matchmaking_duration_ms_sum` | histogram sum | – | Sum of matchmaking durations |
| `leadflow_matchmaking_duration_ms_count` | histogram count | – | Count of matchmaking duration samples |

## Build / Runtime
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `leadflow_build_info` | gauge | `version`, `env`, `commit` | Static build metadata (value always 1) |

---
## Usage Notes
- Histograms use in-memory aggregation; restart resets bucket counts.
- Replay success marks associated failure & delivery log rows resolved without removing history.
- Gauge `leadflow_properties_enriched_gauge` uses a lightweight SQL count; keep under monitoring frequency guidelines.

---
## Example Scrape
```
leadflow_webhook_replay_total{status="success"} 1
leadflow_enrichment_processed_total 3
leadflow_export_total{format="json"} 2
leadflow_matchmaking_jobs_total{status="completed"} 1
```
