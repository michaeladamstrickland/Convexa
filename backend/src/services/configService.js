/**
 * Configuration Service
 * 
 * A centralized configuration management service that handles environment variables,
 * application settings, and other configuration values.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Default configurations
const defaultConfig = {
  // Server settings
  PORT: 3000,
  HOST: 'localhost',
  NODE_ENV: 'development',
  
  // Database settings
  DB_PATH: path.join(process.cwd(), 'data', 'database.sqlite'),
  PRISMA_DB_URL: process.env.PRISMA_DATABASE_URL || 'file:./dev.db',
  
  // API settings
  API_VERSION: 'v1',
  API_PREFIX: '/api',
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-do-not-use-in-production',
  JWT_EXPIRES_IN: '7d',
  
  // External API credentials
  ATTOM_API_KEY: process.env.ATTOM_API_KEY || '',
  SMARTY_AUTH_ID: process.env.SMARTY_AUTH_ID || '',
  SMARTY_AUTH_TOKEN: process.env.SMARTY_AUTH_TOKEN || '',
  
  // File storage
  UPLOAD_DIR: path.join(process.cwd(), 'uploads'),
  MAX_FILE_SIZE: 1024 * 1024 * 10, // 10MB
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: path.join(process.cwd(), 'logs', 'leadflow-ai.log'),
  
  // Performance
  DB_POOL_SIZE: 5,
  CACHE_TTL: 3600, // 1 hour in seconds
  
  // Feature flags
  ENABLE_SKIP_TRACE: true,
  ENABLE_ATTOM_BATCH: true,
  ENABLE_LEAD_SCORING: true
};

/**
 * Configuration Service Class
 */
class ConfigService {
  constructor() {
    this.config = { ...defaultConfig };
    
    // Override with environment variables
    Object.keys(this.config).forEach(key => {
      if (process.env[key] !== undefined) {
        // Convert string values to appropriate types
        const value = process.env[key];
        if (value === 'true' || value === 'false') {
          this.config[key] = value === 'true';
        } else if (!isNaN(value) && value.trim() !== '') {
          this.config[key] = Number(value);
        } else {
          this.config[key] = value;
        }
      }
    });
    
    // Load custom config if exists
    this.loadCustomConfig();
  }
  
  /**
   * Load custom configuration from a JSON file
   */
  loadCustomConfig() {
    const customConfigPath = path.join(process.cwd(), 'config.json');
    
    if (fs.existsSync(customConfigPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'));
        this.config = { ...this.config, ...customConfig };
        console.log('Loaded custom configuration from config.json');
      } catch (error) {
        console.error('Error loading custom config:', error);
      }
    }
  }
  
  /**
   * Get a configuration value
   * 
   * @param {string} key - Configuration key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} Configuration value
   */
  get(key, defaultValue = undefined) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
  
  /**
   * Set a configuration value
   * 
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   */
  set(key, value) {
    this.config[key] = value;
  }
  
  /**
   * Check if a configuration key exists
   * 
   * @param {string} key - Configuration key
   * @returns {boolean} Whether the key exists
   */
  has(key) {
    return this.config[key] !== undefined;
  }
  
  /**
   * Get all configuration values
   * 
   * @returns {Object} All configuration values
   */
  getAll() {
    return { ...this.config };
  }
  
  /**
   * Save current configuration to a file
   * 
   * @param {string} filePath - Path to save the configuration
   * @returns {boolean} Whether the save was successful
   */
  saveToFile(filePath = path.join(process.cwd(), 'config.json')) {
    try {
      // Ensure the directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save config to file
      fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2));
      console.log(`Configuration saved to ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }
  
  /**
   * Load sensitive configuration from secure storage
   * 
   * @returns {boolean} Whether the load was successful
   */
  loadSecureConfig() {
    // In a production environment, this would load from a secure vault
    // such as AWS Secrets Manager, HashiCorp Vault, etc.
    
    // For this example, we'll just check for a secure.env file
    const secureEnvPath = path.join(process.cwd(), 'secure.env');
    
    if (fs.existsSync(secureEnvPath)) {
      try {
        const secureEnv = dotenv.parse(fs.readFileSync(secureEnvPath));
        Object.assign(this.config, secureEnv);
        console.log('Loaded secure configuration');
        return true;
      } catch (error) {
        console.error('Error loading secure config:', error);
        return false;
      }
    }
    
    return false;
  }
}

// Export a singleton instance
export const configService = new ConfigService();

// Export the class for testing
export default ConfigService;
