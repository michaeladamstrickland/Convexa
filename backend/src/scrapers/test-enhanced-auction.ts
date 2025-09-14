/**
 * Enhanced Auction.com Scraper Test
 * 
 * This script tests the enhanced version of the Auction.com scraper
 * with improved anti-detection measures and debugging capabilities.
 * 
 * Run with: npx tsx test-enhanced-auction.ts
 * 
 * Options:
 * - DEBUG=true npx tsx test-enhanced-auction.ts  # To enable debug mode
 * - HEADLESS=false npx tsx test-enhanced-auction.ts  # To run in visible browser mode
 */

import { enhancedAuctionDotComScraper } from './enhancedAuctionScraper';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const locations = ['Las Vegas, NV'];
const maxPages = 1; // Limit to one page for testing
const debugMode = process.env.DEBUG === 'true';
const isHeadless = process.env.HEADLESS !== 'false';

// Set headless mode via environment variable
process.env.PUPPETEER_HEADLESS = isHeadless ? 'true' : 'false';

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, 'scraper-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testEnhancedScraper() {
  console.log('===== TESTING ENHANCED AUCTION.COM SCRAPER =====');
  console.log(`Mode: ${isHeadless ? 'Headless' : 'Visible'} Browser`);
  console.log(`Debug Mode: ${debugMode ? 'Enabled' : 'Disabled'}`);
  console.log(`Test location: ${locations[0]}`);
  console.log(`Max pages: ${maxPages}`);
  
  try {
    // Enable debug mode if requested
    enhancedAuctionDotComScraper.setDebugMode(debugMode);
    
    // Initialize the scraper
    console.log('\nInitializing enhanced scraper...');
    await enhancedAuctionDotComScraper.initialize();
    
    // Search auction listings
    console.log('\nSearching auction listings...');
    if (!isHeadless) {
      console.log('Please observe the browser for any CAPTCHA or anti-bot challenges.');
    }
    
    const startTime = Date.now();
    const listings = await enhancedAuctionDotComScraper.searchListingsByLocation(locations, maxPages);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000;
    console.log(`\nFound ${listings.length} listings in ${duration.toFixed(2)} seconds`);
    
    if (listings.length > 0) {
      console.log('\nSample listing data:');
      console.log(JSON.stringify(listings[0], null, 2));
      
      // Save results to file for analysis
      const resultsFile = path.join(resultsDir, `auction-results-${Date.now()}.json`);
      fs.writeFileSync(resultsFile, JSON.stringify(listings, null, 2));
      console.log(`\nSaved ${listings.length} results to ${resultsFile}`);
      
      // If we have a listing URL, try to get details for one listing
      if (listings[0]?.listingUrl) {
        console.log('\nTesting detailed listing retrieval...');
        const detailStartTime = Date.now();
        const detailedListing = await enhancedAuctionDotComScraper.getListingDetails(listings[0].listingUrl);
        const detailEndTime = Date.now();
        
        console.log(`\nRetrieved detailed listing in ${((detailEndTime - detailStartTime) / 1000).toFixed(2)} seconds`);
        console.log('\nDetailed listing sample:');
        console.log(JSON.stringify(detailedListing, null, 2));
        
        // Save detailed listing to file
        const detailFile = path.join(resultsDir, `listing-detail-${detailedListing.auctionId || Date.now()}.json`);
        fs.writeFileSync(detailFile, JSON.stringify(detailedListing, null, 2));
        console.log(`\nSaved detailed listing to ${detailFile}`);
      }
    } else {
      console.log('\nNo listings found. Anti-bot measures may be active or there were no results for this location.');
    }
    
    // If running in visible mode, keep browser open for observation
    if (!isHeadless) {
      console.log('\nKeeping browser open for 10 more seconds for observation...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Close the scraper
    await enhancedAuctionDotComScraper.close();
    console.log('\n===== TEST COMPLETED =====');
  } catch (error) {
    console.error('Error during test:', error);
    try {
      await enhancedAuctionDotComScraper.close();
    } catch (e) {}
  }
}

// Run the test
testEnhancedScraper().catch(console.error);
