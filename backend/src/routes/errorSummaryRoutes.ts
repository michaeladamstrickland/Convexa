import { Router } from 'express';
import { Request, Response } from 'express';
import scraperMonitor from '../utils/scraperMonitor';
import { logger } from '../utils/logger';

const router = Router();

// Get error details endpoint
router.get('/error-summary', (req: Request, res: Response) => {
  try {
    // Get all jobs
    const allJobs = scraperMonitor.getAllJobs();
    
    // Extract failed jobs
    const failedJobs = allJobs.filter(job => job.status === 'failed');
    
    // Group errors by type
    const errorsByType: Record<string, any[]> = {};
    
    failedJobs.forEach(job => {
      const errorType = job.error?.name || 'Unknown';
      if (!errorsByType[errorType]) {
        errorsByType[errorType] = [];
      }
      errorsByType[errorType].push({
        jobId: job.jobId,
        type: job.type,
        enhanced: job.enhanced,
        startTime: job.startTime,
        error: job.error
      });
    });
    
    // Generate error summary
    const summary = {
      totalJobs: allJobs.length,
      failedJobs: failedJobs.length,
      errorTypes: Object.keys(errorsByType).length,
      errors: errorsByType,
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error generating error summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate error summary'
    });
  }
});

// Clear specific job error
router.post('/clear-error/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = scraperMonitor.getJobInfo(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Job ${jobId} not found`
      });
    }
    
    // Only clear if it's failed
    if (job.status === 'failed') {
      scraperMonitor.updateJobStatus(jobId, 'completed', []);
      res.status(200).json({
        success: true,
        message: `Error cleared for job ${jobId}`
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Job ${jobId} is not in failed status`
      });
    }
  } catch (error) {
    logger.error('Error clearing job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear job error'
    });
  }
});

export default router;
