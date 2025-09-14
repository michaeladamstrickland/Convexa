// Test client for ZIP Search API server

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001';

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
      try {
        const text = await response.text();
        console.error(`Response: ${text}`);
      } catch {
        console.error('Could not read response body');
      }
      return { 
        status: response.status, 
        error: new Error(`API returned ${response.status}`) 
      };
    }
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error calling API ${endpoint}:`, error.message || error);
    return { status: 500, error };
  }
}

// Test all the API endpoints
async function testApiEndpoints() {
  console.log('===== TESTING ZIP SEARCH API ENDPOINTS =====');
  
  // Check server health
  console.log('\n📊 Testing health endpoint...');
  const healthResponse = await callApi('/health');
  if (healthResponse.error) {
    console.error('❌ Server is not responding. Make sure it is running on port 5001.');
    return false;
  }
  
  console.log('✅ Server is healthy:', healthResponse.data);
  
  // Test general search
  console.log('\n🔍 Testing search endpoint...');
  const searchResponse = await callApi('/api/zip-search-new/search?limit=5');
  
  if (searchResponse.error) {
    console.error('❌ Search endpoint failed');
    return false;
  }
  
  console.log(`✅ Found ${searchResponse.data?.leads?.length || 0} leads`);
  if (searchResponse.data?.leads?.length > 0) {
    console.log('📋 First lead:', JSON.stringify(searchResponse.data.leads[0], null, 2));
  }
  
  // Test ZIP code search
  console.log('\n🏘️ Testing ZIP code search...');
  const zipCode = '85034';
  const zipSearchResponse = await callApi('/api/zip-search-new/search-zip', 'POST', { zipCode });
  
  if (zipSearchResponse.error) {
    console.error('❌ ZIP search endpoint failed');
    return false;
  }
  
  console.log(`✅ Found ${zipSearchResponse.data?.leads?.length || 0} leads in ZIP code ${zipCode}`);
  
  // Test revenue analytics
  console.log('\n💰 Testing revenue analytics endpoint...');
  const analyticsResponse = await callApi('/api/zip-search-new/revenue-analytics');
  
  if (analyticsResponse.error) {
    console.error('❌ Revenue analytics endpoint failed');
    return false;
  }
  
  console.log('✅ Revenue analytics:', JSON.stringify(analyticsResponse.data?.analytics, null, 2));
  
  console.log('\n===== ALL TESTS PASSED =====');
  return true;
}

// Run the tests
testApiEndpoints().then(success => {
  if (success) {
    console.log('🎉 API server is working correctly!');
    process.exit(0);
  } else {
    console.error('❌ API tests failed');
    process.exit(1);
  }
});
