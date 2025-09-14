# Public Properties Feed

Endpoint: `GET /api/properties`

Optional query parameters:
- `source`: string (e.g., zillow)
- `zip`: string (e.g., 08081)
- `beds`: number (min beds)
- `minPrice` / `maxPrice`: number
- `propertyType`: string
- `minSqft`: number
- `condition`: string (e.g., NeedsWork, Fair)
- `minScore`: number (filters `investmentScore >= minScore`)
- `tag`: string | CSV of strings; matches enrichmentTags
  - `tag=fixer` uses array contains
  - `tag=high-potential,fixer` uses AND semantics via `hasEvery`
- `reason`: string | CSV of strings; matches reasons array (has | hasSome)
  - Example values: `sqft>1200:+10`, `condition=NeedsWork:+15`
- `tagReasons`: string | CSV; approximated to tag filters by mapping common tokens to known tags (OR semantics via hasSome)
  - Known tags: `high-potential, low-margin, fixer, rental, equity, high-ROI`
- `limit` / `offset`: pagination
- `dedupedOnly`: boolean (reserved)

Response shape:
```
{
  data: Array<{
    id: string;
    source: string;
    zip: string;
    price: number | null;
    beds: number | null;
    sqft: number | null;
    propertyType: string | null;
    investmentScore: number | null;
    condition: string | null;
    enrichmentTags: string[];
    reasons?: string[];
    tagReasons?: Array<{ tag: string; reason: string }> | null;
    createdAt: string;
  }>,
  meta: {
    totalCount: number;
    filtersApplied: string[];
    pagination: { limit: number; offset: number }
  }
}
```

Examples:

- Filter by score and tags (AND):
```bash
curl -s "http://localhost:3001/api/properties?minScore=80&tag=high-potential,fixer&limit=25"
```

- Filter by reason tokens (OR):
```bash
curl -s "http://localhost:3001/api/properties?reason=sqft>1200:+10,condition=NeedsWork:+15"
```

- Filter by tagReasons proxy (mapped to tags):
```bash
curl -s "http://localhost:3001/api/properties?tagReasons=high-potential,low-margin&limit=50"
```

Notes:
- `reason` uses OR semantics across provided tokens (hasSome). Use multiple values to broaden matches.
- `tag` with multiple values uses AND semantics (hasEvery) to ensure all tags are present.
- `tagReasons` currently maps to tag filters with OR semantics as a practical proxy. If deeper JSON matching is needed later, we can add dedicated endpoints.