# Developer Runbook: API Integrations

## Quick Start

1. Set up environment variables in `.env`:
   ```
   NODE_ENV=development
   
   # ATTOM
   ATTOM_API_KEY=your_attom_api_key
   ATTOM_BASE_URL=https://api.gateway.attomdata.com
   
   # BatchData
   BATCHDATA_API_KEY=your_batchdata_api_key
   BATCH_BASE_URL=https://api.batchdata.com
   
   # Networking
   OUTBOUND_PROXY=
   REQUEST_TIMEOUT_MS=15000
   ```

2. Run the API smoke test:
   ```bash
   cd C:/Projects/FlipTracker/FlipTracker/flip_tracker_full/leadflow_ai
   npx ts-node scripts/api-smoke.ts
   ```

3. Start the application:
   ```bash
   npm run dev
   ```

4. Check API health:
   ```bash
   curl -i http://localhost:3000/api/system/vendor-health
   ```

## API Testing & Diagnostics

### Using the API Smoke Test Script

The `scripts/api-smoke.ts` script tests basic connectivity to our vendor APIs.

```bash
# Run with existing .env values
npx ts-node scripts/api-smoke.ts

# Override specific values
ATTOM_API_KEY=xyz npx ts-node scripts/api-smoke.ts
```

### Troubleshooting API Connections

1. **Check Network Connectivity**:
   - Ensure your development environment can reach the vendor domains
   - Verify any corporate firewalls or proxies allow these connections

2. **Verify API Keys**:
   - Check that the keys in your `.env` file are correct
   - Verify the keys are active in the vendor dashboards
   - Check if IP allowlisting is required (add your IP if necessary)

3. **Check API Headers**:
   - ATTOM uses `apikey` header
   - BatchData uses `X-API-Key` header
   - Case sensitivity matters!

4. **API Response Codes**:
   - 401: Authentication issue (wrong/expired key)
   - 403: Permission issue (key doesn't have access to this endpoint)
   - 404: Wrong URL or endpoint 
   - 429: Rate limit hit (implement retry with backoff)
   - 5xx: Server-side issue (temporary, retry with backoff)

### Using cURL for Direct API Testing

#### ATTOM Property Search

```bash
curl -i \
  -H "Accept: application/json" \
  -H "apikey: $ATTOM_API_KEY" \
  "$ATTOM_BASE_URL/propertyapi/v1.0.0/property/address?postalcode=90210&pagesize=1"
```

#### BatchData Skip Trace

```bash
curl -i \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BATCHDATA_API_KEY" \
  -d '{"address":"123 Main St","city":"Beverly Hills","state":"CA","zip":"90210"}' \
  "$BATCH_BASE_URL/api/v1/property/skip"
```

## Feature Flags

Our API integrations use feature flags for easy enabling/disabling:

```
FEATURE_ATTOM_ENABLED=true
FEATURE_BATCH_ENABLED=true
```

When disabled:
- API endpoints continue to work but return empty results
- Warning logs show that the feature is disabled
- UI can display appropriate messaging

## Error Handling & Logging

All vendor API calls include:

1. **Retry Logic**: Automatic retry for 429/5xx errors with exponential backoff
2. **Timeouts**: Default 15-second timeout to prevent hanging requests
3. **Structured Logging**: All API calls log:
   - Request ID
   - Vendor name
   - Endpoint
   - Status code
   - Elapsed time (ms)
   - Error details (if any)

Example log:
```
[a7b3c9d2] ATTOM API: /propertyapi/v1.0.0/property/address (ZIP: 90210) - 200 - 345ms
```

## Adding New API Endpoints

1. Add the new endpoint to the appropriate service file:
   - `src/services/attomService.ts` for ATTOM
   - `src/services/batchService.ts` for BatchData

2. Follow the existing pattern:
   ```typescript
   export async function newEndpoint(param1: string, param2: string) {
     // If feature is disabled, return empty results
     if (!isAttomEnabled || !attom) {
       console.warn('ATTOM API is disabled. Returning empty results.');
       return { result: null, status: 'disabled' };
     }
     
     const startTime = Date.now();
     const endpoint = '/path/to/endpoint';
     
     try {
       // Make the API call
       const { data, status } = await attom.get(endpoint, {
         params: { param1, param2 }
       });
       
       // Log the API call
       logApiCall('ATTOM', endpoint, status, startTime);
       
       return { result: data, status: 'success' };
     } catch (error) {
       logApiCall('ATTOM', endpoint, error.response?.status || 0, startTime, error);
       return { result: null, status: 'error', message: error.message };
     }
   }
   ```

3. Add the endpoint to the API smoke test script

4. Document the endpoint in `INTEGRATIONS.md`

## Cost Control Strategies

1. **Batch Operations**: Use batch endpoints when processing multiple items
   - Configure `MAX_BATCH_SKIP_TRACE_SIZE` to limit batch size

2. **Caching**: Cache common lookup results to prevent duplicate API calls

3. **Address Normalization**: Use `normalizeAddress()` to deduplicate properties

4. **Feature Flags**: Disable APIs when not needed

5. **Daily Limits**: Set `MAX_DAILY_API_COST_DOLLARS` to cap spending

## Monitoring & Alerting

Monitor API health through:

1. System health endpoint: `/api/system/health`
2. Vendor health endpoint: `/api/system/vendor-health`
3. API logs (search for error patterns)

## Security Best Practices

1. Never expose API keys in client-side code
2. All vendor API calls must be made server-side only
3. API keys must be stored in environment variables, not in code
4. Implement IP allowlisting when supported by vendors
5. Use HTTPS for all API communications
