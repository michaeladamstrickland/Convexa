# FlipTracker - ATTOM and BatchData Integration

This document summarizes the complete integration of the ATTOM Property Data API and BatchData Skip Trace API into the FlipTracker application.

## Integration Overview

The integration provides two main capabilities:
1. **Property Data Lookup** - Using ATTOM API to fetch detailed property information
2. **Owner Contact Discovery** - Using BatchData API for skip tracing to find property owner contact information

## Core Components

The integration consists of the following components:

### 1. API Clients and Services

- `src/services/attomClient.ts` - ATTOM API client with property lookup features
- `src/services/batchService.ts` - BatchData API client with skip tracing capabilities

### 2. Utility Modules

- `src/utils/addressNormalization.ts` - Address standardization and matching
- `src/utils/vendorClient.ts` - API client factory with error handling and retries

### 3. Test Scripts

- `test-attom-batch.js` - Tests API connectivity
- `test-integration.sh` / `test-integration.bat` - End-to-end integration testing

## Key Features

- **Address Normalization** - Ensures consistent property identification
- **API Cost Tracking** - Monitors and limits daily API usage costs
- **Response Caching** - Improves performance and reduces API calls
- **Error Handling** - Robust error handling with retry mechanisms
- **Comprehensive Testing** - Test scripts verify connectivity and functionality

## Setup Requirements

1. **Environment Variables**
   - `ATTOM_API_KEY` - Your ATTOM API key
   - `BATCHDATA_API_KEY` - Your BatchData API key
   - `ATTOM_API_ENDPOINT` - Default: https://api.developer.attomdata.com/api/v1
   - `BATCHDATA_API_ENDPOINT` - Default: https://api.batchdata.com/api
   - `MAX_DAILY_API_SPEND` - Default: 100 (dollars)

2. **Node.js Dependencies**
   - Axios - HTTP client for API requests
   - Dotenv - Environment variable management
   - Winston - Logging (optional)

## How to Use

### Property Data Lookup

```javascript
const attomClient = require('./src/services/attomClient').default;

// Look up a property by address
const property = await attomClient.getPropertyByAddress(
  '123 Main St',
  'Anytown',
  'CA',
  '12345'
);

// Search properties by ZIP code
const properties = await attomClient.getPropertiesByZipCode('90210');

// Get property by ATTOM ID
const propertyById = await attomClient.getPropertyById('123456789');
```

### Skip Trace (Owner Contact Discovery)

```javascript
const batchService = require('./src/services/batchService').default;

// Skip trace by property address
const skipTraceResult = await batchService.skipTraceByAddress(
  '123 Main St',
  'Anytown',
  'CA',
  '12345'
);

// Process the results to get formatted contact information
const contactData = batchService.processSkipTraceResults(skipTraceResult);
```

## Error Handling

Both API clients include comprehensive error handling:

1. **Rate Limiting** - Automatically retries on rate limit errors
2. **Network Issues** - Retries with exponential backoff
3. **Invalid Data** - Validation before API calls to prevent errors
4. **Cost Control** - Stops API calls if daily spending limit is reached

## Testing

Run the integration tests to verify API connectivity and functionality:

```bash
# On Unix/Linux/Mac
./test-integration.sh

# On Windows
test-integration.bat
```

## Current Status

- **Implementation**: Complete
- **Testing**: Connectivity tests implemented
- **Documentation**: Complete
- **Frontend Integration**: Pending

## Next Steps

1. **Frontend Integration**
   - Add skip trace button to property detail pages
   - Create property search component using ATTOM API
   - Display contact information from BatchData

2. **User Experience**
   - Add progress indicators during API calls
   - Implement error messages for failed lookups
   - Add confirmation for skip trace to manage costs

3. **Data Management**
   - Store results in database to reduce API calls
   - Implement periodic refreshing of property data
   - Add data aging/expiration for cached results

## API Troubleshooting

If you encounter API issues:

### ATTOM API

- Verify API key is active in ATTOM developer portal
- Ensure addresses are formatted correctly
- Check API endpoint configuration
- Review ATTOM API documentation for required headers

### BatchData API

- Verify API key and endpoint configuration
- Ensure you have the correct subscription for skip tracing
- Test with known good addresses
- Check BatchData support portal for API status

## Support Resources

- ATTOM API Documentation: https://api.developer.attomdata.com/docs
- BatchData API Documentation: https://batchdata.com/api-docs/
- FlipTracker Integration Guide: See `ATTOM_BATCH_IMPLEMENTATION_GUIDE.md`

## Conclusion

The ATTOM and BatchData integration provides FlipTracker with powerful property data and owner contact discovery capabilities. The implementation is complete and ready to be integrated with the frontend components.
