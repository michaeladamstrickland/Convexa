// Simple HTTP client to test the ZIP Search API
// Uses native HTTP module for maximum compatibility

import http from 'http';

// Helper function to make HTTP requests
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: json
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Main function to test the API
async function testApi() {
  try {
    console.log('Testing health endpoint...');
    const health = await httpGet('/health');
    console.log('Response:', health);
    
    console.log('\nTesting search endpoint...');
    const search = await httpGet('/api/zip-search-new/search?limit=2');
    console.log(`Found ${search.data?.leads?.length || 0} leads`);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testApi();
