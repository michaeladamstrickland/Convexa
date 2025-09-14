# Export Endpoint

`GET /api/admin/export-leads`

## Query Parameters
| Param | Description | Default |
|-------|-------------|---------|
| `format` | `json` or `csv` | json |
| `source` | Filter by scraper source | – |
| `zip` | Filter by ZIP | – |
| `condition` | PropertyCondition | – |
| `minScore` | Minimum `investmentScore` (>=) | – |
| `tag` | Requires tag in `enrichmentTags[]` | – |
| `limit` | Page size (<=1000) | 100 |
| `offset` | Pagination offset | 0 |
| `sortBy` | `createdAt`, `investmentScore`, `price` | createdAt |

## JSON Response Shape
```
{
  "data": [ { id, source, zip, price, beds, sqft, propertyType, investmentScore, condition, enrichmentTags:"tag1,tag2", createdAt } ],
  "meta": { "filtersApplied": {...}, "totalCount": 123, "pagination": { "limit":100, "offset":0 } }
}
```

## CSV Response
- Headers: `id,source,zip,price,beds,sqft,propertyType,investmentScore,condition,enrichmentTags,createdAt`
- Content-Type: `text/csv`
- Content-Disposition with timestamp filename

## Metrics
- `leadflow_export_total{format}`
- `leadflow_export_duration_ms_*`

## Example
```
curl "http://localhost:3001/api/admin/export-leads?format=csv&zip=08081&minScore=70&tag=fixer"
```
