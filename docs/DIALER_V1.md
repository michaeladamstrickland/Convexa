# Dialer v1 — Design Doc (2025-09-20)

Scope: Define a minimal dialer slice (doc-first) to enable outbound calls, webhooks, and transcript storage with metrics and compliance guards. No risky refactors or provider lock-in.

## Goals
- One POST to initiate a dial attempt
- Webhooks to ingest recording/transcript events
- Store audio, transcript, summary; attach back to lead
- Metrics + compliance (quiet hours, DNC)

## Endpoints (proposed)

- POST /dial
  - Auth: admin/bearer (tbd)
  - Body (DialRequest):
    - leadId: string
    - toNumber: E164 string
    - fromNumber: E164 string
    - record: boolean (default true)
    - metadata?: Record<string, string>
  - Response (DialResponse):
    - dialId: string
    - status: "queued" | "in_progress" | "failed"
    - provider: "twilio"
    - createdAt: ISO string

- POST /twilio/recording-complete
  - Auth: Twilio signature (X-Twilio-Signature)
  - Body: Twilio RecordingWebhook (form-encoded)
  - Behavior:
    - Validate signature
    - Persist recording URL and metadata
    - Enqueue ASR task

- POST /dial/:dialId/asr-complete
  - Auth: internal
  - Body (AsrComplete): { dialId, transcriptUrl, words, latencyMs }
  - Behavior: persist transcript, compute summary, attach to lead

## DTOs (zod)
- DialRequest, DialResponse, RecordingWebhook (provider-specific wrapper), AsrComplete
- See `src/dto/v1/dialer.ts`

## Storage
- Interface: Storage (putObject/getObject/signUrl)
- Backends: S3 or local filesystem (dev)

## Metrics
- prom-client counters/histograms:
  - dial_attempts_total{provider,status}
  - asr_latency_ms (histogram)
  - webhook_errors_total{type}

## Compliance
- Quiet hours (per TZ)
- DNC check before dialing
- Consent tracking (persist flags on lead; honor)

## Pseudocode

```ts
// POST /dial
validateBody(DialRequest)
const lead = db.leads.find(id)
if (!lead) return 404
if (isQuietHours(now, lead.tz) || isDNC(lead)) return 409
const dialId = uuid()
metrics.dial_attempts_total.inc({ provider: 'twilio', status: 'queued' })
queue.enqueue({ dialId, to, from, record })
return { dialId, status: 'queued', provider: 'twilio', createdAt: nowISO }
```

```ts
// POST /twilio/recording-complete
verifyTwilioSignature(req)
const { CallSid, RecordingUrl, RecordingDuration } = req.body
store.putObject(`recordings/${CallSid}.mp3`, fetch(RecordingUrl))
queue.enqueueAsr({ dialId: CallSid, url: RecordingUrl })
```

```ts
// POST /dial/:dialId/asr-complete
validateBody(AsrComplete)
store.putObject(`transcripts/${dialId}.json`, JSON.stringify({ transcript, words }))
attachToLead(dialId, { transcriptUrl, summary })
metrics.asr_latency.observe(latencyMs)
```

## Implemented subset (current)

- POST /dial
  - Validates DialRequest, ensures lead exists, emits dial_attempts_total{provider="twilio",status="queued"}
  - Writes stub artifact: `artifacts/dialer/<dialId>.json`
  - Returns DialResponse: { dialId, status: "queued", provider: "twilio", createdAt }

- POST /twilio/recording-complete
  - Accepts form-encoded payload, validates fields
  - Verifies X-Twilio-Signature if TWILIO_AUTH_TOKEN present; 401 on failure and increments webhook_errors_total{type="signature"}
  - Writes stub metadata: `artifacts/dialer/recordings/<CallSid>.json`

- POST /dial/:dialId/asr-complete
  - Validates AsrComplete, persists reference: `artifacts/dialer/transcripts/<dialId>.json`
  - Observes asr_latency_seconds histogram (latencyMs/1000)

- Storage
  - Local storage path default: `backend/run_storage` (configurable via LOCAL_STORAGE_PATH)
  - Signed URLs for artifacts use HMAC with ARTIFACT_SIGNING_SECRET and TTL via ARTIFACT_URL_TTL_SECONDS

- Errors
  - Problem+JSON shape: { code, message, field? } on validation and internal errors across new routes

