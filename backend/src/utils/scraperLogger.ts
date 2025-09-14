/**
 * Scraper Logger Utility
 * 
 * Provides enhanced logging functionality specific to the scraper modules.
 * Allows for saving detailed logs and results for better debugging and monitoring.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Define paths
const LOG_DIR = path.join(__dirname, '../../logs/scrapers');
const RESULTS_DIR = path.join(__dirname, '../../data/scraper-results');

// Ensure directories exist
[LOG_DIR, RESULTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Save scraper results to a JSON file for analysis
 */
export const saveScraperResults = (source: string, results: any[], jobId: string): string => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${source}-${jobId}-${timestamp}.json`;
    const filePath = path.join(RESULTS_DIR, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    logger.info(`Saved ${results.length} ${source} scraper results to ${filename}`);
    
    return filePath;
  } catch (error) {
    logger.error(`Error saving scraper results:`, error);
    return '';
  }
};

/**
 * Log detailed scraper activity
 */
export const logScraperActivity = (
  source: string, 
  jobId: string, 
  action: string, 
  details: any
): void => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      source,
      jobId,
      action,
      details
    };
    
    // Append to log file
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `scraper-activity-${today}.log`);
    
    fs.appendFileSync(
      logFile, 
      `${JSON.stringify(logEntry)}\n`
    );
    
    // Also log to main logger
    logger.info(`[${source}][${jobId}] ${action}`);
  } catch (error) {
    logger.error(`Error logging scraper activity:`, error);
  }
};

export default {
  saveScraperResults,
  logScraperActivity
};
