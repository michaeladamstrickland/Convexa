# Properties Feed API

GET /api/properties

Query params:
- source, zip, tag, condition, minScore, isEnriched
- createdAt[from], createdAt[to]
- sorting: sortBy=createdAt|score, order=asc|desc
- pagination: limit, offset

Response:
{
  data: [...],
  meta: {
    total: number,
    filtersApplied: string[],
    pagination: { limit: number, offset: number, nextOffset: number },
    sortBy: string,
    order: 'asc'|'desc'
  }
}

Metrics: leadflow_properties_feed_served_total
