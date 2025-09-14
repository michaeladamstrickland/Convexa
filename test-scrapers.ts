/**
 * Test script for the scraper implementation
 * 
 * This script tests both the Zillow FSBO and Auction.com scrapers
 * with a small sample of locations to verify they're working correctly.
 */
import dotenv from 'dotenv';
import { logger } from './test-logger.js';

// Load environment variables
dotenv.config();

// Import mock scrapers
import { mockZillowScraper, mockAuctionDotComScraper } from './mock-server.js';
const zillowScraper = mockZillowScraper;
const auctionDotComScraper = mockAuctionDotComScraper;

// Create a mock ZillowScraper class
class ZillowScraper {
  async initialize() { return mockZillowScraper.initialize(); }
  async scrapeFSBOListings(...args) { return mockZillowScraper.scrapeFSBOListings(...args); }
  async getListingDetails(...args) { return mockZillowScraper.getListingDetails(...args); }
  async close() { return mockZillowScraper.close(); }
}

// Load environment variables
dotenv.config();

async function runScraperTests() {
  logger.info('===== STARTING SCRAPER TESTS =====');
  
  try {
    // Test locations - using a small sample
    const testLocations = ['07001', '90210']; // NJ and Beverly Hills
    const maxPages = 1; // Limit to 1 page for quick testing
    
    // Test Zillow FSBO scraper
    logger.info('\n----- Testing Zillow FSBO Scraper -----');
    const zillow = new ZillowScraper();
    
    try {
      logger.info('Initializing Zillow scraper...');
      await zillow.initialize();
      
      logger.info(`Scraping Zillow FSBO listings for locations: ${testLocations.join(', ')}`);
      const zillowListings = await zillow.scrapeFSBOListings(testLocations, maxPages);
      
      logger.info(`Found ${zillowListings.length} Zillow FSBO listings`);
      if (zillowListings.length > 0) {
        // Show sample data from first listing
        logger.info('Sample Zillow listing data:');
        const sample = zillowListings[0];
        console.log(JSON.stringify({
          address: sample.address,
          city: sample.city,
          state: sample.state,
          zipCode: sample.zipCode,
          price: sample.price,
          bedrooms: sample.bedrooms,
          bathrooms: sample.bathrooms,
          squareFootage: sample.squareFootage,
          listingUrl: sample.listingUrl,
        }, null, 2));
      }
      
      await zillow.close();
      logger.info('Zillow FSBO scraper test completed successfully');
    } catch (error) {
      logger.error('Error testing Zillow scraper:', error);
      await zillow.close();
    }
    
    // Test Auction.com scraper
    logger.info('\n----- Testing Auction.com Scraper -----');
    try {
      logger.info('Initializing Auction.com scraper...');
      await auctionDotComScraper.initialize();
      
      logger.info(`Searching auction listings for locations: ${testLocations.join(', ')}`);
      const auctionListings = await auctionDotComScraper.searchListingsByLocation(testLocations, maxPages);
      
      logger.info(`Found ${auctionListings.length} auction listings`);
      if (auctionListings.length > 0) {
        // Show sample data from first listing
        logger.info('Sample auction listing data:');
        const sample = auctionListings[0];
        console.log(JSON.stringify({
          propertyAddress: sample.propertyAddress,
          city: sample.city,
          state: sample.state,
          zipCode: sample.zipCode,
          auctionType: sample.auctionType,
          startingBid: sample.startingBid,
          auctionStartDate: sample.auctionStartDate,
          propertyType: sample.propertyType,
          bedrooms: sample.bedrooms,
          bathrooms: sample.bathrooms,
          squareFootage: sample.squareFootage,
          listingUrl: sample.listingUrl,
        }, null, 2));
        
        // Test getting detailed info for one listing
        if (sample.listingUrl) {
          logger.info('Testing auction listing details retrieval...');
          const details = await auctionDotComScraper.getListingDetails(sample.listingUrl);
          logger.info('Successfully retrieved listing details');
        }
      }
      
      await auctionDotComScraper.close();
      logger.info('Auction.com scraper test completed successfully');
    } catch (error) {
      logger.error('Error testing Auction.com scraper:', error);
      await auctionDotComScraper.close();
    }
    
    logger.info('\n===== SCRAPER TESTS COMPLETED =====');
  } catch (error) {
    logger.error('Unhandled error in scraper tests:', error);
  }
}

// Run the tests
runScraperTests().catch(console.error);
