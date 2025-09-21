# Convexa Metrics Stack (Windows + Docker Desktop)

Step-by-step to see data in Grafana and verify Prometheus:

1) Start the stack

npm run ops:stack:up

2) Warm app metrics (hits endpoints across ports 6027 / 6033 / 6035)

npm run ops:warm

3) Verify Prometheus API returns data (exits 0 on success)

npm run ops:prom:check

4) In Grafana

- Import `ops/dashboards/convexa.json`
- Select the Prometheus datasource
- Set time range to "Last 30 minutes" and dashboard refresh to "10s"
- Wait ~15–30s after warming for panels to populate
- Save a screenshot to `ops/findings/dashboard_initial.png`

Notes

- Prometheus scrapes the app via host.docker.internal for Windows + Docker Desktop.
- Recording rules are loaded from `ops/metrics/*.yml` into `/etc/prometheus/rules`.
- If you change Prometheus config or rules, run: `npm run ops:prom:restart`.
