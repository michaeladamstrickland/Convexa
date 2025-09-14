# QA Testing Instructions: ATTOM Implementation & Skip Tracing

## Prerequisites

Before beginning testing, ensure you have:

1. A local development environment with the FlipTracker application running
2. Valid API keys configured in your `.env` file:
   - `ATTOM_API_KEY` - For ATTOM property data API
   - `BATCH_SKIP_TRACING_API_KEY` - For BatchData skip tracing
   - `WHITEPAGES_PRO_API_KEY` - For WhitePages Pro (optional fallback)
3. A test user account with admin permissions
4. Chrome or Firefox with developer tools enabled

## Environment Setup

1. Clone the repository if you haven't already:
   ```bash
   git clone https://github.com/michaeladamstrickland/FlipTracker.git
   cd FlipTracker/flip_tracker_full/leadflow_ai
   ```

2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Create or update your `.env` file with the required API keys:
   ```
   ATTOM_API_KEY=your_attom_api_key
   BATCH_SKIP_TRACING_API_KEY=your_batchdata_api_key
   WHITEPAGES_PRO_API_KEY=your_whitepages_api_key
   SKIP_TRACE_DAILY_QUOTA=100
   MAX_BATCH_SKIP_TRACE_SIZE=10
   ```

4. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

5. In a new terminal, start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Part 1: ATTOM Implementation Testing

### Test Case 1: Property Search by Address

1. Navigate to the Property Search page
2. Enter a valid US address (e.g., "1600 Pennsylvania Ave, Washington, DC 20500")
3. Click "Search"

**Expected Result:**
- Property details should load with information from ATTOM API
- Details should include property characteristics, valuation, and owner information
- No API errors should appear in the console

### Test Case 2: Batch Property Import

1. Navigate to the Lead Import page
2. Upload a CSV file containing addresses (use `test-data/sample-addresses.csv`)
3. Select "Enrich with ATTOM data" option
4. Click "Import"

**Expected Result:**
- Import should process successfully
- Progress indicator should show completion percentage
- Imported leads should contain ATTOM property data
- Summary should show successful/failed records

### Test Case 3: Property Details Page

1. Search for a property or select an existing lead
2. Navigate to the property details page
3. Verify the "Property Data" tab

**Expected Result:**
- ATTOM property data should be displayed in organized sections
- All fields should be correctly formatted (currency, dates, addresses)
- "Last Updated" timestamp should reflect when the data was retrieved

### Test Case 4: ATTOM API Error Handling

1. Temporarily modify your `.env` file to include an invalid ATTOM API key
2. Restart the backend server
3. Attempt to search for a property

**Expected Result:**
- System should display a user-friendly error message
- Error should be logged in the backend console
- UI should not crash or display raw error data to the user

### Test Case 5: ATTOM Data Refresh

1. Find a lead with existing ATTOM data
2. Note the "Last Updated" timestamp
3. Click the "Refresh Property Data" button

**Expected Result:**
- System should make a new API call to ATTOM
- Data should refresh with a new timestamp
- Any changes to the property data should be reflected

## Part 2: Skip Tracing Testing

### Test Case 6: Single Lead Skip Tracing

1. Navigate to the lead details page for a lead without contact info
2. Click the "Skip Trace" button
3. In the modal, leave "Respect quiet hours" checked
4. Click "Run Trace"

**Expected Result:**
- Skip trace process should begin with a loading indicator
- Upon completion, contact information should display (phones and emails)
- Results should show confidence scores and provider information
- Cost should be displayed
- DNC flags should be visible if applicable

### Test Case 7: Bulk Skip Tracing

1. Navigate to the leads list page
2. Select 3-5 leads using the checkboxes
3. Click "Skip Trace Selected" in the bulk actions menu
4. Review the confirmation dialog showing selected leads count
5. Click "Start Bulk Trace"

**Expected Result:**
- Progress indicator should show batch processing status
- Upon completion, summary stats should display (success/failure counts)
- Cost summary should be accurate
- Results table should show status for each lead
- Lead list should update with new contact information icons

### Test Case 8: Skip Trace Fallback Testing

1. Modify the `.env` file to simulate a primary provider failure:
   ```
   SKIP_TRACE_PRIMARY_PROVIDER=invalid_provider
   SKIP_TRACE_FALLBACK_ENABLED=true
   ```
2. Restart the backend server
3. Attempt to skip trace a lead

**Expected Result:**
- System should attempt the primary provider, fail, and try the fallback
- Backend logs should show the fallback process
- Results should eventually come from a secondary provider
- Provider information in the UI should reflect the successful provider

### Test Case 9: Compliance Features

1. Find a lead in a timezone where it's currently outside calling hours (before 8 AM or after 9 PM local time)
2. Attempt to skip trace with "Respect quiet hours" enabled

**Expected Result:**
- System should identify the quiet hours restriction
- Results should display a "Quiet hours enforced" notification
- DNC-flagged numbers should be properly marked

### Test Case 10: Skip Trace Metrics Dashboard

1. Navigate to the Dashboard page
2. Locate the Skip Trace Metrics widget

**Expected Result:**
- Widget should display key metrics (traces run, hit rate, cost, CPCL)
- Provider breakdown should show metrics by provider
- Data should match the actual skip trace operations performed
- No errors should appear in the console

### Test Case 11: Lead Contacts Panel

1. Find a lead that has been skip traced
2. Navigate to the lead details page
3. View the Contacts panel

**Expected Result:**
- Best contacts section should highlight high-confidence contacts
- Phone numbers should display with type and confidence score
- Emails should display with confidence score
- DNC flags should be visible if applicable
- Action buttons (Call, Text, Email, etc.) should be present

### Test Case 12: API Rate Limiting

1. Attempt to skip trace the same lead multiple times in quick succession

**Expected Result:**
- System should prevent duplicate skip traces within a short timeframe
- Error message should inform the user of the rate limit
- Backend logs should record the rate limiting event

## Part 3: Integration Testing

### Test Case 13: Full Lead Workflow with ATTOM and Skip Tracing

1. Start with a fresh lead import using only addresses
2. Enrich the leads with ATTOM data
3. Select the enriched leads
4. Perform a bulk skip trace
5. View the lead details

**Expected Result:**
- Complete workflow should execute without errors
- Leads should contain both property data and contact information
- UI should present a cohesive view of all gathered data

### Test Case 14: Cost Tracking

1. Navigate to the Costs/Billing page
2. View the API usage section

**Expected Result:**
- ATTOM API calls should be logged with costs
- Skip trace operations should be logged with costs
- Cost tracking should match the operations performed

## Reporting Issues

For any issues discovered during testing, please document:

1. Test case number and name
2. Steps to reproduce
3. Expected result
4. Actual result
5. Environment details (browser, OS)
6. Screenshots if applicable
7. Console logs if applicable

Submit issue reports to the development team through the project management system.

## Test Data

Sample test addresses that should work well with both ATTOM and skip tracing:

1. 1600 Pennsylvania Ave, Washington, DC 20500
2. 350 5th Ave, New York, NY 10118
3. 233 S Wacker Dr, Chicago, IL 60606
4. 200 N Spring St, Los Angeles, CA 90012
5. 2800 E Observatory Rd, Los Angeles, CA 90027
