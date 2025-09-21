# Convexa AI — ATTOM + BatchData Integration Guide

This guide walks you through the setup and usage of the ATTOM Property Data API and BatchData Skip Trace integration in Convexa AI.

## Quick Start

1. **Setup Environment:**
   - Make sure your `.env` file contains the required API keys:
     ```
     ATTOM_API_KEY=your_attom_api_key
     BATCHDATA_API_KEY=your_batchdata_api_key
     BATCHDATA_BASE_URL=https://api.batchdata.com/v1
     ```

2. **Run the test script:**
   - On Windows: `test-attom-batch.bat`
   - On Unix/Linux/Mac: `bash test-attom-batch.sh`

3. **Verify the results:**
   - The test should connect to both APIs and return successful responses
   - The terminal will display sample property data and skip trace results

## Features Implemented

### ATTOM Property Data Integration
- Property lookup by address
- Property search by ZIP code
- Detailed property information including:
  - Property details (bedrooms, bathrooms, square footage)
  - Valuation data (market value, tax assessed value)
  - Sales history
  - Owner occupancy status

### BatchData Skip Trace Integration
- Owner contact lookup by property address
- Phone number and email extraction
- Phone type identification (mobile, landline, etc.)
- Confidence scoring for contact data quality

### Additional Functionality
- API cost tracking and daily spending caps
- Response caching to minimize API calls
- Automatic retry with exponential backoff
- Unified error handling and logging

## Usage Examples

### Property Lookup by Address

```javascript
import attomClient from './src/services/attomClient';

// Look up a property by address
const property = await attomClient.getPropertyByAddress(
  '123 Main St',
  'Beverly Hills',
  'CA',
  '90210'
);

console.log(`Property found: ${property.propertyAddress}`);
console.log(`Market value: $${property.marketValue}`);
```

### Property Search by ZIP Code

```javascript
import attomClient from './src/services/attomClient';

// Search for properties in a ZIP code
const properties = await attomClient.getPropertiesByZipCode('90210', 10);

console.log(`Found ${properties.length} properties`);
properties.forEach((property, index) => {
  console.log(`${index + 1}. ${property.propertyAddress}`);
});
```

### Skip Trace an Owner

```javascript
import batchService from './src/services/batchService';

// Skip trace a property owner
const skipTraceResult = await batchService.skipTraceByAddress(
  '123 Main St',
  'Beverly Hills',
  'CA',
  '90210'
);

if (skipTraceResult.status === 'success') {
  const contactData = batchService.processSkipTraceResults(skipTraceResult);
  
  console.log(`Found ${contactData.phones.length} phone numbers`);
  console.log(`Found ${contactData.emails.length} email addresses`);
  console.log(`Contact confidence: ${contactData.confidence}%`);
  
  // Get the best phone number (if available)
  const bestPhone = contactData.phones.find(p => p.isPrimary) || 
                    contactData.phones.find(p => p.isMobile && p.isConnected) ||
                    contactData.phones[0];
  
  if (bestPhone) {
    console.log(`Best phone number: ${bestPhone.number} (${bestPhone.type})`);
  }
}
```

## Cost Management

The integration includes built-in cost controls:

1. **Daily Spending Caps:**
   - `DAILY_CAP_ATTOM_CENTS`: Default 1000¢ ($10)
   - `DAILY_CAP_BATCH_CENTS`: Default 1000¢ ($10)

2. **Response Caching:**
   - Identical requests are cached to reduce API calls
   - Cache TTL is configurable via `CACHE_TTL_SECONDS` (default: 900 seconds)

3. **Cost Tracking:**
   - Each API call cost is logged and tracked
   - Daily totals are maintained and checked against caps

## Integration with Search Service

To integrate ATTOM data with your search service, modify your search controller:

