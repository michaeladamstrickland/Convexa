/**
 * MLClient.js
 * Client for connecting to machine learning models in the Convexa AI system
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import mlConfig from '../config/mlConfig.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MLClient {
  constructor(config = {}) {
    this.config = {
      ...mlConfig,
      ...config
    };
    
    this.baseUrl = this.config.modelEndpoints.baseUrl || 'http://localhost:5000';
    this.apiKey = this.config.apiKey;
    this.modelCache = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.logEnabled = this.config.logging.enabled || false;
    this.logPath = this.config.logging.path || './ml-client.log';
  }

  /**
   * Initialize the ML client
   */
  async initialize() {
    this.log('Initializing ML client');
    try {
      // Check connection to ML service
      try {
        await this.healthCheck();
        this.log('ML service connection established');
      } catch (healthError) {
        this.log(`Health check failed: ${healthError.message}`, 'ERROR');
        this.log('Continuing in fallback mode');
      }
      
      // Load cached models if available
      if (this.config.useModelCache) {
        await this.loadModelCache();
      }
      
      return true;
    } catch (error) {
      this.log(`ML client initialization failed: ${error.message}`, 'ERROR');
      return false;
    }
  }
  
  /**
   * Check health of ML service
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        headers: this.getHeaders()
      });
      
      return response.data.status === 'ok';
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'ERROR');
      throw new Error('ML service is unavailable');
    }
  }

  /**
   * Get prediction for property value
   * @param {Object} propertyData - Property data for prediction
   * @returns {Promise<Object>} Prediction results
   */
  async predictPropertyValue(propertyData) {
    this.log(`Predicting property value for ${propertyData.address || 'unknown address'}`);
    
    try {
      const response = await this.callModel(
        this.config.modelEndpoints.propertyValuation,
        propertyData
      );
      
      return {
        estimatedValue: response.predictedValue,
        confidenceScore: response.confidence,
        comparables: response.comparables || [],
        metadata: response.metadata
      };
    } catch (error) {
      this.log(`Property value prediction failed: ${error.message}`, 'ERROR');
      return {
        estimatedValue: null,
        confidenceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Predict distress signals for a property
   * @param {Object} propertyData - Property data
   * @returns {Promise<Object>} Distress prediction
   */
  async predictDistressSignals(propertyData) {
    this.log(`Predicting distress signals for ${propertyData.address || 'unknown address'}`);
    
    try {
      const response = await this.callModel(
        this.config.modelEndpoints.distressPredictor,
        propertyData
      );
      
      return {
        distressScore: response.distressScore,
        distressSignals: response.signals || [],
        confidenceScore: response.confidence,
        recommendations: response.recommendations || []
      };
    } catch (error) {
      this.log(`Distress prediction failed: ${error.message}`, 'ERROR');
      return {
        distressScore: 0,
        distressSignals: [],
        confidenceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate lead score based on property and owner data
   * @param {Object} leadData - Lead data for scoring
   * @returns {Promise<Object>} Lead score results
   */
  async generateLeadScore(leadData) {
    this.log(`Generating lead score for ${leadData.address || 'unknown address'}`);
    
    try {
      const response = await this.callModel(
        this.config.modelEndpoints.leadScoring,
        leadData
      );
      
      return {
        totalScore: response.score,
        classification: response.classification,
        factors: response.factors || [],
        confidenceScore: response.confidence,
        recommendations: response.recommendations || []
      };
    } catch (error) {
      this.log(`Lead scoring failed: ${error.message}`, 'ERROR');
      return {
        totalScore: 0,
        classification: 'UNKNOWN',
        factors: [],
        confidenceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Find best contact method for a property owner
   * @param {Object} ownerData - Owner data
   * @returns {Promise<Object>} Contact recommendations
   */
  async findBestContactMethod(ownerData) {
    this.log(`Finding best contact method for owner ${ownerData.name || 'unknown'}`);
    
    try {
      const response = await this.callModel(
        this.config.modelEndpoints.contactRecommendation,
        ownerData
      );
      
      return {
        recommendedMethod: response.recommendedMethod,
        alternativeMethods: response.alternativeMethods || [],
        bestTimes: response.bestTimes || [],
        confidenceScore: response.confidence,
        personalizedMessage: response.personalizedMessage
      };
    } catch (error) {
      this.log(`Contact method recommendation failed: ${error.message}`, 'ERROR');
      return {
        recommendedMethod: 'UNKNOWN',
        alternativeMethods: [],
        bestTimes: [],
        confidenceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Recommend next actions for a lead
   * @param {Object} leadData - Lead data
   * @returns {Promise<Object>} Action recommendations
   */
  async recommendNextActions(leadData) {
    this.log(`Recommending next actions for lead at ${leadData.address || 'unknown address'}`);
    
    try {
      const response = await this.callModel(
        this.config.modelEndpoints.actionRecommendation,
        leadData
      );
      
      return {
        actions: response.actions || [],
        priorityRanking: response.priorityRanking || [],
        expectedOutcomes: response.expectedOutcomes || {},
        confidenceScore: response.confidence
      };
    } catch (error) {
      this.log(`Action recommendation failed: ${error.message}`, 'ERROR');
      return {
        actions: [],
        priorityRanking: [],
        expectedOutcomes: {},
        confidenceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Submit feedback to improve ML models
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<boolean>} Success status
   */
  async submitFeedback(feedbackData) {
    this.log('Submitting feedback to ML service');
    
    try {
      const response = await axios.post(
        `${this.baseUrl}${this.config.modelEndpoints.feedback}`,
        feedbackData,
        {
          headers: this.getHeaders()
        }
      );
      
      this.log('Feedback submitted successfully');
      return response.data.success || false;
    } catch (error) {
      this.log(`Feedback submission failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  /**
   * Train or retrain a specific model
   * @param {string} modelType - Type of model to train
   * @param {Object} trainingData - Training data or configuration
   * @returns {Promise<Object>} Training results
   */
  async trainModel(modelType, trainingData = {}) {
    this.log(`Training model: ${modelType}`);
    
    try {
      const response = await axios.post(
        `${this.baseUrl}${this.config.modelEndpoints.training}/${modelType}`,
        trainingData,
        {
          headers: this.getHeaders()
        }
      );
      
      this.log(`Training for model ${modelType} initiated successfully`);
      return {
        trainingId: response.data.trainingId,
        status: response.data.status,
        estimatedCompletionTime: response.data.estimatedCompletionTime
      };
    } catch (error) {
      this.log(`Model training failed: ${error.message}`, 'ERROR');
      return {
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Get training status for a model
   * @param {string} trainingId - Training ID
   * @returns {Promise<Object>} Training status
   */
  async getTrainingStatus(trainingId) {
    this.log(`Checking training status for ID: ${trainingId}`);
    
    try {
      const response = await axios.get(
        `${this.baseUrl}${this.config.modelEndpoints.trainingStatus}/${trainingId}`,
        {
          headers: this.getHeaders()
        }
      );
      
      return {
        status: response.data.status,
        progress: response.data.progress,
        metrics: response.data.metrics || {},
        estimatedCompletionTime: response.data.estimatedCompletionTime
      };
    } catch (error) {
      this.log(`Failed to get training status: ${error.message}`, 'ERROR');
      return {
        status: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Call a specific ML model
   * @param {string} endpoint - Model endpoint
   * @param {Object} data - Input data
   * @returns {Promise<Object>} Model response
   */
  async callModel(endpoint, data) {
    const requestId = uuidv4();
    
    // Add to queue if we're rate limiting
    if (this.config.useRateLimiting) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          id: requestId,
          endpoint,
          data,
          resolve,
          reject
        });
        
        if (!this.processing) {
          this.processQueue();
        }
      });
    }
    
    // Otherwise make direct call
    return this.makeModelRequest(endpoint, data);
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    if (this.requestQueue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    const request = this.requestQueue.shift();
    
    try {
      const result = await this.makeModelRequest(request.endpoint, request.data);
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
    
    // Wait for the rate limit
    setTimeout(() => {
      this.processQueue();
    }, this.config.rateLimitMs || 200);
  }

  /**
   * Make actual request to model endpoint
   * @param {string} endpoint - Model endpoint
   * @param {Object} data - Input data
   * @returns {Promise<Object>} Model response
   */
  async makeModelRequest(endpoint, data) {
    try {
      // Check if endpoint exists
      if (!endpoint) {
        throw new Error('Invalid model endpoint');
      }
      
      // Add timestamp to request
      const requestData = {
        ...data,
        timestamp: new Date().toISOString(),
        requestId: uuidv4()
      };
      
      this.log(`Making request to: ${this.baseUrl}${endpoint}`, 'DEBUG');
      
      const response = await axios.post(
        `${this.baseUrl}${endpoint}`,
        requestData,
        {
          headers: this.getHeaders(),
          timeout: this.config.requestTimeoutMs || 30000
        }
      );
      
      this.log(`Request succeeded with status: ${response.status}`, 'DEBUG');
      return response.data;
    } catch (error) {
      this.log(`Model request failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Get request headers
   * @returns {Object} Headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * Load model cache from disk
   */
  async loadModelCache() {
    const cachePath = this.config.modelCachePath;
    if (!cachePath || !fs.existsSync(cachePath)) {
      return;
    }
    
    try {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      
      // Check cache expiry
      if (cacheData.expiry && new Date(cacheData.expiry) > new Date()) {
        this.modelCache = new Map(Object.entries(cacheData.models || {}));
        this.log(`Loaded ${this.modelCache.size} models from cache`);
      } else {
        this.log('Model cache expired, skipping load');
      }
    } catch (error) {
      this.log(`Failed to load model cache: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Save model cache to disk
   */
  saveModelCache() {
    if (!this.config.useModelCache || !this.config.modelCachePath) {
      return;
    }
    
    try {
      const cacheDir = path.dirname(this.config.modelCachePath);
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const cacheData = {
        expiry: new Date(Date.now() + (this.config.cacheTtlMs || 86400000)).toISOString(),
        models: Object.fromEntries(this.modelCache)
      };
      
      fs.writeFileSync(this.config.modelCachePath, JSON.stringify(cacheData, null, 2));
      this.log('Model cache saved successfully');
    } catch (error) {
      this.log(`Failed to save model cache: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Log a message
   * @param {string} message - Message to log
   * @param {string} level - Log level
   */
  log(message, level = 'INFO') {
    if (!this.logEnabled) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    if (this.config.logging.console) {
      console.log(logEntry);
    }
    
    if (this.logPath) {
      try {
        fs.appendFileSync(this.logPath, logEntry + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error.message}`);
      }
    }
  }

  /**
   * Close the ML client and cleanup resources
   */
  async close() {
    this.log('Closing ML client');
    
    if (this.config.useModelCache) {
      this.saveModelCache();
    }
    
    // Cancel any pending requests
    this.requestQueue = [];
    this.processing = false;
    
    this.log('ML client closed');
  }
}

export default MLClient;
