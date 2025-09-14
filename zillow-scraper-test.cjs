/**
 * zillow-scraper-test.cjs
 * Test integration of Zillow Playwright scraper with the scraping pipeline
 */

// For simulated test only - no Playwright dependencies required
// const ZillowScraper = require('./src/scraping/zillow-scraper.cjs');
const ScrapingPipeline = require('./src/scrapingPipeline.cjs');
const fs = require('fs');
const path = require('path');

// Ensure output directory exists
const outputDir = path.join(__dirname, 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create test log file
const logFile = path.join(outputDir, 'zillow-scraper-test.log');
const logger = {
  log: (message) => {
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
  }
};

// Test addresses
const testAddresses = [
  '123 Main St, Los Angeles, CA 90001',
  // Add more addresses as needed
];

// Utility function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run test with simulated data
 */
async function runSimulatedTest() {
  logger.log('Starting simulated test with mock Zillow data');
  
  // Mock data - simulating what would come from the scraper
  const mockProperties = [
    {
      sourceKey: 'ZILLOW',
      sourceUrl: 'https://www.zillow.com/homedetails/123-main-st/123456_zpid/',
      capturedAt: new Date().toISOString(),
      address: '123 Main St, Los Angeles, CA 90001',
      normalizedAddress: '123 main st los angeles ca 90001',
      ownerName: 'John Smith',
      attributes: {
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        yearBuilt: 1985,
        lotSize: '0.25 acres',
        propertyType: 'Single Family'
      },
      priceHint: 450000,
      distressSignals: ['pre-foreclosure', 'motivated-seller'],
      contacts: [
        {
          type: 'phone',
          value: '213-555-1234',
          confidence: 0.8,
          source: 'listing'
        }
      ]
    },
    {
      sourceKey: 'ZILLOW',
      sourceUrl: 'https://www.zillow.com/homedetails/456-oak-ave/789012_zpid/',
      capturedAt: new Date().toISOString(),
      address: '456 Oak Ave, Los Angeles, CA 90002',
      normalizedAddress: '456 oak ave los angeles ca 90002',
      attributes: {
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2200,
        yearBuilt: 1992,
        lotSize: '0.3 acres',
        propertyType: 'Single Family'
      },
      priceHint: 550000,
      distressSignals: ['fixer-upper'],
      contacts: []
    }
  ];
  
  try {
    // Create a scraping pipeline instance
    const pipeline = new ScrapingPipeline({
      storagePath: path.join(__dirname, 'data')
    });
    
    // Process the mock properties through our pipeline
    const results = await pipeline.processScrapedProperties({
      source: 'ZILLOW',
      items: mockProperties
    }, { 
      enhanceWithAttom: true,
      deduplicate: true,
      scoreLeads: true
    });
    
    logger.log(`Successfully processed ${results.length} simulated properties`);
    
    // Save results
    fs.writeFileSync(
      path.join(outputDir, 'zillow-simulated-results.json'), 
      JSON.stringify(results, null, 2)
    );
    
    logger.log('Simulated test results saved to zillow-simulated-results.json');
    return results;
  } catch (error) {
    logger.error('Error in simulated test:', error);
    throw error;
  }
}

/**
 * Run live test with real scraper
 */
async function runLiveTest() {
  logger.log('Starting live test with Zillow scraper');
  
  try {
    const scraper = new ZillowScraper({
      headless: false, // Set to true in production
      screenshots: true,
      screenshotDir: path.join(outputDir, 'screenshots')
    });
    
    logger.log('Initializing scraper...');
    await scraper.initialize();
    
    const allProperties = [];
    
    // Search for properties by address
    for (const address of testAddresses) {
      logger.log(`Searching for address: ${address}`);
      const properties = await scraper.searchByAddress(address);
      logger.log(`Found ${properties.length} properties for address: ${address}`);
      
      allProperties.push(...properties);
      
      // Wait between searches to avoid detection
      await wait(3000 + Math.random() * 2000);
    }
    
    // Search for distressed properties in an area
    logger.log('Searching for distressed properties in Los Angeles...');
    const distressedProperties = await scraper.searchDistressedProperties('Los Angeles, CA', 2);
    logger.log(`Found ${distressedProperties.length} distressed properties`);
    
    allProperties.push(...distressedProperties);
    
    // Close the scraper
    await scraper.close();
    
    // Save raw scraped data
    fs.writeFileSync(
      path.join(outputDir, 'zillow-raw-results.json'), 
      JSON.stringify(allProperties, null, 2)
    );
    
    logger.log(`Raw scraping complete. Found ${allProperties.length} total properties.`);
    
    // Process scraped properties through pipeline
    if (allProperties.length > 0) {
      const processedResults = await processScrapedProperties(allProperties, { 
        attomEnhancement: true,
        leadScoring: true,
        deduplication: true
      });
      
      logger.log(`Successfully processed ${processedResults.length} properties through pipeline`);
      
      // Save processed results
      fs.writeFileSync(
        path.join(outputDir, 'zillow-processed-results.json'), 
        JSON.stringify(processedResults, null, 2)
      );
      
      logger.log('Live test results saved to zillow-processed-results.json');
      return processedResults;
    } else {
      logger.log('No properties found to process');
      return [];
    }
  } catch (error) {
    logger.error('Error in live test:', error);
    throw error;
  }
}

/**
 * Main function to run tests
 */
async function main() {
  logger.log('=== Starting Zillow Scraper Pipeline Test ===');
  
  try {
    // Run simulated test only
    await runSimulatedTest();
    
    // Live testing requires Playwright to be installed
    // await runLiveTest();
    
    logger.log('=== Zillow Scraper Pipeline Test Complete ===');
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});
