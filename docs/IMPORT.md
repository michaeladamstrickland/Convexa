# CSV Import Guide

This guide explains how to import leads via CSV, how deduplication works, error handling, and metrics.

## Endpoint

- POST /admin/import/csv?mode=preview|commit
  - Upload multipart/form-data with field `file` (CSV; max 10MB)
  - Preview response:
    - { ok, preview: { rows_total, rows_valid, rows_invalid, would_create, would_merge, would_skip, sample_errors[] } }
  - Commit response:
    - { ok, created, merged, skipped, artifact: { auditUrl } }

## Template CSV

Required column:
- address

Optional columns:
- owner_name, phone, email, estimated_value, equity, motivation_score, temperature_tag, source_type, status, notes
- city, state, zip (used for dedupe normalization hints only where relevant)

Example:

address,owner_name,phone,email,estimated_value
123 Main St,John Doe,5551234567,john@example.com,525000

## Deduplication

- In-batch: normalized_address + (owner_name|email|phone) used to skip exact duplicates in the same file.
- Database: best-effort match by normalized address + identifier match (owner/email/phone) against existing rows; merges non-destructively into existing rows.

## Validation

- Zod validates rows. Invalid rows are counted in preview and included as sample_errors (max 10). On commit, only valid rows are processed.
- Limits: 10MB file size; content-type must be CSV.

## Audit and Artifacts

- On commit, an audit file is written: run_reports/import_<timestamp>/audit.json
- The artifacts endpoints and /ops/artifacts page include audit.json with a signed URL for download (24h TTL by default).

## Metrics

- convexa_import_rows_total{result="created|merged|skipped|invalid"}
  - Increments on commit for created, merged, skipped, and invalid counts.
- Exposed at /metrics (Prometheus exposition), gated by Basic Auth if configured.

## Operator UI

- Visit /ops/import to upload a CSV, see inline preview totals and top errors, then "Commit Import".
- Visit /ops/leads to use filters: q, city, state, zip, status, temperature, minValue, maxValue.
- Visit /ops/leads/:id for artifacts and quick actions (add note, set disposition).

## Guardrails

- Demo mode only; no paid provider spend.
- Problem+JSON error format used for validation and auth, e.g. { code, message, field? }.
