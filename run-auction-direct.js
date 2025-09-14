#!/usr/bin/env node

/**
 * Direct Auction.com Scraper Test
 * 
 * This script runs the Auction.com scraper directly using the backend code.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

// Define parameters for the scraper
const locations = ['Las Vegas, NV', 'Phoenix, AZ', 'Jacksonville, FL', 'Detroit, MI', 'Atlanta, GA'];
const maxPages = 2;

async function runAuctionScraper() {
  console.log('===== RUNNING AUCTION.COM SCRAPER DIRECTLY =====');
  console.log(`Searching locations: ${locations.join(', ')}`);
  console.log('Max pages per location:', maxPages);
  
  try {
    // Navigate to the backend directory
    process.chdir('./backend');
    
    // Create a temporary script to run the scraper
    const tempScript = `
      import { auctionDotComScraper } from './src/scrapers/auctionScraper';
      
      async function run() {
        try {
          console.log('Initializing Auction.com scraper...');
          await auctionDotComScraper.initialize();
          
          console.log('Searching auction listings...');
          const startTime = Date.now();
          const listings = await auctionDotComScraper.searchListingsByLocation(${JSON.stringify(locations)}, ${maxPages});
          const endTime = Date.now();
          
          const duration = (endTime - startTime) / 1000;
          console.log(\`Search completed in \${duration.toFixed(2)} seconds\`);
          console.log(\`Found \${listings.length} auction listings\`);
          
          if (listings.length > 0) {
            console.log('\\n----- SAMPLE AUCTION LISTINGS DATA -----');
            for (let i = 0; i < Math.min(3, listings.length); i++) {
              const listing = listings[i];
              console.log(\`\\nAuction Listing #\${i + 1}:\`);
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
              if (i === 0 && listing.listingUrl) {
                console.log('\\nGetting details for the first listing...');
                const detailStartTime = Date.now();
                const details = await auctionDotComScraper.getListingDetails(listing.listingUrl);
                const detailEndTime = Date.now();
                const detailDuration = (detailEndTime - detailStartTime) / 1000;
                
                console.log(\`Details retrieved in \${detailDuration.toFixed(2)} seconds:\`);
                console.log(JSON.stringify(details, null, 2));
              }
            }
            
            // Save to file
            const fs = require('fs');
            const outputDir = '../scraper-results';
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = \`\${outputDir}/auction-\${timestamp}.json\`;
            fs.writeFileSync(outputFile, JSON.stringify(listings, null, 2));
            console.log(\`\\nSaved all \${listings.length} listings to \${outputFile}\`);
          }
          
          console.log('\\nClosing Auction.com scraper...');
          await auctionDotComScraper.close();
          
        } catch (error) {
          console.error('Error:', error);
          try { await auctionDotComScraper.close(); } catch (e) {}
        }
      }
      
      run();
    `;
    
    // Write the temporary script to a file
    const fs = await import('fs');
    fs.writeFileSync('temp-auction-script.ts', tempScript);
    
    // Run the script with tsx
    console.log('\nExecuting scraper with tsx...\n');
    const { stdout, stderr } = await execPromise('npx tsx temp-auction-script.ts');
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    // Clean up
    fs.unlinkSync('temp-auction-script.ts');
    
    console.log('\n===== AUCTION.COM SCRAPER TEST COMPLETED =====');
  } catch (error) {
    console.error('Error running Auction.com scraper:', error);
  }
}

// Run the scraper
runAuctionScraper().catch(console.error);
