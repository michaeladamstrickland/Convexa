#!/usr/bin/env node

/**
 * Direct Zillow Scraper Test
 * 
 * This script runs the Zillow scraper directly using the backend code.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

// Define parameters for the scraper
const locations = ['90210', '33139', '10001', '78701', '60611'];
const maxPages = 2;

async function runZillowScraper() {
  console.log('===== RUNNING ZILLOW SCRAPER DIRECTLY =====');
  console.log(`Scraping locations: ${locations.join(', ')}`);
  console.log('Max pages per location:', maxPages);
  
  try {
    // Navigate to the backend directory
    process.chdir('./backend');
    
    // Create a temporary script to run the scraper
    const tempScript = `
      import { zillowScraper } from './src/scrapers/zillowScraper';
      
      async function run() {
        try {
          console.log('Initializing Zillow scraper...');
          await zillowScraper.initialize();
          
          console.log('Scraping FSBO listings...');
          const startTime = Date.now();
          const listings = await zillowScraper.scrapeFSBOListings(${JSON.stringify(locations)}, ${maxPages});
          const endTime = Date.now();
          
          const duration = (endTime - startTime) / 1000;
          console.log(\`Scraping completed in \${duration.toFixed(2)} seconds\`);
          console.log(\`Found \${listings.length} FSBO listings\`);
          
          if (listings.length > 0) {
            console.log('\\n----- SAMPLE LISTINGS DATA -----');
            listings.slice(0, 3).forEach((listing, index) => {
              console.log(\`\\nListing #\${index + 1}:\`);
              console.log(JSON.stringify({
                address: listing.address,
                city: listing.city,
                state: listing.state,
                zipCode: listing.zipCode,
                price: listing.price,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                squareFootage: listing.squareFootage,
                propertyType: listing.propertyType,
                listingUrl: listing.listingUrl
              }, null, 2));
            });
            
            // Save to file
            const fs = require('fs');
            const outputDir = '../scraper-results';
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = \`\${outputDir}/zillow-fsbo-\${timestamp}.json\`;
            fs.writeFileSync(outputFile, JSON.stringify(listings, null, 2));
            console.log(\`\\nSaved all \${listings.length} listings to \${outputFile}\`);
          }
          
          console.log('\\nClosing Zillow scraper...');
          await zillowScraper.close();
          
        } catch (error) {
          console.error('Error:', error);
          try { await zillowScraper.close(); } catch (e) {}
        }
      }
      
      run();
    `;
    
    // Write the temporary script to a file
    const fs = await import('fs');
    fs.writeFileSync('temp-zillow-script.ts', tempScript);
    
    // Run the script with tsx
    console.log('\nExecuting scraper with tsx...\n');
    const { stdout, stderr } = await execPromise('npx tsx temp-zillow-script.ts');
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    // Clean up
    fs.unlinkSync('temp-zillow-script.ts');
    
    console.log('\n===== ZILLOW SCRAPER TEST COMPLETED =====');
  } catch (error) {
    console.error('Error running Zillow scraper:', error);
  }
}

// Run the scraper
runZillowScraper().catch(console.error);
