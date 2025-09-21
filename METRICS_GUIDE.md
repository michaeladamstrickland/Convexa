# Convexa Metrics Guide

This guide explains how the frontend Call Insights panel parses and displays metrics, how to export data, and how the "Open in Prometheus" link works. It also documents the metric names and labels expected from the backend.

## Metrics Source
- Endpoint: `/api/dev/metrics` (Prometheus text exposition)
- Refresh interval: 30s
- Backward compatibility: The backend exposes both `leadflow_*` and mirrored `convexa_*` metrics for dashboards transitioning to the new naming.

## Metric Names Used
- `leadflow_call_summary_total{outcome,tag}`: Counter of analyzed calls (labels are optional)
- `leadflow_call_live_summary_total{outcome,tag}`: Counter of live calls observed
- `leadflow_call_scoring_ms_bucket{le,outcome,tag}` + `_count`, `_sum`: Histogram for call scoring latency (ms)

Notes:
- The UI prioritizes `leadflow_*` names for compatibility, but mirrored `convexa_*` may also be present.
- Label filters applied in the UI: `outcome`, `tag`.

## UI Features
- Filters: Outcome and Tag dropdowns, which scope counters and histograms by labels.
- Stats: Total analyzed calls, live calls, average latency, and percentiles (P50, P90, P99) computed from histogram buckets.
- Charts:
  - Bar chart of histogram bucket counts (ms)
  - Line chart of selected percentiles
- Export:
  - JSON: Exports parsed metrics and active label filters
  - CSV: Exports histogram buckets with labels (metric, le, outcome, tag, value)
- Open in Prometheus: Deep link to `/api/dev/metrics` with active label filters appended as query params for context. The endpoint may ignore them, but they document state and can be used by proxies that support filter-aware handling.

## Extending
- Adding a new label (e.g., `model`, `region`):
  1) Ensure the backend emits labels on counters and histograms.
  2) Add the label to the filter UI options derived in `frontend/src/components/analytics/CallInsightsPanel.tsx`.
  3) Include it in `labelFilters` and export CSV row building if needed.

- Adding a new metric:
  - For counters: Update `getCounterTotal` calls with the metric name.
  - For histograms: Update calls to `getHistogramBuckets`, `getHistogramCount`, and `getHistogramSum`.

## Troubleshooting
- Empty charts:
  - Confirm the backend is exposing the metrics names above at `/api/dev/metrics`.
  - Check labels; selecting an overly specific outcome/tag can result in zero matches.
- Auth issues:
  - The axios client auto-attaches the Convexa token (fallback to legacy LeadFlow token). On 401, it clears storage and redirects to `/login`.

## Future Enhancements
- Historical charts via `/api/dev/metrics/history` if the backend provides time-series windows.
- Direct link to a Prometheus UI with a pre-filled PromQL query, if a Prometheus web UI is available in the environment.
