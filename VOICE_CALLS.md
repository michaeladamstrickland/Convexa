Voice Calls: Ingestion, Analysis, and Webhooks

Overview
- Endpoints under /api/calls handle call lifecycle, transcripts, LLM analysis, and vendor webhooks.
- CRM activities:
  - call.summary: Final summary after analysis (idempotent per callSid unless force=true).
  - call.live.transcript: Live transcript snippets (utterance batches or DTMF).
  - call.live.summary: Live summary when a vendor marks transcript completed.

Endpoints
- POST /api/calls/start
  - Body: { callSid, leadId?, userId?, audioUrl? }
- POST /api/calls/complete
  - Body: { callSid, audioUrl? }
- POST /api/calls/transcript
  - Body: { callSid, transcript } or AssemblyAI-like: { utterances: [{speaker?, text}], audio_url?, transcript_url? }
- POST /api/calls/analyze
  - Body: { callSid, force? }
  - Creates/publishes crm.activity type call.summary; idempotent unless force.

Vendor Webhooks
- POST /api/calls/webhooks/assemblyai
  - Content-Type: application/json
  - Optional HMAC verification: set CALL_WEBHOOK_VERIFY=assemblyai and ASSEMBLYAI_WEBHOOK_SECRET.
  - Payload fields used: transcript|text|transcript_text, utterances[], audio_url, transcript_url, status (completed triggers analysis + live summary).

- POST /api/calls/webhooks/twilio
  - Content-Type: application/x-www-form-urlencoded
  - Signature verification is toggleable; stubbed for now. Set CALL_WEBHOOK_VERIFY=twilio and TWILIO_AUTH_TOKEN to require.
  - Payload fields used: CallSid, RecordingUrl, Digits/DTMF (emitted as call.live.transcript "DTMF: ...").

Metrics (Prometheus at /api/dev/metrics)
- leadflow_call_started_total, leadflow_call_completed_total
- leadflow_call_summary_total{status="success|fail"}
- leadflow_call_transcription_ms_* and leadflow_call_scoring_ms_*
- leadflow_call_live_transcript_total, leadflow_call_live_summary_total

Notes
- AssemblyAI HMAC: header X-AssemblyAI-Signature must match sha256 HMAC of raw body. Set CALL_WEBHOOK_VERIFY=assemblyai to enforce.
- Idempotency: call.summary uses DB lookup by metadata.callSid; pass force=true to re-emit.