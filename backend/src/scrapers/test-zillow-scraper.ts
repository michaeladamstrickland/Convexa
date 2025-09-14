/**
 * Simple Zillow Scraper Test
 * 
 * Run with: npx tsx test-zillow-scraper.ts
 */

// Import the zillowScraper
import { zillowScraper } from './zillowScraper';

// Test locations - major cities
const locations = ['90210', '33139', '10001'];
const maxPages = 1;

async function testZillowScraper() {
  console.log('===== TESTING ZILLOW SCRAPER =====');
  console.log(`Test locations: ${locations.join(', ')}`);
  console.log(`Max pages per location: ${maxPages}`);
  
  try {
    // Initialize the scraper
    console.log('\nInitializing scraper...');
    await zillowScraper.initialize();
    
    // Scrape FSBO listings
    console.log('\nScraping FSBO listings...');
    const startTime = Date.now();
    const listings = await zillowScraper.scrapeFSBOListings(locations, maxPages);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000;
    console.log(`\nScraped ${listings.length} listings in ${duration.toFixed(2)} seconds`);
    
    if (listings.length > 0) {
      console.log('\nSample listing data:');
      console.log(JSON.stringify(listings[0], null, 2));
    }
    
    // Close the scraper
    await zillowScraper.close();
    console.log('\n===== TEST COMPLETED =====');
  } catch (error) {
    console.error('Error during test:', error);
    try {
      await zillowScraper.close();
    } catch (e) {}
  }
}

// Run the test
testZillowScraper().catch(console.error);
