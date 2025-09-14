#!/usr/bin/env node

/**
 * Direct Auction.com Scraper Test
 * 
 * This script runs the Auction.com scraper directly without going through the API,
 * allowing us to get real data from the scraper more quickly.
 */
import { auctionDotComScraper } from './backend/src/scrapers/auctionScraper.js';
import { logger } from './test-logger.js';

// Test locations - Common auction markets
const testLocations = [
  'Las Vegas, NV',
  'Phoenix, AZ',
  'Jacksonville, FL',
  'Detroit, MI',
  'Atlanta, GA'
];

async function runAuctionDotComScraper() {
  logger.info('===== RUNNING AUCTION.COM SCRAPER DIRECTLY =====');
  logger.info(`Searching locations: ${testLocations.join(', ')}`);
  
  try {
    // Initialize the scraper
    logger.info('Initializing Auction.com scraper...');
    await auctionDotComScraper.initialize();
    
    // Search auction listings with a limit of 2 pages per location for quick testing
    logger.info('Searching auction listings (limit: 2 pages per location)...');
    const startTime = Date.now();
    const listings = await auctionDotComScraper.searchListingsByLocation(testLocations, 2);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000; // in seconds
    logger.info(`Search completed in ${duration.toFixed(2)} seconds`);
    logger.info(`Found ${listings.length} auction listings`);
    
    // Display sample data
    if (listings.length > 0) {
      logger.info('\n----- SAMPLE AUCTION LISTINGS DATA -----');
      listings.slice(0, 3).forEach((listing, index) => {
        logger.info(`\nAuction Listing #${index + 1}:`);
        console.log(JSON.stringify({
          propertyAddress: listing.propertyAddress,
          city: listing.city,
          state: listing.state,
          zipCode: listing.zipCode,
          auctionType: listing.auctionType,
          startingBid: listing.startingBid,
          auctionStartDate: listing.auctionStartDate,
          propertyType: listing.propertyType,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          squareFootage: listing.squareFootage,
          listingUrl: listing.listingUrl
        }, null, 2));
        
        // Get details for one of the listings as an example
        if (index === 0 && listing.listingUrl) {
          logger.info('\nGetting details for the first listing...');
          const detailStartTime = Date.now();
          const details = await auctionDotComScraper.getListingDetails(listing.listingUrl);
          const detailEndTime = Date.now();
          const detailDuration = (detailEndTime - detailStartTime) / 1000;
          
          logger.info(`Details retrieved in ${detailDuration.toFixed(2)} seconds:`);
          console.log(JSON.stringify(details, null, 2));
        }
      });
      
      // Optional: save to file
      const fs = await import('fs');
      const outputDir = './scraper-results';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = `${outputDir}/auction-${timestamp}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(listings, null, 2));
      logger.info(`\nSaved all ${listings.length} listings to ${outputFile}`);
    }
    
    // Close the scraper
    logger.info('\nClosing Auction.com scraper...');
    await auctionDotComScraper.close();
    
    logger.info('===== AUCTION.COM SCRAPER TEST COMPLETED =====');
  } catch (error) {
    logger.error('Error running Auction.com scraper:', error);
    
    // Attempt to close the scraper
    try {
      await auctionDotComScraper.close();
    } catch (closeError) {
      logger.error('Error closing Auction.com scraper:', closeError);
    }
  }
}

// Run the scraper
runAuctionDotComScraper().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
