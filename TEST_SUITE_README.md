# Convexa AI Test Suite

This document provides instructions for running the test suite for the Convexa AI scraper system.

## Available Test Scripts

The following test scripts have been implemented to validate the functionality of various components:

1. **Scraper Tests** (`test-scrapers.ts`): Tests the functionality of the Zillow and Auction.com scrapers
2. **Scheduler Tests** (`test-scheduler.ts`): Tests the job scheduler functionality
3. **API Endpoint Tests** (`test-api-endpoints.ts`): Tests the API endpoints for schedule management
4. **WebSocket Tests** (`test-websocket.ts`): Tests real-time updates via WebSockets

## Running Tests

We've added several npm scripts to make running tests easier:

### Interactive Test Launcher

The easiest way to run tests is to use the interactive test launcher:

```bash
# Launch the interactive test menu
npm run test:launcher
```

This will display a menu of options for running different test combinations.

### Prepare Tests

Before running the tests, it's recommended to run the preparation script which checks for dependencies and fixes common import path issues:

```bash
# Prepare the tests for running
npm run test:prepare
```

### Run Specific Test Components

```bash
# Test the scraper functionality
npm run test:scraper

# Test the scheduler functionality
npm run test:scheduler

# Test the API endpoints
npm run test:api

# Test WebSocket functionality
npm run test:websocket
```

### Run All Tests

```bash
# Run all test scripts
npm run test:all

# Run all tests with cleanup (removes test data after API tests)
npm run test:clean
```

## Test Configuration

The master test script (`run-tests.js`) supports the following command-line arguments:

- `--scrapers`: Run only the scraper tests
- `--scheduler`: Run only the scheduler tests
- `--api`: Run only the API endpoint tests
- `--websocket`: Run only the WebSocket tests
- `--all`: Run all tests (default if no arguments are provided)
- `--cleanup`: Clean up test data after running tests

## Test Output

The test output is color-coded for better readability:
- Green: Successful tests
- Red: Failed tests
- Blue: Currently running test
- Cyan: Section separators

## Troubleshooting

If you encounter issues with the tests:

1. Make sure all dependencies are installed: `npm install`
2. Ensure the database is properly set up: `npm run db:setup`
3. Check that the server is not already running on the ports used by the tests
4. Look for error messages in the test output for specific issues

## Adding New Tests

When adding new test files:
1. Create a new TypeScript file with the naming pattern `test-*.ts`
2. Update `run-tests.js` to include your new test
3. Add a corresponding npm script to package.json

## Expected Test Coverage

- Zillow FSBO Scraper: All methods tested with sample data
- Auction.com Scraper: All methods tested with sample data
- Job Scheduler: Schedule creation, loading, and execution tested
- API Endpoints: All CRUD operations for schedules tested
- WebSockets: Real-time updates of scraper status tested
