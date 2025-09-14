# Technical Testing Guide: ATTOM & Skip Tracing Implementation

This document provides detailed technical testing procedures for developers implementing and testing the ATTOM property data integration and skip tracing functionality in the FlipTracker application.

## Development Environment Setup

### Required Environment Variables

```
# API Keys
ATTOM_API_KEY=your_key_here
BATCH_SKIP_TRACING_API_KEY=your_key_here
WHITEPAGES_PRO_API_KEY=your_key_here

# ATTOM Configuration
ATTOM_API_URL=https://api.gateway.attomdata.com/propertyapi/v1.0.0
ATTOM_BATCH_ENDPOINT=/property/expandedprofile
ATTOM_RATE_LIMIT=5
ATTOM_CACHE_TTL=86400

# Skip Trace Configuration
SKIP_TRACE_DAILY_QUOTA=100
SKIP_TRACE_CACHE_DAYS=7
SKIP_TRACE_MAX_RETRIES=2
SKIP_TRACE_RETRY_DELAY_MS=2000
SKIP_TRACE_PRIMARY_PROVIDER=batchdata
SKIP_TRACE_FALLBACK_ENABLED=true
MAX_BATCH_SKIP_TRACE_SIZE=10

# Feature Flags
FEATURE_ATTOM_PROPERTY_DATA=true
FEATURE_SKIPTRACE_BATCHDATA=true
FEATURE_SKIPTRACE_FALLBACK=true
```

### Database Schema Verification

Run the following commands to verify the database schema:

```bash
# Backend directory
cd backend
npx prisma generate
npx prisma db push
```

Verify these tables exist with the correct fields:

1. `Lead` with ATTOM fields:
   - `attomPropertyId`
   - `attomData` (JSON)
   - `attomLastUpdate` (DateTime)

2. `Lead` with skip trace fields:
   - `skipTraceProvider` (String)
   - `skipTraceCostCents` (Int)
   - `skipTracedAt` (DateTime)

3. `SkipTraceRecord` table with:
   - `leadId` (String)
   - `provider` (String)
   - `status` (String)
   - `requestData` (JSON)
   - `responseData` (JSON)
   - `cost` (Float)
   - `confidence` (Float)
   - `completedAt` (DateTime)

## Unit Testing ATTOM Implementation

### 1. Test ATTOM API Client

```bash
# Run the ATTOM client unit tests
cd backend
npm test -- --testPathPattern=attomClient.test.ts
```

Key functions to test:
- `getPropertyByAddress()`
- `getPropertyById()`
- `getBatchProperties()`

### 2. Manual ATTOM API Testing

Execute the following command to test the ATTOM API directly:

```bash
curl -X GET "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=1600+Pennsylvania+Ave&postalcode=20500" \
     -H "apikey: YOUR_API_KEY" \
     -H "Accept: application/json" | jq
```

### 3. Test ATTOM Data Service

```bash
# Create a file to test the ATTOM service directly
cd backend
node -e "
const { attomDataService } = require('./src/services');
async function test() {
  try {
    const property = await attomDataService.getPropertyByAddress({
      street: '1600 Pennsylvania Ave',
      city: 'Washington',
      state: 'DC',
      zip: '20500'
    });
    console.log('ATTOM Property Data:', JSON.stringify(property, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}
test();
"
```

## Unit Testing Skip Trace Implementation

### 1. Test Skip Trace Service

```bash
# Run the skip trace service unit tests
cd backend
npm test -- --testPathPattern=skipTraceService.test.ts
```

Key functions to test:
- `runSkipTrace()`
- `getSkipTraceHistory()`
- `estimateCost()`

### 2. Manual Skip Trace API Testing

Run the following commands to test the skip trace API endpoints:

```bash
# Create a test lead
curl -X POST "http://localhost:3001/api/leads" \
     -H "Content-Type: application/json" \
     -d '{
       "propertyAddress": "123 Main St",
       "city": "San Francisco",
       "state": "CA",
       "zipCode": "94102",
       "ownerName": "John Smith"
     }'

# Get the lead ID from the response and use it in the next command

# Skip trace the lead
curl -X POST "http://localhost:3001/api/skip-trace/leads/LEAD_ID_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "respectQuietHours": true
     }'
```

