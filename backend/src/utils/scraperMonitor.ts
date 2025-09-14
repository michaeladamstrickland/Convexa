/**
 * Scraper Monitor
 * 
 * A utility to track and monitor scraper executions and help with debugging.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

class ScraperMonitor {
  private events: EventEmitter;
  private activeJobs: Map<string, {
    jobId: string,
    type: string,
    enhanced: boolean,
    startTime: Date,
    status: 'pending' | 'running' | 'completed' | 'failed',
    error?: any,
    results?: any[]
  }>;
  
  constructor() {
    this.events = new EventEmitter();
    this.activeJobs = new Map();
    
    // Set maximum listeners to avoid memory leak warnings
    this.events.setMaxListeners(50);
  }
  
  /**
   * Register a new scraper job
   */
  registerJob(jobId: string, type: string, enhanced: boolean): void {
    this.activeJobs.set(jobId, {
      jobId,
      type,
      enhanced,
      startTime: new Date(),
      status: 'pending'
    });
    
    logger.info(`[ScraperMonitor] Registered new ${enhanced ? 'enhanced' : 'standard'} ${type} job: ${jobId}`);
    this.events.emit('job-registered', { jobId, type, enhanced });
  }
  
  /**
   * Update a job's status
   */
  updateJobStatus(jobId: string, status: 'pending' | 'running' | 'completed' | 'failed', details?: any): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      logger.warn(`[ScraperMonitor] Attempted to update non-existent job: ${jobId}`);
      return;
    }
    
    job.status = status;
    if (status === 'completed' && details) {
      job.results = details;
    } else if (status === 'failed' && details) {
      job.error = details;
    }
    
    logger.info(`[ScraperMonitor] Job ${jobId} status updated to ${status}`);
    this.events.emit('job-updated', { jobId, status, details });
    
    // Clean up completed/failed jobs after 1 hour
    if (status === 'completed' || status === 'failed') {
      setTimeout(() => {
        this.activeJobs.delete(jobId);
        logger.info(`[ScraperMonitor] Job ${jobId} removed from monitor`);
      }, 60 * 60 * 1000);
    }
  }
  
  /**
   * Get information about a specific job
   */
  getJobInfo(jobId: string): any {
    return this.activeJobs.get(jobId);
  }
  
  /**
   * Get all active jobs
   */
  getAllJobs(): any[] {
    return Array.from(this.activeJobs.values());
  }
  
  /**
   * Subscribe to job events
   */
  subscribeToEvents(event: 'job-registered' | 'job-updated', callback: (data: any) => void): void {
    this.events.on(event, callback);
  }
  
  /**
   * Unsubscribe from job events
   */
  unsubscribeFromEvents(event: 'job-registered' | 'job-updated', callback: (data: any) => void): void {
    this.events.off(event, callback);
  }
  
  /**
   * Log current status of all jobs
   */
  logStatus(): void {
    const jobs = this.getAllJobs();
    logger.info(`[ScraperMonitor] Current status: ${jobs.length} active jobs`);
    jobs.forEach(job => {
      const duration = Math.round((new Date().getTime() - job.startTime.getTime()) / 1000);
      logger.info(`[ScraperMonitor] Job ${job.jobId}: ${job.type} (${job.enhanced ? 'enhanced' : 'standard'}) - Status: ${job.status} - Running for ${duration}s`);
    });
  }
}

// Create and export a singleton instance
const scraperMonitor = new ScraperMonitor();
export default scraperMonitor;
