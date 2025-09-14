# Property Data Fusion Module

This module provides utilities for merging property data from multiple sources, with a focus on:

1. Source reliability ranking
2. Data completeness assessment
3. Conflict resolution
4. Contact data aggregation
5. ATTOM API integration

## Core Components

### 1. Property Fusion

The `propertyFusion.cjs` module provides utilities for merging property records from different sources:

- Source reliability ranking - Prioritizes more trusted data sources
- Completeness scoring - Selects most complete record as base
- Attribute merging - Intelligent merging of property attributes
- Contact merging - Combines contact data with confidence scoring

### 2. ATTOM Integration

The `attomFusion.cjs` module specializes in integrating ATTOM API data with scraped properties:

- Field mapping - Converts ATTOM fields to standardized format
- Property enhancement - Enriches property data with ATTOM information
- Batch processing - Handles bulk property enhancement

### 3. Batch Processing

The `batchProcessor.cjs` module provides tools for processing property data in batches:

- Batch processing - Process groups of properties efficiently
- Deduplication - Remove duplicate properties by address
- Stream processing - Process properties in chunks with async generators

## Usage Examples

### Basic Property Fusion

```js
const { fuseProperties } = require('./src/fusion/propertyFusion.cjs');

// Multiple property records for the same property from different sources
const properties = [propertyFromZillow, propertyFromAuction, propertyFromCounty];

// Fuse them into a single enriched record
const fusedProperty = fuseProperties(null, properties);
```

### ATTOM Data Enhancement

```js
const { enhanceWithAttom } = require('./src/fusion/attomFusion.cjs');

// Enhance a property with ATTOM data
const enhancedProperty = enhanceWithAttom(attomData, scrapedProperty);
```

### Batch Processing

```js
const { processBatch } = require('./src/fusion/batchProcessor.cjs');

// Process a batch of properties
const processedProperties = await processBatch(propertyBatch, {
  attomData: attomBatchResults,
  deduplicate: true
});
```

## Integration With Scraping Pipeline

This fusion module serves as a critical component in the property data pipeline:

1. Scrapers collect property data from various sources
2. Normalization applies consistent formatting to addresses and names
3. **Fusion** merges data from multiple sources, resolving conflicts
4. Storage component saves the enriched property data
5. Lead scoring evaluates the merged property records

## Testing

The `test-fusion.cjs` script demonstrates and validates the fusion functionality with sample property data.
