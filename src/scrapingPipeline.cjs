/**
 * scrapingPipeline.cjs
 * End-to-end property scraping pipeline with fusion capabilities
 */

const { fuseProperties } = require('./fusion/propertyFusion.cjs');
const PropertyStoreWithFusion = require('./storage/propertyStoreWithFusion.cjs');
const PropertyStoreWithDatabase = require('./storage/propertyStoreWithDatabase.cjs');
const { processBatch } = require('./fusion/batchProcessor.cjs');
const { normalizeAddress } = require('./lib/normalize.cjs');
const { scorePropertyBatch } = require('./scoring/leadScoring.cjs');
const fs = require('fs');
const path = require('path');

class ScrapingPipeline {
  constructor(options = {}) {
    this.options = options;
    
    // Use database storage if enabled, otherwise use file storage
    if (options.useDatabase) {
      this.store = new PropertyStoreWithDatabase({
        dbConfig: options.dbConfig,
        attomClient: options.attomClient,
        dbConnector: options.dbConnector,
        logger: options.logger || console
      });
      this.usingDb = true;
    } else {
      this.store = new PropertyStoreWithFusion({
        storagePath: options.storagePath || './data',
        attomClient: options.attomClient
      });
      this.usingDb = false;
    }
  }
  
  /**
   * Process scraped properties from a single source
   * @param {Object} scrapeResult - Scraper output 
   * @param {Object} options - Processing options
   * @returns {Array} Processed properties
   */
  async processScrapedProperties(scrapeResult, options = {}) {
    if (!scrapeResult || !scrapeResult.items) {
      console.error('Invalid scrape result');
      return [];
    }
    
    const {
      enhanceWithAttom = Boolean(this.options.attomClient),
      deduplicate = true,
      scoreLeads = true,
      sourceName = scrapeResult.source || 'unknown'
    } = options;
    
    console.log(`Processing ${scrapeResult.items.length} properties from ${sourceName}...`);
    
    try {
      // 1. Normalize addresses
      const normalized = await this._normalizeAddresses(scrapeResult.items);
      
      // 2. Get ATTOM data if enabled
      let attomBatch = {};
      if (enhanceWithAttom && this.options.attomClient) {
        attomBatch = await this._fetchAttomBatch(normalized);
      }
      
      // 3. Process batch (fusion, deduplication)
      const processed = await processBatch(normalized, {
        attomData: attomBatch,
        deduplicate
      });
      
      // 4. Score leads if enabled
      let scored = processed;
      if (scoreLeads) {
        scored = this._scoreLeads(processed);
      }
      
      // 5. Store the results
      const stored = await this.store.batchStoreWithFusion(scored, {
        deduplicate: false, // Already deduplicated in processing
        attomBatch
      });
      
      return stored;
    } catch (error) {
      console.error('Error processing scraped properties:', error);
      return [];
    }
  }
  
  /**
   * Normalize addresses for all properties
   * @param {Array} properties - Properties to normalize
   * @returns {Array} Properties with normalized addresses
   */
  async _normalizeAddresses(properties) {
    const result = [];
    
    for (const property of properties) {
      try {
        // Skip properties without address
        if (!property.address) continue;
        
        // Convert address object to string if needed
        const addrStr = typeof property.address === 'string' 
          ? property.address
          : [
              property.address.line1, 
              property.address.city, 
              property.address.state, 
              property.address.zip
            ].filter(Boolean).join(", ");
        
        // Normalize address
        const { normalized, hash } = await normalizeAddress(addrStr);
        
        result.push({
          ...property,
          addressHash: hash,
          normalizedAddress: normalized
        });
      } catch (error) {
        console.warn(`Failed to normalize address for property: ${error.message}`);
      }
    }
    
    return result;
  }
  
  /**
   * Fetch ATTOM data for properties in batch
   * @param {Array} properties - Properties with address hashes
   * @returns {Object} ATTOM data keyed by address hash
   */
  async _fetchAttomBatch(properties) {
    if (!this.options.attomClient) {
      return {};
    }
    
    const result = {};
    
    // Group properties by address hash to avoid duplicate requests
    const addressHashes = new Set();
    properties.forEach(p => {
      if (p.addressHash) addressHashes.add(p.addressHash);
    });
    
    // Fetch ATTOM data for each hash
    for (const hash of addressHashes) {
      try {
        const attomData = await this.options.attomClient.getPropertyData(hash);
        if (attomData) {
          result[hash] = attomData;
        }
      } catch (error) {
        console.warn(`Failed to get ATTOM data for hash ${hash}: ${error.message}`);
      }
    }
    
    return result;
  }
  
  /**
   * Apply lead scoring to properties
   * @param {Array} properties - Properties to score
   * @returns {Array} Scored properties
   */
  _scoreLeads(properties) {
    try {
      return scorePropertyBatch(properties);
    } catch (error) {
      console.warn(`Failed to score leads: ${error.message}`);
      return properties;
    }
  }
  
  /**
   * Save processed results to file (for testing/debugging)
   * @param {Array} properties - Processed properties
   * @param {string} filename - Output filename
   */
  saveResultsToFile(properties, filename = 'processed-properties.json') {
    try {
      // If using database, this is just for debugging purposes
      const outputPath = path.join(this.options.storagePath || './data', filename);
      fs.writeFileSync(outputPath, JSON.stringify(properties, null, 2));
      console.log(`Saved ${properties.length} properties to ${outputPath}`);
    } catch (error) {
      console.error('Failed to save results to file:', error);
    }
  }
  
  /**
   * Create leads in the system from scored properties
   * @param {Array} scoredProperties - Properties with scoring
   * @returns {Array} Created leads or empty array if not using database
   */
  async createLeadsFromProperties(scoredProperties) {
    if (!this.usingDb) {
      console.warn('Cannot create leads: Database not enabled');
      return [];
    }
    
    try {
      // Filter for properties with good scores
      const highScoringProperties = scoredProperties.filter(p => 
        p.scoring && 
        (p.scoring.classification === 'HOT' || p.scoring.classification === 'WARM')
      );
      
      if (highScoringProperties.length === 0) {
        console.log('No high-scoring properties found for lead creation');
        return [];
      }
      
      console.log(`Creating leads from ${highScoringProperties.length} high-scoring properties`);
      return await this.store.createLeadsFromProperties(highScoringProperties);
    } catch (error) {
      console.error('Error creating leads from properties:', error);
      return [];
    }
  }
  
  /**
   * Close database connection if using database
   */
  async close() {
    if (this.usingDb) {
      await this.store.close();
    }
  }
}

module.exports = ScrapingPipeline;
