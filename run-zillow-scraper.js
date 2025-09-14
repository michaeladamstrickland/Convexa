#!/usr/bin/env node

/**
 * Direct Zillow Scraper Test
 * 
 * This script runs the Zillow scraper directly without going through the API,
 * allowing us to get real data from the scraper more quickly.
 */
import { zillowScraper } from './backend/src/scrapers/zillowScraper.js';
import { logger } from './test-logger.js';

// Test locations - Common real estate hot markets
const testLocations = [
  '90210', // Beverly Hills
  '33139', // Miami Beach
  '10001', // Manhattan, NY
  '78701', // Austin, TX
  '60611'  // Chicago Loop
];

async function runZillowScraper() {
  logger.info('===== RUNNING ZILLOW SCRAPER DIRECTLY =====');
  logger.info(`Scraping locations: ${testLocations.join(', ')}`);
  
  try {
    // Initialize the scraper
    logger.info('Initializing Zillow scraper...');
    await zillowScraper.initialize();
    
    // Scrape FSBO listings with a limit of 2 pages per location for quick testing
    logger.info('Scraping FSBO listings (limit: 2 pages per location)...');
    const startTime = Date.now();
    const listings = await zillowScraper.scrapeFSBOListings(testLocations, 2);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000; // in seconds
    logger.info(`Scraping completed in ${duration.toFixed(2)} seconds`);
    logger.info(`Found ${listings.length} FSBO listings`);
    
    // Display sample data
    if (listings.length > 0) {
      logger.info('\n----- SAMPLE LISTINGS DATA -----');
      listings.slice(0, 3).forEach((listing, index) => {
        logger.info(`\nListing #${index + 1}:`);
        console.log(JSON.stringify({
          address: listing.address,
          city: listing.city,
          state: listing.state,
          zipCode: listing.zipCode,
          price: listing.price,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          squareFootage: listing.squareFootage,
          yearBuilt: listing.yearBuilt,
          propertyType: listing.propertyType,
          listingUrl: listing.listingUrl
        }, null, 2));
      });
      
      // Optional: save to file
      const fs = await import('fs');
      const outputDir = './scraper-results';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = `${outputDir}/zillow-fsbo-${timestamp}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(listings, null, 2));
      logger.info(`\nSaved all ${listings.length} listings to ${outputFile}`);
    }
    
    // Close the scraper
    logger.info('\nClosing Zillow scraper...');
    await zillowScraper.close();
    
    logger.info('===== ZILLOW SCRAPER TEST COMPLETED =====');
  } catch (error) {
    logger.error('Error running Zillow scraper:', error);
    
    // Attempt to close the scraper
    try {
      await zillowScraper.close();
    } catch (closeError) {
      logger.error('Error closing Zillow scraper:', closeError);
    }
  }
}

// Run the scraper
runZillowScraper().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
