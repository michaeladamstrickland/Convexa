# API Surface

Generated on: 2025-09-24T14:27:47.999Z

Total routes: 36

## Authentication Summary

- **basic-auth**: 7 routes
- **api-key**: 21 routes
- **token-auth**: 2 routes
- **none**: 6 routes

## Routes by Category

### Admin

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| USE | /admin | basic-auth | use_admin | ✅ Active |
| GET | /admin/artifact-download | basic-auth | get_admin_artifactdownload | ✅ Active |
| GET | /admin/artifacts | basic-auth | get_admin_artifacts | ✅ Active |
| POST | /admin/export/weekly-bundle | basic-auth | post_admin_export_weeklybundle | ✅ Active |
| POST | /admin/import/csv | basic-auth | post_admin_import_csv | ✅ Active |

### ATTOM Data

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| GET | /api/attom/property/address | api-key | get_api_attom_property_address | ✅ Active |
| GET | /api/attom/property/zip | api-key | get_api_attom_property_zip | ✅ Active |
| GET | /api/attom/status | api-key | get_api_attom_status | ✅ Active |

### API

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| GET | /api/db-info | api-key | get_api_dbinfo | ✅ Active |
| GET | /api/debug/attempt-reasons-today | api-key | get_api_debug_attemptreasonstoday | ✅ Active |
| GET | /api/debug/config | api-key | get_api_debug_config | ✅ Active |
| GET | /api/debug/errors-today | api-key | get_api_debug_errorstoday | ✅ Active |
| GET | /api/debug/provider-calls-today | token-auth | get_api_debug_providercallstoday | ✅ Active |
| GET | /api/debug/skiptrace-latest | api-key | get_api_debug_skiptracelatest | ✅ Active |
| GET | /api/debug/zip-hints-today | api-key | get_api_debug_ziphintstoday | ✅ Active |
| POST | /api/leads | api-key | post_api_leads | ✅ Active |
| POST | /api/leads/bulk/skiptrace | api-key | post_api_leads_bulk_skiptrace | ✅ Active |
| GET | /api/search | api-key | get_api_search | ✅ Active |
| USE | /api/search | api-key | use_api_search | ✅ Active |
| POST | /api/skiptrace-runs/start | api-key | post_api_skiptraceruns_start | ✅ Active |
| GET | /api/skiptrace/analytics | api-key | get_api_skiptrace_analytics | ✅ Active |
| GET | /api/skiptrace/quota | api-key | get_api_skiptrace_quota | ✅ Active |
| GET | /api/status | api-key | get_api_status | ✅ Active |

### Search

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| POST | /api/zip-search-new/add-lead | api-key | post_api_zipsearchnew_addlead | ✅ Active |
| GET | /api/zip-search-new/revenue-analytics | api-key | get_api_zipsearchnew_revenueanalytics | ✅ Active |
| GET | /api/zip-search-new/search | api-key | get_api_zipsearchnew_search | ✅ Active |
| POST | /api/zip-search-new/search-zip | api-key | post_api_zipsearchnew_searchzip | ✅ Active |

### Other

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| POST | /dial | none | post_dial | ✅ Active |
| GET | /leads | none | get_leads | ✅ Active |
| POST | /twilio/recording-complete | token-auth | post_twilio_recordingcomplete | ✅ Active |

### Monitoring

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| GET | /health | none | get_health | ✅ Active |
| GET | /metrics | none | get_metrics | ✅ Active |
| USE | /metrics | basic-auth | use_metrics | ✅ Active |

### Operations

| Method | Path | Auth | Metrics Label | Status |
|--------|------|------|---------------|--------|
| GET | /ops/artifacts | none | get_ops_artifacts | ✅ Active |
| GET | /ops/import | basic-auth | get_ops_import | ✅ Active |
| GET | /ops/leads | none | get_ops_leads | ✅ Active |

