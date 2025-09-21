# Convexa AI - ATTOM Batch Integration

This module provides ATTOM Property Data API batch integration for Convexa AI. It allows you to process property data in bulk, normalize it, and convert it to leads in the system.

## Overview

The ATTOM batch processing system allows for efficient retrieval of property data in bulk, which is then normalized, deduplicated, and integrated into our unified property model. This significantly reduces API costs and processing time compared to individual property lookups.

## Features

- Batch property data retrieval from ATTOM API
- Property data normalization and deduplication
- Conversion of properties to leads
- Tracking of batch processing status
- Command-line interface for batch operations

## Getting Started

### Prerequisites

- Node.js 14+
- ATTOM Property Data API key with batch processing access
- CSV file with property addresses

### Setup

1. Configure your `.env` file:
   ```
   ATTOM_API_KEY=your_attom_api_key
   ```

2. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

3. Create necessary directories:
   ```bash
   mkdir -p data/attom_batch/uploads
   mkdir -p data/attom_batch/results
   mkdir -p logs
   ```

## Usage

### Command Line Interface

On Windows:
```batch
run-attom-batch.bat [command] [arguments]
```

On Linux/Mac:
```bash
./setup-attom-batch.sh
./run-attom-batch.sh [command] [arguments]
```

### Available Commands

- **Submit a New Batch**
  ```
  run-attom-batch submit data/attom_batch/uploads/properties.csv --name "My Batch"
  ```

- **Check Batch Status**
  ```
  run-attom-batch status [batchId]
  ```

- **Download Batch Results**
  ```
  run-attom-batch download [batchId]
  ```

- **Process Batch Results**
  ```
  run-attom-batch process [batchId] --leads
  ```

- **List All Batches**
  ```
  run-attom-batch list
  ```

- **Run Full Batch Process**
  ```
  run-attom-batch run-all data/attom_batch/uploads/properties.csv --name "My Batch" --leads
  ```

### CSV Format

The input CSV file must contain the following columns:
- Address
- City
- State
- Zip

Example:
```csv
Address,City,State,Zip
123 Main St,Denver,CO,80202
456 Elm Ave,Phoenix,AZ,85001
```

## System Components

### Property Integration Service

Handles the integration of property data from various sources:
- Converts source-specific data to unified model
- Implements deduplication logic
- Merges data from multiple sources
- Calculates distress scores
- Converts properties to leads

### ATTOM Batch Service

Manages the ATTOM batch API operations:
- Creates and submits batch requests
- Checks batch status
- Downloads batch results
- Processes results into unified model
- Stores batch metadata

### Unified Property Model

Normalizes property data into a consistent format:
- Standardized address information
- Property details and characteristics
- Valuation data
- Sales history
- Distress factors and scoring

### Configuration Service

Manages application settings and API credentials:
- Environment variables
- Default configurations
- Custom configuration options
- Secure settings storage

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Verify your ATTOM API key is correct
   - Ensure your account has batch processing access
   - Check daily API limits

2. **CSV Format Issues**
   - Ensure your CSV has the correct headers (Address,City,State,Zip)
   - Check for special characters or encoding issues
   - Verify addresses are formatted correctly

3. **Processing Errors**
   - Check logs in the `logs` directory
   - Verify database connections
   - Ensure sufficient disk space for results
