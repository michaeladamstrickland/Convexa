#!/usr/bin/env node

// Script to test the zip-search-new API routes

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000/api';

// Helper function to make API calls
async function callApi(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    console.log(`Calling ${API_BASE}${endpoint}...`);
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (!response.ok) {
      console.error(`API call failed with status: ${response.status}`);
      const text = await response.text();
      console.error(`Response text: ${text}`);
      return { 
        status: response.status, 
        error: new Error(`API returned ${response.status}`) 
      };
    }
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error calling API ${endpoint}:`, error);
    return { status: 500, error };
  }
}

// Test the zip-search-new routes
async function testZipSearchNewRoutes() {
  console.log('===== TESTING ZIP-SEARCH-NEW API ROUTES =====');
  
  // Test the health endpoint first to verify server is running
  console.log('\nTesting health endpoint...');
  try {
    console.log('Trying /health...');
    const healthResponse = await callApi('/health');
    console.log(`Health status: ${healthResponse.status}`);
    console.log('Response:', healthResponse.data);
    
    if (healthResponse.error) {
      // Try alternate location
      console.log('Health endpoint not found at /api/health, trying /health directly...');
      
      const directResponse = await fetch('http://localhost:5000/health');
      if (!directResponse.ok) {
        console.error(`Direct health call failed with status: ${directResponse.status}`);
        return false;
      }
      
      const directData = await directResponse.json();
      console.log('Direct health response:', directData);
      return true;
    }
  } catch (error) {
    console.error('Error checking health endpoints:', error);
    return false;
  }
  
  if (healthResponse.error) {
    console.error('❌ Server is not responding. Make sure it is running on port 5000.');
    return false;
  }
  
  // Test search endpoint
  console.log('\nTesting search endpoint...');
  const searchResponse = await callApi('/zip-search-new/search?limit=5');
  
  if (searchResponse.error) {
    console.error('❌ Search endpoint test failed');
  } else {
    console.log(`✓ Search endpoint returned ${searchResponse.data?.leads?.length || 0} leads`);
    console.log('Pagination:', searchResponse.data?.pagination);
    if (searchResponse.data?.leads?.length > 0) {
      console.log('First lead:', JSON.stringify(searchResponse.data.leads[0], null, 2));
    }
  }
  
  // Test searching by zip code
  console.log('\nTesting zip code search...');
  const zipSearchBody = { zipCode: '85034' }; // Using a zip code found in our sample lead
  const zipSearchResponse = await callApi('/zip-search-new/search-zip', 'POST', zipSearchBody);
  
  if (zipSearchResponse.error) {
    console.error('❌ Zip code search endpoint test failed');
  } else {
    console.log(`✓ Zip code search endpoint returned data`);
    console.log(`Found ${zipSearchResponse.data?.leadCount || 0} leads in zip code ${zipSearchBody.zipCode}`);
  }
  
  console.log('\n===== ZIP-SEARCH-NEW API TEST COMPLETED =====');
  return !healthResponse.error;
}

// Run the tests
testZipSearchNewRoutes().then((success) => {
  if (success) {
    console.log('✓ API tests completed successfully');
    process.exit(0);
  } else {
    console.error('❌ API tests failed');
    process.exit(1);
  }
});
