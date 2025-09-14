# Skip Trace API Documentation

This document outlines the Skip Trace API endpoints available in the LeadFlow AI application.

## Base URL

All API endpoints are available under the `/api/skip-trace` base URL.

## Authentication

All requests require authentication. Provide an authentication token in the `Authorization` header:

```
Authorization: Bearer <your_token>
```

## Endpoints

### Skip Trace a Single Lead

Skip trace a single lead to find contact information.

**URL**: `/api/skip-trace/leads/:leadId`

**Method**: `POST`

**Request Body**:

```json
{
  "respectQuietHours": true,
  "force": false
}
```

Parameters:
- `respectQuietHours` (boolean): Whether to respect quiet hours based on lead timezone
- `force` (boolean, optional): Force a skip trace even if the lead already has contact info

**Response**:

```json
{
  "success": true,
  "message": "Skip trace completed successfully",
  "result": {
    "leadId": "lead_123",
    "providersTried": ["batch_skip_tracing", "whitepages_pro"],
    "cost": 0.25,
    "contacts": {
      "phones": [
        {
          "value": "(555) 123-4567",
          "type": "mobile",
          "confidence": 0.85,
          "dnc": false,
          "lastSeen": "2025-01-15",
          "source": "batch_skip_tracing"
        }
      ],
      "emails": [
        {
          "value": "john.doe@example.com",
          "confidence": 0.75,
          "dnc": false,
          "lastSeen": "2025-02-20",
          "source": "whitepages_pro"
        }
      ]
    },
    "compliance": {
      "quietHours": true,
      "leadTimezone": "America/Los_Angeles",
      "dncSuppressed": 0
    }
  },
  "cost": 0.25
}
```

### Bulk Skip Trace Multiple Leads

Skip trace multiple leads in one request.

**URL**: `/api/skip-trace/bulk`

**Method**: `POST`

**Request Body**:

```json
{
  "leadIds": ["lead_123", "lead_456", "lead_789"],
  "respectQuietHours": true
}
```

Parameters:
- `leadIds` (array): Array of lead IDs to skip trace
- `respectQuietHours` (boolean): Whether to respect quiet hours based on lead timezone

**Response**:

```json
{
  "success": true,
  "summary": {
    "requested": 3,
    "processed": 3,
    "hits": 2,
    "noHits": 1,
    "errors": 0,
    "cost": 0.55
  },
  "results": [
    {
      "leadId": "lead_123",
      "status": "success",
      "matches": 3,
      "cost": 0.25
    },
    {
      "leadId": "lead_456",
      "status": "success",
      "matches": 1,
      "cost": 0.30
    },
    {
      "leadId": "lead_789",
      "status": "no_hit",
      "matches": 0,
      "cost": 0
    }
  ]
}
```

### Get Skip Trace Metrics

Get metrics about skip tracing activity.

**URL**: `/api/skip-trace/metrics`

**Method**: `GET`

**Query Parameters**:
- `range` (string, optional): Time range for metrics. Values: `7d`, `30d`, `90d`, `year`. Default: `30d`

**Response**:

```json
{
  "success": true,
  "traces": 125,
  "hitRate": 0.78,
  "cost": 35.75,
  "cpcl": 0.29,
  "byProvider": [
    {
      "name": "batch_skip_tracing",
      "traces": 85,
      "hitRate": 0.82,
      "avgCost": 0.25
    },
    {
      "name": "whitepages_pro",
      "traces": 35,
      "hitRate": 0.71,
      "avgCost": 0.15
    },
    {
      "name": "public_records",
      "traces": 5,
      "hitRate": 0.4,
      "avgCost": 0
    }
  ]
}
```

### Get Skip Trace History for a Lead

Get skip trace history for a specific lead.

**URL**: `/api/skip-trace/leads/:leadId/history`

**Method**: `GET`

**Response**:

```json
{
  "success": true,
  "history": [
    {
      "id": "record_123",
      "leadId": "lead_123",
      "provider": "batch_skip_tracing",
      "status": "completed",
      "cost": 0.25,
      "confidence": 0.85,
      "completedAt": "2025-09-06T14:32:11.123Z",
      "createdAt": "2025-09-06T14:32:10.456Z"
    }
  ]
}
```

### Get Skip Trace Cost Estimate

Get an estimate for skip tracing cost.

**URL**: `/api/skip-trace/estimate`

**Method**: `GET`

**Query Parameters**:
- `provider` (string, optional): Provider to get estimate for. Default: `batch_skip_tracing`

**Response**:

```json
{
  "success": true,
  "cost": 0.25,
  "provider": "batch_skip_tracing"
}
```

## Error Responses

In case of errors, the API will return an appropriate HTTP status code and a JSON response with the error details:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": "Detailed error information"
}
```

Common error codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (lead or resource not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (server-side issue)

## Rate Limits

The skip trace API is subject to rate limiting to prevent abuse and control costs. The current limits are:

- 100 single skip traces per day per organization
- 1,000 bulk skip traces per day per organization

Exceeding these limits will result in a `429 Too Many Requests` response.
