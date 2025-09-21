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
`<RAILWAY_HOST_URL>` (This will be provided by Railway after deployment)

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
