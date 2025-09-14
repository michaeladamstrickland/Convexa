/**
 * MLPredictionService.js
 * Service for handling ML predictions in the scraping pipeline
 */

import MLClient from './MLClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MLPredictionService {
  constructor(config = {}) {
    this.config = {
      modelConfigPath: path.join(__dirname, '../config/mlConfig.js'),
      resultsCachePath: path.join(__dirname, '../data/prediction-cache'),
      cacheEnabled: true,
      cacheTtlHours: 24,
      batchSize: 10,
      ...config
    };
    
    this.mlClient = new MLClient(this.config);
    this.predictionCache = new Map();
    this.predictionQueue = [];
    this.processing = false;
    
    // Ensure cache directory exists
    if (this.config.cacheEnabled && !fs.existsSync(this.config.resultsCachePath)) {
      fs.mkdirSync(this.config.resultsCachePath, { recursive: true });
    }
  }

  /**
   * Initialize the prediction service
   */
  async initialize() {
    try {
      const initialized = await this.mlClient.initialize();
      
      if (!initialized) {
        console.error('Failed to initialize ML client, prediction service will operate in fallback mode');
        return false;
      }
      
      // Load prediction cache if enabled
      if (this.config.cacheEnabled) {
        this.loadPredictionCache();
      }
      
      console.log('ML Prediction Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize ML Prediction Service:', error.message);
      return false;
    }
  }

  /**
   * Process a property to generate predictions and scores
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Enriched property with predictions
   */
  async processProperty(property) {
    if (!property || !property.address) {
      throw new Error('Invalid property data: address is required');
    }
    
    // Generate a unique identifier for the property
    const propertyId = property.id || this.generatePropertyId(property);
    
    // Check cache first if enabled
    if (this.config.cacheEnabled) {
      const cachedResult = this.getCachedPrediction(propertyId);
      if (cachedResult) {
        console.log(`Using cached prediction for property: ${property.address}`);
        return this.mergePropertyWithPredictions(property, cachedResult);
      }
    }
    
    try {
      // Create property profile with all relevant data for predictions
      const propertyProfile = this.createPropertyProfile(property);
      
      // Run predictions in parallel
      const [valueEstimate, distressSignals, leadScore] = await Promise.all([
        this.mlClient.predictPropertyValue(propertyProfile),
        this.mlClient.predictDistressSignals(propertyProfile),
        this.mlClient.generateLeadScore(propertyProfile)
      ]);
      
      // Combine predictions
      const predictionResults = {
        valueEstimate,
        distressSignals,
        leadScore,
        timestamp: new Date().toISOString(),
        propertyId
      };
      
      // Cache prediction if enabled
      if (this.config.cacheEnabled) {
        this.cachePrediction(propertyId, predictionResults);
      }
      
      // Merge predictions with property data
      return this.mergePropertyWithPredictions(property, predictionResults);
    } catch (error) {
      console.error(`Failed to process property ${property.address}:`, error.message);
      
      // Return original property with error flag
      return {
        ...property,
        mlProcessed: false,
        mlError: error.message
      };
    }
  }

  /**
   * Process a batch of properties
   * @param {Array} properties - Array of property data
   * @returns {Promise<Array>} Enriched properties with predictions
   */
  async processBatch(properties) {
    if (!Array.isArray(properties) || properties.length === 0) {
      return [];
    }
    
    console.log(`Processing batch of ${properties.length} properties`);
    
    // Process in smaller batches to avoid overwhelming the ML service
    const results = [];
    const batchSize = this.config.batchSize;
    
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(property => this.processProperty(property))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Queue property for background processing
   * @param {Object} property - Property data
   * @returns {string} Queue ID
   */
  queueProperty(property) {
    const queueId = uuidv4();
    
    this.predictionQueue.push({
      id: queueId,
      property,
      timestamp: Date.now()
    });
    
    // Start processing queue if not already processing
    if (!this.processing) {
      this.processQueue();
    }
    
    return queueId;
  }

  /**
   * Process queued property predictions
   */
  async processQueue() {
    if (this.predictionQueue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Take batch from queue
    const batchSize = this.config.batchSize;
    const batch = this.predictionQueue.splice(0, batchSize);
    
    try {
      // Extract properties from queue items
      const properties = batch.map(item => item.property);
      
      // Process batch
      await this.processBatch(properties);
      
      console.log(`Processed ${batch.length} properties from queue`);
    } catch (error) {
      console.error('Failed to process prediction queue:', error.message);
    }
    
    // Continue processing queue
    setTimeout(() => {
      this.processQueue();
    }, 1000);
  }

  /**
   * Create a contact strategy for a property owner
   * @param {Object} property - Property data with owner information
   * @returns {Promise<Object>} Contact strategy
   */
  async createContactStrategy(property) {
    if (!property || !property.owner) {
      throw new Error('Invalid property data: owner information required');
    }
    
    try {
      // Build owner profile
      const ownerProfile = {
        name: property.owner.name,
        age: property.owner.age,
        occupation: property.owner.occupation,
        contactHistory: property.owner.contactHistory || [],
        propertyDetails: {
          address: property.address,
          valueEstimate: property.valueEstimate?.estimatedValue,
          distressScore: property.distressSignals?.distressScore
        }
      };
      
      // Get contact recommendations
      const contactStrategy = await this.mlClient.findBestContactMethod(ownerProfile);
      
      // Get action recommendations
      const actionPlan = await this.mlClient.recommendNextActions({
        ...ownerProfile,
        leadScore: property.leadScore
      });
      
      return {
        contactStrategy,
        actionPlan,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to create contact strategy for ${property.address}:`, error.message);
      return {
        error: error.message,
        fallbackStrategy: {
          recommendedMethod: 'DIRECT_MAIL',
          alternativeMethods: ['EMAIL', 'PHONE'],
          message: 'We would like to discuss your property at {{address}}.'
        }
      };
    }
  }

  /**
   * Submit feedback about prediction accuracy
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<boolean>} Success status
   */
  async submitFeedback(feedbackData) {
    try {
      const success = await this.mlClient.submitFeedback(feedbackData);
      
      if (success && feedbackData.propertyId && this.config.cacheEnabled) {
        // Invalidate cache for this property
        this.invalidateCachedPrediction(feedbackData.propertyId);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to submit feedback:', error.message);
      return false;
    }
  }

  /**
   * Create a comprehensive property profile
   * @param {Object} property - Property data
   * @returns {Object} Property profile for ML models
   */
  createPropertyProfile(property) {
    // Basic property information
    const profile = {
      address: property.address,
      location: {
        latitude: property.latitude || property.location?.latitude,
        longitude: property.longitude || property.location?.longitude,
        zipCode: property.zipCode || property.postalCode
      },
      attributes: {
        bedrooms: property.bedrooms || property.attributes?.bedrooms,
        bathrooms: property.bathrooms || property.attributes?.bathrooms,
        squareFeet: property.squareFeet || property.attributes?.squareFeet,
        lotSize: property.lotSize || property.attributes?.lotSize,
        yearBuilt: property.yearBuilt || property.attributes?.yearBuilt,
        propertyType: property.propertyType || property.attributes?.propertyType
      }
    };
    
    // Add owner information if available
    if (property.owner || property.ownerName) {
      profile.owner = {
        name: property.ownerName || property.owner?.name,
        ownershipDuration: property.ownershipDuration || property.owner?.ownershipDuration
      };
    }
    
    // Add financial information if available
    if (property.financialDetails || property.lastSalePrice) {
      profile.financials = {
        lastSalePrice: property.lastSalePrice || property.financialDetails?.lastSalePrice,
        lastSaleDate: property.lastSaleDate || property.financialDetails?.lastSaleDate,
        taxAssessedValue: property.taxAssessedValue || property.financialDetails?.taxAssessedValue,
        taxesOwed: property.taxesOwed || property.financialDetails?.taxesOwed
      };
    }
    
    // Add distress signals if available
    if (property.distressSignals || property.foreclosureStatus) {
      profile.distress = {
        foreclosureStatus: property.foreclosureStatus || property.distressSignals?.foreclosureStatus,
        liens: property.liens || property.distressSignals?.liens,
        bankruptcyHistory: property.bankruptcyHistory || property.distressSignals?.bankruptcyHistory,
        propertyCondition: property.propertyCondition || property.distressSignals?.propertyCondition
      };
    }
    
    // Add market data if available
    if (property.marketData) {
      profile.market = property.marketData;
    }
    
    return profile;
  }

  /**
   * Merge property data with predictions
   * @param {Object} property - Original property data
   * @param {Object} predictions - Prediction results
   * @returns {Object} Merged property with predictions
   */
  mergePropertyWithPredictions(property, predictions) {
    return {
      ...property,
      mlProcessed: true,
      mlTimestamp: predictions.timestamp,
      valueEstimate: predictions.valueEstimate,
      distressSignals: predictions.distressSignals,
      leadScore: predictions.leadScore,
      profitPotential: this.calculateProfitPotential(
        predictions.valueEstimate,
        property.lastSalePrice || property.financialDetails?.lastSalePrice
      )
    };
  }

  /**
   * Calculate profit potential
   * @param {Object} valueEstimate - Value estimate results
   * @param {number} lastSalePrice - Last sale price
   * @returns {Object} Profit potential
   */
  calculateProfitPotential(valueEstimate, lastSalePrice) {
    if (!valueEstimate || !valueEstimate.estimatedValue || !lastSalePrice) {
      return {
        potentialProfit: null,
        confidenceScore: 0,
        returnOnInvestment: null
      };
    }
    
    const estimatedValue = valueEstimate.estimatedValue;
    const potentialProfit = estimatedValue - lastSalePrice;
    const returnOnInvestment = (potentialProfit / lastSalePrice) * 100;
    
    return {
      potentialProfit,
      returnOnInvestment,
      confidenceScore: valueEstimate.confidenceScore,
      valueGrowthPercent: ((estimatedValue / lastSalePrice) - 1) * 100
    };
  }

  /**
   * Generate a unique property ID
   * @param {Object} property - Property data
   * @returns {string} Unique property ID
   */
  generatePropertyId(property) {
    // Create a deterministic ID based on address
    const addressNormalized = property.address
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    // Include zipcode for additional uniqueness
    const zipCode = property.zipCode || property.postalCode || '';
    
    return `prop_${addressNormalized}_${zipCode}`;
  }

  /**
   * Get cached prediction for property
   * @param {string} propertyId - Property ID
   * @returns {Object|null} Cached prediction or null
   */
  getCachedPrediction(propertyId) {
    // Check memory cache first
    if (this.predictionCache.has(propertyId)) {
      const cached = this.predictionCache.get(propertyId);
      
      // Check if cache is still valid
      const cacheTtl = this.config.cacheTtlHours * 60 * 60 * 1000;
      if (Date.now() - cached.timestamp < cacheTtl) {
        return cached;
      }
      
      // Cache expired, remove from memory
      this.predictionCache.delete(propertyId);
    }
    
    // Check file cache
    if (this.config.cacheEnabled) {
      const cacheFilePath = path.join(this.config.resultsCachePath, `${propertyId}.json`);
      
      if (fs.existsSync(cacheFilePath)) {
        try {
          const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
          
          // Check cache validity
          const cacheTtl = this.config.cacheTtlHours * 60 * 60 * 1000;
          const cacheTimestamp = new Date(cacheData.timestamp).getTime();
          
          if (Date.now() - cacheTimestamp < cacheTtl) {
            // Add to memory cache and return
            this.predictionCache.set(propertyId, cacheData);
            return cacheData;
          }
          
          // Cache expired, remove file
          fs.unlinkSync(cacheFilePath);
        } catch (error) {
          console.error(`Failed to read cache file for ${propertyId}:`, error.message);
        }
      }
    }
    
    return null;
  }

  /**
   * Cache prediction results
   * @param {string} propertyId - Property ID
   * @param {Object} prediction - Prediction results
   */
  cachePrediction(propertyId, prediction) {
    // Add to memory cache
    this.predictionCache.set(propertyId, prediction);
    
    // Add to file cache if enabled
    if (this.config.cacheEnabled) {
      try {
        const cacheFilePath = path.join(this.config.resultsCachePath, `${propertyId}.json`);
        fs.writeFileSync(cacheFilePath, JSON.stringify(prediction, null, 2));
      } catch (error) {
        console.error(`Failed to write cache file for ${propertyId}:`, error.message);
      }
    }
  }

  /**
   * Invalidate cached prediction
   * @param {string} propertyId - Property ID
   */
  invalidateCachedPrediction(propertyId) {
    // Remove from memory cache
    this.predictionCache.delete(propertyId);
    
    // Remove from file cache if enabled
    if (this.config.cacheEnabled) {
      try {
        const cacheFilePath = path.join(this.config.resultsCachePath, `${propertyId}.json`);
        
        if (fs.existsSync(cacheFilePath)) {
          fs.unlinkSync(cacheFilePath);
        }
      } catch (error) {
        console.error(`Failed to delete cache file for ${propertyId}:`, error.message);
      }
    }
  }

  /**
   * Load prediction cache from disk
   */
  loadPredictionCache() {
    if (!this.config.cacheEnabled || !fs.existsSync(this.config.resultsCachePath)) {
      return;
    }
    
    try {
      // Get all cache files
      const cacheFiles = fs.readdirSync(this.config.resultsCachePath)
        .filter(file => file.endsWith('.json'));
      
      // Load most recent files into memory (limit to 100)
      const recentFiles = cacheFiles.slice(0, 100);
      
      recentFiles.forEach(file => {
        try {
          const propertyId = file.replace('.json', '');
          const cacheData = JSON.parse(
            fs.readFileSync(path.join(this.config.resultsCachePath, file), 'utf8')
          );
          
          // Check if cache is still valid
          const cacheTtl = this.config.cacheTtlHours * 60 * 60 * 1000;
          const cacheTimestamp = new Date(cacheData.timestamp).getTime();
          
          if (Date.now() - cacheTimestamp < cacheTtl) {
            this.predictionCache.set(propertyId, cacheData);
          } else {
            // Cache expired, remove file
            fs.unlinkSync(path.join(this.config.resultsCachePath, file));
          }
        } catch (error) {
          console.error(`Failed to load cache file ${file}:`, error.message);
        }
      });
      
      console.log(`Loaded ${this.predictionCache.size} predictions from cache`);
    } catch (error) {
      console.error('Failed to load prediction cache:', error.message);
    }
  }

  /**
   * Close the prediction service
   */
  async close() {
    await this.mlClient.close();
  }
}

export default MLPredictionService;
