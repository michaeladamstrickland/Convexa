/**
 * Enhanced Debug script for the Zillow Scraper
 * 
 * This script provides comprehensive debugging for scraper functionality
 * with detailed error reporting and parameter validation.
 */

import { zillowScraper } from '../scrapers/zillowScraper';
import { enhancedZillowScraper } from '../scrapers/enhancedZillowScraper';
import { logger } from '../utils/logger';
import { logDetailedError } from '../utils/errorLogger';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let mode = 'both'; // default
  let zipCodes = ['08106'];
  let maxPages = 1;
  
  // Check for mode argument (standard, enhanced, or both)
  if (args[0] === 'standard' || args[0] === 'enhanced' || args[0] === 'both') {
    mode = args[0];
    args.shift();
  }
  
  // Check for zip codes
  if (args[0] && args[0].includes(',')) {
    zipCodes = args[0].split(',').map(zip => zip.trim());
    args.shift();
  } else if (args[0] && /^\d{5}$/.test(args[0])) {
    zipCodes = [args[0]];
    args.shift();
  }
  
  // Check for max pages
  if (args[0] && !isNaN(parseInt(args[0]))) {
    maxPages = Math.min(Math.max(parseInt(args[0]), 1), 10); // Between 1 and 10
    args.shift();
  }
  
  return { mode, zipCodes, maxPages };
}

/**
 * Run a single scraper test with timing and error handling
 */
async function runScraperTest(scraperType: 'standard' | 'enhanced', zipCodes: string[], maxPages: number) {
  const scraper = scraperType === 'standard' ? zillowScraper : enhancedZillowScraper;
  const startTime = Date.now();
  
  try {
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`Testing ${scraperType} Zillow scraper...`);
    logger.info(`Zip codes: ${zipCodes.join(', ')}`);
    logger.info(`Max pages: ${maxPages}`);
    
    // Run the scraper
    const results = await scraper.runFullScrape(zipCodes, maxPages);
    const duration = (Date.now() - startTime) / 1000;
    
    // Validate results
    const validArray = Array.isArray(results);
    
    logger.info(`✅ ${scraperType} scraper completed in ${duration.toFixed(2)}s`);
    logger.info(`Result type: ${typeof results}`);
    logger.info(`Is array: ${validArray}`);
    
    if (validArray) {
      logger.info(`Found ${results.length} listings`);
      
      // Log sample result (first one if available)
      if (results.length > 0) {
        const sample = results[0];
        logger.info(`Sample listing: ${sample.address}, ${sample.city}, ${sample.state} ${sample.zipCode}`);
        logger.info(`Price: $${sample.price}, Beds: ${sample.bedrooms}, Baths: ${sample.bathrooms}`);
      }
    } else {
      logger.error(`❌ Invalid result type: expected array, got ${typeof results}`);
    }
    
    return {
      success: true,
      duration,
      resultCount: validArray ? results.length : 0
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    logger.error(`❌ ${scraperType} scraper failed after ${duration.toFixed(2)}s`);
    logDetailedError(error, { scraperType, zipCodes, maxPages }, 'ScraperTest');
    
    return {
      success: false,
      duration,
      error
    };
  }
}

/**
 * Run scraper tests based on command line arguments
 */
async function runTests() {
  const { mode, zipCodes, maxPages } = parseArgs();
  
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`SCRAPER DEBUG UTILITY`);
  logger.info(`Mode: ${mode}`);
  logger.info(`Zip codes: ${zipCodes.join(', ')}`);
  logger.info(`Max pages: ${maxPages}`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const results: Record<string, any> = {};
  
  // Run tests based on selected mode
  if (mode === 'standard' || mode === 'both') {
    results.standard = await runScraperTest('standard', zipCodes, maxPages);
  }
  
  if (mode === 'enhanced' || mode === 'both') {
    results.enhanced = await runScraperTest('enhanced', zipCodes, maxPages);
  }
  
  // Print summary
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`TEST SUMMARY`);
  
  if (results.standard) {
    logger.info(`Standard: ${results.standard.success ? '✅ Success' : '❌ Failed'} in ${results.standard.duration.toFixed(2)}s`);
    if (results.standard.success) {
      logger.info(`Standard results: ${results.standard.resultCount}`);
    }
  }
  
  if (results.enhanced) {
    logger.info(`Enhanced: ${results.enhanced.success ? '✅ Success' : '❌ Failed'} in ${results.enhanced.duration.toFixed(2)}s`);
    if (results.enhanced.success) {
      logger.info(`Enhanced results: ${results.enhanced.resultCount}`);
    }
  }
  
  // Compare if both were tested
  if (results.standard && results.enhanced && results.standard.success && results.enhanced.success) {
    const standardCount = results.standard.resultCount;
    const enhancedCount = results.enhanced.resultCount;
    
    logger.info(`Comparison: Enhanced found ${enhancedCount > standardCount ? 'more' : 'fewer'} results`);
    logger.info(`Difference: ${Math.abs(enhancedCount - standardCount)} listings`);
    
    if (enhancedCount > standardCount) {
      logger.info(`Enhanced scraper found ${((enhancedCount / standardCount - 1) * 100).toFixed(1)}% more listings`);
    } else if (standardCount > enhancedCount) {
      logger.info(`Standard scraper found ${((standardCount / enhancedCount - 1) * 100).toFixed(1)}% more listings`);
    } else {
      logger.info(`Both scrapers found the same number of listings`);
    }
  }
  
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// Run the tests
runTests()
  .then(() => {
    logger.info('Scraper tests completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Fatal error running scraper tests:', error);
    process.exit(1);
  });

// Export for potential use in other tests
export { runTests };
