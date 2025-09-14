// Frontend Integration Test Script
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Calculate __dirname equivalent for ES modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test property ID - replace with a valid ATTOM ID from your database
const TEST_ATTOM_ID = '42116';

// Helper function for safely accessing nested properties - same as in frontend
function getNestedValue(obj, path, defaultValue = 'N/A') {
  try {
    const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (e) {
    console.log(`Error getting nested value for path ${path}:`, e);
    return defaultValue;
  }
}

// Helper for numeric formatting with fallbacks
function formatNumber(value, defaultValue = 'N/A') {
  if (value === undefined || value === null) return defaultValue;
  if (isNaN(value)) return defaultValue;
  return Number(value).toLocaleString();
}

async function testFrontendIntegration() {
  console.log('Starting Frontend Integration Test...');
  
  try {
    // Ensure ATTOM API server is running
    let statusCheck;
    try {
      statusCheck = await axios.get('http://localhost:5002/api/attom/status');
      console.log('ATTOM API server status:', statusCheck.data);
    } catch (error) {
      console.error('ATTOM API server does not appear to be running!');
      console.log('Please start the server with: node backend/attom-server.js');
      process.exit(1);
    }
    
    // Test property detail endpoint
    console.log(`Testing property detail endpoint for ID: ${TEST_ATTOM_ID}...`);
    const detailResponse = await axios.get(`http://localhost:5002/api/attom/property/${TEST_ATTOM_ID}/detail`);
    
    if (detailResponse.data.status === 'success') {
      console.log('Property detail endpoint successful!');
      
      // Test our field mapping with the helper functions
      const property = detailResponse.data.property;
      
      console.log('\n==== Testing Field Access with Helper Functions ====');
      console.log(`Address: ${getNestedValue(property, 'address')}`);
      console.log(`City/State/ZIP: ${getNestedValue(property, 'city')}, ${getNestedValue(property, 'state')} ${getNestedValue(property, 'zipCode')}`);
      console.log(`Property Type: ${getNestedValue(property, 'propertyType')}`);
      console.log(`Year Built: ${getNestedValue(property, 'yearBuilt')}`);
      console.log(`Bedrooms: ${getNestedValue(property, 'bedrooms')}`);
      console.log(`Bathrooms: ${getNestedValue(property, 'bathrooms')}`);
      console.log(`Square Feet: ${formatNumber(getNestedValue(property, 'squareFeet', 0))}`);
      console.log(`Last Sale: ${getNestedValue(property, 'lastSaleDate')} for ${formatNumber(getNestedValue(property, 'lastSalePrice', 0), '$0')}`);
      
      // Check for any fields with N/A values
      const fieldsToCheck = [
        'address', 'city', 'state', 'zipCode', 'propertyType', 'yearBuilt', 
        'bedrooms', 'bathrooms', 'squareFeet', 'lotSize', 'lastSaleDate', 'lastSalePrice'
      ];
      
      const naFields = [];
      fieldsToCheck.forEach(field => {
        if (getNestedValue(property, field) === 'N/A') {
          naFields.push(field);
        }
      });
      
      if (naFields.length > 0) {
        console.log('\n⚠️ Fields with N/A values:', naFields.join(', '));
        console.log('These fields may need additional mapping paths in the backend.');
      } else {
        console.log('\n✅ All checked fields have values! Field mapping is working well.');
      }
      
      // Save the response for frontend testing
      const outputFile = path.join(__dirname, 'frontend', 'test-property-data.json');
      fs.writeFileSync(outputFile, JSON.stringify(detailResponse.data, null, 2));
      console.log(`Response saved to ${outputFile}`);
      
      // Generate test component code to quickly view the property
      const testComponentFile = path.join(__dirname, 'frontend', 'TestPropertyComponent.jsx');
      
      const testComponentCode = `
import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, Grid, CircularProgress } from '@mui/material';
import PropertyDetailEnhanced from './PropertyDetailEnhanced';
import testPropertyData from './test-property-data.json';

// Helper function for safely accessing nested properties
const getNestedValue = (obj, path, defaultValue = 'N/A') => {
  try {
    const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (e) {
    console.log(\`Error getting nested value for path \${path}:\`, e);
    return defaultValue;
  }
};

// Helper for numeric formatting with fallbacks
const formatNumber = (value, defaultValue = 'N/A') => {
  if (value === undefined || value === null) return defaultValue;
  if (isNaN(value)) return defaultValue;
  return Number(value).toLocaleString();
};

const TestPropertyComponent = () => {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load the test property data
    setLoading(true);
    try {
      setProperty(testPropertyData.property);
    } catch (err) {
      console.error("Error loading test data:", err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  if (!property) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error">Failed to load test property data</Typography>
      </Box>
    );
  }
  
  // Display a simple property summary with safe property access
  const PropertySummary = () => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6">Property Summary (Using Helper Functions)</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography variant="body2">Address</Typography>
          <Typography variant="body1">{getNestedValue(property, 'address')}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2">Type</Typography>
          <Typography variant="body1">{getNestedValue(property, 'propertyType')}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2">Year Built</Typography>
          <Typography variant="body1">{getNestedValue(property, 'yearBuilt')}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2">Size</Typography>
          <Typography variant="body1">{formatNumber(getNestedValue(property, 'squareFeet', 0))} sq ft</Typography>
        </Grid>
      </Grid>
    </Paper>
  );
  
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>ATTOM API Test Component</Typography>
      <PropertySummary />
      
      <Typography variant="h5" gutterBottom>Full Property Detail Component:</Typography>
      <PropertyDetailEnhanced 
        propertyId="${TEST_ATTOM_ID}" 
        property={property} 
        onBack={() => console.log('Back button clicked')}
      />
    </Box>
  );
};

export default TestPropertyComponent;
`;
      
      fs.writeFileSync(testComponentFile, testComponentCode);
      console.log(`Test component created at ${testComponentFile}`);
      console.log('\nTo test the component:');
      console.log('1. Import and use TestPropertyComponent in your main App.js');
      console.log('2. Or modify your routes to include this test component');
      console.log('\nExample route:');
      console.log(`
// Add this to your routes
import TestPropertyComponent from './TestPropertyComponent';
...
<Route path="/test-property" element={<TestPropertyComponent />} />
      `);
    } else {
      console.error('Property detail endpoint failed:', detailResponse.data);
    }
  } catch (error) {
    console.error('Error in frontend integration test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFrontendIntegration().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});
