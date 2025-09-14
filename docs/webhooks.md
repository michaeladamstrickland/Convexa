# LeadFlow Webhooks

## Overview
Outbound webhooks allow external systems to receive near real-time events.

Currently emitted events:
- `job.completed` – A scrape job finished
- `property.new` – A new property record (non-duplicate) was stored
- `matchmaking.completed` – A matchmaking job finished (new)

## Delivery
Requests are HTTP POST with JSON body:
```
{
  "event": "job.completed",
  "data": { ... }
}
```

Headers:
- `Content-Type: application/json`
- `X-Event-Type: <event>`
- `X-Webhook-Id: <bullmq job id>`
- `X-Timestamp: <ms epoch>`
- `X-Signature: sha256=<hex hmac>`

### matchmaking.completed
Trigger: Emitted when a matchmaking job completes.

Payload shape:
```
{
  "event": "matchmaking.completed",
  "data": {
    "jobId": "<uuid>",
    "matchedCount": 3,
    "timestamp": "2025-09-14T12:00:00.000Z"
  }
}
```
Headers example:
- `X-Event-Type: matchmaking.completed`
- `X-Signature: sha256=<hmac>`
- `X-Timestamp: 1726312345678`

## Signature
`signature = HMAC_SHA256(hex, signingSecret, rawBody)`

Node example:
```js
import crypto from 'crypto';
function verify(signatureHeader, body, secret) {
  if(!signatureHeader?.startsWith('sha256=')) return false;
  const received = signatureHeader.slice(7);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(received, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a,b);
}
```

## Replay & Failure Metadata
Terminology: "Replay" = attempt a fresh delivery for a previously dead-lettered failure. (Older docs referenced "retry").

- Configurable `WEBHOOK_MAX_ATTEMPTS` (default 5; test: 3).
- Backoff: exponential production, fixed short in test.
- Dead-letter persistence in `WebhookDeliveryFailure` includes:
  - `attempts` (final attempt count)
  - `finalError` (legacy compatibility)
  - `lastError` (updated each attempt)
  - `lastAttemptAt`
  - `isResolved` (true after successful replay delivery)
  - `replayedAt` (timestamp of successful replay)
  - `replayJobId` (BullMQ job id that produced the successful replay)

Replay flow:
1. Failure recorded after maxAttempts.
2. Admin triggers single or bulk replay.
3. Worker processes a normal delivery job tagged with `failureId`.
4. On success both the failure row and related delivery log rows are updated (`isResolved=true`, `replayedAt`, `replayJobId`).
5. On replay failure nothing is resolved; counters increment failure side.

### Replay + Enrichment Interaction
If enrichment occurs after the original failed delivery (e.g. property fields populated later), you can replay to deliver the richer payload. Enrichment does not automatically trigger webhooks; replay is the manual mechanism to push updated context downstream.

## Admin API
- `GET /api/admin/webhooks` – List subscriptions
- `POST /api/admin/webhooks` – Create subscription `{ targetUrl, eventTypes[] }`
- `PATCH /api/admin/webhooks/:id` – Update
- `DELETE /api/admin/webhooks/:id` – Delete
- `POST /api/admin/webhook-test` – Manually enqueue test event
- `GET /api/admin/webhook-failures` – Filterable list (subscriptionId, eventType, since, limit, offset, includeResolved)
- `POST /api/admin/webhooks/verify` – One-off challenge delivery (does not store subscription)

### Verify Example
```
POST /api/admin/webhooks/verify
{
  "url": "https://webhook.site/xyz",
  "eventType": "job.completed"
}
=> {
  "delivered": true,
  "status": 200,
  "durationMs": 123
}
```
- `POST /api/admin/webhook-failures/:id/replay` – Replay single dead-letter (400 if already resolved)
- `POST /api/admin/webhook-failures/replay-all` – Bulk replay (optional filters)

### Replay Example (Single)
```
POST /api/admin/webhook-failures/{failureId}/replay
=> { "replayed": true, "jobId": "123" }
```
If the downstream is still failing the failure remains unresolved; metrics will show a failed replay increment.

## Metrics (Prometheus style)
Added to `/api/dev/metrics`:
- `leadflow_webhooks_delivered_total`
- `leadflow_webhooks_failed_total`
- `leadflow_webhooks_active_subscriptions`
- `leadflow_webhooks_unresolved_failures`
- Histogram buckets: `leadflow_webhook_delivery_duration_ms_bucket{le="..."}`
- `leadflow_webhook_replay_total{status="success|failed"}`
 - `leadflow_webhook_deliveries_total{status, eventType}`
 - `leadflow_webhook_delivery_total{event="matchmaking.completed"}`

## Operational Guidance
- Monitor failure growth; spike suggests downstream outage.
- Bulk retry only after confirming target stability.
- Rotate `signingSecret` by creating a new subscription, enabling it, then disabling the old one.

## Future Enhancements
- Per-subscription rate limiting
- Jittered backoff strategy
- Replay with time window filters (date range bulk replay)
- Event versioning & schema registry
- Replay safety guardrails (max replays per hour)
