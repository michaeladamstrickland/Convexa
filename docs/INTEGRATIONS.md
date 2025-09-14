# API Integrations Documentation

## Overview

This document provides details about our API integrations with ATTOM and BatchData, including example calls, endpoints used, and troubleshooting tips.

## ATTOM Property Data API

ATTOM provides comprehensive property data, including property details, ownership information, and valuation data.

### Base URL

```
https://api.gateway.attomdata.com
```

### Authentication

ATTOM requires an API key sent in the `apikey` header:

```
apikey: YOUR_ATTOM_API_KEY
```

### Endpoints Used

#### Property by Address

```bash
curl -i \
  -H "Accept: application/json" \
  -H "apikey: $ATTOM_API_KEY" \
  "$ATTOM_BASE_URL/propertyapi/v1.0.0/property/address?address1=123%20Main%20St&address2=Beverly%20Hills,%20CA%2090210"
```

#### Property by ZIP Code

```bash
curl -i \
  -H "Accept: application/json" \
  -H "apikey: $ATTOM_API_KEY" \
  "$ATTOM_BASE_URL/propertyapi/v1.0.0/property/address?postalcode=90210&page=1&pagesize=10"
```

#### Property by ATTOM ID

```bash
curl -i \
  -H "Accept: application/json" \
  -H "apikey: $ATTOM_API_KEY" \
  "$ATTOM_BASE_URL/propertyapi/v1.0.0/property/basicprofile?attomid=1234567"
```

### Response Example (Property by Address)

```json
{
  "status": {
    "version": "1.0.0",
    "code": 0,
    "msg": "SuccessWithResult",
    "total": 1,
    "page": 1,
    "pagesize": 10,
    "transactionID": "123456789abcdef"
  },
  "property": [
    {
      "identifier": {
        "attomId": 12345678,
        "fips": "06037",
        "apn": "4348-022-001"
      },
      "address": {
        "line1": "123 MAIN ST",
        "line2": "BEVERLY HILLS, CA 90210",
        "locality": "BEVERLY HILLS",
        "countrySubd": "CA",
        "postal1": "90210"
      },
      "summary": {
        "proptype": "SFR",
        "propsubtype": "SINGLE FAMILY RESIDENCE",
        "yearbuilt": 1988,
        "propclass": "A"
      },
      "building": {
        "size": {
          "universalsize": 3500
        },
        "rooms": {
          "beds": 4,
          "bathstotal": 3
        }
      },
      "lot": {
        "lotsize1": 10000
      },
      "assessment": {
        "assessed": {
          "assdttlvalue": 2000000
        },
        "market": {
          "mktttlvalue": 2500000
        }
      },
      "sale": {
        "salesearchdate": "2022-01-15",
        "amount": {
          "saleamt": 2000000
        }
      }
    }
  ]
}
```

## BatchData Skip Trace API

BatchData provides owner contact information through skip tracing services.

### Base URL

```
https://api.batchdata.com
```

### Authentication

BatchData requires an API key sent in the `X-API-Key` header:

```
X-API-Key: YOUR_BATCHDATA_API_KEY
```

### Endpoints Used

#### Skip Trace by Address

```bash
curl -i \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BATCHDATA_API_KEY" \
  -d '{"address":"123 Main St","city":"Beverly Hills","state":"CA","zip":"90210"}' \
  "$BATCH_BASE_URL/api/v1/property/skip"
```

#### Batch Skip Trace

```bash
curl -i \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BATCHDATA_API_KEY" \
  -d '{"records":[{"address":"123 Main St","city":"Beverly Hills","state":"CA","zip":"90210"},{"address":"456 Oak Ave","city":"Los Angeles","state":"CA","zip":"90001"}]}' \
  "$BATCH_BASE_URL/api/v1/batch/upload"
```

### Response Example (Skip Trace by Address)

```json
{
  "status": "success",
  "result": {
    "name": "John Smith",
    "first_name": "John",
    "last_name": "Smith",
    "phones": [
      {
        "phone_number": "3105551234",
        "phone_type": "mobile",
        "carrier": "Verizon"
      },
      {
        "phone_number": "3105554321",
        "phone_type": "landline",
        "carrier": "AT&T"
      }
    ],
    "emails": [
      {
        "email": "john.smith@example.com",
        "is_valid": true,
        "confidence": 0.9
      }
    ],
    "owner_address": "789 Elm St, Malibu, CA 90265",
    "dnc_flag": false
  }
}
```

## Troubleshooting

### Common Issues

#### 401 Unauthorized

- Verify the API key is correct and active
- Check if the account has been activated and has proper permissions
- Ensure the API key is being sent in the correct header format

#### 404 Not Found

- Verify the base URL is correct
- Check if the endpoint path or version is correct
- Confirm the API product is enabled in your account

#### 429 Too Many Requests

- Implement retry logic with exponential backoff
- Respect rate limits defined in the API documentation

#### 5XX Server Errors

- Retry the request after a short delay
- Contact vendor support if errors persist

### API Health Check

To verify API connectivity, run our API health check:

```bash
curl -i http://localhost:3000/api/system/vendor-health
```

Response:

```json
{
  "timestamp": "2025-09-06T12:34:56.789Z",
  "services": [
    {
      "service": "ATTOM API",
      "status": "healthy",
      "latency": 245
    },
    {
      "service": "BatchData API",
      "status": "healthy",
      "latency": 312
    }
  ]
}
```

## Cost Control & Monitoring

We implement several strategies to control API costs:

1. Feature flags to enable/disable specific vendors
2. Batch size limits for bulk operations
3. Caching of common lookups
4. Result deduplication using normalized addresses

Monitor API usage through the system dashboard or logs.

## Security Best Practices

1. Never expose API keys in client-side code
2. All vendor API calls are made server-side only
3. API keys are stored in environment variables, not in code
4. Implement IP allowlisting when supported by vendors
