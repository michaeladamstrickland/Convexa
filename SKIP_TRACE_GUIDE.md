# Enhanced Skip Trace System Guide

The FlipTracker Skip Trace System has been completely enhanced with production-grade features including multiple providers, persistent storage, phone normalization, compliance features, and analytics.

## Features

- **Multi-Provider Support**: Primary (BatchData) and fallback (WhitePages) providers
- **Persistent Storage**: Normalized phone and email storage in database
- **E.164 Phone Normalization**: International standard phone number formatting
- **DNC Compliance**: Do Not Call list checking and enforcement
- **Contact Attempt Logging**: Compliance tracking for all contact attempts
- **Quota Management**: Daily quota tracking and enforcement
- **Cost Analytics**: Detailed cost tracking by provider
- **Retry Logic**: Automatic retries for failed skip traces

## Setup

1. **Run the Setup Script**:

   ```bash
   # On Windows
   setup-skip-trace.bat

   # On Unix/Linux/Mac
   ./setup-skip-trace.sh
   ```

2. **Configure API Keys**:

   Add your API keys to the `.env` file:

   ```properties
   # BatchData (Primary Provider)
   BATCHDATA_API_KEY=your_batchdata_api_key
   BATCHDATA_API_URL=https://api.batchdata.com/api

   # WhitePages (Fallback Provider)
   WHITEPAGES_API_KEY=your_whitepages_api_key
   WHITEPAGES_API_URL=https://api.whitepages.com/3.3/person
   ```

3. **Configure Settings**:

   Customize skip trace settings in `.env`:

   ```properties
   # Skip Trace Settings
   SKIP_TRACE_DAILY_QUOTA=100
   SKIP_TRACE_CACHE_DAYS=7
   SKIP_TRACE_MAX_RETRIES=2
   SKIP_TRACE_RETRY_DELAY_MS=2000
   SKIP_TRACE_PRIMARY_PROVIDER=batchdata
   SKIP_TRACE_FALLBACK_ENABLED=true

   # Compliance Settings
   ENFORCE_QUIET_HOURS=true
   DEFAULT_TIMEZONE=America/New_York
   ```

## API Endpoints

### Get Skip Trace Data

```
GET /api/skip-trace/:leadId
```

Query Parameters:
- `compliance` - Set to `true` to check DNC compliance

### Run Skip Trace

```
POST /api/skip-trace
```

Request Body:
```json
{
  "leadId": "123",
  "forceRefresh": false,
  "provider": "batchdata",
  "useFallback": true,
  "fallbackProvider": "whitepages"
}
```

### Run Bulk Skip Trace

```
POST /api/skip-trace/bulk
```

Request Body:
```json
{
  "leadIds": ["123", "456", "789"],
  "forceRefresh": false,
  "provider": "batchdata",
  "useFallback": true,
  "fallbackProvider": "whitepages"
}
```

### Check DNC Compliance

```
GET /api/skip-trace/compliance/check/:phoneNumber
```

### Log Contact Attempt

```
POST /api/skip-trace/contact-attempt
```

Request Body:
```json
{
  "leadId": "123",
  "contactType": "CALL",
  "contactInfo": "+14155552671",
  "userId": "user_123",
  "notes": "Left voicemail",
  "overrideReason": null
}
```

### Force Refresh Skip Trace

```
POST /api/skip-trace/refresh/:leadId
```

### Get Skip Trace Analytics

```
GET /api/skip-trace/analytics/stats
```

Query Parameters:
- `startDate` - Format: YYYY-MM-DD
- `endDate` - Format: YYYY-MM-DD
- `provider` - Provider to filter by

## Database Schema

The enhanced skip trace system adds the following tables:

1. `phone_numbers`: Stores normalized E.164 phone numbers
2. `email_addresses`: Stores email addresses
3. `skip_trace_logs`: Audit and cost tracking
4. `contact_attempts`: Compliance tracking
5. `provider_quota_usage`: Quota tracking
6. Additional columns in `leads` table for skip trace data

## Best Practices

1. **Check Compliance**: Always check DNC compliance before making calls
2. **Log Contact Attempts**: Log all contact attempts for compliance tracking
3. **Use Bulk Skip Trace**: More efficient for processing multiple leads
4. **Monitor Quota**: Stay within your daily quota limits
5. **Track Costs**: Use the analytics endpoints to track skip trace costs

## Integration with Frontend

To integrate with the frontend:

1. Add skip trace buttons to lead detail pages
2. Create skip trace result modals showing phone/email
3. Implement DNC compliance indicators
4. Add bulk skip trace functionality to lead list pages
5. Create cost analytics dashboard

## Troubleshooting

1. **API Errors**: Check API keys in `.env` file
2. **Database Errors**: Run the setup script to ensure tables exist
3. **Quota Exceeded**: Check daily quota usage in analytics
4. **Missing Contact Data**: Verify lead has enough information (name/address)
5. **Compliance Errors**: Check DNC status and quiet hours
