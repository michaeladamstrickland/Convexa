/**
 * Auction.com API Endpoint Test
 * 
 * This script tests the integration of the enhanced Auction.com scraper
 * with the API endpoint. It simulates a frontend request to the API.
 * 
 * Run with: node test-auction-api.js
 */

const axios = require('axios');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base URL for API
const API_URL = 'http://localhost:3001/api';

// Authentication token (you'll need to get this from your browser)
let authToken = '';

// Function to prompt for API token
function getAuthToken() {
  return new Promise((resolve) => {
    rl.question('Enter your authentication token (from browser): ', (token) => {
      resolve(token);
    });
  });
}

// Function to prompt for state
function getState() {
  return new Promise((resolve) => {
    rl.question('Enter state code (e.g. FL, CA, NY): ', (state) => {
      resolve(state.toUpperCase());
    });
  });
}

// Function to prompt for max pages
function getMaxPages() {
  return new Promise((resolve) => {
    rl.question('Enter max pages to scrape (1-5): ', (pages) => {
      resolve(parseInt(pages) || 1);
    });
  });
}

// Main function
async function testAuctionApi() {
  try {
    console.log('===== TESTING AUCTION.COM API INTEGRATION =====');
    
    // Get auth token
    authToken = await getAuthToken();
    
    // Get state
    const state = await getState();
    
    // Get max pages
    const maxPages = await getMaxPages();
    
    console.log(`\nStarting scraper job for state: ${state}, pages: ${maxPages}`);
    
    // Make request to start scraper job
    const response = await axios.post(
      `${API_URL}/scraper/auction`, 
      {
        state,
        maxPages,
        auctionType: 'all'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.success) {
      const jobId = response.data.data.jobId;
      console.log(`\nScraper job started successfully with ID: ${jobId}`);
      
      // Poll for job status
      console.log('\nPolling for job status (press Ctrl+C to stop)...');
      
      let completed = false;
      let attempts = 0;
      
      while (!completed && attempts < 60) {  // Poll for up to 5 minutes (60 * 5s)
        await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5 seconds
        
        const statusResponse = await axios.get(
          `${API_URL}/scraper/jobs/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        if (statusResponse.data && statusResponse.data.data) {
          const job = statusResponse.data.data;
          const status = job.status;
          
          console.log(`Job status: ${status}, Results: ${job.resultsCount || 0}`);
          
          if (status === 'completed' || status === 'failed') {
            completed = true;
            
            if (status === 'completed') {
              console.log(`\nJob completed successfully with ${job.resultsCount} results`);
              
              // Get property records if available
              const recordsResponse = await axios.get(
                `${API_URL}/scraper/property-records?jobId=${jobId}&limit=5`,
                {
                  headers: {
                    'Authorization': `Bearer ${authToken}`
                  }
                }
              );
              
              if (recordsResponse.data && recordsResponse.data.data && recordsResponse.data.data.records) {
                const records = recordsResponse.data.data.records;
                console.log(`\nSample of ${records.length} records (limited to 5):`);
                
                records.forEach((record, index) => {
                  const data = JSON.parse(record.rawData);
                  console.log(`\n[${index + 1}] ${data.propertyAddress || 'Unknown'}`);
                  console.log(`    City: ${data.city || 'Unknown'}, State: ${data.state || 'Unknown'}`);
                  console.log(`    Price: ${data.startingBid ? '$' + data.startingBid : 'Unknown'}`);
                });
              }
            } else {
              console.log(`\nJob failed with error: ${job.logs || 'Unknown error'}`);
            }
          }
        }
        
        attempts++;
      }
      
      if (!completed) {
        console.log('\nJob polling timed out. The job may still be running.');
      }
    } else {
      console.error('\nFailed to start scraper job:', response.data);
    }
  } catch (error) {
    console.error('\nError testing API:', error.response?.data || error.message);
  } finally {
    rl.close();
  }
}

// Run the test
testAuctionApi().catch(console.error);
