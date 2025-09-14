/**
 * test-storage-fusion.cjs
 * Test script for property storage with data fusion
 */

const PropertyStore = require('./src/storage/propertyStore.cjs');
const PropertyStoreWithFusion = require('./src/storage/propertyStoreWithFusion.cjs');
const fs = require('fs');
const path = require('path');

// Create test directory
const testDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Cleanup function for test directory
function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Load sample ATTOM property data
let attomData;
try {
  attomData = JSON.parse(fs.readFileSync('./property_assessment_42116.json'));
  console.log('✓ Loaded ATTOM sample data');
} catch (err) {
  console.error('❌ Failed to load ATTOM sample data:', err.message);
  attomData = null;
}

// Create mock ATTOM client
const mockAttomClient = {
  getPropertyData: async (hash) => {
    return attomData; // Return the same sample data for all requests in this test
  }
};

// Create test property records
const property1 = {
  address: {
    line1: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zip: '90210'
  },
  ownerName: 'John Smith',
  attributes: {
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1985
  },
  priceHint: 450000,
  distressSignals: ['tax-lien'],
  sourceKey: 'county-records',
  capturedAt: '2025-09-06T18:30:00Z'
};

const property2 = {
  address: {
    line1: '123 Main Street',
    city: 'Anytown',
    state: 'CA',
    zip: '90210'
  },
  attributes: {
    bedrooms: 3,
    bathrooms: 2.5,
    squareFeet: 1750,
    lotSize: 8500
  },
  contacts: [
    {
      type: 'phone',
      value: '555-123-4567',
      confidence: 0.8,
      source: 'zillow'
    }
  ],
  distressSignals: ['pre-foreclosure', 'bankruptcy'],
  sourceKey: 'zillow',
  sourceUrl: 'https://zillow.com/property/123',
  capturedAt: '2025-09-05T14:20:00Z'
};

const property3 = {
  address: {
    line1: '123 Main St.',
    city: 'Anytown',
    state: 'California',
    zip: '90210'
  },
  ownerName: 'Smith, John A.',
  attributes: {
    bedrooms: 3,
    squareFeet: 1820,
    yearBuilt: 1986
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
  distressSignals: ['auction-scheduled'],
  sourceKey: 'auction-com',
  sourceUrl: 'https://auction.com/property/abc123',
  capturedAt: '2025-09-06T09:15:00Z'
};

// Run the tests
async function runTests() {
  try {
    console.log('\n--- Testing PropertyStore with Fusion ---');
    
    // Create store instance
    const store = new PropertyStoreWithFusion({ 
      storagePath: testDir,
      attomClient: mockAttomClient
    });
    
    // Test 1: Store a single property
    console.log('\nTest 1: Store a single property');
    const stored1 = await store.storePropertyWithFusion(property1);
    console.log('✓ Stored property:', stored1.addressHash);
    
    // Test 2: Store a second property with similar address (should be fused)
    console.log('\nTest 2: Store property with similar address (fusion)');
    const stored2 = await store.storePropertyWithFusion(property2);
    console.log('✓ Fused property:', stored2.addressHash);
    console.log('  > Total sources:', stored2.sources.length);
    console.log('  > Distress signals:', stored2.distressSignals);
    
    // Test 3: Store a third property with similar address and ATTOM data
    console.log('\nTest 3: Store property with ATTOM data');
    const stored3 = await store.storePropertyWithFusion(property3, { attomData });
    console.log('✓ Fused property with ATTOM:', stored3.addressHash);
    console.log('  > Total sources:', stored3.sources.length);
    console.log('  > Distress signals:', stored3.distressSignals);
    
    // Test 4: Batch store with fusion
    console.log('\nTest 4: Batch store with fusion');
    
    // Create a new store for this test
    const batchStore = new PropertyStoreWithFusion({ 
      storagePath: path.join(testDir, 'batch'),
      attomClient: mockAttomClient
    });
    
    // Create attomBatch object
    const attomBatch = {};
    if (attomData) {
      // This would normally be keyed by address hash, but for testing
      // we just use a placeholder value
      attomBatch['main-st-123-anytown-ca-90210'] = attomData;
    }
    
    const batchResult = await batchStore.batchStoreWithFusion(
      [property1, property2, property3],
      { deduplicate: true, attomBatch }
    );
    
    console.log(`✓ Batch stored ${batchResult.length} properties`);
    
    // Test 5: Retrieve fused property
    console.log('\nTest 5: Retrieve fused property');
    const retrieved = await store.getPropertyByHash(stored3.addressHash);
    
    if (retrieved) {
      console.log('✓ Retrieved property:', retrieved.addressHash);
      console.log('  > Owner:', retrieved.ownerName);
      console.log('  > Attributes:', JSON.stringify(retrieved.attributes));
      console.log('  > Sources:', retrieved.sources.map(s => s.key).join(', '));
      console.log('  > Contacts:', retrieved.contacts ? retrieved.contacts.length : 0);
    } else {
      console.log('❌ Failed to retrieve property');
    }
    
    console.log('\n--- All Tests Completed ---');
  } catch (error) {
    console.error('Error in tests:', error);
  } finally {
    // Clean up test directory
    cleanup();
  }
}

// Run the tests
runTests();
