import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Debug endpoint for Zillow scraper
router.post('/debug-zillow', catchAsync(async (req: Request, res: Response) => {
  try {
    // Log the request body
    logger.info('Debug Zillow request body:', req.body);
    
    // Check if zipCodes is present and valid
    const { zipCodes, maxPages, useEnhanced } = req.body;
    
    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      logger.error('Invalid zipCodes in request:', zipCodes);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid zipCodes parameter. Must be a non-empty array.' 
      });
    }
    
    // Log the parsed parameters
    logger.info('Parsed parameters:', {
      zipCodesType: typeof zipCodes,
      zipCodesIsArray: Array.isArray(zipCodes),
      zipCodesLength: zipCodes.length,
      maxPages,
      useEnhanced,
      useEnhancedType: typeof useEnhanced
    });
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Debug successful',
      parsedData: {
        zipCodes,
        maxPages,
        useEnhanced
      }
    });
  } catch (error: any) {
    logger.error('Debug Zillow error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Debug error',
      error: error.message || 'Unknown error' 
    });
  }
}));

export default router;
