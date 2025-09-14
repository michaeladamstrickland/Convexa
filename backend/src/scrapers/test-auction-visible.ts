/**
 * Test Auction.com Scraper with Non-Headless Mode
 * 
 * Run with: npx tsx test-auction-visible.ts
 * 
 * This script runs the Auction.com scraper in visible browser mode to help
 * diagnose and debug anti-bot detection issues.
 */

import { auctionDotComScraper } from './auctionScraper';
import * as fs from 'fs';

// Force non-headless mode for this test
process.env.PUPPETEER_HEADLESS = 'false';

// Single location for testing
const locations = ['Las Vegas, NV'];
const maxPages = 1;

async function testVisibleScraper() {
  console.log('===== TESTING AUCTION.COM SCRAPER IN VISIBLE MODE =====');
  console.log(`Test location: ${locations[0]}`);
  console.log('Browser will open in visible mode. Please observe the browser behavior.');
  console.log('This helps identify if there are CAPTCHAs or anti-bot measures in place.');
  
  try {
    // Initialize the scraper (visible browser)
    console.log('\nInitializing scraper with visible browser...');
    await auctionDotComScraper.initialize();
    
    // Search auction listings
    console.log('\nSearching auction listings...');
    console.log('Please observe the browser for any CAPTCHA or anti-bot challenges.');
    
    const startTime = Date.now();
    const listings = await auctionDotComScraper.searchListingsByLocation(locations, maxPages);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000;
    console.log(`\nFound ${listings.length} listings in ${duration.toFixed(2)} seconds`);
    
    if (listings.length > 0) {
      console.log('\nSample listing data:');
      console.log(JSON.stringify(listings[0], null, 2));
      
      // Save results to file for analysis
      const resultsFile = `auction-results-${Date.now()}.json`;
      fs.writeFileSync(resultsFile, JSON.stringify(listings, null, 2));
      console.log(`\nSaved ${listings.length} results to ${resultsFile}`);
    } else {
      console.log('\nNo listings found. Anti-bot measures may be active.');
    }
    
    // Keep browser open for 5 seconds to allow user to observe final state
    console.log('\nKeeping browser open for 5 more seconds for observation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close the scraper
    await auctionDotComScraper.close();
    console.log('\n===== TEST COMPLETED =====');
  } catch (error) {
    console.error('Error during test:', error);
    try {
      await auctionDotComScraper.close();
    } catch (e) {}
  }
}

// Run the visible test
testVisibleScraper().catch(console.error);
