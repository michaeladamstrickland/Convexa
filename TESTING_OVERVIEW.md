# Testing Framework Overview

This document provides a complete overview of the testing resources available for verifying the FlipTracker ATTOM integration and Skip Trace functionality.

## Available Testing Resources

| Resource | Purpose | Target Users |
|----------|---------|-------------|
| [QUICK_START_TESTING.md](./QUICK_START_TESTING.md) | Quick start guide for immediate testing | All testers |
| [QA_TESTING_INSTRUCTIONS.md](./QA_TESTING_INSTRUCTIONS.md) | Comprehensive manual testing scenarios | QA team |
| [TECHNICAL_TESTING_GUIDE.md](./TECHNICAL_TESTING_GUIDE.md) | Technical implementation testing | Developers |
| [run-tests.bat](./run-tests.bat) / [run-tests.sh](./run-tests.sh) | Script to run automated tests | All testers |
| [run-integration-tests.js](./run-integration-tests.js) | NodeJS script that tests API integrations | Developers |

## Testing Strategy

Our testing approach follows a layered methodology to ensure complete coverage:

1. **API Integration Tests**
   - Verify connectivity to external APIs (ATTOM, BatchData, WhitePages)
   - Confirm data retrieval with test queries
   - Validate API key configurations

2. **Service Layer Tests**
   - Test service functions with mock and real data
   - Verify provider fallback mechanism
   - Test error handling and recovery

3. **UI Component Tests**
   - Verify proper rendering of all UI components
   - Test user interactions (button clicks, form submissions)
   - Confirm data display correctness

4. **End-to-End Tests**
   - Test complete user workflows
   - Verify data flows from UI through to external APIs and back
   - Test bulk operations with multiple records

## Environment Setup

All tests require the following environment variables to be configured:

```
# Required
ATTOM_API_KEY=your_attom_api_key_here
BATCH_SKIP_TRACING_API_KEY=your_batchdata_api_key_here

# Optional
WHITEPAGES_PRO_API_KEY=your_whitepages_api_key_here
```

These can be configured in a `.env` file in the project root. The test scripts will check for this file and create a template if one doesn't exist.

## Automated Testing

The `run-tests` script provides a simple way to verify both the ATTOM and Skip Trace integrations with minimal setup. It:

1. Checks for required environment variables
2. Tests connectivity to the ATTOM API
3. Tests single and bulk skip trace operations
4. Reports results with clear success/failure indicators

This is intended as a quick verification of the integration points, not a comprehensive test suite.

## Manual Testing Guides

For more thorough testing, refer to the following guides:

- **QA Testing Instructions**: Structured testing scenarios with step-by-step instructions
- **Technical Testing Guide**: Developer-focused testing for implementation verification

## Test Coverage Matrix

| Feature Area | Unit Tests | Integration Tests | UI Tests | Manual Tests |
|--------------|:----------:|:----------------:|:--------:|:------------:|
| ATTOM Property Search | ✅ | ✅ | ✅ | ✅ |
| ATTOM Batch Processing | ✅ | ✅ | ⚠️ | ✅ |
| Skip Trace - Single Lead | ✅ | ✅ | ✅ | ✅ |
| Skip Trace - Bulk | ✅ | ✅ | ✅ | ✅ |
| Provider Fallback | ✅ | ⚠️ | N/A | ✅ |
| Cost Tracking | ✅ | ✅ | ✅ | ✅ |
| Error Handling | ✅ | ✅ | ⚠️ | ✅ |

✅ = Full coverage
⚠️ = Partial coverage
N/A = Not applicable

## Test Result Reporting

When reporting test results, please include:

1. Test environment details (OS, browser if applicable)
2. Steps performed
3. Expected vs. actual results
4. Any error messages
5. Screenshots for UI issues

## Continuous Integration

These tests are designed to be incorporated into CI/CD pipelines. The automated tests can be run as part of pre-deployment verification.

## Troubleshooting Common Issues

### API Connection Failures

- Verify API keys are correctly configured
- Check for network connectivity issues
- Ensure API rate limits haven't been exceeded

### UI Component Issues

- Clear browser cache and reload
- Check browser console for JavaScript errors
- Verify correct component versions are loaded

### Data Issues

- Check input data formatting
- Verify expected response formats
- Test with known-good test data

## Contact for Support

For testing-related questions or issues, contact:

- **Technical Testing**: dev-team@fliptracker.example
- **QA Process**: qa-team@fliptracker.example
