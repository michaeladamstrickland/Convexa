/**
 * propertyStore.cjs
 * Simple storage system for property data with deduplication
 */
const fs = require('fs');
const path = require('path');
const { normalizeAddress } = require('../lib/normalize.cjs');

class PropertyStore {
  constructor(options = {}) {
    this.storagePath = options.storagePath || './data';
    this.indexFile = path.join(this.storagePath, 'property-index.json');
    this.propertyDir = path.join(this.storagePath, 'properties');
    this.index = { byHash: {}, byAddress: {} };
    
    this._initializeStorage();
  }
  
  /**
   * Initialize storage directories and index
   */
  _initializeStorage() {
    try {
      // Create directories if needed
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }
      
      if (!fs.existsSync(this.propertyDir)) {
        fs.mkdirSync(this.propertyDir, { recursive: true });
      }
      
      // Load index if exists
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, 'utf8');
        this.index = JSON.parse(data);
      } else {
        this._saveIndex();
      }
    } catch (error) {
      console.error('Error initializing property store:', error);
    }
  }
  
  /**
   * Save the property index
   */
  _saveIndex() {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2));
    } catch (error) {
      console.error('Error saving property index:', error);
    }
  }
  
  /**
   * Get property file path from hash
   */
  _getPropertyFilePath(hash) {
    return path.join(this.propertyDir, `${hash}.json`);
  }
  
  /**
   * Store a property in the database
   * @param {Object} property - Property data to store
   * @returns {Object} Stored property with metadata
   */
  async storeProperty(property) {
    try {
      if (!property || !property.address) {
        throw new Error('Invalid property data: missing address');
      }
      
      // Create address string
      const addrStr = [
        property.address.line1, 
        property.address.city, 
        property.address.state, 
        property.address.zip
      ].filter(Boolean).join(", ");
      
      // Normalize address and get hash
      const { normalized, hash } = await normalizeAddress(addrStr);
      
      // Add hash and timestamp to property
      const timestamp = new Date().toISOString();
      const storedProperty = {
        ...property,
        addressHash: hash,
        normalizedAddress: normalized,
        storedAt: timestamp,
        updatedAt: timestamp
      };
      
      // Check if property already exists
      let existingHash = this.index.byAddress[normalized];
      
      if (existingHash) {
        // Update existing property
        const existingPath = this._getPropertyFilePath(existingHash);
        
        if (fs.existsSync(existingPath)) {
          const existingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
          
          // Merge data: retain history but update with new info
          const merged = this._mergeProperties(existingData, storedProperty);
          
          // Save updated property
          fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2));
          return merged;
        }
      }
      
      // Store new property
      const filePath = this._getPropertyFilePath(hash);
      fs.writeFileSync(filePath, JSON.stringify(storedProperty, null, 2));
      
      // Update index
      this.index.byHash[hash] = {
        normalizedAddress: normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
        filePath: filePath
      };
      
      this.index.byAddress[normalized] = hash;
      this._saveIndex();
      
      return storedProperty;
    } catch (error) {
      console.error('Error storing property:', error);
      throw error;
    }
  }
  
  /**
   * Merge an existing property with new data
   * @param {Object} existing - Existing property
   * @param {Object} updated - Updated property
   * @returns {Object} Merged property
   */
  _mergeProperties(existing, updated) {
    // Simple merge strategy - more sophisticated logic can be added later
    const merged = {
      ...existing,
      ...updated,
      address: { ...existing.address, ...updated.address },
      updatedAt: new Date().toISOString()
    };
    
    // Merge attributes
    if (existing.attributes || updated.attributes) {
      merged.attributes = { 
        ...(existing.attributes || {}), 
        ...(updated.attributes || {}) 
      };
    }
    
    // Combine sources
    merged.sources = [
      ...(existing.sources || []),
      ...(updated.sources || [])
    ].filter((s, i, a) => a.findIndex(t => t.key === s.key) === i); // Deduplicate
    
    // Combine distress signals
    merged.distressSignals = Array.from(new Set([
      ...(existing.distressSignals || []),
      ...(updated.distressSignals || [])
    ]));
    
    // Track history (optional)
    if (!merged.history) merged.history = [];
    merged.history.push({
      timestamp: new Date().toISOString(),
      source: updated.sourceKey || 'unknown',
      changes: this._detectChanges(existing, updated)
    });
    
    // Limit history length to prevent file bloat
    if (merged.history.length > 10) {
      merged.history = merged.history.slice(-10);
    }
    
    return merged;
  }
  
  /**
   * Detect changes between property versions
   * @param {Object} older - Older property
   * @param {Object} newer - Newer property
   * @returns {Object} Detected changes
   */
  _detectChanges(older, newer) {
    const changes = {};
    
    // Simple change detection for key fields
    if (newer.ownerName && newer.ownerName !== older.ownerName) {
      changes.ownerName = {
        from: older.ownerName,
        to: newer.ownerName
      };
    }
    
    if (newer.priceHint && newer.priceHint !== older.priceHint) {
      changes.priceHint = {
        from: older.priceHint,
        to: newer.priceHint
      };
    }
    
    // Check attributes
    if (newer.attributes && older.attributes) {
      const attrChanges = {};
      
      for (const key in newer.attributes) {
        if (newer.attributes[key] !== older.attributes[key]) {
          attrChanges[key] = {
            from: older.attributes[key],
            to: newer.attributes[key]
          };
        }
      }
      
      if (Object.keys(attrChanges).length > 0) {
        changes.attributes = attrChanges;
      }
    }
    
    return changes;
  }
  
  /**
   * Get a property by its address hash
   * @param {string} hash - Address hash
   * @returns {Object|null} Property data
   */
  getPropertyByHash(hash) {
    try {
      if (!hash || !this.index.byHash[hash]) {
        return null;
      }
      
      const filePath = this._getPropertyFilePath(hash);
      
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      return null;
    } catch (error) {
      console.error('Error getting property by hash:', error);
      return null;
    }
  }
  
  /**
   * Get a property by address
   * @param {Object} address - Address object or string
   * @returns {Promise<Object|null>} Property data
   */
  async getPropertyByAddress(address) {
    try {
      if (!address) return null;
      
      // Convert address to string if object
      let addressStr = address;
      if (typeof address === 'object') {
        addressStr = [
          address.line1, 
          address.city, 
          address.state, 
          address.zip
        ].filter(Boolean).join(", ");
      }
      
      // Normalize address
      const { normalized, hash } = await normalizeAddress(addressStr);
      
      return this.getPropertyByHash(hash);
    } catch (error) {
      console.error('Error getting property by address:', error);
      return null;
    }
  }
  
  /**
   * Get all properties
   * @returns {Array} Array of properties
   */
  getAllProperties() {
    try {
      const properties = [];
      
      for (const hash in this.index.byHash) {
        const property = this.getPropertyByHash(hash);
        if (property) {
          properties.push(property);
        }
      }
      
      return properties;
    } catch (error) {
      console.error('Error getting all properties:', error);
      return [];
    }
  }
  
  /**
   * Query properties by criteria
   * @param {Function} filterFn - Filter function
   * @returns {Array} Matching properties
   */
  queryProperties(filterFn) {
    try {
      return this.getAllProperties().filter(filterFn);
    } catch (error) {
      console.error('Error querying properties:', error);
      return [];
    }
  }
  
  /**
   * Delete a property
   * @param {string} hash - Address hash
   * @returns {boolean} Success flag
   */
  deleteProperty(hash) {
    try {
      if (!hash || !this.index.byHash[hash]) {
        return false;
      }
      
      const indexEntry = this.index.byHash[hash];
      const filePath = this._getPropertyFilePath(hash);
      
      // Remove file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Remove from indexes
      delete this.index.byHash[hash];
      delete this.index.byAddress[indexEntry.normalizedAddress];
      
      this._saveIndex();
      return true;
    } catch (error) {
      console.error('Error deleting property:', error);
      return false;
    }
  }
}

module.exports = PropertyStore;
