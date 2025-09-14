#!/usr/bin/env node

import axios from 'axios';
import * as fs from 'fs';

// Simple function to check if the ATTOM API is working
async function checkAttomApi() {
  console.log('===== CHECKING ATTOM API =====');
  
  try {
    // 1. Check server status
    console.log('Checking server status...');
    const statusRes = await axios.get('http://localhost:5002/api/attom/status');
    console.log('Server status:', statusRes.data);
    
    // 2. Test with a property ID
    const propertyId = '42116';
    console.log(`\nTesting property with ID: ${propertyId}`);
    
    const propertyRes = await axios.get(`http://localhost:5002/api/attom/property/${propertyId}/detail`);
    
    // 3. Save the response to a file
    fs.writeFileSync('attom-test-result.json', JSON.stringify(propertyRes.data, null, 2));
    console.log('Response saved to attom-test-result.json');
    
    // 4. Display summary of key fields
    if (propertyRes.data.property) {
      const prop = propertyRes.data.property;
      
      console.log('\nProperty Data Summary:');
      console.log('---------------------');
      console.log(`Address: ${prop.address || 'N/A'}`);
      console.log(`City: ${prop.city || 'N/A'}, ${prop.state || 'N/A'} ${prop.zipCode || 'N/A'}`);
      console.log(`Property Type: ${prop.propertyType || 'N/A'}`);
      console.log(`Year Built: ${prop.yearBuilt || 'N/A'}`);
      console.log(`Bedrooms: ${prop.bedrooms || 'N/A'}`);
      console.log(`Bathrooms: ${prop.bathrooms || 'N/A'}`);
      console.log(`Square Feet: ${prop.squareFeet || 'N/A'}`);
      
      // Check for any N/A values
      const fields = ['address', 'city', 'state', 'zipCode', 'propertyType', 'yearBuilt', 
                       'bedrooms', 'bathrooms', 'squareFeet', 'lastSaleDate', 'lastSalePrice'];
      
      const missingFields = [];
      for (const field of fields) {
        if (!prop[field]) {
          missingFields.push(field);
        }
      }
      
      if (missingFields.length > 0) {
        console.log('\n⚠️ Missing fields:', missingFields.join(', '));
      } else {
        console.log('\n✅ All key fields have values!');
      }
    } else {
      console.error('No property data in response:', propertyRes.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.log('\nIs the ATTOM API server running? Try:');
    console.log('cd backend && node attom-server.js');
  }
}

// Run the check
checkAttomApi();
