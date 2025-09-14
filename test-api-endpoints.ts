/**
 * Test script for the API endpoints
 * 
 * This script tests the REST API endpoints for both scraper and scheduler
 * to verify they're working correctly.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Define base API URL and authentication token
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''; // Add test token in .env file

// Create authenticated client
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

/**
 * Run API tests sequentially
 */
async function runApiTests() {
  console.log('===== STARTING API ENDPOINT TESTS =====');
  
  // Keep track of created resources to clean up later
  const createdResources = {
    scheduleId: null,
    jobId: null
  };

  try {
    // 1. Test scheduler endpoints
    console.log('\n----- Testing Scheduler Endpoints -----');
    
    // Get all schedules
    console.log('GET /scheduler/schedules');
    const schedulesResponse = await api.get('/scheduler/schedules');
    console.log(`Status: ${schedulesResponse.status}`);
    console.log(`Found ${schedulesResponse.data.schedules?.length || 0} schedules`);
    
    // Create a new schedule
    console.log('\nPOST /scheduler/schedules');
    const newSchedule = {
      name: `API Test Schedule ${uuidv4().substring(0, 8)}`,
      scraperType: 'zillow_fsbo',
      cronExpression: '0 12 * * *',
      config: {
        locations: ['07001'],
        maxPages: 1
      }
    };
    
    try {
      const createResponse = await api.post('/scheduler/schedules', newSchedule);
      console.log(`Status: ${createResponse.status}`);
      console.log('Created schedule:');
      console.log(JSON.stringify(createResponse.data.schedule, null, 2));
      
      // Save for later use and cleanup
      createdResources.scheduleId = createResponse.data.schedule?.id;
    } catch (error) {
      console.error('Error creating schedule:', error.response?.data || error.message);
    }
    
    // If schedule was created, test other operations
    if (createdResources.scheduleId) {
      // Get schedule by ID
      console.log(`\nGET /scheduler/schedules/${createdResources.scheduleId}`);
      try {
        const getResponse = await api.get(`/scheduler/schedules/${createdResources.scheduleId}`);
        console.log(`Status: ${getResponse.status}`);
        console.log('Schedule details:');
        console.log(JSON.stringify(getResponse.data.schedule, null, 2));
      } catch (error) {
        console.error('Error getting schedule:', error.response?.data || error.message);
      }
      
      // Update schedule
      console.log(`\nPUT /scheduler/schedules/${createdResources.scheduleId}`);
      try {
        const updateResponse = await api.put(`/scheduler/schedules/${createdResources.scheduleId}`, {
          name: 'Updated API Test Schedule',
          cronExpression: '0 15 * * *' // 3 PM every day
        });
        console.log(`Status: ${updateResponse.status}`);
        console.log('Updated schedule:');
        console.log(JSON.stringify(updateResponse.data.schedule, null, 2));
      } catch (error) {
        console.error('Error updating schedule:', error.response?.data || error.message);
      }
      
      // Run schedule immediately (optional - uncomment to test)
      /*
      console.log(`\nPOST /scheduler/schedules/${createdResources.scheduleId}/run`);
      try {
        const runResponse = await api.post(`/scheduler/schedules/${createdResources.scheduleId}/run`);
        console.log(`Status: ${runResponse.status}`);
        console.log('Run response:');
        console.log(JSON.stringify(runResponse.data, null, 2));
        
        // Save job ID for later reference
        createdResources.jobId = runResponse.data.jobId;
      } catch (error) {
        console.error('Error running schedule:', error.response?.data || error.message);
      }
      */
    }
    
    // 2. Test scraper endpoints
    console.log('\n----- Testing Scraper Endpoints -----');
    
    // Get all jobs
    console.log('GET /scraper/jobs');
    try {
      const jobsResponse = await api.get('/scraper/jobs');
      console.log(`Status: ${jobsResponse.status}`);
      console.log(`Found ${jobsResponse.data.jobs?.length || 0} jobs`);
      if (jobsResponse.data.jobs?.length > 0) {
        console.log('Latest job:');
        console.log(JSON.stringify(jobsResponse.data.jobs[0], null, 2));
      }
    } catch (error) {
      console.error('Error getting jobs:', error.response?.data || error.message);
    }
    
    // If we ran a job, get its details
    if (createdResources.jobId) {
      console.log(`\nGET /scraper/jobs/${createdResources.jobId}`);
      try {
        const jobResponse = await api.get(`/scraper/jobs/${createdResources.jobId}`);
        console.log(`Status: ${jobResponse.status}`);
        console.log('Job details:');
        console.log(JSON.stringify(jobResponse.data.job, null, 2));
      } catch (error) {
        console.error('Error getting job details:', error.response?.data || error.message);
      }
    }
    
    // 3. Cleanup (if requested)
    if (createdResources.scheduleId && process.argv.includes('--cleanup')) {
      console.log('\n----- Cleaning Up Test Resources -----');
      console.log(`DELETE /scheduler/schedules/${createdResources.scheduleId}`);
      try {
        const deleteResponse = await api.delete(`/scheduler/schedules/${createdResources.scheduleId}`);
        console.log(`Status: ${deleteResponse.status}`);
        console.log('Schedule deleted successfully');
      } catch (error) {
        console.error('Error deleting schedule:', error.response?.data || error.message);
      }
    } else if (createdResources.scheduleId) {
      console.log(`\nSkipping cleanup. The schedule ${createdResources.scheduleId} was left in the database.`);
      console.log('Run with --cleanup flag to delete test resources');
    }

    console.log('\n===== API ENDPOINT TESTS COMPLETED =====');
  } catch (error) {
    console.error('Unhandled error in API tests:', error);
  }
}

// Run the tests
runApiTests().catch(console.error);