```javascript
import attomClient from '../services/attomClient';

// In your search handler:
async function searchProperties(req, res) {
  const { address, city, state, zipCode, useRealData } = req.body;
  
  // Check if ATTOM data is requested
  if (useRealData && process.env.ATTOM_API_KEY) {
    try {
      // If address is provided, look up specific property
      if (address) {
        const property = await attomClient.getPropertyByAddress(
          address, city, state, zipCode
        );
        
        if (property) {
          return res.json({
            success: true,
            source: 'attom',
            property
          });
        }
      } 
      // If only ZIP is provided, return multiple properties
      else if (zipCode) {
        const properties = await attomClient.getPropertiesByZipCode(zipCode);
        
        return res.json({
          success: true,
          source: 'attom',
          properties
        });
      }
    } catch (error) {
      console.error('ATTOM API error:', error);
      // Fall back to local database
    }
  }
  
  // Fall back to local database search
  const results = await searchLocalDatabase(req.body);
  
  return res.json({
    success: true,
    source: 'local',
    results
  });
}
```

## Integration with Lead Detail Page

To add skip tracing to your lead detail page:

```javascript
import batchService from '../services/batchService';

// In your lead detail controller:
async function skipTraceLead(req, res) {
  const { id } = req.params;
  
  try {
    // Get lead from database
    const lead = await db.lead.findUnique({ where: { id } });
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Skip trace the lead
    const skipTraceResult = await batchService.skipTraceByAddress(
      lead.propertyAddress,
      lead.city,
      lead.state,
      lead.zipCode,
      lead.ownerFirstName,
      lead.ownerLastName
    );
    
    if (skipTraceResult.status === 'success') {
      const contactData = batchService.processSkipTraceResults(skipTraceResult);
      
      // Update lead with contact information
      await db.lead.update({
        where: { id },
        data: {
          skipTraceProvider: 'batchdata',
          skipTraceCostCents: skipTraceResult.cost * 100,
          skipTracedAt: new Date(),
          phonesJson: JSON.stringify(contactData.phones),
          emailsJson: JSON.stringify(contactData.emails)
        }
      });
      
      return res.json({
        success: true,
        contactData,
        cost: skipTraceResult.cost
      });
    } else {
      return res.status(400).json({
        success: false,
        message: skipTraceResult.message || 'Skip trace failed'
      });
    }
  } catch (error) {
    console.error('Skip trace error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
```

## Error Handling

The integration includes comprehensive error handling:

1. **Automatic Retries:**
   - Requests are automatically retried on transient failures (5xx errors, timeouts)
   - Exponential backoff with jitter prevents overwhelming the API
   - Non-retryable errors (4xx) are handled immediately

2. **Daily Cap Exceeded:**
   - When a daily spending cap is reached, APIs return a 429 status
   - Error includes information about the cap limit and current spending

3. **API Unavailable:**
   - Connection errors are caught and reported
   - Services can be disabled via configuration

## Troubleshooting

### Common Issues

1. **API Connection Failures:**
   - Verify your API keys are correct
   - Check your network connectivity
   - Ensure the API service is available

2. **Daily Cap Exceeded:**
   - Increase the cap in your `.env` file if needed
   - Wait until tomorrow for the cap to reset

3. **No Results Found:**
   - Verify the address format is correct
   - Try a different address that you know exists
   - Check if the property is in the ATTOM database

### Diagnostic Tools

- Run `node test-attom-batch.js` to test API connectivity
- Check the logs for detailed error messages
- Contact API support if persistent issues occur

## Next Steps

After successful integration, consider:

1. **Frontend Integration:**
   - Update search forms to use ATTOM data
   - Add skip trace buttons to lead pages
   - Display contact information in lead details

2. **Advanced Features:**
   - Implement bulk skip tracing
   - Add phone validation via Twilio
   - Create email verification workflow

3. **Analytics:**
   - Track conversion rates from skip traced leads
   - Analyze cost per acquisition
   - Optimize spending based on lead quality

For further assistance, refer to the API documentation or contact support.
