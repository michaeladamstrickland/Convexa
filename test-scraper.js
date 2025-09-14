/**
 * test-scraper.js
 * Simple test script to verify the enhanced scraper implementation
 */
const EnhancedCookCountyScraper = require('./src/scrapers/cook-county-enhanced');
const { scoreLead, temperature } = require('./src/scoring/leadScore');
const { normalizeAddress, normalizeOwnerName } = require('./src/lib/normalize');

async function runTest() {
  console.log('Starting FlipTracker Enhanced Scraper Test');
  console.log('----------------------------------------');
  
  // Test address normalization
  console.log('Testing address normalization...');
  const addresses = [
    '123 Main St, Chicago, IL 60601',
    '123 Main Street, Chicago, Illinois 60601',
    '123 Main Street Apartment 4B, Chicago, IL 60601'
  ];
  
  for (const addr of addresses) {
    const normalized = normalizeAddress(addr);
    console.log(`Original: ${addr}`);
    console.log(`Normalized: ${normalized.normalized}`);
    console.log(`Hash: ${normalized.hash}`);
    console.log('---');
  }
  
  // Test owner name normalization
  console.log('\nTesting owner name normalization...');
  const names = [
    'John Smith',
    'John Smith Jr.',
    'JOHN SMITH TRUST',
    'SMITH FAMILY LIVING TRUST',
    'ACME PROPERTIES LLC'
  ];
  
  for (const name of names) {
    const normalized = normalizeOwnerName(name);
    console.log(`Original: ${name}`);
    console.log(`Normalized: ${normalized}`);
    console.log('---');
  }
  
  // Test lead scoring
  console.log('\nTesting lead scoring...');
  const leads = [
    {
      address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
      distressSignals: ['PRE_FORECLOSURE'],
      lastEventDate: new Date().toISOString()
    },
    {
      address: { line1: '456 Oak Ave', city: 'Chicago', state: 'IL', zip: '60602' },
      distressSignals: ['TAX_DELINQUENT', 'AUCTION'],
      lastEventDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      ownerInfo: { 
        mailingAddress: { zip: '90210' } 
      },
      address: { zip: '60602' },
      contacts: [{ type: 'phone', value: '555-123-4567' }]
    }
  ];
  
  for (const lead of leads) {
    const score = scoreLead(lead);
    const temp = temperature(score);
    console.log(`Lead: ${lead.address.line1}`);
    console.log(`Score: ${score}`);
    console.log(`Temperature: ${temp}`);
    console.log('---');
  }
  
  // Initialize the enhanced scraper (but don't actually run it)
  console.log('\nInitializing enhanced Cook County scraper...');
  try {
    const scraper = new EnhancedCookCountyScraper();
    console.log('Scraper initialized successfully');
    console.log(`Source Key: ${scraper.sourceKey}`);
    console.log('Note: Not performing actual scrape in test mode');
  } catch (error) {
    console.error('Error initializing scraper:', error);
  }
  
  console.log('\nTest complete!');
}

// Run the test
runTest().catch(console.error);
