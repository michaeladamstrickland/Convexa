Why Dockerfile: avoids monorepo TS build errors in Railway; runs the known-good JS server (backend/integrated-server.js).

What’s included:
- Dockerfile + .dockerignore
- Optional env-gated basic auth for /metrics and /admin/*
- Staging smoke script: npm run ops:staging:smoke
- Railway deploy guide and deploy notes
- Artifacts and dialer storage routed to LOCAL_STORAGE_PATH to persist under /data

Provisioning checklist:
- Volume at /data (SQLite + artifacts)
- Redis attached; set REDIS_URL
- Service variables: PORT=8080, NODE_ENV=staging, SQLITE_DB_PATH=/data/convexa.db, LOCAL_STORAGE_PATH=/data/run_storage, STORAGE_BACKEND=local, ARTIFACT_SIGNING_SECRET, ARTIFACT_URL_TTL_SECONDS=86400, REDIS_URL, TWILIO_AUTH_TOKEN=dev-token, SKIP_TRACE_DEMO_MODE=true, X_ADMIN_TOKEN, BASIC_AUTH_USER, BASIC_AUTH_PASS

Smoke:
BASE="https://<your>.up.railway.app" BASIC_AUTH_USER=staging BASIC_AUTH_PASS=<strong-pass> npm run ops:staging:smoke

Prom scrape example provided in ops/deploy/railway.md.

Acceptance criteria:
- /health, /leads, /dial+asr, /metrics reachable; smoke prints "Staging smoke OK".

What Sixth needs next:
- Staging URL, Prom scrape config, gating check, dashboard screenshot, QA orchestrator run.
