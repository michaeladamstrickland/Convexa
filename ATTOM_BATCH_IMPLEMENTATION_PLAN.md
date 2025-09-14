# LeadFlow AI — ATTOM + Batch Skip Trace Implementation Plan

## Implementation Timeline

| Phase | Task | Timeframe | Status |
|-------|------|-----------|--------|
| **1** | **Environment & Database Setup** | **Day 1** | 🟡 In Progress |
| 1.1 | Configure environment variables | 2 hours | ⚪ Not Started |
| 1.2 | Update Prisma schema | 3 hours | ⚪ Not Started |
| 1.3 | Create and run migrations | 1 hour | ⚪ Not Started |
| 1.4 | Update system status endpoint | 1 hour | ⚪ Not Started |
| **2** | **ATTOM Client Implementation** | **Days 2-3** | ⚪ Not Started |
| 2.1 | Create ATTOM client service | 4 hours | ⚪ Not Started |
| 2.2 | Implement caching mechanism | 3 hours | ⚪ Not Started |
| 2.3 | Add cost tracking | 2 hours | ⚪ Not Started |
| 2.4 | Implement daily cap functionality | 2 hours | ⚪ Not Started |
| 2.5 | Create address normalization util | 2 hours | ⚪ Not Started |
| **3** | **Batch Skip Tracing Integration** | **Days 4-5** | ⚪ Not Started |
| 3.1 | Create Batch API client | 4 hours | ⚪ Not Started |
| 3.2 | Implement skip trace service | 4 hours | ⚪ Not Started |
| 3.3 | Add budget guard and cost tracking | 2 hours | ⚪ Not Started |
| 3.4 | Implement retry mechanism | 2 hours | ⚪ Not Started |
| 3.5 | Optional: Add Twilio validation | 3 hours | ⚪ Not Started |
| **4** | **Backend Controllers & Routes** | **Day 6** | ⚪ Not Started |
| 4.1 | Update unified search controller | 3 hours | ⚪ Not Started |
| 4.2 | Create skip trace endpoint | 3 hours | ⚪ Not Started |
| 4.3 | Update AI scoring to map temperatures | 2 hours | ⚪ Not Started |
| **5** | **Frontend Integration** | **Days 7-8** | ⚪ Not Started |
| 5.1 | Update search page with ATTOM toggle | 2 hours | ⚪ Not Started |
| 5.2 | Enhance lead row with skip trace button | 2 hours | ⚪ Not Started |
| 5.3 | Update Kanban board with contactable pill | 2 hours | ⚪ Not Started |
| 5.4 | Enhance CSV export | 2 hours | ⚪ Not Started |
| **6** | **Testing & QA** | **Day 9** | ⚪ Not Started |
| 6.1 | Unit tests for ATTOM client | 3 hours | ⚪ Not Started |
| 6.2 | Unit tests for skip trace service | 3 hours | ⚪ Not Started |
| 6.3 | Integration tests | 4 hours | ⚪ Not Started |
| 6.4 | Frontend smoke tests | 2 hours | ⚪ Not Started |
| **7** | **Deployment & Rollout** | **Day 10** | ⚪ Not Started |
| 7.1 | Environment setup on production | 2 hours | ⚪ Not Started |
| 7.2 | Run migrations | 1 hour | ⚪ Not Started |
| 7.3 | Live dry run with limited cap | 2 hours | ⚪ Not Started |
| 7.4 | Monitor cost analytics | 1 hour | ⚪ Not Started |
| 7.5 | Final adjustments | 2 hours | ⚪ Not Started |

## Detailed Implementation Tasks

### Phase 1: Environment & Database Setup

#### 1.1 Configure Environment Variables
- Add to `backend/.env`:
  ```
  ATTOM_API_KEY=...
  BATCHDATA_API_KEY=...
  BATCHDATA_BASE_URL=https://api.batchdata.com/v1
  TWILIO_API_KEY=...                      # optional
  DAILY_CAP_ATTOM_CENTS=1500
  DAILY_CAP_BATCH_CENTS=2000
  CACHE_TTL_SECONDS=900
  ```
- Add to `frontend/.env`:
  ```
  VITE_ATTOM_ENABLED=true
  VITE_SKIPTRACE_ENABLED=true
  ```
- Add to `.env.example` files for documentation

#### 1.2 Update Prisma Schema
- Add the following fields to Lead model:
  ```prisma
  model Lead {
    // Existing fields...
    
    source            String?
    ai_score          Int?
    temperature_tag   String?
    phones_json       String?     // JSON array
    emails_json       String?     // JSON array
    skip_trace_provider String?
    skip_trace_cost_cents Int?
    skip_traced_at    DateTime?
    ai_cost_cents     Int?
    ai_scored_at      DateTime?
    dnc_flag          Boolean?    @default(false)
    
    @@index([normalized_address, owner_name])  // For deduplication
  }
  ```

#### 1.3 Create and Run Migrations
- Generate migration: `npx prisma migrate dev --name add_attom_batch_fields`
- Apply migration: `npx prisma migrate deploy`
- Update Prisma client: `npx prisma generate`

#### 1.4 Update System Status Endpoint
- Modify `/api/system/status` to include:
  ```typescript
  {
    attomEnabled: !!process.env.ATTOM_API_KEY,
    skipTraceEnabled: !!process.env.BATCHDATA_API_KEY,
    caps: {
      attom: parseInt(process.env.DAILY_CAP_ATTOM_CENTS || '1500'),
      batch: parseInt(process.env.DAILY_CAP_BATCH_CENTS || '2000')
    },
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '900')
  }
  ```

