# Railway Docker deploy (staging)

This guide deploys Convexa as a Dockerized staging service on Railway using the integrated JS server (no TS build).

## Why Dockerfile

- Avoids monorepo TypeScript build errors on Railway.
- Runs the known-good JS server at `backend/integrated-server.js`.
- Keeps image small by copying only `backend/` and `ops/`.

## Steps (UI)

1) Create Project → Deploy from GitHub → select branch `ops/staging-cutover`.
2) Railway auto-detects the `Dockerfile` (no build command needed).
3) Add a persistent Volume, mount it at `/data` (for SQLite + artifacts).
4) Add Redis database; set `REDIS_URL` on the service.
5) Configure Variables (service):

```
PORT=8080
NODE_ENV=staging
SQLITE_DB_PATH=/data/convexa.db
LOCAL_STORAGE_PATH=/data/run_storage
STORAGE_BACKEND=local
ARTIFACT_SIGNING_SECRET=<64-hex>
ARTIFACT_URL_TTL_SECONDS=86400
REDIS_URL=<from Railway>
TWILIO_AUTH_TOKEN=dev-token
SKIP_TRACE_DEMO_MODE=true
X_ADMIN_TOKEN=<64-hex>
BASIC_AUTH_USER=staging
BASIC_AUTH_PASS=<strong-pass>
```

6) Deploy → after first successful deploy, copy the staging URL from Settings → Domains.

## Smoke test

Set BASE to the Railway URL and run the tiny smoke:

```sh
BASE="https://<your>.up.railway.app" \
BASIC_AUTH_USER=staging BASIC_AUTH_PASS=<strong-pass> \
npm run ops:staging:smoke
```

Expected output: `Staging smoke OK`

## Prometheus scrape (example)

```
- job_name: "convexa_staging"
  scheme: https
  metrics_path: /metrics
  static_configs:
    - targets: ["<your>.up.railway.app:443"]
  basic_auth:
    username: ${PROM_BASIC_AUTH_USER}
    password: ${PROM_BASIC_AUTH_PASS}
```

## Notes

- The Docker image exposes port 8080; Railway will map it.
- Persistent data is stored under `/data` (DB + artifacts). Ensure the service has the volume attached.
- `/metrics` and `/admin/*` can be gated by basic auth when `BASIC_AUTH_USER/PASS` are set.
- Skip-trace providers remain in demo mode (`SKIP_TRACE_DEMO_MODE=true`) for $0 spend.
