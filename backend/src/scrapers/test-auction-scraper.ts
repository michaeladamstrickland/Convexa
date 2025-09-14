/**
 * Simple Auction.com Scraper Test
 * 
 * Run with: npx tsx test-auction-scraper.ts
 */

// Import the auctionDotComScraper
import { auctionDotComScraper } from './auctionScraper';
import * as fs from 'fs';

// Test locations - major auction markets
const locations = ['Las Vegas, NV', 'Phoenix, AZ', 'Jacksonville, FL'];
const maxPages = 1;

async function testAuctionScraper() {
  console.log('===== TESTING AUCTION.COM SCRAPER =====');
  console.log(`Test locations: ${locations.join(', ')}`);
  console.log(`Max pages per location: ${maxPages}`);
  
  try {
    // Initialize the scraper
    console.log('\nInitializing scraper...');
    await auctionDotComScraper.initialize();
    
    // Search auction listings
    console.log('\nSearching auction listings...');
    const startTime = Date.now();
    const listings = await auctionDotComScraper.searchListingsByLocation(locations, maxPages);
    const endTime = Date.now();
    
    // Log results
    const duration = (endTime - startTime) / 1000;
    console.log(`\nFound ${listings.length} listings in ${duration.toFixed(2)} seconds`);
    
    if (listings.length > 0) {
      console.log('\nSample listing data:');
      console.log(JSON.stringify(listings[0], null, 2));
      
      // Get details for the first listing
      if (listings[0]?.listingUrl) {
        console.log('\nGetting details for first listing...');
        const detailStartTime = Date.now();
        const details = await auctionDotComScraper.getListingDetails(listings[0].listingUrl);
        const detailEndTime = Date.now();
        
        const detailDuration = (detailEndTime - detailStartTime) / 1000;
        console.log(`\nRetrieved details in ${detailDuration.toFixed(2)} seconds:`);
        console.log(JSON.stringify(details, null, 2));
      }
    }
    
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

// Run the test
async function debugWebpage() {
  console.log('\n===== DEBUG MODE: CAPTURING WEBPAGE CONTENT =====');
  
  try {
    // Initialize the scraper with puppeteer in non-headless mode
    process.env.PUPPETEER_HEADLESS = 'false'; // Set headless mode to false temporarily
    
    // Initialize the scraper
    await auctionDotComScraper.initialize();
    
    // Create a custom scraping function just for testing
    const debugSite = async (url: string) => {
      console.log(`Navigating to ${url}...`);
      
      // Use the page from the scraper instance
      const page = await auctionDotComScraper['browser']?.newPage();
      
      if (!page) {
        throw new Error('Failed to create a new page');
      }
      
      // Set a more normal user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );
      
      // Navigate to the URL
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Add a 5 second delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take a screenshot
      const screenshotPath = `auction-debug-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved to ${screenshotPath}`);
      
      // Get HTML content
      const htmlContent = await page.content();
      const htmlPath = `auction-debug-${Date.now()}.html`;
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`HTML content saved to ${htmlPath}`);
      
      // Check for anti-bot measures
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasRecaptcha: document.body.innerHTML.includes('recaptcha') || document.body.innerHTML.includes('captcha'),
          hasRobotCheck: document.body.innerHTML.includes('robot') || document.body.innerHTML.includes('bot'),
          hasBlockedMessage: document.body.innerHTML.includes('blocked') || document.body.innerHTML.includes('access denied'),
          mainText: document.body.innerText.substring(0, 1000)
        };
      });
      
      console.log('\nPage Analysis:');
      console.log(JSON.stringify(pageInfo, null, 2));
      
      await page.close();
    };
    
    // Test both the homepage and search page
    await debugSite('https://www.auction.com/');
    await debugSite('https://www.auction.com/search/?search=Las%20Vegas,%20NV');
    
    // Close the browser
    await auctionDotComScraper.close();
    console.log('\n===== DEBUG COMPLETED =====');
  } catch (error) {
    console.error('Error in debug mode:', error);
    try {
      await auctionDotComScraper.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
  }
}

// Choose which function to run
// Set to true to run in debug mode, false to run normal test
const runDebugMode = false;

if (runDebugMode) {
  debugWebpage().catch(console.error);
} else {
  testAuctionScraper().catch(console.error);
}
