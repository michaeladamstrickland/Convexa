#!/usr/bin/env node

/**
 * API Endpoint Test Script
 * 
 * This script tests the scraper API endpoints to verify they're working correctly.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { logger } from './test-logger.js';

// Load environment variables
dotenv.config();

// Define base API URL and authentication token
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Create authenticated client
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

// Test data
const testZillowScraperRequest = {
  source: 'zillow_fsbo',
  config: {
    locations: ['90210', '33139', '10001'],
    maxPages: 1
  }
};

const testAuctionScraperRequest = {
  source: 'auction_com',
  config: {
    locations: ['Las Vegas, NV', 'Phoenix, AZ'],
    maxPages: 1
  }
};

const testScheduleRequest = {
  name: 'Weekly Zillow Scraper',
  scraperType: 'zillow_fsbo',
  cronExpression: '0 9 * * 1', // Every Monday at 9 AM
  config: {
    locations: ['90210', '33139', '10001'],
    maxPages: 2
  }
};

/**
 * Run API tests
 */
async function runApiTests() {
  logger.info('===== STARTING API ENDPOINT TESTS =====');
  
  try {
    // Test the scheduler endpoints
    logger.info('\n----- Testing Scheduler Endpoints -----');
    
    // List schedules
    logger.info('GET /scraper/schedules');
    const schedulesResponse = await api.get('/scraper/schedules');
    logger.info(`Found ${schedulesResponse.data.length} schedules`);
    
    // Create a new schedule
    logger.info('\nPOST /scraper/schedules');
    const createScheduleResponse = await api.post('/scraper/schedules', testScheduleRequest);
    logger.info(`Created schedule with ID: ${createScheduleResponse.data.id}`);
    
    // Get the created schedule
    const scheduleId = createScheduleResponse.data.id;
    logger.info(`\nGET /scraper/schedules/${scheduleId}`);
    const getScheduleResponse = await api.get(`/scraper/schedules/${scheduleId}`);
    logger.info(`Retrieved schedule: ${getScheduleResponse.data.name}`);
    
    // Update the schedule
    logger.info(`\nPUT /scraper/schedules/${scheduleId}`);
    const updateScheduleResponse = await api.put(`/scraper/schedules/${scheduleId}`, {
      name: 'Updated Zillow Schedule',
      cronExpression: '0 10 * * 2' // Every Tuesday at 10 AM
    });
    logger.info(`Updated schedule: ${updateScheduleResponse.data.name}`);
    
    // Test immediate execution of a schedule
    logger.info(`\nPOST /scraper/schedules/${scheduleId}/run`);
    const runScheduleResponse = await api.post(`/scraper/schedules/${scheduleId}/run`);
    logger.info(`Started job with ID: ${runScheduleResponse.data.jobId}`);
    
    // Test the scraper job endpoints
    logger.info('\n----- Testing Scraper Job Endpoints -----');
    
    // Start a Zillow scraper job
    logger.info('\nPOST /scraper/start');
    const startZillowResponse = await api.post('/scraper/start', testZillowScraperRequest);
    logger.info(`Started Zillow scraper job with ID: ${startZillowResponse.data.jobId}`);
    
    // Start an Auction.com scraper job
    logger.info('\nPOST /scraper/start');
    const startAuctionResponse = await api.post('/scraper/start', testAuctionScraperRequest);
    logger.info(`Started Auction.com scraper job with ID: ${startAuctionResponse.data.jobId}`);
    
    // Get job status
    const zillowJobId = startZillowResponse.data.jobId;
    logger.info(`\nGET /scraper/jobs/${zillowJobId}`);
    const jobStatusResponse = await api.get(`/scraper/jobs/${zillowJobId}`);
    logger.info(`Job status: ${jobStatusResponse.data.status}`);
    
    // List all jobs
    logger.info('\nGET /scraper/jobs');
    const jobsResponse = await api.get('/scraper/jobs');
    logger.info(`Found ${jobsResponse.data.length} jobs`);
    
    // Clean up the created schedule
    logger.info(`\nDELETE /scraper/schedules/${scheduleId}`);
    await api.delete(`/scraper/schedules/${scheduleId}`);
    logger.info(`Deleted schedule: ${scheduleId}`);
    
    logger.info('\n===== API ENDPOINT TESTS COMPLETED =====');
  } catch (error) {
    logger.error('Unhandled error in API tests:', error);
  }
}

// Run the tests
runApiTests().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
