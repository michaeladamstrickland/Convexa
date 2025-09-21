# Convexa AI - Database Structure

## Overview

Convexa AI uses a SQLite database with Prisma ORM for persistence. The database is structured to support:

1. **Lead Management** - Track leads with their property and owner information
2. **Skip Tracing** - Store skip trace results and contact data
3. **Campaign Management** - Manage outreach campaigns
4. **Usage Analytics** - Track API costs and system usage
5. **User Management** - Organization and user data

## Database Locations

- Main Prisma DB: `prisma/dev.db` - Managed by Prisma ORM
- Legacy SQLite DB: `data/leadflow.db` - Direct SQLite access
- Skip Trace DB: `data/skip_trace.db` - Stores skip trace results

## Entity Relationships

```
Organization 1 --- * User
Organization 1 --- * Lead
Lead 1 --- * LeadNote
Lead 1 --- * SkipTraceRecord
Lead 1 --- * CallLog
Lead 1 --- * CampaignLog
Campaign 1 --- * CampaignLog
```

## Prisma Schema

The primary data model is defined in `prisma/schema.prisma`:

### Core Entities

#### Organization
- Central entity that owns all data
- Contains plan information and usage tracking
- One-to-many relationship with Users and Leads

#### User
- Authentication and authorization
- Roles: admin, manager, user
- Belongs to an organization
- Can be assigned to leads

#### Lead
- Primary entity for lead management
- Contains property, owner, and valuation data
- Includes AI scoring and temperature tags
- Associated with notes, skip trace records, calls, and campaigns

### Supporting Entities

#### LeadNote
- Notes attached to leads
- Supports different note types (general, call, email, etc.)

#### SkipTraceRecord
- Tracks skip trace operations on leads
- Stores original request and provider response
- Includes confidence scores and cost tracking

#### Campaign & CampaignLog
- Manage outreach campaigns
- Track messages sent to leads
- Measure engagement metrics

#### CallLog
- Track calls made/received for leads
- Store call outcomes and recordings
- Include AI analysis of calls

#### PropertyRecord
- Store raw property data from various sources
- Used for deduplication and processing
- Separate from lead data

## Direct SQLite Schema (data/leadflow.db)

The direct SQLite database contains:

### leads
```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  source_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  motivation_score INTEGER NOT NULL DEFAULT 0,
  estimated_value REAL,
  equity REAL,
  condition_score INTEGER NOT NULL DEFAULT 50,
  tax_debt REAL NOT NULL DEFAULT 0,
  violations INTEGER NOT NULL DEFAULT 0,
  is_probate BOOLEAN NOT NULL DEFAULT 0,
  is_vacant BOOLEAN NOT NULL DEFAULT 0,
  days_on_market INTEGER,
  lead_score INTEGER NOT NULL DEFAULT 0,
  aiScore INTEGER,
  feedback_good INTEGER NOT NULL DEFAULT 0,
  feedback_bad INTEGER NOT NULL DEFAULT 0,
  phones TEXT NOT NULL DEFAULT '[]',
  emails TEXT NOT NULL DEFAULT '[]',
  raw_data TEXT,
  temperature_tag TEXT NOT NULL DEFAULT 'DEAD',
  status TEXT NOT NULL DEFAULT 'NEW',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL,
  skip_traced_at DATETIME,
  dnc_flag INTEGER NOT NULL DEFAULT 0,
  timezone TEXT,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  activity_log_json TEXT,
  skip_trace_provider TEXT,
  skip_trace_cost_cents INTEGER NOT NULL DEFAULT 0,
  ai_cost_cents INTEGER NOT NULL DEFAULT 0,
  ai_scored_at DATETIME
);
```

