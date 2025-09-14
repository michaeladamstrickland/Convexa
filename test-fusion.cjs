/**
 * test-fusion.cjs
 * Test script for property fusion utilities
 */

const { fuseProperties, completenessScore } = require('./src/fusion/propertyFusion.cjs');
const { enhanceWithAttom } = require('./src/fusion/attomFusion.cjs');
const fs = require('fs');

// Load sample ATTOM property data
let attomData;
try {
  attomData = JSON.parse(fs.readFileSync('./property_assessment_42116.json'));
  console.log('✓ Loaded ATTOM sample data');
} catch (err) {
  console.error('❌ Failed to load ATTOM sample data:', err.message);
  attomData = null;
}

// Create test property records
const property1 = {
  address: '123 Main St, Anytown, CA 90210',
  addressHash: 'main-st-123-anytown-ca-90210',
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
  address: '123 Main St, Anytown, CA 90210',
  addressHash: 'main-st-123-anytown-ca-90210',
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
  address: '123 Main St, Anytown, CA 90210',
  addressHash: 'main-st-123-anytown-ca-90210',
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

// Test completeness scoring
console.log('\n--- Testing Completeness Scoring ---');
console.log(`Property 1 score: ${completenessScore(property1)}`);
console.log(`Property 2 score: ${completenessScore(property2)}`);
console.log(`Property 3 score: ${completenessScore(property3)}`);

// Test property fusion without ATTOM
console.log('\n--- Testing Property Fusion (no ATTOM) ---');
const fusedNoAttom = fuseProperties(null, [property1, property2, property3]);
console.log(JSON.stringify(fusedNoAttom, null, 2));

// Test property fusion with ATTOM
if (attomData) {
  console.log('\n--- Testing Property Fusion (with ATTOM) ---');
  const fusedWithAttom = fuseProperties(attomData, [property1, property2, property3]);
  console.log(JSON.stringify(fusedWithAttom, null, 2));
  
  // Test enhancing single property with ATTOM
  console.log('\n--- Testing ATTOM Enhancement ---');
  const enhanced = enhanceWithAttom(attomData, property1);
  console.log(JSON.stringify(enhanced, null, 2));
} else {
  console.log('\n⚠️ Skipping ATTOM fusion tests - no sample data');
}

console.log('\n✓ Fusion tests complete');
