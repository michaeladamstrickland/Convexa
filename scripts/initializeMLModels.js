/**
 * initializeMLModels.js
 * Script to initialize and configure the ML models
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import MLClient from '../services/MLClient.js';
import mlConfig from '../config/mlConfig.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  // Local model paths
  localModelPaths: {
    propertyValuation: path.join(__dirname, '../models/property-valuation'),
    distressPredictor: path.join(__dirname, '../models/distress-predictor'),
    leadScoring: path.join(__dirname, '../models/lead-scoring'),
    contactRecommendation: path.join(__dirname, '../models/contact-recommendation')
  },
  
  // Remote model URLs (for downloading pre-trained models)
  remoteModelUrls: {
    propertyValuation: process.env.PROPERTY_VALUATION_MODEL_URL,
    distressPredictor: process.env.DISTRESS_PREDICTOR_MODEL_URL,
    leadScoring: process.env.LEAD_SCORING_MODEL_URL,
    contactRecommendation: process.env.CONTACT_RECOMMENDATION_MODEL_URL
  },
  
  // Whether to use remote models
  useRemoteModels: process.env.USE_REMOTE_MODELS === 'true',
  
  // Configuration file path
  configFilePath: path.join(__dirname, '../config/mlConfig.js'),
  
  // ML Service URL
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  
  // API Key for ML service
  apiKey: process.env.ML_API_KEY || mlConfig.apiKey
};

/**
 * Initialize the ML models
 */
const initializeModels = async () => {
  logger.info('Initializing ML models...');
  
  try {
    // Create models directory if it doesn't exist
    const modelsDir = path.join(__dirname, '../models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
      logger.info('Created models directory');
    }
    
    // Initialize ML client
    const mlClient = new MLClient({
      ...mlConfig,
      apiKey: config.apiKey,
      baseUrl: config.mlServiceUrl
    });
    
    // Check ML service health
    const healthCheck = await mlClient.healthCheck().catch(() => false);
    
    if (!healthCheck) {
      logger.warn('ML service is not available. Using fallback mode.');
      await initializeFallbackModels();
      return;
    }
    
    logger.info('ML service is available. Checking model status...');
    
    // Download or update models if needed
    if (config.useRemoteModels) {
      await downloadRemoteModels();
    } else {
      await setupLocalModels();
    }
    
    logger.info('ML models initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize ML models:', error);
    throw error;
  }
};

/**
 * Initialize fallback models (when ML service is unavailable)
 */
const initializeFallbackModels = async () => {
  logger.info('Initializing fallback models...');
  
  // Create fallback model configurations for offline use
  const fallbackConfig = {
    useRateLimiting: false,
    useModelCache: true,
    modelCachePath: path.join(__dirname, '../data/model-cache.json'),
    cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
    logging: {
      enabled: true,
      console: true,
      path: path.join(__dirname, '../logs/ml-client.log')
    }
  };
  
  // Update the config file with fallback settings
  updateConfigFile(fallbackConfig);
  
  logger.info('Fallback models initialized');
};

/**
 * Download remote models if configured
 */
const downloadRemoteModels = async () => {
  logger.info('Checking for remote models to download...');
  
  for (const [modelType, url] of Object.entries(config.remoteModelUrls)) {
    if (!url) {
      logger.debug(`No remote URL configured for ${modelType} model`);
      continue;
    }
    
    const modelDir = config.localModelPaths[modelType];
    
    // Skip if model already exists and is recent (within last 30 days)
    if (fs.existsSync(path.join(modelDir, 'model.json'))) {
      const stats = fs.statSync(path.join(modelDir, 'model.json'));
      const modifiedTime = new Date(stats.mtime);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (modifiedTime > thirtyDaysAgo) {
        logger.info(`Model ${modelType} already exists and is recent. Skipping download.`);
        continue;
      }
    }
    
    logger.info(`Downloading ${modelType} model from remote URL...`);
    
    try {
      // Create model directory if it doesn't exist
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      // Download model file
      const response = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(path.join(modelDir, 'model.zip'));
      
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      logger.info(`Downloaded ${modelType} model successfully`);
      
      // TODO: Extract zip file and set up model
      // This would depend on the specific model format and requirements
    } catch (error) {
      logger.error(`Failed to download ${modelType} model:`, error);
    }
  }
};

/**
 * Set up local models
 */
const setupLocalModels = async () => {
  logger.info('Setting up local models...');
  
  // Check each model directory
  for (const [modelType, modelDir] of Object.entries(config.localModelPaths)) {
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
      logger.info(`Created directory for ${modelType} model`);
      
      // Create placeholder model config
      const placeholderConfig = {
        modelType,
        version: '0.1.0',
        createDate: new Date().toISOString(),
        parameters: {
          // Default parameters would go here
        },
        metadata: {
          description: `Placeholder for ${modelType} model`,
          status: 'inactive'
        }
      };
      
      fs.writeFileSync(
        path.join(modelDir, 'model-config.json'),
        JSON.stringify(placeholderConfig, null, 2)
      );
    } else {
      logger.info(`Model directory for ${modelType} already exists`);
    }
  }
};

/**
 * Update the ML config file
 * @param {Object} newConfig - New configuration values
 */
const updateConfigFile = (newConfig) => {
  try {
    const configPath = config.configFilePath;
    
    if (!fs.existsSync(configPath)) {
      logger.error('ML config file not found');
      return;
    }
    
    // Read existing config
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Extract the config object (assuming it's an ES module)
    const configMatch = configContent.match(/const config = ({[\s\S]+?});/);
    
    if (!configMatch || !configMatch[1]) {
      logger.error('Could not parse ML config file');
      return;
    }
    
    // Parse the config object
    const configObj = eval(`(${configMatch[1]})`);
    
    // Merge with new config
    const mergedConfig = { ...configObj, ...newConfig };
    
    // Update the file content
    const updatedContent = configContent.replace(
      /const config = ({[\s\S]+?});/,
      `const config = ${JSON.stringify(mergedConfig, null, 2)};`
    );
    
    // Write the updated config
    fs.writeFileSync(configPath, updatedContent, 'utf8');
    
    logger.info('Updated ML config file');
  } catch (error) {
    logger.error('Failed to update ML config file:', error);
  }
};

/**
 * Generate a unique session ID for ML training
 * @returns {string} Session ID
 */
const generateSessionId = () => {
  return `ml_training_${uuidv4()}`;
};

/**
 * Main execution function
 */
const main = async () => {
  logger.info('Starting ML model initialization');
  
  try {
    await initializeModels();
    logger.info('ML model initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('ML model initialization failed:', error);
    process.exit(1);
  }
};

// Run the script if directly executed
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export {
  initializeModels,
  initializeFallbackModels,
  updateConfigFile,
  generateSessionId
};
