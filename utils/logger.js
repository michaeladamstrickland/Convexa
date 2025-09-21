/**
 * logger.js
 * Utility for logging application events
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Configuration
const config = {
  level: process.env.LOG_LEVEL || 'INFO',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false',
  logToFile: process.env.LOG_TO_FILE !== 'false',
  logFilePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../logs/convexa-ai.log'),
  maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '10485760', 10), // 10MB default
  logRotation: true
};

// Create logs directory if it doesn't exist
if (config.logToFile) {
  const logDirectory = path.dirname(config.logFilePath);
  if (!fs.existsSync(logDirectory)) {
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
    }
  }
}

/**
 * Format the log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

/**
 * Write log to file
 * @param {string} formattedMessage - Formatted log message
 */
const writeToFile = (formattedMessage) => {
  if (!config.logToFile) return;
  
  try {
    // Check if file exists and if it exceeds max size
    let shouldRotate = false;
    
    if (config.logRotation && fs.existsSync(config.logFilePath)) {
      const stats = fs.statSync(config.logFilePath);
      shouldRotate = stats.size > config.maxLogFileSize;
      
      if (shouldRotate) {
        // Rotate log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFilePath = `${config.logFilePath}.${timestamp}`;
        fs.renameSync(config.logFilePath, rotatedFilePath);
      }
    }
    
    // Append to log file
    fs.appendFileSync(config.logFilePath, formattedMessage + '\n');
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
};

/**
 * Log a message at the specified level
 * @param {string} level - Log level
 * @param {string} message - Log message
 */
const log = (level, message) => {
  if (LOG_LEVELS[level] > LOG_LEVELS[config.level]) return;
  
  const formattedMessage = formatLogMessage(level, message);
  
  if (config.logToConsole) {
    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else if (level === 'WARN') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }
  
  writeToFile(formattedMessage);
};

/**
 * Logger object with methods for different log levels
 */
const logger = {
  error: (message, error) => {
    if (error) {
      const errorMessage = error.stack || error.message || error;
      log('ERROR', `${message}: ${errorMessage}`);
    } else {
      log('ERROR', message);
    }
  },
  
  warn: (message) => {
    log('WARN', message);
  },
  
  info: (message) => {
    log('INFO', message);
  },
  
  debug: (message) => {
    log('DEBUG', message);
  },
  
  /**
   * Set the log level
   * @param {string} level - New log level
   */
  setLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      config.level = level;
    }
  },
  
  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig: () => {
    return { ...config };
  },
  
  /**
   * Update logger configuration
   * @param {Object} newConfig - New configuration values
   */
  configure: (newConfig) => {
    Object.assign(config, newConfig);
  }
};

export default logger;
