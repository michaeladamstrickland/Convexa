// Simple test script for ATTOM API
import axios from 'axios';

// Test the basic health endpoint first
async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    const response = await axios.get('http://localhost:5002/health');
    console.log('Health response:', response.data);
    return true;
  } catch (error) {
    console.error('Health endpoint failed:', error.message);
    return false;
  }
}

// Test the property detail endpoint
async function testPropertyDetail() {
  try {
    console.log('Testing property detail endpoint...');
    const response = await axios.get('http://localhost:5002/api/attom/property/42116/detail');
    console.log('Property detail found:', response.data.property !== undefined);
    console.log('First few property fields:');
    
    const property = response.data.property;
    if (property) {
      console.log(`- Address: ${property.address}`);
      console.log(`- City: ${property.city}`);
      console.log(`- Property Type: ${property.propertyType}`);
      console.log(`- Year Built: ${property.yearBuilt}`);
      console.log(`- Square Feet: ${property.squareFeet}`);
    }
    
    return true;
  } catch (error) {
    console.error('Property detail endpoint failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  const healthOk = await testHealth();
  
  if (healthOk) {
    await testPropertyDetail();
  } else {
    console.log('Skipping property detail test because health check failed');
  }
}

runTests();
