# Matchmaking Jobs

## Purpose
Mock job that counts enriched properties meeting a score & optional source filter. Foundation for future buyer/property matching.

## Model Fields
- `filterJSON` (stored filters)
- `status` (queued|running|completed|failed)
- `matchedCount`
- `completedAt`

## Create Job
`POST /api/admin/matchmaking-jobs`
```
{ "filterJSON": { "minScore": 70, "source": "zillow" } }
=> { "success": true, "jobId": "..." }
```

Poll DB (future: add status endpoint) until `status=completed`.

## Metrics
- `leadflow_matchmaking_jobs_total{status}`
- `leadflow_matchmaking_duration_ms_*`

## Logs
```
{"component":"matchmaking","status":"completed","matchmakingJobId":"...","matchedCount":42,"durationMs":15}
```
