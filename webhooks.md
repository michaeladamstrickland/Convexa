# Webhooks Admin + Delivery History

GET /api/admin/delivery-history
- Filters: subscriptionId, eventType, status, targetUrl
- Sort: createdAt desc
- Fields: id, subscriptionId, eventType, status, attempts, jobId, lastAttemptAt, createdAt, updatedAt, targetUrl, headers, timestamp
- Pagination: limit, offset, nextOffset

Metrics: leadflow_delivery_history_queries_total
