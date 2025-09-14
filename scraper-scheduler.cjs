/**
 * scraper-scheduler.cjs
 * Scheduler for running scrapers based on configuration
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const ZillowScraper = require('./src/scraping/zillow-scraper.cjs');
const ScrapingPipeline = require('./src/scrapingPipeline.cjs');
const { scorePropertyBatch } = require('./src/scoring/leadScoring.cjs');

// Load configuration
let config;
try {
  const configPath = path.join(__dirname, 'config', 'scraper-config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.error('Error loading configuration:', error);
  process.exit(1);
}

// Initialize logger
const logFile = path.join(__dirname, config.general.logFile || './data/scraper.log');
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - INFO: ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ERROR: ${message}\n${error ? error.stack : ''}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.error(message, error);
  },
  warn: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - WARN: ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.warn(message);
  }
};

// Initialize scraping pipeline
const pipeline = new ScrapingPipeline({
  storagePath: path.join(__dirname, 'data')
});

/**
 * Run the Zillow scraper for a target area
 */
async function runZillowScraper(target, distressedOnly = false) {
  logger.info(`Running Zillow scraper for: ${target}${distressedOnly ? ' (distressed only)' : ''}`);
  
  const scraperConfig = config.scraperSpecific.zillow;
  const scraper = new ZillowScraper({
    headless: config.general.headless,
    screenshots: config.general.screenshotsEnabled,
    screenshotDir: path.join(__dirname, config.general.screenshotDir, 'zillow'),
    useProxy: config.proxyConfig.enabled,
    proxyUrl: config.proxyConfig.enabled && config.proxyConfig.providers.find(p => p.enabled)?.url
  });
  
  try {
    await scraper.initialize();
    
    let properties = [];
    
    if (distressedOnly) {
      properties = await scraper.searchDistressedProperties(
        target, 
        scraperConfig.searchResultsLimit
      );
      logger.info(`Found ${properties.length} distressed properties in ${target}`);
    } else {
      // For demonstration, search for a few properties by address in this area
      const addressesToTry = [
        `123 Main St, ${target}`,
        `456 Oak Ave, ${target}`
      ];
      
      for (const address of addressesToTry) {
        const results = await scraper.searchByAddress(address);
        properties.push(...results);
        
        // Add delay between searches
        await new Promise(r => setTimeout(r, 
          scraperConfig.searchDelay + Math.random() * 1000));
      }
      
      logger.info(`Found ${properties.length} properties by address search in ${target}`);
    }
    
    // Process properties through pipeline
    if (properties.length > 0) {
      const processedProperties = await pipeline.processScrapedProperties({
        source: 'ZILLOW',
        items: properties
      }, {
        enhanceWithAttom: true,
        deduplicate: true,
        scoreLeads: true
      });
      
      // Save results to timestamped file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsFile = `zillow-${distressedOnly ? 'distressed-' : ''}${target.replace(/,?\s+/g, '-').toLowerCase()}-${timestamp}.json`;
      
      pipeline.saveResultsToFile(processedProperties, resultsFile);
      
      // Log high-scoring leads
      const hotLeads = processedProperties.filter(p => 
        p.scoring && p.scoring.classification === 'HOT');
      
      if (hotLeads.length > 0) {
        logger.info(`Found ${hotLeads.length} HOT leads!`);
        hotLeads.forEach(lead => {
          logger.info(`HOT Lead: ${lead.address}, Score: ${lead.scoring.totalScore}, Distress: ${lead.distressSignals.join(', ')}`);
        });
      }
    }
    
    await scraper.close();
    logger.info(`Finished Zillow scraper run for: ${target}`);
  } catch (error) {
    logger.error(`Error running Zillow scraper for ${target}:`, error);
  } finally {
    try {
      await scraper.close();
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Schedule all scrapers based on configuration
 */
function scheduleScrapers() {
  const schedules = config.schedules;
  
  // Schedule Zillow scraper
  if (schedules.zillow && schedules.zillow.cron) {
    logger.info(`Scheduling Zillow scraper: ${schedules.zillow.cron}`);
    
    cron.schedule(schedules.zillow.cron, () => {
      const targets = schedules.zillow.targets || [];
      const distressedOnly = schedules.zillow.distressedOnly || false;
      
      targets.forEach(target => {
        // Stagger scraper runs to avoid overwhelming resources
        setTimeout(() => {
          runZillowScraper(target, distressedOnly).catch(error => {
            logger.error(`Scheduled Zillow scraper failed:`, error);
          });
        }, Math.random() * 60000); // Random delay up to 1 minute
      });
    });
  }
  
  // Add other scrapers here when implemented
  
  logger.info('All scrapers scheduled successfully');
}

/**
 * Main function
 */
async function main() {
  logger.info('Starting scraper scheduler...');
  
  try {
    // Schedule scrapers
    scheduleScrapers();
    
    // Run immediate test if requested
    if (process.argv.includes('--test')) {
      const target = process.argv[process.argv.indexOf('--test') + 1] || 'Los Angeles, CA';
      const distressedOnly = process.argv.includes('--distressed');
      
      logger.info(`Running immediate test for ${target}${distressedOnly ? ' (distressed only)' : ''}`);
      await runZillowScraper(target, distressedOnly);
    }
    
    logger.info('Scraper scheduler running...');
  } catch (error) {
    logger.error('Error in main:', error);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
