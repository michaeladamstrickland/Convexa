// test-attom.ts
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

async function testAttomAPI() {
  try {
    console.log('Testing ATTOM API connection...');
    
    const apiKey = process.env.ATTOM_API_KEY;
    if (!apiKey) {
      console.error('ATTOM API key not found in .env file');
      return;
    }
    
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    // Try the ATTOM API property ID endpoint with a specific ID
    const response = await axios({
      method: 'GET',
      url: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile',
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json'
      },
      params: {
        attomid: '1234567'
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Headers:', response.headers);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('Error testing ATTOM API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testAttomAPI();
