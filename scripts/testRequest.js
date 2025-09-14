/**
 * testRequest.js
 * Script to test HTTP requests to our API
 */

import http from 'http';

// Function to make a GET request
function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      
      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // The whole response has been received
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Function to make a POST request
function makePostRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Test health check
console.log('Testing health check endpoint...');
makeGetRequest('http://localhost:3030/api/health')
  .then(data => {
    console.log('Health Check Result:', data);
    
    // Test property valuation
    console.log('\nTesting property valuation endpoint...');
    return makePostRequest('http://localhost:3030/api/predict/value', {
      address: '123 Test St, Testville, TX 12345',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      yearBuilt: 1995,
      zipCode: '12345'
    });
  })
  .then(data => {
    console.log('Property Valuation Result:', data);
    
    console.log('\nAll tests completed!');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });
