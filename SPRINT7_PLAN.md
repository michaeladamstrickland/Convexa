# Sprint 7 – AI Cold Calling & Conversation Intelligence (Closed)

Status: Closed on 2025-09-14

Deliverables
- Call ingestion endpoints: /api/calls/start, /complete, /transcript, /analyze
- Prisma models: CallTranscript, CallAnalysis (+ optional fields recordingUrl, transcriptUrl, dtmfCaptured)
- LLM analysis with heuristic fallback when OPENAI_API_KEY is absent
- CRM activity emission: type "call.summary" with metadata { callSid, summary, score, tags, transcriptUrl?, recordingUrl? }
- Webhook emission via existing delivery infra
- Metrics: leadflow_call_* counters and histograms in /api/dev/metrics
- Tests: happy path, idempotency, webhook smoke

Notes
- Idempotent call.summary creation by default; /analyze accepts { force: true } to emit another activity and webhook.
