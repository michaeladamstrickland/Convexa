# ATTOM Batch Integration - Implementation Update

## Overview

This document outlines the implementation details for the newly created ATTOM Batch integration services that have been implemented for LeadFlow AI. These services enhance our property data processing capabilities by allowing efficient batch retrieval of property data from ATTOM's API.

## Implemented Components

### 1. Unified Property Model

We've implemented a unified property model that standardizes data from various sources, including ATTOM. This model allows for consistent handling of property data across the system and facilitates integration with our leads database.

Key features:
- Standardized address information for deduplication
- Normalized property details and characteristics
- Unified valuation data across sources
- Distress factors and scoring
- Detailed metadata tracking

### 2. Property Integration Service

The Property Integration Service (`propertyIntegrationService.js`) handles the integration of property data from various sources, including ATTOM batch processing. It provides:

- Conversion of source-specific data to our unified model
- Deduplication using address normalization
- Merging data from multiple sources
- Distress score calculation
- Lead generation from property data

Key functions:
- `processProperty` - Process a single property from any source
- `processPropertiesBulk` - Process multiple properties in bulk
- `convertPropertyToLead` - Convert a property to a lead
- `savePropertyAsLead` - Save a property as a new lead

### 3. ATTOM Batch Service

The ATTOM Batch Service (`attomBatchService.js`) manages the interaction with ATTOM's batch API. It provides:

- Batch request creation and submission
- Status monitoring
- Result downloading
- Processing of results into our unified model

Key functions:
- `createBatchRequest` - Create a new batch request from property addresses
- `submitBatchRequest` - Submit a batch to ATTOM API
- `checkBatchStatus` - Check the status of a batch job
- `downloadBatchResults` - Download batch results
- `processBatchResults` - Process results into our system
- `listBatchJobs` - List all batch jobs

### 4. Configuration Service

The Configuration Service (`configService.js`) provides centralized configuration management for the system, including:

- Environment variable management
- Application settings
- External API credentials
- Feature flags

Key features:
- Default configuration values
- Environment variable overrides
- Custom configuration file support
- Secure configuration loading

### 5. Command Line Interface

The command line interface (`attom-batch.js`) provides a user-friendly way to interact with the ATTOM batch processing system. It supports:

- Submitting new batch requests
- Checking batch status
- Downloading and processing results
- Listing batch jobs
- Running complete batch workflows

Commands:
- `submit` - Create and submit a batch request
- `status` - Check batch status
- `download` - Download batch results
- `process` - Process batch results
- `list` - List all batch jobs
- `run-all` - Run the full process from start to finish

## Database Schema

New tables have been added to support these features:

### attom_batch_jobs

```sql
CREATE TABLE attom_batch_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  result_file_name TEXT,
  result_file_path TEXT,
  status TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  external_batch_id TEXT,
  response TEXT,
  error TEXT,
  attom_status TEXT,
  progress_percent INTEGER,
  records_found INTEGER,
  processed_records INTEGER,
  error_records INTEGER,
  leads_created INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  submitted_at TEXT,
  estimated_completion_time INTEGER,
  last_checked TEXT,
  downloaded_at TEXT,
  processing_started_at TEXT,
  processing_completed_at TEXT
);
```

### property_records

```sql
CREATE TABLE property_records (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  property_hash TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
```

## Usage Examples

### Running a Complete Batch Process

```bash
node attom-batch.js run-all properties.csv --name "My First Batch" --leads
```

This command:
1. Creates a batch request from properties.csv
2. Submits the batch to ATTOM API
3. Waits for processing to complete
4. Downloads the results
5. Processes the results into our system
6. Converts properties to leads

### Creating and Submitting a Batch

```bash
node attom-batch.js submit properties.csv --name "Test Batch"
```

### Checking Batch Status

```bash
node attom-batch.js status [batchId]
```

### Processing Results and Converting to Leads

```bash
node attom-batch.js process [batchId] --leads
```

### Viewing All Batch Jobs

```bash
node attom-batch.js list
```

## Integration with Existing Code

The new batch processing services integrate with the existing LeadFlow AI system:

1. **Lead Generation** - Properties from ATTOM batches can be converted to leads
2. **Unified Property Model** - Ensures consistent data structure across the system
3. **Configuration Management** - Uses centralized configuration for API keys and settings

## Next Steps

To complete the integration, the following steps should be taken:

1. **Database Migration** - Run migrations to create the necessary tables
2. **Testing** - Test the batch processing with small test files
3. **User Interface** - Develop a UI for managing batch jobs
4. **Scheduled Jobs** - Set up scheduled batch processing for regular data updates
5. **Monitoring** - Implement monitoring and alerting for batch jobs

## Configuration Requirements

The following environment variables should be set:

```
ATTOM_API_KEY=your_attom_api_key
BATCH_UPLOAD_DIR=path/to/upload/directory
BATCH_RESULTS_DIR=path/to/results/directory
DAILY_CAP_ATTOM_CENTS=10000  # $100 default cap
```
