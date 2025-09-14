/**
 * Simple Auction.com Scraper Route
 * 
 * This is a simplified version of the route handler for debugging purposes.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { auctionDotComScraper } from './scrapers/auctionScraper';
import { enhancedAuctionDotComScraper } from './scrapers/enhancedAuctionScraper';
import { logger } from './utils/logger';
import scraperMonitor from './utils/scraperMonitor';
import { AppError } from './middleware/errorHandler';

/**
 * Simplified route handler for the Auction.com scraper
 */
export async function simplifiedAuctionRoute(req: Request, res: Response) {
  try {
    logger.info('Auction.com scraper request body:', req.body);
    
    // Extract parameters with validation
    const { state, auctionType = 'all', maxPages = 3, useEnhanced = false } = req.body;
    
    // Validate state
    if (!state) {
      return res.status(400).json({
        success: false,
        message: 'State is required'
      });
    }
    
    // Convert state code to search location format
    const stateMapping: {[key: string]: string} = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    
    const stateName = stateMapping[state] || state;
    const locations = [`${stateName}`];
    
    logger.info('Parameters:', { 
      state, 
      stateName,
      auctionType, 
      maxPages: Number(maxPages),
      useEnhanced: Boolean(useEnhanced)
    });
    
    // Generate a job ID
    const jobId = uuidv4();
    
    // Register job with monitor
    scraperMonitor.registerJob(jobId, 'auction', Boolean(useEnhanced));
    
    // Select scraper
    const scraper = useEnhanced ? enhancedAuctionDotComScraper : auctionDotComScraper;
    
    // Run scraper in the background
    setTimeout(async () => {
      scraperMonitor.updateJobStatus(jobId, 'running');
      
      try {
        // Initialize the scraper (default to headless mode for production)
        process.env.PUPPETEER_HEADLESS = 'true';
        
        // Initialize the scraper
        logger.info(`Initializing ${useEnhanced ? 'enhanced' : 'standard'} auction scraper for job ${jobId}`);
        await scraper.initialize();
        
        // Run the scraper
        logger.info(`Running auction scraper for state: ${stateName}, pages: ${maxPages}`);
        
        const listings = await scraper.searchListingsByLocation(locations, Number(maxPages));
        
        // Close browser
        await scraper.close();
        
        logger.info(`Auction scraping completed with ${listings.length} results`);
        scraperMonitor.updateJobStatus(jobId, 'completed', listings);
      } catch (error) {
        logger.error('Auction scraping failed:', error);
        scraperMonitor.updateJobStatus(jobId, 'failed', error);
        
        // Attempt to close the browser if it's still open
        try {
          await scraper.close();
        } catch (closeError) {
          logger.error('Failed to close browser:', closeError);
        }
      }
    }, 0);
    
    // Respond immediately
    res.status(200).json({
      success: true,
      message: 'Auction scraping job started',
      data: { jobId }
    });
    
  } catch (error: any) {
    logger.error('Error in Auction route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred'
    });
  }
}
