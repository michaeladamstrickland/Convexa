#!/usr/bin/env node

import axios from 'axios';
import * as fs from 'fs';

// Test property ID
const TEST_ATTOM_ID = '42116';

// Test the ATTOM API
async function testApi() {
  try {
    console.log('Testing ATTOM API...');
    
    // Test status endpoint
    const statusResponse = await axios.get('http://localhost:5002/api/attom/status');
    console.log('ATTOM API Status:', statusResponse.data);
    
    // Test property detail endpoint
    console.log(`\nTesting property detail for ID ${TEST_ATTOM_ID}...`);
    const detailResponse = await axios.get(`http://localhost:5002/api/attom/property/${TEST_ATTOM_ID}/detail`);
    
    if (detailResponse.data.status === 'success') {
      console.log('Property detail retrieved successfully!');
      
      // Save the response to a file
      fs.writeFileSync('property-detail.json', JSON.stringify(detailResponse.data, null, 2));
      console.log('Response saved to property-detail.json');
      
      // Helper function for safe access
      function getNestedValue(obj, path, defaultValue = 'N/A') {
        try {
          const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
          return result !== undefined && result !== null ? result : defaultValue;
        } catch (e) {
          return defaultValue;
        }
      }
      
      // Display some key property information
      const property = detailResponse.data.property;
      console.log('\nProperty Summary:');
      console.log('-----------------');
      console.log(`Address: ${getNestedValue(property, 'address')}`);
      console.log(`City/State: ${getNestedValue(property, 'city')}, ${getNestedValue(property, 'state')} ${getNestedValue(property, 'zipCode')}`);
      console.log(`Property Type: ${getNestedValue(property, 'propertyType')}`);
      console.log(`Year Built: ${getNestedValue(property, 'yearBuilt')}`);
      console.log(`Bedrooms: ${getNestedValue(property, 'bedrooms')}`);
      console.log(`Bathrooms: ${getNestedValue(property, 'bathrooms')}`);
      console.log(`Square Feet: ${getNestedValue(property, 'squareFeet')}`);
      console.log(`Last Sale Date: ${getNestedValue(property, 'lastSaleDate')}`);
      console.log(`Last Sale Price: ${getNestedValue(property, 'lastSalePrice')}`);
      
      // Check for any missing fields
      const fieldsToCheck = [
        'address', 'city', 'state', 'zipCode', 'propertyType', 
        'yearBuilt', 'bedrooms', 'bathrooms', 'squareFeet',
        'lotSize', 'lastSaleDate', 'lastSalePrice'
      ];
      
      const missingFields = [];
      fieldsToCheck.forEach(field => {
        if (getNestedValue(property, field) === 'N/A') {
          missingFields.push(field);
        }
      });
      
      if (missingFields.length > 0) {
        console.log('\n⚠️ Fields with missing values:', missingFields.join(', '));
      } else {
        console.log('\n✅ All checked fields have values!');
      }
    } else {
      console.error('Failed to retrieve property detail:', detailResponse.data);
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
testApi();
