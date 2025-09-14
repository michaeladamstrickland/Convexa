// Test script to verify the fixed implementation
const axios = require('axios');

async function testAttomAPI() {
  try {
    console.log('Testing ATTOM API status...');
    const statusResponse = await axios.get('http://localhost:5002/api/attom/status');
    console.log('Status response:', statusResponse.data);
    
    console.log('\nTesting property detail endpoint...');
    const propertyResponse = await axios.get('http://localhost:5002/api/attom/property/42116/detail');
    
    console.log('Property detail response (first 200 chars):');
    console.log(JSON.stringify(propertyResponse.data).substring(0, 200) + '...');
    
    if (propertyResponse.data && propertyResponse.data.property) {
      const property = propertyResponse.data.property;
      
      console.log('\nExtracted key property fields:');
      console.log('- Address:', property.address);
      console.log('- Property Type:', property.propertyType);
      console.log('- Year Built:', property.yearBuilt);
      console.log('- Square Feet:', property.squareFeet);
      console.log('- Bedrooms:', property.bedrooms);
      console.log('- Bathrooms:', property.bathrooms);
      console.log('- Last Sale Price:', property.lastSalePrice);
      console.log('- Tax Assessed Value:', property.taxAssessedValue);
    } else {
      console.log('No property data found in response');
    }
  } catch (error) {
    console.error('Error testing ATTOM API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAttomAPI();
