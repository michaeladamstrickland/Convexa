# ATTOM + BatchData Implementation Plan

## Overview

This implementation plan outlines how we'll integrate the ATTOM Property Data API and BatchData Skip Tracing service into our FlipTracker application. The goal is to provide real property data and owner contact information to help investors identify and reach out to potential sellers.

## Architecture

```
┌───────────────┐       ┌──────────────┐       ┌──────────────┐
│  Frontend UI  │ ─────▶│   API Layer  │ ─────▶│ Data Services│
└───────────────┘       └──────────────┘       └──────────────┘
                              │                       │
                              ▼                       ▼
                        ┌──────────────┐       ┌──────────────┐
                        │  Controllers │       │ ATTOM Client │
                        └──────────────┘       └──────────────┘
                              │                       │
                              │                       ▼
                              │               ┌──────────────┐
                              └──────────────▶│ Batch Client │
                                              └──────────────┘
```

## Components

1. **ATTOM Client**
   - Handles property lookups by address and ZIP code
   - Includes retry logic and error handling
   - Normalizes property data into our Lead model
   
2. **Batch Skip Trace Client**
   - Handles owner information lookups
   - Includes rate limiting and error handling
   - Provides phone and email extraction
   
3. **Address Normalization Utility**
   - Standardizes addresses to prevent duplicates
   - Handles parsing and formatting
   
4. **Unified Search Controller**
   - Integrates ATTOM and BatchData APIs
   - Orchestrates workflow between services
   - Handles cost tracking and rate limiting

5. **Database Schema Updates**
   - Added fields for normalized addresses
   - Added fields for skip tracing data
   - Added temperature tags for lead classification
   - Added cost tracking fields

## Implementation Steps

### Phase 1: Core Integration

1. ✅ Update Prisma Schema
2. ✅ Create ATTOM Client
3. ✅ Create BatchData Skip Trace Service
4. ✅ Create Address Normalization Utility
5. ✅ Create Unified Search Controller
6. ✅ Create database migration
7. ✅ Update API endpoints

### Phase 2: Cost Tracking & Analysis

1. □ Implement cost tracking for API calls
2. □ Add admin dashboard to monitor usage
3. □ Create cost analysis reports
4. □ Implement budget limits and notifications

### Phase 3: Frontend Updates

1. □ Add property search by ZIP
2. □ Create property details view
3. □ Implement skip tracing UI
4. □ Add cost display and warnings

### Phase 4: Testing & Optimization

1. □ Create unit tests for all services
2. □ Implement integration tests
3. □ Optimize API usage to minimize costs
4. □ Add caching for common requests

## API Usage

### ATTOM API

- Endpoints used:
  - `/property/address` - Property details by address
  - `/property/basicprofile` - Basic property information
  - `/search/property` - Search by ZIP code

- Cost structure:
  - Basic lookups: $0.XX per call
  - Detailed lookups: $0.XX per call
  - Monthly minimum: $XXX

### BatchData API

- Endpoints used:
  - `/v1/property/skip` - Skip tracing by address
  - `/v1/batch/upload` - Batch skip tracing

- Cost structure:
  - Single lookups: $0.XX per call
  - Batch processing: $0.XX per record
  - No monthly minimum

## Budget & Cost Controls

- Set daily/weekly/monthly budget caps
- Implement tiered search strategy to minimize costs
- Cache results to prevent duplicate lookups
- Track cost per lead acquisition

## Success Metrics

1. Cost per contact acquired
2. Data accuracy rate
3. Conversion rate from data to deals
4. ROI on data service costs
