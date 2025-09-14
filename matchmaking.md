# Matchmaking: Auto Triggers and Admin Tools

Auto Trigger:
- On enrichment completion, if investmentScore >= 85 or tags include highIntent|urgentSeller, create matchmaking job with filterJSON { propertyId, source: 'auto' } and enqueue.
- Property flagged with data.autoMatchTriggered=true (best-effort)

Admin Endpoints:
- POST /api/admin/matchmaking-jobs { filterJSON }
- GET /api/admin/matchmaking-jobs?status&propertyId&source&createdAt[from]&createdAt[to]
- POST /api/admin/matchmaking-jobs/:id/replay

Worker behavior:
- If filterJSON.propertyId present, match against that single property; otherwise use minScore/source filters.

Metrics:
- leadflow_matchmaking_jobs_total{status}
- leadflow_matchmaking_jobs_triggered_total{source}
- leadflow_matchmaking_auto_trigger_total
- leadflow_matchmaking_replay_total
