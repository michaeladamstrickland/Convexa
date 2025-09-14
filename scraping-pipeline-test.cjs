/**
 * scraping-pipeline-test.cjs
 * Test script for the end-to-end scraping pipeline
 */

const ScrapingPipeline = require('./src/scrapingPipeline.cjs');
const fs = require('fs');
const path = require('path');

// Create test directories
const testDir = path.join(__dirname, 'test-pipeline-data');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Cleanup function
function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Mock ATTOM client
const mockAttomClient = {
  getPropertyData: async (hash) => {
    // For testing, return sample ATTOM data for any hash
    try {
      return JSON.parse(fs.readFileSync('./property_assessment_42116.json'));
    } catch (error) {
      console.error('Failed to load ATTOM sample data:', error.message);
      return null;
    }
  }
};

// Mock lead scorer
const mockLeadScorer = {
  scoreLead: (property) => {
    // Simple scoring logic for testing
    let score = 50; // Base score
    
    // Add points for distress signals
    if (property.distressSignals) {
      score += property.distressSignals.length * 10;
    }
    
    // Add points for contact info
    if (property.contacts && property.contacts.length > 0) {
      score += 15;
    }
    
    // Add points for owner name
    if (property.ownerName) {
      score += 10;
    }
    
    return Math.min(score, 100); // Cap at 100
  }
};

// Sample scrape results
const zillowResults = {
  source: 'zillow',
  timestamp: new Date().toISOString(),
  items: [
    {
      address: '123 Main St, Anytown, CA 90210',
      ownerName: null,
      attributes: {
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1750,
        yearBuilt: 1985
      },
      priceHint: 450000,
      distressSignals: [],
      sourceKey: 'zillow',
      sourceUrl: 'https://zillow.com/property/123',
      capturedAt: new Date().toISOString()
    },
    {
      address: '456 Oak Ave, Anytown, CA 90210',
      ownerName: null,
      attributes: {
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2200,
        yearBuilt: 1992
      },
      priceHint: 650000,
      distressSignals: [],
      sourceKey: 'zillow',
      sourceUrl: 'https://zillow.com/property/456',
      capturedAt: new Date().toISOString()
    }
  ]
};

const countyResults = {
  source: 'county-records',
  timestamp: new Date().toISOString(),
  items: [
    {
      address: '123 Main Street, Anytown, CA 90210',
      ownerName: 'John Smith',
      parcelId: '123-456-789',
      attributes: {
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        yearBuilt: 1984,
        lotSize: 7500
      },
      distressSignals: ['tax-lien'],
      sourceKey: 'county-records',
      capturedAt: new Date().toISOString()
    }
  ]
};

const auctionResults = {
  source: 'auction-com',
  timestamp: new Date().toISOString(),
  items: [
    {
      address: '123 Main St., Anytown, CA 90210',
      ownerName: 'Smith, John A.',
      attributes: {
        bedrooms: 3,
        squareFeet: 1820
      },
      contacts: [
        {
          type: 'phone',
          value: '555-123-4567',
          confidence: 0.6,
          source: 'auction'
        },
        {
          type: 'email',
          value: 'john.smith@example.com',
          confidence: 0.7,
          source: 'auction'
        }
      ],
      distressSignals: ['auction-scheduled', 'pre-foreclosure'],
      sourceKey: 'auction-com',
      sourceUrl: 'https://auction.com/property/abc123',
      capturedAt: new Date().toISOString()
    }
  ]
};

// Run the tests
async function runTests() {
  try {
    console.log('\n--- Testing Scraping Pipeline ---');
    
    // Create pipeline instance
    const pipeline = new ScrapingPipeline({
      storagePath: testDir,
      attomClient: mockAttomClient,
      leadScorer: mockLeadScorer
    });
    
    // Test 1: Process Zillow results
    console.log('\nTest 1: Process Zillow results');
    const zillowProcessed = await pipeline.processScrapedProperties(zillowResults, {
      enhanceWithAttom: true,
      sourceName: 'zillow'
    });
    console.log(`✓ Processed ${zillowProcessed.length} properties from Zillow`);
    
    // Test 2: Process County records (should fuse with existing Zillow data)
    console.log('\nTest 2: Process County records');
    const countyProcessed = await pipeline.processScrapedProperties(countyResults, {
      enhanceWithAttom: true,
      sourceName: 'county-records'
    });
    console.log(`✓ Processed ${countyProcessed.length} properties from County Records`);
    
    // Test 3: Process Auction data (should fuse with existing data)
    console.log('\nTest 3: Process Auction data');
    const auctionProcessed = await pipeline.processScrapedProperties(auctionResults, {
      enhanceWithAttom: true,
      sourceName: 'auction-com'
    });
    console.log(`✓ Processed ${auctionProcessed.length} properties from Auction.com`);
    
    // Save final results to file
    pipeline.saveResultsToFile(auctionProcessed, 'final-properties.json');
    
    console.log('\n--- Scraping Pipeline Tests Completed ---');
    
  } catch (error) {
    console.error('Error in tests:', error);
  } finally {
    // Don't clean up so we can inspect the results
    //cleanup();
  }
}

// Run the tests
runTests();
