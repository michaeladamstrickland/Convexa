## Railway (Docker) deploy — staging

See `ops/deploy/railway.md` for the full step-by-step.

Required service env vars:

- PORT=8080
- NODE_ENV=staging
- SQLITE_DB_PATH=/data/convexa.db
- LOCAL_STORAGE_PATH=/data/run_storage
- STORAGE_BACKEND=local
- ARTIFACT_SIGNING_SECRET=<64-hex>
- ARTIFACT_URL_TTL_SECONDS=86400
- REDIS_URL=<from Railway>
- TWILIO_AUTH_TOKEN=dev-token
- SKIP_TRACE_DEMO_MODE=true  # keep provider spend at $0
- X_ADMIN_TOKEN=<64-hex>
- BASIC_AUTH_USER=staging
- BASIC_AUTH_PASS=<strong-pass>

Smoke:

Run `npm run ops:staging:smoke` with BASE set to the Railway URL and BASIC_AUTH_USER/PASS if enabled.

# Staging Deployment Notes

## Provider Choice
Railway.app

Rationale: Railway offers a quick path for Node/Express applications, providing persistent volumes, Redis add-ons, easy environment variable management, and automatic HTTPS.

## Environment Variables (set in Railway project)

```
PORT=8080
NODE_ENV=staging
SQLITE_DB_PATH=/data/convexa.db
LOCAL_STORAGE_PATH=/data/run_storage
STORAGE_BACKEND=local
ARTIFACT_SIGNING_SECRET=<use the same value as in GitHub secret>
ARTIFACT_URL_TTL_SECONDS=86400
REDIS_URL=<railway redis url>
TWILIO_AUTH_TOKEN=<dev token – signature verify only>
SKIP_TRACE_DEMO_MODE=true
X_ADMIN_TOKEN=<random-32+ chars>
BASIC_AUTH_USER=${{ secrets.STAGING_BASIC_AUTH_USER }}
BASIC_AUTH_PASS=${{ secrets.STAGING_BASIC_AUTH_PASS }}
```

## Infrastructure
- Persistent volume mounted at `/data` for SQLite database and artifacts.
- Managed Redis instance attached, with `REDIS_URL` automatically configured by Railway.

## Staging Base URL
https://leadshepard.up.railway.app

Note: Staging runs `backend/integrated-server.js`. Both the classic routes (e.g., `/leads`) and the `zip-search-new` prefixed routes (e.g., `/api/zip-search-new/search`) are supported.

## How to Restart/Redeploy
- **Manual Redeploy:** In the Railway dashboard, navigate to your project, then to the service, and click "Deploy" -> "Redeploy".
- **Automatic Redeploy:** Railway is configured to automatically redeploy on new commits to the `main` branch (or the branch configured for deployment).

## Gating Endpoints
- **Method:** Basic Authentication for `/admin/*` and `/metrics`.
- **Allowed CIDRs:** None (Basic Auth only for now).
- **Test Account:** `admin:<STAGING_BASIC_AUTH_PASS>` (as configured in Railway environment variables).

## Secrets Management
- **Runtime (staging app):** Railway project -> Environment Variables
- **CI (GitHub Actions):** Repo Settings -> Secrets and variables -> Actions
  - `RAILWAY_TOKEN` (if using Railway CLI from CI)
  - `STAGING_BASIC_AUTH_USER`
  - `STAGING_BASIC_AUTH_PASS`
  - `ARTIFACT_SIGNING_SECRET`
  - `REDIS_URL` (if not provisioned automatically)
  - `TWILIO_AUTH_TOKEN` (dev token for signature verification only)
  - `PROM_BASIC_AUTH_USER` / `PROM_BASIC_AUTH_PASS` (if Prometheus needs auth to scrape)
