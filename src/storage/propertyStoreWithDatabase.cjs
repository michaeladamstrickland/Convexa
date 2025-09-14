/**
 * propertyStoreWithDatabase.cjs
 * Enhanced property storage with MongoDB database integration
 */

const DatabaseConnector = require('../db/dbConnector.cjs');
const { fuseProperties } = require('../fusion/propertyFusion.cjs');
const { normalizeAddress } = require('../lib/normalize.cjs');

class PropertyStoreWithDatabase {
  constructor(options = {}) {
    this.dbConnector = options.dbConnector || new DatabaseConnector(options.dbConfig);
    this.attomClient = options.attomClient || null;
    this.logger = options.logger || console;
  }
  
  /**
   * Store a property with fusion support
   */
  async storePropertyWithFusion(property, options = {}) {
    const { 
      skipAttom = false,
      skipFusion = false,
      attomData = null
    } = options;
    
    try {
      // Skip processing if property has no address
      if (!property.address) {
        this.logger.warn('Cannot store property: No address provided');
        return null;
      }
      
      // Normalize address if needed
      let addrStr, normalizedAddr, addressHash;
      
      if (!property.normalizedAddress || !property.addressHash) {
        addrStr = typeof property.address === 'string' 
          ? property.address 
          : `${property.address.line1}, ${property.address.city}, ${property.address.state} ${property.address.zip}`;
        
        const normalized = await normalizeAddress(addrStr);
        normalizedAddr = normalized.normalized;
        addressHash = normalized.hash;
        
        property = {
          ...property,
          normalizedAddress: normalizedAddr,
          addressHash: addressHash
        };
      } else {
        normalizedAddr = property.normalizedAddress;
        addressHash = property.addressHash;
      }
      
      // Get existing property
      const existingProperty = await this.dbConnector.getPropertyByAddressHash(addressHash);
      
      if (existingProperty && !skipFusion) {
        // Get ATTOM data if available and not provided
        let attomDataToUse = attomData;
        
        if (!attomDataToUse && !skipAttom && this.attomClient) {
          attomDataToUse = await this.attomClient.getPropertyData(addressHash);
        }
        
        // Perform fusion of new and existing property data
        const fusedProperty = fuseProperties(attomDataToUse, [existingProperty, property]);
        
        // Store the fused property
        return await this.dbConnector.storeProperty(fusedProperty);
      }
      
      // No fusion needed - store property directly
      return await this.dbConnector.storeProperty(property);
    } catch (error) {
      this.logger.error(`Error storing property with fusion: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Store a batch of properties with fusion
   */
  async batchStoreWithFusion(properties, options = {}) {
    if (!Array.isArray(properties) || properties.length === 0) {
      return [];
    }
    
    const { 
      deduplicate = true,
      skipAttom = false,
      attomBatch = {} 
    } = options;
    
    try {
      const results = [];
      const processedAddressHashes = new Set();
      
      // Process each property
      for (const property of properties) {
        try {
          // Skip if no address
          if (!property.address) {
            this.logger.warn('Skipping property without address');
            continue;
          }
          
          // Normalize address if needed
          if (!property.normalizedAddress || !property.addressHash) {
            const addrStr = typeof property.address === 'string' 
              ? property.address 
              : `${property.address.line1}, ${property.address.city}, ${property.address.state} ${property.address.zip}`;
            
            const normalized = await normalizeAddress(addrStr);
            property.normalizedAddress = normalized.normalized;
            property.addressHash = normalized.hash;
          }
          
          // Skip duplicates within the batch if deduplication is enabled
          if (deduplicate && processedAddressHashes.has(property.addressHash)) {
            this.logger.debug(`Skipping duplicate property: ${property.address}`);
            continue;
          }
          
          processedAddressHashes.add(property.addressHash);
          
          // Store with fusion
          const attomData = attomBatch[property.addressHash];
          const storedProperty = await this.storePropertyWithFusion(property, {
            skipAttom,
            attomData
          });
          
          if (storedProperty) {
            results.push(storedProperty);
          }
        } catch (error) {
          this.logger.error(`Error processing property in batch: ${error.message}`, error);
          // Continue with next property
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error in batch store with fusion: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Create lead entries from property data
   */
  async createLeadsFromProperties(scoredProperties) {
    if (!Array.isArray(scoredProperties) || scoredProperties.length === 0) {
      return [];
    }
    
    const leads = [];
    
    for (const property of scoredProperties) {
      // Skip properties without scoring or ID
      if (!property.scoring || !property._id) continue;
      
      try {
        // Create lead entry
        const lead = {
          address: property.address,
          normalizedAddress: property.normalizedAddress,
          ownerName: property.ownerName,
          distressSignals: property.distressSignals || [],
          scoring: property.scoring,
          contacts: property.contacts || [],
          status: 'NEW',
          notes: [],
          tasks: []
        };
        
        // Store lead
        const storedLead = await this.dbConnector.storeLead(lead, property._id);
        leads.push(storedLead);
      } catch (error) {
        this.logger.error(`Error creating lead for property: ${error.message}`, error);
        // Continue with next property
      }
    }
    
    return leads;
  }
  
  /**
   * Get hot leads for the UI
   */
  async getHotLeads(options = {}) {
    try {
      const leads = await this.dbConnector.getHotLeads(options);
      
      // Enrich leads with property details
      const enrichedLeads = [];
      
      for (const lead of leads) {
        try {
          // Get the associated property
          const property = await this.dbConnector.searchProperties(
            { _id: lead.propertyId },
            { limit: 1 }
          );
          
          if (property && property.length > 0) {
            enrichedLeads.push({
              ...lead,
              property: property[0]
            });
          } else {
            enrichedLeads.push(lead);
          }
        } catch (error) {
          this.logger.error(`Error enriching lead: ${error.message}`, error);
          enrichedLeads.push(lead);
        }
      }
      
      return enrichedLeads;
    } catch (error) {
      this.logger.error(`Error getting hot leads: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Search properties
   */
  async searchProperties(criteria, options = {}) {
    try {
      return await this.dbConnector.searchProperties(criteria, options);
    } catch (error) {
      this.logger.error(`Error searching properties: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Close database connection
   */
  async close() {
    try {
      await this.dbConnector.close();
    } catch (error) {
      this.logger.error(`Error closing database connection: ${error.message}`, error);
    }
  }
}

module.exports = PropertyStoreWithDatabase;
