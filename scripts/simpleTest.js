/**
 * simpleTest.js
 * A very simple test script
 */

import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3030,
  path: '/api/health',
  method: 'GET'
};

console.log('Sending request to http://localhost:3030/api/health');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Data:');
    console.log(data);
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

req.end();
