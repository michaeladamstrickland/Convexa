# CRM Activity API

Endpoints:

- POST /api/admin/crm-activity
  - Body: { type: string, propertyId?: string, leadId?: string, userId?: string, metadata?: object, emitWebhook?: boolean }
  - Emits webhook to subscribers of event type `crm.activity` when emitWebhook=true.

- GET /api/admin/crm-activity
  - Query: type, propertyId, leadId, userId, createdAt[from], createdAt[to], limit, cursor, order
  - Returns paginated activities sorted by createdAt (desc by default).

Metrics:

- leadflow_crm_activity_total
- leadflow_crm_activity_webhook_total{status="success|fail"}

Notes:
- Activities are stored in `crm_activities` with metadata JSON to flexibly capture context.
- Webhook payload schema: { id, type, propertyId, leadId, userId, metadata, createdAt }.

---

## call.summary activity

Producer
- Created by POST /api/calls/analyze (see src/routes/callRoutes.ts) after LLM analysis of a transcript.

Metadata shape
```
{
  "callSid": string,
  "summary": string,
  "score": number,
  "tags": string[],
  "transcriptUrl"?: string | null,
  "recordingUrl"?: string | null
}
```

Idempotency
- Only one call.summary activity is emitted per callSid by default; pass { force: true } in the analyze body to emit again.