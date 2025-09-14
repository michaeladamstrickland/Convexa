/**
 * dbConnector.cjs
 * Database connector for FlipTracker scraping system
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

class DatabaseConnector {
  constructor(config = {}) {
    this.config = {
      uri: config.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: config.dbName || process.env.MONGODB_DB_NAME || 'fliptracker',
      propertiesCollection: config.propertiesCollection || 'properties',
      leadsCollection: config.leadsCollection || 'leads',
      scrapeLogsCollection: config.scrapeLogsCollection || 'scrape_logs',
      ...config
    };
    
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.collections = {};
    
    // Create log directory if needed
    this.logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logStream = fs.createWriteStream(path.join(this.logDir, 'db-operations.log'), { flags: 'a' });
  }
  
  /**
   * Connect to the database
   */
  async connect() {
    try {
      if (this.isConnected) return true;
      
      this.client = new MongoClient(this.config.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
      
      // Initialize collections
      this.collections = {
        properties: this.db.collection(this.config.propertiesCollection),
        leads: this.db.collection(this.config.leadsCollection),
        scrapeLogs: this.db.collection(this.config.scrapeLogsCollection)
      };
      
      // Create indexes if needed
      await this._ensureIndexes();
      
      this.isConnected = true;
      this.log(`Connected to MongoDB: ${this.config.uri}/${this.config.dbName}`);
      
      return true;
    } catch (error) {
      this.logError('Error connecting to database:', error);
      throw error;
    }
  }
  
  /**
   * Ensure required indexes exist
   */
  async _ensureIndexes() {
    // Properties collection indexes
    await this.collections.properties.createIndexes([
      { key: { addressHash: 1 }, unique: true, name: 'addressHash_unique' },
      { key: { normalizedAddress: 1 }, name: 'normalizedAddress' },
      { key: { 'address.city': 1, 'address.state': 1 }, name: 'city_state' },
      { key: { 'address.zip': 1 }, name: 'zip' },
      { key: { parcelId: 1 }, sparse: true, name: 'parcelId' },
      { key: { apn: 1 }, sparse: true, name: 'apn' },
      { key: { 'sources.key': 1 }, name: 'source_key' }
    ]);
    
    // Leads collection indexes
    await this.collections.leads.createIndexes([
      { key: { propertyId: 1 }, name: 'propertyId' },
      { key: { 'scoring.totalScore': -1 }, name: 'totalScore' },
      { key: { 'scoring.classification': 1 }, name: 'classification' },
      { key: { createdAt: -1 }, name: 'createdAt' }
    ]);
    
    // Scrape logs collection indexes
    await this.collections.scrapeLogs.createIndexes([
      { key: { sourceKey: 1 }, name: 'sourceKey' },
      { key: { timestamp: -1 }, name: 'timestamp' }
    ]);
  }
  
  /**
   * Store a property in the database
   */
  async storeProperty(property) {
    await this.connect();
    
    try {
      // Check if property already exists
      const existingProperty = await this.collections.properties.findOne({ 
        addressHash: property.addressHash 
      });
      
      if (existingProperty) {
        // Update existing property
        const updateResult = await this.collections.properties.updateOne(
          { _id: existingProperty._id },
          { 
            $set: {
              ...property,
              updatedAt: new Date(),
              versions: [...(existingProperty.versions || []), {
                timestamp: new Date(),
                sourceKey: property.sources?.[0]?.key || 'unknown',
                changes: this._computeChanges(existingProperty, property)
              }]
            }
          }
        );
        
        this.log(`Updated property: ${property.address}, ID: ${existingProperty._id}`);
        return { ...property, _id: existingProperty._id };
      } else {
        // Insert new property
        const insertResult = await this.collections.properties.insertOne({
          ...property,
          createdAt: new Date(),
          updatedAt: new Date(),
          versions: []
        });
        
        this.log(`Inserted new property: ${property.address}, ID: ${insertResult.insertedId}`);
        return { ...property, _id: insertResult.insertedId };
      }
    } catch (error) {
      this.logError(`Error storing property: ${property.address}`, error);
      throw error;
    }
  }
  
  /**
   * Store a batch of properties
   */
  async storePropertyBatch(properties) {
    if (!Array.isArray(properties) || properties.length === 0) {
      return [];
    }
    
    const results = [];
    
    // Process in smaller batches to avoid overwhelming the database
    const batchSize = 50;
    
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      
      // Process each property
      for (const property of batch) {
        try {
          const result = await this.storeProperty(property);
          results.push(result);
        } catch (error) {
          this.logError(`Error in batch processing property: ${property.address}`, error);
          // Continue with next property
        }
      }
    }
    
    return results;
  }
  
  /**
   * Store a lead in the database
   */
  async storeLead(lead, propertyId) {
    await this.connect();
    
    try {
      // Check if lead already exists for this property
      const existingLead = await this.collections.leads.findOne({ propertyId });
      
      if (existingLead) {
        // Update existing lead
        const updateResult = await this.collections.leads.updateOne(
          { _id: existingLead._id },
          { 
            $set: {
              ...lead,
              updatedAt: new Date()
            }
          }
        );
        
        this.log(`Updated lead for property ID: ${propertyId}`);
        return { ...lead, _id: existingLead._id, propertyId };
      } else {
        // Insert new lead
        const insertResult = await this.collections.leads.insertOne({
          ...lead,
          propertyId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        this.log(`Inserted new lead for property ID: ${propertyId}`);
        return { ...lead, _id: insertResult.insertedId, propertyId };
      }
    } catch (error) {
      this.logError(`Error storing lead for property ID: ${propertyId}`, error);
      throw error;
    }
  }
  
  /**
   * Get a property by address hash
   */
  async getPropertyByAddressHash(addressHash) {
    await this.connect();
    
    try {
      return await this.collections.properties.findOne({ addressHash });
    } catch (error) {
      this.logError(`Error getting property by address hash: ${addressHash}`, error);
      throw error;
    }
  }
  
  /**
   * Get a property by normalized address
   */
  async getPropertyByAddress(normalizedAddress) {
    await this.connect();
    
    try {
      return await this.collections.properties.findOne({ normalizedAddress });
    } catch (error) {
      this.logError(`Error getting property by address: ${normalizedAddress}`, error);
      throw error;
    }
  }
  
  /**
   * Search properties by criteria
   */
  async searchProperties(criteria = {}, options = {}) {
    await this.connect();
    
    try {
      const { 
        limit = 100, 
        skip = 0, 
        sort = { updatedAt: -1 } 
      } = options;
      
      return await this.collections.properties
        .find(criteria)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logError(`Error searching properties with criteria: ${JSON.stringify(criteria)}`, error);
      throw error;
    }
  }
  
  /**
   * Get hot leads
   */
  async getHotLeads(options = {}) {
    await this.connect();
    
    try {
      const { 
        limit = 50, 
        skip = 0,
        minScore = 70
      } = options;
      
      return await this.collections.leads
        .find({ 
          'scoring.totalScore': { $gte: minScore },
          'scoring.classification': 'HOT'
        })
        .sort({ 'scoring.totalScore': -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logError('Error getting hot leads', error);
      throw error;
    }
  }
  
  /**
   * Log scrape operation
   */
  async logScrapeOperation(sourceKey, stats) {
    await this.connect();
    
    try {
      await this.collections.scrapeLogs.insertOne({
        sourceKey,
        timestamp: new Date(),
        stats
      });
    } catch (error) {
      this.logError(`Error logging scrape operation for source: ${sourceKey}`, error);
      // Don't throw - this is just logging
    }
  }
  
  /**
   * Close database connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
      this.collections = {};
      this.log('Disconnected from MongoDB');
    }
    
    if (this.logStream) {
      this.logStream.end();
    }
  }
  
  /**
   * Compute changes between two property objects
   */
  _computeChanges(oldProperty, newProperty) {
    const changes = {};
    
    // Check top-level fields
    const topLevelFields = [
      'address', 'normalizedAddress', 'ownerName', 'parcelId', 'apn'
    ];
    
    for (const field of topLevelFields) {
      if (JSON.stringify(oldProperty[field]) !== JSON.stringify(newProperty[field])) {
        changes[field] = {
          old: oldProperty[field],
          new: newProperty[field]
        };
      }
    }
    
    // Check attributes
    if (oldProperty.attributes || newProperty.attributes) {
      const oldAttrs = oldProperty.attributes || {};
      const newAttrs = newProperty.attributes || {};
      const allKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]);
      
      const attrChanges = {};
      
      for (const key of allKeys) {
        if (oldAttrs[key] !== newAttrs[key]) {
          attrChanges[key] = {
            old: oldAttrs[key],
            new: newAttrs[key]
          };
        }
      }
      
      if (Object.keys(attrChanges).length > 0) {
        changes.attributes = attrChanges;
      }
    }
    
    // Check distress signals
    if (oldProperty.distressSignals || newProperty.distressSignals) {
      const oldSignals = new Set(oldProperty.distressSignals || []);
      const newSignals = new Set(newProperty.distressSignals || []);
      
      const added = [...newSignals].filter(s => !oldSignals.has(s));
      const removed = [...oldSignals].filter(s => !newSignals.has(s));
      
      if (added.length > 0 || removed.length > 0) {
        changes.distressSignals = { added, removed };
      }
    }
    
    return changes;
  }
  
  /**
   * Log an informational message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - INFO: ${message}\n`;
    this.logStream.write(logMessage);
    console.log(message);
  }
  
  /**
   * Log an error message
   */
  logError(message, error) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ERROR: ${message}\n${error ? error.stack : ''}\n`;
    this.logStream.write(logMessage);
    console.error(message, error);
  }
}

module.exports = DatabaseConnector;
