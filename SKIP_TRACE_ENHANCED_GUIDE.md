# Skip Trace Enhanced Implementation Guide

## Overview

This document outlines the enhanced skip tracing system implemented in FlipTracker's LeadFlow AI component. The system provides robust contact information discovery for property leads with multiple provider support, data persistence, compliance features, and analytics.

## Features

### Core Functionality
- **Multi-Provider Support**: Primary (BatchData) and fallback (WhitePages) providers
- **Cost Control**: Set maximum cost per lookup and track usage
- **Data Persistence**: Phone numbers and emails stored in SQLite database
- **Contact Prioritization**: Identifies primary phone numbers and emails
- **Compliance Features**: DNC list checking and quiet hours enforcement

### Advanced Features
- **Retry Logic**: Smart fallback between providers with configurable retry parameters
- **Cache System**: Prevent redundant lookups and reduce API costs
- **Analytics**: Track usage, success rates, and costs across providers
- **Rate Limiting**: Prevent excessive API usage
- **Phone Normalization**: Standardize phone formats for consistency

## Technical Implementation

### Database Schema

The implementation uses SQLite with the following tables:

1. `phone_numbers` - Stores discovered phone numbers
   - `id` - Primary key
   - `lead_id` - Reference to property lead
   - `number` - Standardized phone number
   - `type` - Type (mobile, landline, etc.)
   - `is_primary` - Whether this is a primary contact number
   - `provider` - Which service found this number
   - `confidence` - Confidence score (0-100)
   - `last_updated` - When this record was last updated

2. `email_addresses` - Stores discovered email addresses
   - `id` - Primary key
   - `lead_id` - Reference to property lead
   - `address` - Email address
   - `type` - Type (personal, work, etc.)
   - `is_primary` - Whether this is a primary contact email
   - `provider` - Which service found this email
   - `confidence` - Confidence score (0-100)
   - `last_updated` - When this record was last updated

3. `skip_trace_logs` - Records all skip trace operations
   - `id` - Primary key
   - `lead_id` - Reference to property lead
   - `provider` - Provider used
   - `success` - Whether the lookup succeeded
   - `cost` - Cost of this lookup
   - `timestamp` - When the lookup occurred
   - `details` - Additional lookup details (JSON)

4. `contact_attempts` - Tracks all contact attempts
   - `id` - Primary key
   - `lead_id` - Reference to property lead
   - `contact_type` - Type (call, email, text)
   - `contact_id` - Reference to phone or email
   - `timestamp` - When contact was attempted
   - `success` - Whether contact attempt succeeded
   - `notes` - Additional context

5. `provider_quota_usage` - Tracks API usage by provider
   - `id` - Primary key
   - `provider` - Provider name
   - `calls_today` - Number of API calls today
   - `calls_month` - Number of API calls this month
   - `cost_today` - Total cost today
   - `cost_month` - Total cost this month
   - `last_reset` - When counters were last reset

### API Endpoints

#### Core Endpoints
- `POST /api/skip-trace/lookup` - Main skip trace endpoint
  - Parameters:
    - `leadId` - ID of the lead to skip trace
    - `preferredProvider` - Which provider to try first ('batch', 'whitepages', 'auto')
    - `maxCost` - Maximum cost allowed for this lookup
    - `includeEmails` - Whether to include email lookups
    - `skipCache` - Whether to bypass the cache
    - `enforceDNC` - Whether to enforce DNC compliance

- `GET /api/skip-trace/lookup/{leadId}` - Get existing skip trace data for a lead

#### Compliance Endpoints
- `GET /api/skip-trace/compliance/check/{phoneNumber}` - Check if a number is DNC listed
- `GET /api/skip-trace/compliance/quiet-hours` - Check if current time is within quiet hours

#### Analytics Endpoints
- `GET /api/skip-trace/analytics/stats` - Get overall usage statistics
- `GET /api/skip-trace/analytics/costs` - Get cost breakdown by provider
- `GET /api/skip-trace/analytics/success-rates` - Get success rate statistics

### Environment Configuration

The following environment variables are used:

```
# API Keys
BATCH_DATA_API_KEY=your-batchdata-api-key
WHITE_PAGES_API_KEY=your-whitepages-api-key

# Provider Configuration
DEFAULT_PROVIDER=batch
MAX_PROVIDER_RETRIES=2
ENABLE_FALLBACK_PROVIDER=true

# Cost Control
MAX_COST_PER_LOOKUP=1.50
MONTHLY_BUDGET=500

# Compliance
ENFORCE_DNC_LIST=true
ENFORCE_QUIET_HOURS=true
QUIET_HOURS_START=21
QUIET_HOURS_END=9
QUIET_HOURS_TIMEZONE=America/New_York
```

## Testing

A comprehensive test script (`test-skip-trace.js`) is provided to validate the implementation, with tests for:

1. Database schema validation
2. API integration testing
3. DNC compliance checking
4. Analytics reporting

Run tests using the included batch file:
```
test-skip-trace.bat
```

## Next Steps

1. **Frontend Integration**: Add UI components to display and manage skip trace data
2. **Additional Providers**: Integrate with more skip trace providers for better coverage
3. **Machine Learning**: Implement predictive models to optimize provider selection
4. **Bulk Processing**: Add support for batch processing of leads
