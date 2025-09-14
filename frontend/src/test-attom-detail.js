// Test script to verify property data flow in ATTOM API
import axios from 'axios';

// API base URL for ATTOM API
const API_BASE_URL = 'http://localhost:5002/api/attom';

// Test property ID - replace with an actual ID from your application
const TEST_ATTOM_ID = '42116'; // Use a real ID from your database

async function testPropertyDataFlow() {
  console.log('========= TESTING PROPERTY DATA FLOW =========');
  console.log(`Testing with ATTOM ID: ${TEST_ATTOM_ID}`);
  
  try {
    // Test basic property endpoint
    console.log('\n--- Testing basic property endpoint ---');
    const basicResponse = await axios.get(`${API_BASE_URL}/property/${TEST_ATTOM_ID}`);
    console.log('Status:', basicResponse.data.status);
    console.log('Property fields:', Object.keys(basicResponse.data.property || {}).length);
    console.log('Sample fields:', Object.keys(basicResponse.data.property || {}).slice(0, 5));
    
    // Test valuation endpoint
    console.log('\n--- Testing valuation endpoint ---');
    const valuationResponse = await axios.get(`${API_BASE_URL}/property/${TEST_ATTOM_ID}/valuation`);
    console.log('Status:', valuationResponse.data.status);
    console.log('Valuation fields:', Object.keys(valuationResponse.data.valuation || {}).length);
    console.log('Sample fields:', Object.keys(valuationResponse.data.valuation || {}).slice(0, 5));
    
    // Test comprehensive property detail endpoint
    console.log('\n--- Testing comprehensive property detail endpoint ---');
    const detailResponse = await axios.get(`${API_BASE_URL}/property/${TEST_ATTOM_ID}/detail`);
    console.log('Status:', detailResponse.data.status);
    console.log('Property fields:', Object.keys(detailResponse.data.property || {}).length);
    console.log('Sample fields:', Object.keys(detailResponse.data.property || {}).slice(0, 10));
    
    // Compare the data between endpoints
    console.log('\n--- Comparing data between endpoints ---');
    const basicFields = new Set(Object.keys(basicResponse.data.property || {}));
    const detailFields = new Set(Object.keys(detailResponse.data.property || {}));
    const valuationFields = new Set(Object.keys(valuationResponse.data.valuation || {}));
    
    console.log('Basic fields count:', basicFields.size);
    console.log('Detail fields count:', detailFields.size);
    console.log('Valuation fields count:', valuationFields.size);
    
    // Fields in detail but not in basic
    const uniqueDetailFields = [...detailFields].filter(field => !basicFields.has(field));
    console.log('\nFields in detail but not in basic endpoint:', uniqueDetailFields);
    
    // Critical fields check
    const criticalFields = [
      'propertyType', 'yearBuilt', 'bedrooms', 'bathrooms', 'squareFeet', 
      'lotSize', 'estimatedValue', 'ownerName', 'lastSaleDate'
    ];
    
    console.log('\n--- Critical fields comparison ---');
    criticalFields.forEach(field => {
      console.log(`Field: ${field}`);
      console.log(`  Basic endpoint: ${basicResponse.data.property?.[field] !== undefined ? 'Present' : 'Missing'}`);
      console.log(`  Detail endpoint: ${detailResponse.data.property?.[field] !== undefined ? 'Present' : 'Missing'}`);
    });
    
    // Check for data completeness
    console.log('\n--- Data completeness check ---');
    const detailData = detailResponse.data.property || {};
    criticalFields.forEach(field => {
      const hasValue = detailData[field] !== undefined && 
                       detailData[field] !== null && 
                       detailData[field] !== 'N/A';
      console.log(`${field}: ${hasValue ? 'Has value' : 'No value'}`);
    });
    
    console.log('\n========= TEST COMPLETED =========');
  } catch (error) {
    console.error('Error testing property data flow:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testPropertyDataFlow();

// Export the test function for use in other files
export default testPropertyDataFlow;
