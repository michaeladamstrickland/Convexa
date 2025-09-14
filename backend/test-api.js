/**
 * ZIP Search API Test Script
 * 
 * This script tests all endpoints of the ZIP Search API.
 * Run it after starting the server to verify the API is working correctly.
 * 
 * Usage: node test-api.js
 */

// Using node's built-in http module for better compatibility
const http = require('http');

// Configuration
const API_HOST = 'localhost';
const API_PORT = 5001;
const ENDPOINTS = [
  { path: '/health', method: 'GET', name: 'Health Check' },
  { path: '/api/zip-search-new/search?limit=3', method: 'GET', name: 'Search API' },
  { path: '/api/zip-search-new/revenue-analytics', method: 'GET', name: 'Analytics API' },
  { path: '/api/db-info', method: 'GET', name: 'Database Info API' }
];

// Test all endpoints sequentially
async function testAllEndpoints() {
  console.log(`
🔍 Testing ZIP Search API Server
==============================
Server: http://${API_HOST}:${API_PORT}
  `);

  // Test each endpoint one by one
  for (const endpoint of ENDPOINTS) {
    await testEndpoint(endpoint);
    console.log('\n------------------------------\n');
  }
  
  // Test the POST endpoint separately
  await testZipSearchPostEndpoint();
  
  console.log(`
✅ API Test Complete
=================
${ENDPOINTS.length + 1} endpoints tested

If all endpoints returned successfully, the server is working correctly!
  `);
}

// Function to test a GET endpoint
function testEndpoint({ path, name, method }) {
  return new Promise((resolve) => {
    console.log(`Testing ${name} (${method} ${path})`);
    
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method
    };
    
    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${name} is working!`);
          try {
            const parsed = JSON.parse(data);
            // Show a summary of the response based on the endpoint
            if (path === '/health') {
              console.log(`Server status: ${parsed.status}`);
              if (parsed.database) console.log(`Database: ${parsed.database}`);
              if (parsed.leads) console.log(`Lead count: ${parsed.leads}`);
            } else if (path.includes('search')) {
              console.log(`Found ${parsed.leads?.length || 0} leads`);
              console.log(`Total: ${parsed.pagination?.total || 'unknown'}`);
            } else if (path.includes('analytics')) {
              console.log(`Total leads: ${parsed.analytics?.totalLeads || 0}`);
              console.log(`Total value: $${(parsed.analytics?.totalEstimatedValue || 0).toLocaleString()}`);
            } else if (path.includes('db-info')) {
              console.log(`Tables: ${parsed.tables?.length || 0}`);
              if (parsed.tables) {
                console.log(`Available tables: ${parsed.tables.join(', ')}`);
              }
            }
          } catch (e) {
            console.log('Response is not valid JSON:', data.substring(0, 100) + '...');
          }
        } else {
          console.log(`❌ ${name} returned an error!`);
          console.log(`Response: ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error connecting to ${name}:`, error.message);
      console.log('Make sure the server is running on port 5001');
      resolve();
    });
    
    req.end();
  });
}

// Function to test the ZIP search POST endpoint
function testZipSearchPostEndpoint() {
  return new Promise((resolve) => {
    const path = '/api/zip-search-new/search-zip';
    const name = 'ZIP Search API (POST)';
    console.log(`Testing ${name} (POST ${path})`);
    
    const postData = JSON.stringify({
      zipCode: '90210'  // Beverly Hills ZIP code as test
    });
    
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${name} is working!`);
          try {
            const parsed = JSON.parse(data);
            console.log(`ZIP Code: ${parsed.zipCode}`);
            console.log(`Found ${parsed.leadCount} leads`);
          } catch (e) {
            console.log('Response is not valid JSON:', data.substring(0, 100) + '...');
          }
        } else {
          console.log(`❌ ${name} returned an error!`);
          console.log(`Response: ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error connecting to ${name}:`, error.message);
      console.log('Make sure the server is running on port 5001');
      resolve();
    });
    
    req.write(postData);
    req.end();
  });
}

// Start the tests
testAllEndpoints().catch(console.error);