### 3. Test Skip Trace Batch Processing

```bash
# Test batch skip tracing with multiple leads
cd backend
node -e "
const { skipTraceService } = require('./src/services');
async function test() {
  try {
    const results = await Promise.all([
      skipTraceService.runSkipTrace('lead_1', {
        fullName: 'John Smith',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102'
      }),
      skipTraceService.runSkipTrace('lead_2', {
        fullName: 'Jane Doe',
        address: '456 Oak Ave',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601'
      })
    ]);
    console.log('Batch Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}
test();
"
```

## Integration Testing

### 1. ATTOM Integration Test

```bash
# Run the ATTOM integration test
cd backend
node -e "
const { attomDataService } = require('./src/services');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Create a test lead
    const lead = await prisma.lead.create({
      data: {
        propertyAddress: '1600 Pennsylvania Ave',
        city: 'Washington',
        state: 'DC',
        zipCode: '20500',
        source: 'test',
        status: 'new'
      }
    });
    
    console.log('Created test lead:', lead.id);
    
    // Enrich with ATTOM data
    const attomData = await attomDataService.enrichLeadWithAttomData(lead.id);
    console.log('ATTOM enrichment result:', attomData ? 'Success' : 'Failed');
    
    // Retrieve the updated lead
    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id }
    });
    
    console.log('Updated lead with ATTOM data:', JSON.stringify({
      attomPropertyId: updatedLead.attomPropertyId,
      attomLastUpdate: updatedLead.attomLastUpdate,
      attomData: updatedLead.attomData ? 'Present' : 'Missing'
    }, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
"
```

### 2. Skip Trace Integration Test

```bash
# Run the skip trace integration test
cd backend
node -e "
const { skipTraceService } = require('./src/services');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Create a test lead
    const lead = await prisma.lead.create({
      data: {
        propertyAddress: '350 5th Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10118',
        source: 'test',
        status: 'new'
      }
    });
    
    console.log('Created test lead:', lead.id);
    
    // Run skip trace
    const request = {
      fullName: 'Test Owner',
      address: lead.propertyAddress,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zipCode
    };
    
    const result = await skipTraceService.runSkipTrace(lead.id, request);
    console.log('Skip trace result:', JSON.stringify(result, null, 2));
    
    // Verify skip trace record
    const records = await prisma.skipTraceRecord.findMany({
      where: { leadId: lead.id }
    });
    
    console.log('Skip trace records created:', records.length);
    console.log('Provider used:', records[0]?.provider);
    console.log('Cost:', records[0]?.cost);
    
    // Retrieve the updated lead
    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id }
    });
    
    console.log('Updated lead with skip trace data:', JSON.stringify({
      skipTraceProvider: updatedLead.skipTraceProvider,
      skipTracedAt: updatedLead.skipTracedAt,
      phones: updatedLead.phones ? JSON.parse(updatedLead.phones) : [],
      emails: updatedLead.emails ? JSON.parse(updatedLead.emails) : []
    }, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
"
```

### 3. End-to-End Test

Create a test script `test-integration.js`:

