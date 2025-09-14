import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { zillowScraper } from '../scrapers/zillowScraper';
import { enhancedZillowScraper } from '../scrapers/enhancedZillowScraper';
import { auctionDotComScraper } from '../scrapers/auctionScraper';
import { enhancedAuctionDotComScraper } from '../scrapers/enhancedAuctionScraper';
import { logger } from '../utils/logger';
import scraperLogger from '../utils/scraperLogger';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Open a SQLite database connection directly
let db: Database;
(async () => {
  db = await open({
    filename: path.resolve(__dirname, '../../../prisma/dev.db'),
    driver: sqlite3.Database
  });
  
  // Initialize tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scraping_jobs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      config TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      logs TEXT,
      resultsCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS property_records (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      city TEXT,
      state TEXT,
      zipCode TEXT,
      source TEXT NOT NULL,
      rawData TEXT NOT NULL,
      processed INTEGER DEFAULT 0,
      scrapingJobId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (scrapingJobId) REFERENCES scraping_jobs(id)
    );
    
    CREATE TABLE IF NOT EXISTS scraping_schedules (
      id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      frequency TEXT,
      time TEXT,
      day TEXT,
      sources TEXT NOT NULL,
      zipCodes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  
  logger.info('Scraper database tables initialized');
})();

// All routes require authentication
router.use(authenticate as any);

// Fixed Zillow scraper route
export const runZillowScraper = catchAsync(async (req: Request, res: Response) => {
  try {
    // Log the incoming request body for debugging
    logger.info('Zillow scraper request body:', req.body);
    
    // Extract and validate the parameters from the request body
    let { zipCodes, maxPages = 3, useEnhanced = false } = req.body;
    
    // Ensure zipCodes is an array
    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      // Fallback to default values if not provided or invalid
      zipCodes = ['07001', '07002'];
      logger.warn(`Invalid zipCodes parameter. Using defaults: ${zipCodes}`);
    }
    
    // Validate maxPages
    if (typeof maxPages !== 'number' || maxPages < 1) {
      maxPages = 3;
      logger.warn(`Invalid maxPages parameter. Using default: ${maxPages}`);
    }
    
    // Ensure useEnhanced is a boolean
    useEnhanced = Boolean(useEnhanced);
    
    const now = new Date().toISOString();
    const jobId = uuidv4();

    logger.info(`Creating Zillow scraping job: ${jobId} with useEnhanced=${useEnhanced}`);
    
    // Create scraping job record
    await db.run(
      `INSERT INTO scraping_jobs (id, source, status, config, startedAt, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        'zillow_fsbo',
        'pending',
        JSON.stringify({ zipCodes, maxPages, useEnhanced }),
        now,
        now,
        now
      ]
    );

    // Select the appropriate scraper based on the useEnhanced flag
    const selectedScraper = useEnhanced ? enhancedZillowScraper : zillowScraper;
    
    // Log which scraper version is being used
    logger.info(`Using ${useEnhanced ? 'enhanced' : 'standard'} Zillow scraper for job ${jobId}`);
    
    // Run scraper asynchronously
    selectedScraper.runFullScrape(zipCodes, maxPages)
      .then(async (results: any) => {
        // Handle both void and array return types
        // Standard scraper returns void, enhanced scraper returns ZillowListing[]
        const resultsCount = Array.isArray(results) ? results.length : 0;
        
        await db.run(
          `UPDATE scraping_jobs 
           SET status = ?, completedAt = ?, resultsCount = ?, updatedAt = ? 
           WHERE id = ?`,
          [
            'completed',
            new Date().toISOString(),
            resultsCount,
            new Date().toISOString(),
            jobId
          ]
        );
        
        // Get the updated job to broadcast
        const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id = ?', jobId);
        
        // Import and use WebSocket service to broadcast job update
        const scraperWebSocketService = require('../utils/scraperWebSocketService').default;
        scraperWebSocketService.broadcastJobUpdate({
          action: 'job_completed',
          job: updatedJob
        });
        
        logger.info(`Zillow scraping job ${jobId} completed with ${resultsCount} results`);
      })
      .catch(async (error: any) => {
        await db.run(
          `UPDATE scraping_jobs 
           SET status = ?, completedAt = ?, logs = ?, updatedAt = ? 
           WHERE id = ?`,
          [
            'failed',
            new Date().toISOString(),
            error?.message || 'Unknown error',
            new Date().toISOString(),
            jobId
          ]
        );
        
        // Get the updated job to broadcast
        const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id = ?', jobId);
        
        // Import and use WebSocket service to broadcast job update
        const scraperWebSocketService = require('../utils/scraperWebSocketService').default;
        scraperWebSocketService.broadcastJobUpdate({
          action: 'job_failed',
          job: updatedJob
        });
        
        logger.error(`Zillow scraping job ${jobId} failed:`, error);
      });

    res.json({
      success: true,
      message: 'Scraping job started',
      data: { jobId },
    });
  } catch (error: any) {
    logger.error('Error starting Zillow scraper:', error);
    throw new AppError(error.message || 'Failed to start Zillow scraper', 500);
  }
});

// Rest of the file omitted for brevity
// Include other routes and handlers here as needed

// Export default router
export default router;