### Phase 2: ATTOM Client Implementation

#### 2.1 Create ATTOM Client Service
- Create `src/services/attomClient.ts`:
  - Implement `getByGeo({ city?, state?, zip?, county?, page, pageSize })`
  - Set timeouts (5-8s)
  - Implement retries with backoff (250ms → max 3)
  - Normalize response shape

#### 2.2 Implement Caching Mechanism
- Create in-memory LRU cache
- Key by query parameters
- Use `CACHE_TTL_SECONDS` for expiration
- Add cache hit/miss logging

#### 2.3 Add Cost Tracking
- Create cost tracking service
- Increment `spend.attom.cents` for each API call
- Store daily spend in database

#### 2.4 Implement Daily Cap Functionality
- Check current spend before making API call
- Throw 429 error if cap would be exceeded
- Add logging for cap hits

#### 2.5 Create Address Normalization Util
- Create `src/utils/addressNormalization.ts`
- Implement address standardization
- Add deduplication logic based on normalized address and owner name

### Phase 3: Batch Skip Tracing Integration

#### 3.1 Create Batch API Client
- Create `src/services/batchDataClient.ts`
- Implement property skip trace method
- Handle API authentication
- Parse response into standard format

#### 3.2 Implement Skip Trace Service
- Create `src/services/skipTraceService.ts`
- Get lead by ID and extract address & owner
- Call Batch API and process response
- Store results in `phones_json`, `emails_json`, etc.
- Update lead with timestamp and provider info

#### 3.3 Add Budget Guard and Cost Tracking
- Track skip trace costs in database
- Check daily cap before making API call
- Throw 429 if cap would be exceeded

#### 3.4 Implement Retry Mechanism
- Add up to 2 retries with jitter
- Treat 4xx errors as final
- Log all retry attempts

#### 3.5 Optional: Add Twilio Validation
- Create `src/services/twilioClient.ts`
- Validate phone numbers using Twilio Lookup
- Enrich phone data with type (mobile/landline/voip)
- Handle cost tracking and daily cap

### Phase 4: Backend Controllers & Routes

#### 4.1 Update Unified Search Controller
- Modify `/api/search` endpoint to support ATTOM parameters
- Check if ATTOM is enabled
- Call ATTOM service when appropriate parameters are provided
- Normalize and persist results
- Return paginated results with source metadata

#### 4.2 Create Skip Trace Endpoint
- Create `/api/leads/:id/skiptrace` endpoint
- Call skip trace service
- Return updated lead with contact information
- Include cost information in response

#### 4.3 Update AI Scoring to Map Temperatures
- Ensure AI scoring works with or without OpenAI key
- Track token usage and costs
- Map scores to temperature tags:
  - 0-39: DEAD
  - 40-64: WARM
  - 65-84: HOT
  - 85-100: ON_FIRE

### Phase 5: Frontend Integration

#### 5.1 Update Search Page with ATTOM Toggle
- Add ATTOM toggle chip to search form
- Display data source in result header
- Show temperature badges on results

#### 5.2 Enhance Lead Row with Skip Trace Button
- Add Skip Trace button to lead rows
- Open SkipTraceModal on click
- Show badges for best phone and skip trace status

#### 5.3 Update Kanban Board with Contactable Pill
- Add "Contactable" pill to cards with phone/email
- Ensure drag-and-drop still works correctly

#### 5.4 Enhance CSV Export
- Update export to include new fields:
  - `source`
  - `skip_trace_provider`
  - `best_phone`
  - `all_phones`
  - `emails`
  - `dnc_flag`

### Phase 6: Testing & QA

#### 6.1 Unit Tests for ATTOM Client
- Test pagination merge
- Test cache hit/miss
- Test retry on 429/5xx errors
- Test address normalization

#### 6.2 Unit Tests for Skip Trace Service
- Test mapping of Batch response
- Test writing of contact data
- Test cost tracking
- Test budget cap enforcement

#### 6.3 Integration Tests
- Test `/api/search` with ATTOM parameters
- Test `/api/leads/:id/skiptrace` endpoint
- Mock external APIs for consistent testing

#### 6.4 Frontend Smoke Tests
- Test search form with ATTOM toggle
- Test skip trace flow
- Test CSV export with new fields

### Phase 7: Deployment & Rollout

#### 7.1 Environment Setup on Production
- Add environment variables to production
- Update documentation

#### 7.2 Run Migrations
- Apply database migrations to production
- Verify schema changes

#### 7.3 Live Dry Run with Limited Cap
- Set low caps initially ($10/day/provider)
- Test with small ZIP code (85034)
- Monitor API calls and responses

#### 7.4 Monitor Cost Analytics
- Check cost analytics dashboard
- Verify tracking accuracy
- Adjust caps if needed

#### 7.5 Final Adjustments
- Address any issues found during rollout
- Optimize performance if needed
- Update documentation with final changes

## Success Metrics

- **Technical:**
  - 95%+ API success rate
  - <1s average response time
  - <5% duplicate leads
  - 100% accurate cost tracking

- **Business:**
  - 50+ new contactable leads per day
  - 80%+ leads with valid phone numbers
  - <$0.50 average cost per contactable lead
