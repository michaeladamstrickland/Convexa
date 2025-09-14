# Quick Start: ATTOM & Skip Trace Testing

This guide provides the quickest way to test both the ATTOM Property Data integration and Skip Tracing functionality in the FlipTracker application.

## Prerequisites

1. Clone the FlipTracker repository and navigate to the project folder
2. Ensure you have Node.js v16+ and npm installed
3. Configure your `.env` file with valid API keys (see below)

## Set Up Environment

1. Create or modify `.env` file with these essential values:

```
# Database
DATABASE_URL="file:./dev.db"

# API Keys
ATTOM_API_KEY=your_attom_api_key_here
BATCH_SKIP_TRACING_API_KEY=your_batchdata_api_key_here
WHITEPAGES_PRO_API_KEY=your_whitepages_api_key_here  # Optional

# Feature Flags
FEATURE_ATTOM_PROPERTY_DATA=true
FEATURE_SKIPTRACE_BATCHDATA=true
FEATURE_SKIPTRACE_FALLBACK=true
```

2. Install dependencies and start the development servers:

```bash
# Install backend dependencies
cd backend
npm install

# Start backend server
npm run dev

# In a new terminal, install frontend dependencies
cd ../frontend
npm install

# Start frontend server
npm run dev
```

## Quick Tests

### ATTOM Property Data Test

1. Open your browser to `http://localhost:3000`
2. Navigate to the Property Search page
3. Enter address: "1600 Pennsylvania Ave, Washington, DC 20500"
4. Click "Search"
5. Verify property details appear including:
   - Property characteristics
   - Owner information
   - Valuation
   - Last sale data

### Skip Trace Single Lead Test

1. Navigate to the Leads page
2. Select any lead or create a new one
3. Click the "Skip Trace" button
4. In the modal, click "Run Trace"
5. Verify the results show:
   - Phone numbers with confidence scores
   - Email addresses (if found)
   - Provider information and cost

### Skip Trace Bulk Test

1. Navigate to the Leads page
2. Select 2-3 leads using the checkboxes
3. Click "Skip Trace Selected" from the bulk actions menu
4. Click "Start Bulk Trace"
5. Verify the bulk process runs and shows:
   - Progress indicators
   - Summary statistics
   - Individual lead results

## Command-Line Testing

If you prefer testing via command line, run these commands:

### Test ATTOM Integration

```bash
cd backend
node -e "
const { attomDataService } = require('./src/services');

async function test() {
  try {
    const result = await attomDataService.getPropertyByAddress({
      street: '1600 Pennsylvania Ave',
      city: 'Washington',
      state: 'DC',
      zip: '20500'
    });
    console.log('Success!', result ? 'Property found' : 'No property found');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
"
```

### Test Skip Trace Integration

```bash
cd backend
node -e "
const { skipTraceService } = require('./src/services');

async function test() {
  try {
    const result = await skipTraceService.runSkipTrace(
      'test_lead_id',
      {
        fullName: 'John Smith',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102'
      }
    );
    console.log('Skip trace result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
"
```

## Run Automated Tests

We have automated tests for both integrations:

```bash
# Run ATTOM integration tests
cd backend
npm test -- --testPathPattern=attom

# Run Skip Trace integration tests  
npm test -- --testPathPattern=skipTrace
```

## Common Issues & Solutions

### ATTOM API Issues

1. **Error: Invalid API key**
   - Double-check your ATTOM_API_KEY in .env
   - Ensure it's activated for property lookups

2. **Error: No results found**
   - Try a well-known address like "1600 Pennsylvania Ave"
   - Check address format (include city, state, zip)

### Skip Trace API Issues

1. **Error: Provider authentication failed**
   - Verify your BATCH_SKIP_TRACING_API_KEY is correct
   - Check account status at BatchData's website

2. **Error: Rate limit exceeded**
   - Wait a few minutes before trying again
   - Check your plan limits with the provider

## Help & Support

If you encounter issues during testing:

1. Check the backend logs for detailed error messages
2. Open browser developer tools (F12) to see frontend errors
3. Contact the development team with specific error details

For more comprehensive testing instructions, see:
- [QA_TESTING_INSTRUCTIONS.md](./QA_TESTING_INSTRUCTIONS.md)
- [TECHNICAL_TESTING_GUIDE.md](./TECHNICAL_TESTING_GUIDE.md)