### api_cost_entries
```sql
CREATE TABLE api_cost_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apiType TEXT NOT NULL,
  cost REAL NOT NULL,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Skip Trace Database (data/skip_trace.db)

The skip trace database contains:

### skip_trace_results
```sql
CREATE TABLE skip_trace_results (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  request_data TEXT NOT NULL,
  response_data TEXT,
  confidence REAL,
  cost REAL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

### skip_trace_phones
```sql
CREATE TABLE skip_trace_phones (
  id TEXT PRIMARY KEY,
  skip_trace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_type TEXT,
  carrier TEXT,
  is_valid BOOLEAN DEFAULT 1,
  is_mobile BOOLEAN,
  is_dnc BOOLEAN DEFAULT 0,
  confidence REAL,
  FOREIGN KEY (skip_trace_id) REFERENCES skip_trace_results(id)
);
```

### skip_trace_emails
```sql
CREATE TABLE skip_trace_emails (
  id TEXT PRIMARY KEY,
  skip_trace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_type TEXT,
  is_valid BOOLEAN DEFAULT 1,
  confidence REAL,
  FOREIGN KEY (skip_trace_id) REFERENCES skip_trace_results(id)
);
```

## Database Access Patterns

The system uses several methods to access data:

1. **Prisma ORM** - Primary method for structured data access
2. **Direct SQLite** - Used for legacy code and performance-critical operations
3. **Raw SQL** - For complex queries and reports

## Migration Strategy

Convexa AI is currently transitioning from direct SQLite access to full Prisma ORM usage. The migration strategy involves:

1. Maintaining backward compatibility for existing features
2. Using Prisma for all new features
3. Gradually migrating legacy code to Prisma

## Database Relationships Diagram

```
┌─────────────────┐       ┌──────────────────┐
│  Organization   │       │      User        │
├─────────────────┤       ├──────────────────┤
│ id              │1     *│ id               │
│ name            ├───────┤ email            │
│ plan            │       │ password         │
│ monthlyLeadCount│       │ firstName        │
└─────────────────┘       │ lastName         │
        │                 │ role             │
        │                 │ organizationId   │
        │                 └──────────────────┘
        │                          │
        │                          │
        │                          │ assignedTo
        │1                         │
        │                          │
        │                ┌──────────────────┐
        └────────────────┤      Lead        │
                        *├──────────────────┤
                         │ id               │
                         │ address          │
                         │ ownerName        │
                         │ status           │
                         │ aiScore          │
                         │ temperatureTag   │
                         │ organizationId   │
                         └──────────────────┘
                                  │
                                  │
            ┌───────────┬─────────┴─────────┬───────────┐
            │           │                   │           │
    ┌──────────────┐    │            ┌────────────┐     │
    │  LeadNote    │    │            │ CallLog    │     │
    ├──────────────┤    │            ├────────────┤     │
   *│ id           │    │           *│ id         │     │
    │ content      │    │            │ direction  │     │
    │ type         │    │            │ duration   │     │
    │ leadId       │    │            │ transcript │     │
    └──────────────┘    │            │ leadId     │     │
                        │            └────────────┘     │
                        │                              │
               ┌─────────────────┐            ┌───────────────┐
               │SkipTraceRecord  │            │ CampaignLog   │
               ├─────────────────┤            ├───────────────┤
              *│ id              │           *│ id            │
               │ provider        │            │ status        │
               │ responseData    │            │ response      │
               │ confidence      │            │ campaignId    │
               │ cost            │            │ leadId        │
               │ leadId          │            └───────────────┘
               └─────────────────┘                   │
                                                     │
                                          ┌───────────────────┐
                                          │    Campaign       │
                                          ├───────────────────┤
                                          │ id                │
                                          │ name              │
                                          │ type              │
                                          │ message           │
                                          │ organizationId    │
                                          └───────────────────┘
```

## Database Optimization

The system uses several techniques to optimize database performance:

1. **WAL Mode** - Write-Ahead Logging for concurrent access
2. **Indexes** - On frequently queried fields
3. **Prepared Statements** - For query optimization
4. **Bulk Operations** - For efficient batch processing
5. **Connection Pooling** - For managing database connections