```javascript
const { attomDataService, skipTraceService } = require('./src/services');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFullWorkflow() {
  try {
    console.log('Starting full integration test...');
    
    // 1. Create a test lead
    const lead = await prisma.lead.create({
      data: {
        propertyAddress: '233 S Wacker Dr',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60606',
        source: 'test',
        status: 'new'
      }
    });
    
    console.log(`1. Created test lead: ${lead.id}`);
    
    // 2. Enrich with ATTOM data
    const attomResult = await attomDataService.enrichLeadWithAttomData(lead.id);
    console.log(`2. ATTOM enrichment: ${attomResult ? 'Success' : 'Failed'}`);
    
    // 3. Skip trace the lead
    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id }
    });
    
    const request = {
      fullName: updatedLead.ownerName || 'Unknown Owner',
      address: updatedLead.propertyAddress,
      city: updatedLead.city,
      state: updatedLead.state,
      zipCode: updatedLead.zipCode
    };
    
    const skipTraceResult = await skipTraceService.runSkipTrace(lead.id, request);
    console.log(`3. Skip trace: ${skipTraceResult.success ? 'Success' : 'Failed'}`);
    
    // 4. Get final lead data
    const finalLead = await prisma.lead.findUnique({
      where: { id: lead.id }
    });
    
    console.log('4. Final lead data:');
    console.log(`   - Property: ${finalLead.propertyAddress}, ${finalLead.city}, ${finalLead.state}`);
    console.log(`   - ATTOM ID: ${finalLead.attomPropertyId || 'Not found'}`);
    console.log(`   - Owner: ${finalLead.ownerName || 'Unknown'}`);
    console.log(`   - Skip traced: ${finalLead.skipTracedAt ? 'Yes' : 'No'}`);
    
    const phones = finalLead.phones ? JSON.parse(finalLead.phones) : [];
    const emails = finalLead.emails ? JSON.parse(finalLead.emails) : [];
    
    console.log(`   - Phones found: ${phones.length}`);
    console.log(`   - Emails found: ${emails.length}`);
    
    return {
      leadId: lead.id,
      success: skipTraceResult.success && !!attomResult,
      phonesFound: phones.length,
      emailsFound: emails.length
    };
  } catch (error) {
    console.error('Test failed with error:', error);
    return { success: false, error: error.message };
  }
}

testFullWorkflow()
  .then(result => {
    console.log('\nTest results:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
```

Run the test:

```bash
cd backend
node test-integration.js
```

## UI Testing Procedures

### 1. ATTOM Property Search Component

1. Open the browser console (F12)
2. Navigate to the property search page
3. Enter test address: "1600 Pennsylvania Ave, Washington, DC 20500"
4. Click Search
5. Monitor network requests in the Network tab
6. Verify the request to the ATTOM API endpoint
7. Verify the response data is properly displayed

### 2. Skip Trace Button Component

1. Navigate to a lead details page
2. Open the browser console (F12)
3. Click the "Skip Trace" button
4. Monitor the network request to `/api/skip-trace/leads/{id}`
5. Verify the modal displays loading state during API call
6. Verify the results are properly displayed when complete

### 3. Bulk Skip Trace Modal

1. Navigate to the leads list page
2. Select 3+ leads using checkboxes
3. Click "Skip Trace Selected" button
4. Open browser console and monitor network requests
5. Verify the request to `/api/skip-trace/bulk`
6. Verify progress indication during processing
7. Verify summary statistics and results table when complete

## Performance Testing

### ATTOM API Performance

```bash
cd backend
node -e "
const { attomDataService } = require('./src/services');
const { performance } = require('perf_hooks');

async function testPerformance() {
  const addresses = [
    {street: '1600 Pennsylvania Ave', city: 'Washington', state: 'DC', zip: '20500'},
    {street: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118'},
    {street: '233 S Wacker Dr', city: 'Chicago', state: 'IL', zip: '60606'},
    {street: '200 N Spring St', city: 'Los Angeles', state: 'CA', zip: '90012'},
    {street: '2800 E Observatory Rd', city: 'Los Angeles', state: 'CA', zip: '90027'}
  ];
  
  const start = performance.now();
  
  for (const address of addresses) {
    const addressStart = performance.now();
    try {
      const result = await attomDataService.getPropertyByAddress(address);
      const addressTime = performance.now() - addressStart;
      console.log(`Address: ${address.street}, ${address.city}, ${address.state} - ${result ? 'Success' : 'Failed'} (${addressTime.toFixed(2)}ms)`);
    } catch (error) {
      console.error(`Error with ${address.street}: ${error.message}`);
    }
  }
  
  const totalTime = performance.now() - start;
  console.log(`\nTotal time for ${addresses.length} lookups: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per lookup: ${(totalTime / addresses.length).toFixed(2)}ms`);
}

testPerformance();
"
```

