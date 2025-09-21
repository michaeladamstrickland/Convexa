# Grafana provisioning

This folder contains provisioning for Grafana so the Prometheus datasource and the Convexa dashboard are auto-loaded at startup.

- Datasource: Prometheus (http://prometheus:9090)
- Dashboards path mounted at /etc/grafana/dashboards

After `npm run ops:stack:up`, open Grafana:

- URL: http://localhost:3000
- Login: admin / admin (first run prompts for password change)

The dashboard "Convexa Dashboard" should appear automatically. If not, check container logs and that the dashboard JSON exists at `ops/dashboards/convexa.json`.
