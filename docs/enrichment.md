# Enrichment Pipeline

## Overview
Processes `ScrapedProperty` records to add:
- `enrichmentTags: string[]`
- `investmentScore: Int (0–100 mock)`
- `condition: PropertyCondition (Fair|NeedsWork mock)`

Queue: `enrichment` (BullMQ)
Worker: `enrichmentWorker` (concurrency 5)

## Idempotency
Skips records already enriched (non-empty tags OR non-null score).

## Manual Bulk Enqueue
Script: `src/scripts/enqueueUnenriched.ts`
```
ts-node src/scripts/enqueueUnenriched.ts
```

## Metrics
- `leadflow_enrichment_processed_total`
- `leadflow_enrichment_duration_ms_bucket` / `_sum` / `_count`
- `leadflow_properties_enriched_gauge`

## Logs
Structured JSON example:
```
{"component":"enrichment","status":"processed","propertyId":"...","tags":["fixer"],"investmentScore":72,"condition":"Fair","durationMs":18}
```
