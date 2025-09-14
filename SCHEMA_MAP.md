# LeadFlow — Schema Map

Timestamp (ET): 2025-08-16 12:00 ET

Scope
- Authoritative schema mapped from backend/prisma/schema.prisma (PostgreSQL).
- A second, divergent Prisma schema exists at prisma/schema.prisma (SQLite) for demo/local; see “Divergences” section.

---

## Mermaid ERD (Backend/PostgreSQL)

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Lead : owns
  Organization ||--o{ Campaign : owns
  Organization ||--o{ CallLog : owns

  User ||--o{ Lead : "AssignedTo (assignedToId)"
  User ||--o{ CallLog : "CreatedBy (createdById)"
  User ||--o{ CampaignLog : "actor (optional)"

  Lead ||--o{ LeadNote : has
  Lead ||--o{ SkipTraceRecord : has
  Lead ||--o{ CallLog : has
  Lead ||--o{ CampaignLog : targetedIn

  Campaign ||--o{ CampaignLog : produces

  Organization {
    String id PK
    String name
    String plan "free|basic|pro|enterprise"
    Int monthlyLeadCount
    Int monthlySkipTraceCount
    Int monthlyCampaignCount
    DateTime createdAt
    DateTime updatedAt
  }

  User {
    String id PK
    String email UNIQUE
    String password
    String firstName
    String lastName
    String role "admin|manager|user"
    Boolean isActive
    DateTime lastLoginAt
    String organizationId FK -> Organization.id
    DateTime createdAt
    DateTime updatedAt
  }

  Lead {
    String id PK
    String status "new|contacted|...|closed|dead"
    String source
    String priority "low|medium|high|hot"
    // Property
    String propertyAddress
    String city
    String state
    String zipCode
    String propertyType
    Int bedrooms
    Float bathrooms
    Int squareFootage
    Float lotSize
    Int yearBuilt
    // Valuation
    Float listPrice
    Float arv
    Float estimatedRepairs
    Float marketValue
    Float loanAmount
    Float equity
    Float equityPercent
    Float lastSalePrice
    DateTime lastSaleDate
    Float taxAssessedValue
    // Owner
    String ownerName
    String ownerPhone
    String ownerEmail
    String ownerAddress
    Boolean isAbsenteeOwner
    // Motivation
    Float motivationScore
    String motivationFactors "JSON text"
    String distressSignals "JSON text"
    Int timeOnMarket
    Int priceReductions
    // AI
    Float aiScore
    String aiSummary
    String dealPotential "flip|wholesale|rental|pass"
    Float profitEstimate
    String[] tags
    Boolean isActive
    // Relationships
    String organizationId FK -> Organization.id
    String assignedToId FK -> User.id
    DateTime createdAt
    DateTime updatedAt
  }

  LeadNote {
    String id PK
    String content
    String type "general|call|email|meeting|follow_up"
    String leadId FK -> Lead.id
    DateTime createdAt
  }

  SkipTraceRecord {
    String id PK
    String provider "batch_skip_tracing|whitepages_pro|public_records|failed"
    String status "pending|completed|failed"
    String requestData "JSON text"
    String responseData "JSON text"
    Float cost
    Float confidence
    String leadId FK -> Lead.id
    DateTime createdAt
    DateTime completedAt
  }

  Campaign {
    String id PK
    String name
    String type "sms|call|email|direct_mail"
    String status "draft|active|paused|completed"
    String subject
    String message
    String script
    String filters "JSON text"
    Int targetCount
    DateTime scheduledAt
    DateTime startedAt
    DateTime completedAt
    Int sent
    Int delivered
    Int opened
    Int clicked
    Int replied
    String organizationId FK -> Organization.id
    DateTime createdAt
    DateTime updatedAt
  }

  CampaignLog {
    String id PK
    String status "sent|delivered|opened|clicked|replied|failed"
    String response
    String errorMessage
    DateTime sentAt
    DateTime deliveredAt
    DateTime openedAt
    DateTime repliedAt
    String campaignId FK -> Campaign.id
    String leadId FK -> Lead.id
    String userId FK -> User.id
  }

  CallLog {
    String id PK
    String direction "inbound|outbound"
    String status "completed|busy|no_answer|voicemail|failed"
    Int duration
    String transcript
    String recording
    String fromNumber
    String toNumber
    String twilioCallSid
    String sentiment
    String aiSummary
    Float motivationScore
    String outcome "interested|not_interested|callback|no_answer"
    DateTime followUpDate
    DateTime callStartedAt
    DateTime callEndedAt
    DateTime createdAt
    String leadId FK -> Lead.id
    String organizationId FK -> Organization.id
    String createdById FK -> User.id
  }

  ScrapingJob {
    String id PK
    String source "zillow_fsbo|realtor_com|nj_property_records"
    String status "pending|running|completed|failed"
    String config "JSON text"
    Int recordsFound
    Int recordsSaved
    Int errorCount
    String logs "text"
    DateTime startedAt
    DateTime completedAt
  }

  PropertyRecord {
    String id PK
    String source
    String sourceId
    String address
    String city
    String state
    String zipCode
    String rawData "JSON text"
    Boolean processed
    String propertyHash INDEX
    DateTime createdAt
  }

  DailyMetric {
    String id PK
    DateTime date UNIQUE
    Int leadsGenerated
    Int leadsContacted
    Int leadsConverted
    Int campaignsSent
    Int campaignReplies
    Int callsMade
    Int callsAnswered
    Float avgCallDuration
    Int skipTracesRun
    Int skipTraceSuccess
    Float totalSpent
    Float revenueGenerated
    DateTime createdAt
  }
```

---

## Relationship Highlights

- Organization is the multi-tenancy boundary. Users, Leads, Campaigns, and CallLogs are scoped by organizationId. Controllers must include organizationId filters in all queries to enforce row-level isolation.
- Lead is the central entity for CRM flows. It carries property data, owner contact info, scoring (AI and motivation), and arrays of tags. It links outbound activities:
  - LeadNote records user-generated notes.
  - SkipTraceRecord stores provider requests/responses with costs and confidence to track enrichment lineage.
  - CampaignLog and CallLog form the communications timeline.
- Campaign orchestrates outreach and aggregates statistics (sent/delivered/opened/replied); CampaignLog is the per-message/event record.
- CallLog captures voice interactions, including AI-derived sentiment/motivation and Twilio metadata (callSid, recordings).
- PropertyRecord and ScrapingJob capture ingestion via scrapers (e.g., Zillow FSBO). PropertyRecord has a propertyHash for deduplication and unique (source, sourceId) to avoid duplicates.
- DailyMetric is a reporting rollup table for dashboards/analytics.

---

## Integrity and Indexing

- Uniqueness:
  - User.email UNIQUE
  - DailyMetric.date UNIQUE (@db.Date)
  - PropertyRecord (source, sourceId) UNIQUE to prevent duplicate source entries
- Indexes:
  - PropertyRecord.propertyHash indexed to speed dedup checks
- Cascades:
  - Organization → User/Lead/Campaign/CallLog cascades on delete
  - Lead → LeadNote/SkipTraceRecord/CampaignLog cascades on delete

---

## Data Lifecycle Mapping

- Ingested: PropertyRecord (from scraper) and/or Lead (from API ingestion) created.
- Normalized: Enrichment services consolidate property attributes into Lead (uniform fields).
- Enriched: SkipTraceRecord appended; lead ownerPhone/ownerEmail updated; address validated.
- Scored: aiService updates Lead.aiScore, motivationScore, aiSummary, dealPotential, profitEstimate asynchronously.
- Contacted: CampaignLog and CallLog entries accumulate; Lead.status transitions through pipeline.
- Closed: Lead.status under_contract → closed; metrics recorded in DailyMetric.

---

## Divergences: Root SQLite Schema (prisma/schema.prisma)

The root Prisma schema (SQLite) contains different models (Lead with different fields, ProbateCase, PropertyViolation, Campaign, Contact) intended for demos or earlier iterations. Using both schemas concurrently risks data drift and conflicting migrations.

Recommendation
- Declare backend/prisma/schema.prisma as the source of truth (PostgreSQL).
- Migrate any required concepts (e.g., ProbateCase) into backend schema via additive migrations if still needed.
- Deprecate or isolate root prisma for example-only. Ensure CI enforces a single prisma validate target.

---

## Notes and Next Steps

- Add a unified EventLog table if a single timeline stream is desired (type, subjectId, actorId, correlationId), otherwise retain specialized logs.
- Introduce soft-deletion markers where needed (beyond Lead.isActive) and archival strategy for CampaignLog/CallLog retention.
- If TCPA/DNC compliance requires auditability, consider a ConsentLog and DNCCheck tables to capture outcomes and enforce messaging rules (see SECURITY_CHECKLIST.md).
