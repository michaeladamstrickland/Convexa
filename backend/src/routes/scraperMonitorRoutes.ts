/**
 * Debug API for Scrapers
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import scraperMonitor from '../utils/scraperMonitor';

const router = Router();

// Get status of all scraper jobs
router.get('/status', (req: Request, res: Response) => {
  const jobs = scraperMonitor.getAllJobs();
  res.status(200).json({
    success: true,
    count: jobs.length,
    jobs
  });
});

// Get status of a specific job
router.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = scraperMonitor.getJobInfo(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      message: `Job ${jobId} not found`
    });
  }
  
  res.status(200).json({
    success: true,
    job
  });
});

// Manually log all current jobs (useful for debugging)
router.post('/log', (req: Request, res: Response) => {
  scraperMonitor.logStatus();
  res.status(200).json({
    success: true,
    message: 'Job status logged'
  });
});

export default router;
