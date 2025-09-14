# Webhook Delivery History Endpoint

The unified delivery history surfaces both successful and failed webhook attempts. This powers dashboards, audit trails, and replay tooling.

## Endpoint
GET /api/admin/webhook-deliveries

## Query Parameters
- subscriptionId: filter by subscription UUID
- eventType: filter by event type
- status: delivered | failed
- isResolved: true | false (only meaningful for failed records)
- createdAfter: ISO timestamp lower bound (exclusive)
- createdBefore: ISO timestamp upper bound (exclusive)
- limit: page size (default 50, max 200)
- offset: pagination offset (default 0)

## Response Shape
{
  "data": [
    {
      "id": "uuid",
      "subscriptionId": "uuid",
      "eventType": "job.completed",
      "status": "delivered" | "failed",
      "attemptsMade": 1,
      "jobId": "BullMQ job id",
      "lastAttemptAt": "2025-09-12T18:01:22.123Z",
      "isResolved": false,
      "lastError": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "total": 123, "limit": 50, "offset": 0 }
}

## Semantics
- A successful initial delivery creates a single `delivered` row.
- A terminal failure creates a `failed` row (and a separate dead-letter entry in `/webhook-failures`).
- When a failed delivery is successfully retried via `/webhook-failures/:id/retry`, both the failure record and corresponding delivery log rows are marked `isResolved = true`.
- `lastError` holds the most recent error message for failed rows; null for delivered.

## Metrics
Prometheus now exposes: `leadflow_webhook_deliveries_total{status,eventType}` for cardinality-safe dashboards. Combine with existing unresolved failure gauge to track backlog health.

## Usage Examples
1. List last 100 failures still unresolved:
   /api/admin/webhook-deliveries?status=failed&isResolved=false&limit=100
2. Count total deliveries for an event type in timeframe:
   /api/admin/webhook-deliveries?eventType=job.completed&createdAfter=2025-09-12T00:00:00.000Z&limit=1 (check meta.total)
3. Paginate through success + failure mixed timeline:
   /api/admin/webhook-deliveries?limit=50&offset=0 (then increment offset)

## Notes / Future
- Replay endpoint will accept a delivery log id and enqueue a new attempt while linking lineage.
- Consider adding `correlationId` if multi-event workflows emerge.
- Indexes exist on (subscriptionId, eventType, status, createdAt) to keep filtered pagination efficient.
