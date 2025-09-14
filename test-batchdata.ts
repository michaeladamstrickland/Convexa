// test-batchdata.ts
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

async function testBatchDataAPI() {
  try {
    console.log('Testing BatchData API connection...');
    
    const apiKey = process.env.BATCHDATA_API_KEY;
    if (!apiKey) {
      console.error('BatchData API key not found in .env file');
      return;
    }
    
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    // Test API connection with a different endpoint format
    const response = await axios({
      method: 'GET',
      url: 'https://batch-data.com/api/v1/property/skip',  // Changed domain
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      },
      params: {
        address: '123 Main St',
        city: 'Beverly Hills',
        state: 'CA',
        zip: '90210'
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('Error testing BatchData API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testBatchDataAPI();
