/**
 * propertyStoreWithFusion.cjs
 * Storage system for property data with fusion capabilities
 * Extends the basic PropertyStore with data fusion functionality
 */

const PropertyStore = require('./propertyStore.cjs');
const { fuseProperties } = require('../fusion/propertyFusion.cjs');

class PropertyStoreWithFusion extends PropertyStore {
  constructor(options = {}) {
    super(options);
    this.attomClient = options.attomClient || null;
  }
  
  /**
   * Store a property with fusion capabilities
   * @param {Object} property - Property data to store
   * @param {Object} options - Storage options
   * @param {boolean} options.skipFusion - Skip fusion process
   * @param {Object} options.attomData - ATTOM data for property
   * @returns {Object} Stored and fused property
   */
  async storePropertyWithFusion(property, options = {}) {
    try {
      if (!property || !property.address) {
        throw new Error('Invalid property data: missing address');
      }
      
      const { skipFusion = false, attomData = null } = options;
      
      // If fusion is enabled, check for existing property data
      if (!skipFusion) {
        // Create address string for lookup
        const addrStr = [
          property.address.line1, 
          property.address.city, 
          property.address.state, 
          property.address.zip
        ].filter(Boolean).join(", ");
        
        // Get existing property
        const existingProperty = await this.getPropertyByAddress(addrStr);
        
        if (existingProperty) {
          // Get ATTOM data if available and not provided
          let attomDataToUse = attomData;
          
          if (!attomDataToUse && this.attomClient && existingProperty.addressHash) {
            try {
              attomDataToUse = await this.attomClient.getPropertyData(existingProperty.addressHash);
            } catch (error) {
              console.warn('Failed to get ATTOM data for fusion:', error.message);
            }
          }
          
          // Perform fusion of new and existing property data
          const fusedProperty = fuseProperties(attomDataToUse, [existingProperty, property]);
          
          // Store the fused property
          return super.storeProperty(fusedProperty);
        }
      }
      
      // No existing property or fusion skipped - store normally
      return super.storeProperty(property);
    } catch (error) {
      console.error('Error storing property with fusion:', error);
      throw error;
    }
  }
  
  /**
   * Batch store properties with fusion
   * @param {Array} properties - Array of properties to store
   * @param {Object} options - Storage options
   * @param {boolean} options.deduplicate - Deduplicate properties by address
   * @param {Object} options.attomBatch - ATTOM data by address hash 
   * @returns {Array} Stored properties
   */
  async batchStoreWithFusion(properties, options = {}) {
    try {
      if (!Array.isArray(properties) || properties.length === 0) {
        return [];
      }
      
      const { deduplicate = true, attomBatch = {} } = options;
      const results = [];
      
      // If deduplication is enabled, group by address hash
      if (deduplicate) {
        const groups = {};
        
        // First pass: collect normalized address data and group
        for (const property of properties) {
          // Create address string
          const addrStr = [
            property.address.line1, 
            property.address.city, 
            property.address.state, 
            property.address.zip
          ].filter(Boolean).join(", ");
          
          // Get normalized address
          const { hash } = await this._normalizeAddressWithCache(addrStr);
          
          // Group by hash
          if (!groups[hash]) {
            groups[hash] = [];
          }
          
          groups[hash].push(property);
        }
        
        // Second pass: fuse each group and store
        for (const [hash, group] of Object.entries(groups)) {
          // Get existing property if any
          const existingProperty = this.getPropertyByHash(hash);
          
          if (existingProperty) {
            group.push(existingProperty);
          }
          
          // Get ATTOM data if available
          const attomData = attomBatch[hash] || null;
          
          // Fuse the group
          const fusedProperty = fuseProperties(attomData, group);
          
          // Store the fused property
          const stored = await super.storeProperty(fusedProperty);
          results.push(stored);
        }
      } else {
        // No deduplication - store each property individually
        for (const property of properties) {
          const stored = await this.storePropertyWithFusion(property, {
            skipFusion: false,
            attomData: property.addressHash ? attomBatch[property.addressHash] : null
          });
          
          results.push(stored);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in batch store with fusion:', error);
      throw error;
    }
  }
  
  /**
   * Normalize address with caching for batch operations
   * @private
   */
  async _normalizeAddressWithCache(address) {
    // This method can be enhanced with a cache to avoid repeated normalization
    // during batch processing
    const { normalizeAddress } = require('../lib/normalize.cjs');
    return normalizeAddress(address);
  }
}

module.exports = PropertyStoreWithFusion;
