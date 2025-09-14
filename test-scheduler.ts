/**
 * Test script for the job scheduler implementation
 * 
 * This script tests the job scheduler functionality including:
 * - Creating schedules
 * - Listing schedules
 * - Running schedules immediately
 * - Updating and deleting schedules
 */
import dotenv from 'dotenv';
import { logger } from './test-logger.js';

// Load environment variables
dotenv.config();

// Import the mock scheduler
import { mockJobScheduler } from './mock-server.js';
const jobScheduler = mockJobScheduler;

// Load environment variables
dotenv.config();

async function runSchedulerTests() {
  logger.info('===== STARTING JOB SCHEDULER TESTS =====');
  
  try {
    // Initialize the scheduler
    logger.info('Initializing job scheduler...');
    await jobScheduler.initialize();
    
    // Test creating a schedule
    logger.info('\n----- Testing Schedule Creation -----');
    
    // Create a test schedule for Zillow scraper
    const zillowSchedule = await jobScheduler.createSchedule({
      name: 'Test Zillow Schedule',
      scraperType: 'zillow_fsbo',
      cronExpression: '0 12 * * 1', // Every Monday at noon
      config: {
        locations: ['07001', '90210'],
        maxPages: 1
      }
    });
    
    logger.info(`Created Zillow schedule: ${JSON.stringify(zillowSchedule)}`);
    
    // Create a test schedule for Auction scraper
    const auctionSchedule = await jobScheduler.createSchedule({
      name: 'Test Auction Schedule',
      scraperType: 'auction_com',
      cronExpression: '0 14 * * 3', // Every Wednesday at 2 PM
      config: {
        locations: ['Las Vegas, NV', 'Miami, FL'],
        maxPages: 1
      }
    });
    
    logger.info(`Created Auction schedule: ${JSON.stringify(auctionSchedule)}`);
    
    // Test listing all schedules
    logger.info('\n----- Testing Schedule Listing -----');
    const allSchedules = await jobScheduler.getSchedules(true); // Include inactive
    logger.info(`Found ${allSchedules.length} schedules:`);
    console.log(JSON.stringify(allSchedules, null, 2));
    
    // Test updating a schedule
    if (zillowSchedule?.id) {
      logger.info('\n----- Testing Schedule Update -----');
      const updatedSchedule = await jobScheduler.updateSchedule(zillowSchedule.id, {
        name: 'Updated Zillow Schedule',
        cronExpression: '0 10 * * 2', // Every Tuesday at 10 AM
      });
      
      logger.info(`Updated schedule: ${JSON.stringify(updatedSchedule)}`);
    }
    
    // Test running a schedule immediately
    if (auctionSchedule?.id) {
      logger.info('\n----- Testing Run Schedule Immediately -----');
      logger.info('Note: This will actually start a scraping job!');
      logger.info('Press Ctrl+C if you want to cancel...');
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay to allow cancellation
      
      try {
        const jobId = await jobScheduler.runScheduleNow(auctionSchedule.id);
        logger.info(`Started immediate job with ID: ${jobId}`);
      } catch (error) {
        logger.error('Error running schedule immediately:', error);
      }
    }
    
    // Wait a bit to allow for job initialization
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test deleting schedules (cleanup)
    logger.info('\n----- Cleaning Up Test Schedules -----');
    
    if (zillowSchedule?.id) {
      await jobScheduler.deleteSchedule(zillowSchedule.id);
      logger.info(`Deleted Zillow schedule: ${zillowSchedule.id}`);
    }
    
    if (auctionSchedule?.id) {
      await jobScheduler.deleteSchedule(auctionSchedule.id);
      logger.info(`Deleted Auction schedule: ${auctionSchedule.id}`);
    }
    
    // Shut down the scheduler
    jobScheduler.stop();
    
    logger.info('\n===== JOB SCHEDULER TESTS COMPLETED =====');
  } catch (error) {
    logger.error('Unhandled error in scheduler tests:', error);
  }
}

// Run the tests
runSchedulerTests().catch(console.error);
