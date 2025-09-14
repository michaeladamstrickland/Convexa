# ATTOM + BatchData Integration

This integration allows you to search for real property data using the ATTOM API and skip trace property owners using the BatchData API.

## Setup

1. Add API keys to your `.env` file:

```
ATTOM_API_KEY=your_api_key_here
BATCHDATA_API_KEY=your_api_key_here
```

2. Run the database migration:

```bash
npx prisma migrate dev --name attom_batchdata_integration
```

3. Start the server:

```bash
npm run dev
```

## API Endpoints

### Search Property by Address

```
POST /api/search/address
Content-Type: application/json

{
  "address": "123 Main St",
  "city": "Anytown",
  "state": "CA",
  "zipCode": "90210",
  "skipTrace": true
}
```

### Search Properties by ZIP Code

```
POST /api/search/zip
Content-Type: application/json

{
  "zipCode": "90210",
  "limit": 10,
  "skipTrace": false
}
```

### Skip Trace Existing Lead

```
POST /api/leads/skip-trace
Content-Type: application/json

{
  "leadId": "cl9z1y2t70000j0f0g0h0i0j0"
}
```

## Cost Controls

The ATTOM and BatchData APIs have usage costs. The integration includes:

- Cost tracking per API call
- Skip tracing limits for batch operations
- Caching to prevent duplicate lookups

You can monitor and adjust these settings in the `.env` file:

```
# Cost control settings
MAX_DAILY_API_COST_DOLLARS=50
MAX_BATCH_SKIP_TRACE_SIZE=10
```

## Monitoring

The API usage costs are tracked in the database and can be viewed in the admin dashboard.

## Error Handling

The integration includes retry logic and error handling for API calls. Failed API calls are logged and can be retried.
