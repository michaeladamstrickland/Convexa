# QA Smoke - Integrated API

This tiny smoke verifies the integrated backend starts, essential routes respond, artifacts signing works, and the dialer v1 slice emits metrics.

## Quick run

- Start server (Windows-friendly):
  - Uses defaults PORT=6027, SQLITE_DB_PATH=backend/data/convexa.db
- Run tiny smoke:
  - Validates /leads, /dial, /dial/:id/asr-complete, /metrics, webhook 401.

## What it checks

- Health: GET /health → 200 JSON
- Leads list: GET /leads?limit=1 → leads[0].id
- Dial: POST /dial → { dialId, status: 'queued' }
- ASR complete: POST /dial/:dialId/asr-complete → { success: true }
- Metrics: GET /metrics → dial_attempts_total{status="queued"} > 0
- Artifacts: GET /admin/artifacts → array; signedUrl works and tamper → 401 with code invalid_signature or expired_signature

## Env knobs

- ARTIFACT_SIGNING_SECRET: HMAC secret for signing downloads (default dev-secret)
- ARTIFACT_URL_TTL_SECONDS: Signed URL TTL seconds (default 86400)
- TWILIO_AUTH_TOKEN: If set, webhook signature is enforced and missing/invalid returns 401
- SQLITE_DB_PATH: Canonical DB file path

## Troubleshooting

- Port busy: change PORT or stop the other server instance
- No leads: seed DB or point SQLITE_DB_PATH to an existing DB
- Metrics missing: ensure prom-client is installed (it is in devDependencies)

## Commands (optional)

- Start: npm run server:integrated
- Tiny smoke: npm run test:smoke:tiny
- Route tests only: npm run test:routes