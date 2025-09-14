/**
 * Simple Scraper Routes
 * 
 * These are simplified versions of the scraper routes for debugging purposes.
 */

import express from 'express';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { zillowScraper } from '../scrapers/zillowScraper';
import { enhancedZillowScraper } from '../scrapers/enhancedZillowScraper';
import { auctionDotComScraper } from '../scrapers/auctionScraper';
import { enhancedAuctionDotComScraper } from '../scrapers/enhancedAuctionScraper';
import { logger } from '../utils/logger';
import scraperMonitor from '../utils/scraperMonitor';
import { logDetailedError } from '../utils/errorLogger';

const router = express.Router();

/**
 * Validate zip codes
 */
function validateZipCodes(zipCodes: any): string[] {
  // If zipCodes is not provided or not an array, use defaults
  if (!zipCodes || !Array.isArray(zipCodes)) {
    logger.warn('Invalid or missing zipCodes, using defaults');
    return ['07001', '07002'];
  }
  
  // Filter out invalid zip codes
  const validZips = zipCodes.filter((zip: any) => {
    if (typeof zip !== 'string') {
      return false;
    }
    return /^\d{5}(-\d{4})?$/.test(zip.trim());
  });
  
  if (validZips.length === 0) {
    logger.warn('No valid zip codes found, using defaults');
    return ['07001', '07002'];
  }
  
  return validZips;
}

/**
 * Zillow Scraper Route
 */
router.post('/zillow', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  try {
    logger.info(`[${requestId}] Zillow scraper request received`, { 
      body: req.body, 
      ip: req.ip, 
      userAgent: req.headers['user-agent'] 
    });
    
    // Validate request body exists
    if (!req.body) {
      logger.warn(`[${requestId}] Missing request body`);
      return res.status(400).json({
        success: false,
        message: 'Missing request body',
        requestId
      });
    }
    
    // Extract and validate parameters
    const zipCodes = validateZipCodes(req.body.zipCodes);
    const maxPages = isNaN(Number(req.body.maxPages)) ? 3 : Math.min(Math.max(Number(req.body.maxPages), 1), 10);
    const useEnhanced = req.body.useEnhanced === true;
    
    logger.info(`[${requestId}] Validated parameters:`, { zipCodes, maxPages, useEnhanced });
    
    // Generate a job ID
    const jobId = uuidv4();
    
    try {
      // Register job with monitor
      scraperMonitor.registerJob(jobId, 'zillow', useEnhanced);
      
      // Select scraper
      const scraper = useEnhanced ? enhancedZillowScraper : zillowScraper;
      
      // Log which scraper we're using
      logger.info(`[${requestId}] Using ${useEnhanced ? 'enhanced' : 'standard'} Zillow scraper for job ${jobId}`);
      
      // Run scraper in the background with proper error handling
      setTimeout(() => {
        // Update status to running
        scraperMonitor.updateJobStatus(jobId, 'running');
        
        // Log start of execution
        logger.info(`[${requestId}] Starting Zillow scrape for zip codes: ${zipCodes.join(', ')}`);
        
        scraper.runFullScrape(zipCodes, maxPages)
          .then(results => {
            const resultCount = Array.isArray(results) ? results.length : 0;
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            logger.info(`[${requestId}] Zillow scraping completed with ${resultCount} results in ${duration}s`);
            scraperMonitor.updateJobStatus(jobId, 'completed', results);
          })
          .catch(error => {
            // Log detailed error with context
            logDetailedError(error, {
              jobId,
              zipCodes,
              maxPages,
              useEnhanced,
              requestId
            }, 'ZillowScraper');
            
            // Create a clean error object for the monitor
            const cleanError = {
              message: error.message || 'Unknown error',
              name: error.name || 'Error',
              code: error.code,
              time: new Date().toISOString(),
              scraper: useEnhanced ? 'enhanced' : 'standard',
              zipCodes
            };
            
            scraperMonitor.updateJobStatus(jobId, 'failed', cleanError);
          });
      }, 0);
      
      // Respond immediately with success
      res.status(200).json({
        success: true,
        message: 'Scraping job started successfully',
        data: { 
          jobId,
          zipCodes,
          maxPages,
          useEnhanced,
          startTime: new Date().toISOString(),
          statusEndpoint: `/api/scraper-monitor/status/${jobId}`
        },
        requestId
      });
      
    } catch (monitorError: any) {
      // Handle errors with the scraper monitor
      logger.error(`[${requestId}] Error in scraper monitor:`, monitorError);
      res.status(500).json({
        success: false,
        message: 'Error starting scraper monitoring',
        error: monitorError.message,
        requestId
      });
    }
    
  } catch (error: any) {
    // Handle any unexpected errors
    const errorTime = Date.now() - startTime;
    
    // Log detailed error
    logDetailedError(error, {
      route: 'simplifiedZillowRoute',
      requestId,
      processingTimeMs: errorTime,
      requestBody: req.body
    }, 'ZillowRouteHandler');
    
    // Send detailed error response
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your request',
      error: error.message || 'Unknown error',
      errorType: error.name,
      errorCode: error.code,
      requestId,
      timestamp: new Date().toISOString(),
      suggestions: [
        'Check that your zip codes are valid',
        'Ensure the backend server has internet access',
        'Try using the standard scraper instead of enhanced',
        'Reduce the number of pages to scrape'
      ]
    });
  }
});

/**
 * Auction Scraper Route
 */
router.post('/auction', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  try {
    logger.info(`[${requestId}] Auction scraper request received`, { body: req.body });
    
    // Extract parameters
    const state = req.body.state || 'NJ';
    const maxPages = isNaN(Number(req.body.maxPages)) ? 3 : Math.min(Math.max(Number(req.body.maxPages), 1), 10);
    const useEnhanced = req.body.useEnhanced === true;
    
    // Generate job ID
    const jobId = uuidv4();
    
    // Register job with monitor
    scraperMonitor.registerJob(jobId, 'auction', useEnhanced);
    
    // Select scraper
    const scraper = useEnhanced ? enhancedAuctionDotComScraper : auctionDotComScraper;
    
    // Run in background
    setTimeout(() => {
      scraperMonitor.updateJobStatus(jobId, 'running');
      
      // Initialize scraper
      scraper.initialize()
        .then(() => {
          // Run search
          return scraper.searchListingsByLocation([state], maxPages);
        })
        .then(results => {
          // Close browser
          scraper.close();
          
          // Update status
          scraperMonitor.updateJobStatus(jobId, 'completed', results);
          logger.info(`Auction scraping completed with ${results.length} results`);
        })
        .catch(error => {
          // Close browser on error
          try {
            scraper.close();
          } catch (e) {
            logger.error('Error closing browser:', e);
          }
          
          // Log error
          logDetailedError(error, {
            jobId,
            state,
            maxPages,
            useEnhanced,
            requestId
          }, 'AuctionScraper');
          
          // Update status
          scraperMonitor.updateJobStatus(jobId, 'failed', {
            message: error.message || 'Unknown error',
            name: error.name || 'Error',
            time: new Date().toISOString()
          });
        });
    }, 0);
    
    // Respond immediately
    res.status(200).json({
      success: true,
      message: 'Auction scraping job started',
      data: { jobId }
    });
    
  } catch (error: any) {
    logger.error(`[${requestId}] Auction scraper error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to start auction scraper',
      error: error.message
    });
  }
});

export default router;