### Skip Trace API Performance

```bash
cd backend
node -e "
const { skipTraceService } = require('./src/services');
const { performance } = require('perf_hooks');

async function testPerformance() {
  const requests = [
    {leadId: 'perf_test_1', request: {fullName: 'John Smith', address: '123 Main St', city: 'San Francisco', state: 'CA', zipCode: '94102'}},
    {leadId: 'perf_test_2', request: {fullName: 'Jane Doe', address: '456 Oak Ave', city: 'Chicago', state: 'IL', zipCode: '60601'}},
    {leadId: 'perf_test_3', request: {fullName: 'Bob Johnson', address: '789 Pine St', city: 'New York', state: 'NY', zipCode: '10001'}},
    {leadId: 'perf_test_4', request: {fullName: 'Alice Brown', address: '321 Elm St', city: 'Boston', state: 'MA', zipCode: '02108'}},
    {leadId: 'perf_test_5', request: {fullName: 'Charlie Davis', address: '654 Maple Ave', city: 'Denver', state: 'CO', zipCode: '80202'}}
  ];
  
  const start = performance.now();
  
  for (const item of requests) {
    const itemStart = performance.now();
    try {
      const result = await skipTraceService.runSkipTrace(item.leadId, item.request);
      const itemTime = performance.now() - itemStart;
      console.log(`Lead: ${item.leadId} - ${result.success ? 'Success' : 'Failed'} (${itemTime.toFixed(2)}ms)`);
    } catch (error) {
      console.error(`Error with ${item.leadId}: ${error.message}`);
    }
  }
  
  const totalTime = performance.now() - start;
  console.log(`\nTotal time for ${requests.length} skip traces: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per skip trace: ${(totalTime / requests.length).toFixed(2)}ms`);
}

testPerformance();
"
```

## Load Testing

For load testing, create a test script that simulates multiple concurrent users making ATTOM and skip trace requests. This can be done using tools like Artillery or k6.

Example k6 script:

```javascript
// save as load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
};

export default function () {
  // Test ATTOM property search
  const propertyResponse = http.post('http://localhost:3001/api/property/search', {
    address: '1600 Pennsylvania Ave',
    city: 'Washington',
    state: 'DC',
    zipCode: '20500'
  });
  
  check(propertyResponse, {
    'property search status is 200': (r) => r.status === 200,
    'property data received': (r) => r.json().hasOwnProperty('propertyId'),
  });
  
  sleep(1);
  
  // Test skip trace endpoint
  const leadId = 'test_lead_1'; // This should be a valid lead ID in your test database
  const skipTraceResponse = http.post(`http://localhost:3001/api/skip-trace/leads/${leadId}`, {
    respectQuietHours: true
  });
  
  check(skipTraceResponse, {
    'skip trace status is 200': (r) => r.status === 200,
    'skip trace completed': (r) => r.json().hasOwnProperty('success'),
  });
  
  sleep(2);
}
```

Run load test:

```bash
k6 run load-test.js
```

## Error Cases to Test

1. **ATTOM API Errors:**
   - Invalid API key
   - Rate limit exceeded
   - Malformed address
   - No property found for address
   - Network timeout

2. **Skip Trace Errors:**
   - Invalid API key
   - Rate limit exceeded
   - Provider service down
   - Insufficient data for lookup
   - DNC compliance blocks

## Final Verification Checklist

Before completing testing, verify:

1. **ATTOM Integration:**
   - Property data is correctly stored in the database
   - Property data is displayed correctly in the UI
   - Error handling works for invalid addresses
   - Caching works as expected for repeat lookups

2. **Skip Trace Integration:**
   - Contact data is correctly stored in the database
   - Contact data is displayed correctly in the UI
   - Fallback providers work when primary fails
   - Compliance features (DNC, quiet hours) work correctly
   - Cost tracking is accurate

3. **Performance:**
   - API response times are acceptable under normal load
   - UI remains responsive during API calls
   - Batch operations can handle expected volume
