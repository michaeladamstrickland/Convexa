import { PrismaClient } from '@prisma/client';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { ZillowScraper, zillowScraper } from '../scrapers/zillowScraper';
import { auctionDotComScraper } from '../scrapers/auctionScraper';
import { randomUUID } from 'crypto';
import { Sql } from '@prisma/client/runtime/library';
// We'll add more scrapers as they are implemented

/**
 * Calculate the next run date for a cron expression
 * 
 * Note: This is a simple implementation and doesn't handle all edge cases
 */
function getNextRunDate(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.split(' ');
  
  // Simple implementation for basic cron expressions
  // For more complex expressions, consider using a dedicated library like 'cron-parser'
  
  // Default to next minute if we can't parse properly
  let nextRun = new Date(now);
  nextRun.setSeconds(0);
  nextRun.setMinutes(nextRun.getMinutes() + 1);
  
  // For hourly jobs
  if (parts[0] === '*' && parts[1] !== '*') {
    // Run at specific minute of every hour
    const minute = parseInt(parts[1], 10);
    nextRun.setMinutes(minute);
    if (nextRun <= now) {
      nextRun.setHours(nextRun.getHours() + 1);
    }
  }
  
  // For daily jobs
  else if (parts[0] === '*' && parts[1] === '*' && parts[2] !== '*') {
    // Run at specific hour of every day
    const hour = parseInt(parts[2], 10);
    nextRun.setHours(hour);
    nextRun.setMinutes(0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  }
  
  // For weekly jobs (simplified)
  else if (cronExpression.includes('0 0 * * 0')) {
    // Run at midnight on Sunday
    nextRun.setHours(0);
    nextRun.setMinutes(0);
    const day = nextRun.getDay();
    nextRun.setDate(nextRun.getDate() + (7 - day));
  }
  
  return nextRun;
}

const prisma = new PrismaClient();

/**
 * JobScheduler - Manages scheduled scraping jobs
 * 
 * This service handles:
 * 1. Loading scheduled jobs from the database
 * 2. Scheduling them to run based on cron expressions
 * 3. Executing scrapers at scheduled times
 * 4. Updating job history and next run times
 */
export class JobScheduler {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  /**
   * Initialize the job scheduler and load all active schedules
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing job scheduler');
      
      // Create the ScraperSchedule table if it doesn't exist yet
      await this.ensureScraperScheduleTableExists();
      
      // Load all active schedules
      await this.loadSchedules();
      
      this.isRunning = true;
      logger.info('Job scheduler initialized successfully');
    } catch (error) {
      logger.error('Error initializing job scheduler:', error);
      throw error;
    }
  }

  /**
   * Create the ScraperSchedule table if it doesn't exist
   */
  private async ensureScraperScheduleTableExists(): Promise<void> {
    // Check if the table exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT 1 FROM scraper_schedules LIMIT 1`;
      logger.info('ScraperSchedule table exists');
    } catch (error) {
      logger.info('Creating ScraperSchedule table');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS scraper_schedules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          scraperType TEXT NOT NULL,
          cronExpression TEXT NOT NULL,
          config TEXT NOT NULL,
          isActive BOOLEAN NOT NULL DEFAULT true,
          lastRunAt TIMESTAMP,
          nextRunAt TIMESTAMP,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('ScraperSchedule table created');
    }
  }

  /**
   * Load all active schedules from the database
   */
  async loadSchedules(): Promise<void> {
    try {
      // First, unschedule any existing jobs
      this.unscheduleAllJobs();
      
      // Fetch all active schedules
      const schedules = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE isActive = 1
      `;
      
      logger.info(`Loading ${schedules.length} active schedules`);
      
      for (const schedule of schedules) {
        this.scheduleJob(schedule);
      }
      
      logger.info(`Loaded and scheduled ${this.scheduledJobs.size} jobs`);
    } catch (error) {
      logger.error('Error loading schedules:', error);
      throw error;
    }
  }

  /**
   * Unschedule all currently running jobs
   */
  private unscheduleAllJobs(): void {
    for (const [id, task] of this.scheduledJobs.entries()) {
      task.stop();
      logger.info(`Unscheduled job: ${id}`);
    }
    this.scheduledJobs.clear();
  }

  /**
   * Schedule a job based on its cron expression
   */
  private scheduleJob(schedule: any): void {
    try {
      // Validate cron expression
      if (!cron.validate(schedule.cronExpression)) {
        logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
        return;
      }

      // Parse the job configuration
      const config = JSON.parse(schedule.config);
      
      // Schedule the job
      const task = cron.schedule(schedule.cronExpression, async () => {
        await this.executeJob(schedule.id, schedule.scraperType, config);
      });
      
      // Store the scheduled task
      this.scheduledJobs.set(schedule.id, task);
      
      // Calculate and update next run time
      const nextRun = getNextRunDate(schedule.cronExpression);
      
      prisma.$executeRaw`
        UPDATE scraper_schedules
        SET nextRunAt = ${nextRun}
        WHERE id = ${schedule.id}
      `;
      
      logger.info(`Scheduled job ${schedule.id} (${schedule.name}) with cron: ${schedule.cronExpression}, next run: ${nextRun}`);
    } catch (error) {
      logger.error(`Error scheduling job ${schedule.id}:`, error);
    }
  }

  /**
   * Execute a scheduled job
   */
  private async executeJob(scheduleId: string, scraperType: string, config: any): Promise<void> {
    logger.info(`Executing scheduled job: ${scheduleId}, type: ${scraperType}`);
    
    try {
      // Create a record for this job run
      const jobId = await this.createJobRecord(scheduleId, scraperType, config);
      
      // Update last run time
      await prisma.$executeRaw`
        UPDATE scraper_schedules
        SET lastRunAt = CURRENT_TIMESTAMP
        WHERE id = ${scheduleId}
      `;
      
      // Execute the appropriate scraper based on type
      switch (scraperType) {
        case 'zillow_fsbo':
          await this.runZillowScraper(jobId, config);
          break;
        case 'auction_com':
          await this.runAuctionScraper(jobId, config);
          break;
        // Add more scrapers here as they are implemented
        default:
          logger.error(`Unknown scraper type: ${scraperType}`);
          await this.updateJobStatus(jobId, 'failed', 'Unknown scraper type');
          return;
      }
      
      // Update next run time
      const schedule = await prisma.$queryRaw<any[]>`
        SELECT cronExpression FROM scraper_schedules WHERE id = ${scheduleId}
      `;
      
      if (schedule.length > 0) {
        const nextRun = getNextRunDate(schedule[0].cronExpression);
        await prisma.$executeRaw`
          UPDATE scraper_schedules
          SET nextRunAt = ${nextRun}
          WHERE id = ${scheduleId}
        `;
      }
      
      logger.info(`Completed scheduled job: ${scheduleId}`);
    } catch (error) {
      logger.error(`Error executing scheduled job ${scheduleId}:`, error);
    }
  }

  /**
   * Create a job record in the database
   */
  private async createJobRecord(scheduleId: string, scraperType: string, config: any): Promise<string> {
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO scraping_jobs (id, source, status, config, startedAt)
      VALUES (
        ${crypto.randomUUID()},
        ${scraperType},
        'running',
        ${JSON.stringify(config)},
        CURRENT_TIMESTAMP
      )
      RETURNING id
    `;
    
    return result[0].id;
  }

  /**
   * Update job status in the database
   */
  private async updateJobStatus(jobId: string, status: string, logs?: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE scraping_jobs
      SET 
        status = ${status},
        logs = COALESCE(logs || '\n' || ${logs || ''}, ${logs || ''}),
        completedAt = CASE WHEN ${status} IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ${jobId}
    `;
  }

  /**
   * Update job record counts
   */
  private async updateJobCounts(jobId: string, recordsFound: number, recordsSaved: number, errorCount = 0): Promise<void> {
    await prisma.$executeRaw`
      UPDATE scraping_jobs
      SET 
        recordsFound = ${recordsFound},
        recordsSaved = ${recordsSaved},
        errorCount = ${errorCount}
      WHERE id = ${jobId}
    `;
  }

  /**
   * Run the Zillow scraper with the provided configuration
   */
  private async runZillowScraper(jobId: string, config: any): Promise<void> {
    try {
      await this.updateJobStatus(jobId, 'running', 'Starting Zillow FSBO scraper');
      
      const locations = config.locations || [];
      const maxPages = config.maxPages || 3;
      
      // Run the scraper
      // Create a new instance of the ZillowScraper class
      const scraper = new ZillowScraper();
      await scraper.initialize();
      
      const listings = await scraper.scrapeFSBOListings(locations, maxPages);
      
      await this.updateJobCounts(jobId, listings.length, 0);
      
      // Save the listings
      await scraper.saveListingsToDatabase(listings);
      
      await scraper.close();
      
      // Update the job as completed
      await this.updateJobStatus(jobId, 'completed', `Completed scraping ${listings.length} listings`);
      await this.updateJobCounts(jobId, listings.length, listings.length);
      
      logger.info(`Zillow scraper job ${jobId} completed successfully with ${listings.length} listings`);
    } catch (error) {
      logger.error(`Error running Zillow scraper job ${jobId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(jobId, 'failed', `Error: ${errorMessage}`);
    }
  }

  /**
   * Run the Auction.com scraper with the provided configuration
   */
  private async runAuctionScraper(jobId: string, config: any): Promise<void> {
    try {
      await this.updateJobStatus(jobId, 'running', 'Starting Auction.com scraper');
      
      const locations = config.locations || [];
      const maxPages = config.maxPages || 3;
      
      // Create and run the scraper
      await auctionDotComScraper.runFullScrape(locations, maxPages);
      
      // Job is updated by the scraper's runFullScrape method
      await this.updateJobStatus(jobId, 'completed', `Completed Auction.com scraping`);
      
      logger.info(`Auction.com scraper job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(jobId, 'failed', `Error: ${errorMessage}`);
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: {
    name: string;
    scraperType: string;
    cronExpression: string;
    config: any;
  }): Promise<any> {
    try {
      // Validate cron expression
      if (!cron.validate(data.cronExpression)) {
        throw new Error(`Invalid cron expression: ${data.cronExpression}`);
      }
      
      // Calculate next run time
      const nextRun = getNextRunDate(data.cronExpression);
      
      // Create the schedule
      const id = crypto.randomUUID();
      const configStr = JSON.stringify(data.config);
      
      await prisma.$executeRaw`
        INSERT INTO scraper_schedules (
          id, name, scraperType, cronExpression, config, isActive, nextRunAt, createdAt, updatedAt
        ) VALUES (
          ${id}, 
          ${data.name}, 
          ${data.scraperType}, 
          ${data.cronExpression}, 
          ${configStr}, 
          1, 
          ${nextRun}, 
          CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        )
      `;
      
      // Load the created schedule
      const schedule = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE id = ${id}
      `;
      
      // Schedule the job
      if (schedule.length > 0) {
        this.scheduleJob(schedule[0]);
      }
      
      return schedule[0];
    } catch (error) {
      logger.error('Error creating schedule:', error);
      throw error;
    }
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(id: string, data: {
    name?: string;
    cronExpression?: string;
    config?: any;
    isActive?: boolean;
  }): Promise<any> {
    try {
      // Get current schedule
      const current = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE id = ${id}
      `;
      
      if (current.length === 0) {
        throw new Error(`Schedule not found: ${id}`);
      }
      
      // Build update parts
      const updates = [];
      const params: any[] = [];
      
      if (data.name !== undefined) {
        updates.push(`name = ?`);
        params.push(data.name);
      }
      
      if (data.cronExpression !== undefined) {
        // Validate cron expression
        if (!cron.validate(data.cronExpression)) {
          throw new Error(`Invalid cron expression: ${data.cronExpression}`);
        }
        
        updates.push(`cronExpression = ?`);
        params.push(data.cronExpression);
        
        // Calculate new next run time
        const nextRun = getNextRunDate(data.cronExpression);
        updates.push(`nextRunAt = ?`);
        params.push(nextRun);
      }
      
      if (data.config !== undefined) {
        updates.push(`config = ?`);
        params.push(JSON.stringify(data.config));
      }
      
      if (data.isActive !== undefined) {
        updates.push(`isActive = ?`);
        params.push(data.isActive ? 1 : 0);
      }
      
      // Add updated timestamp
      updates.push(`updatedAt = CURRENT_TIMESTAMP`);
      
      // Update the schedule if there are changes
      if (updates.length > 0) {
        const query = `
          UPDATE scraper_schedules 
          SET ${updates.join(', ')}
          WHERE id = ?
        `;
        
        params.push(id);
        
        // Execute individual updates for each field
        if (data.name !== undefined) {
          await prisma.$executeRaw`
            UPDATE scraper_schedules 
            SET name = ${data.name}
            WHERE id = ${id}
          `;
        }
        
        if (data.cronExpression !== undefined) {
          const nextRunDate = getNextRunDate(data.cronExpression);
          await prisma.$executeRaw`
            UPDATE scraper_schedules 
            SET cronExpression = ${data.cronExpression}, nextRunAt = ${nextRunDate}
            WHERE id = ${id}
          `;
        }
        
        if (data.config !== undefined) {
          await prisma.$executeRaw`
            UPDATE scraper_schedules 
            SET config = ${JSON.stringify(data.config)}
            WHERE id = ${id}
          `;
        }
        
        if (data.isActive !== undefined) {
          await prisma.$executeRaw`
            UPDATE scraper_schedules 
            SET isActive = ${data.isActive ? 1 : 0}
            WHERE id = ${id}
          `;
        }
        
        // Update timestamp
        await prisma.$executeRaw`
          UPDATE scraper_schedules 
          SET updatedAt = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `;
        
        // If the schedule was updated, reload and reschedule
        await this.loadSchedules();
      }
      
      // Return the updated schedule
      const updated = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE id = ${id}
      `;
      
      return updated[0];
    } catch (error) {
      logger.error(`Error updating schedule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<boolean> {
    try {
      // Unschedule the job if it's currently scheduled
      if (this.scheduledJobs.has(id)) {
        const task = this.scheduledJobs.get(id);
        const scheduledTask = this.scheduledJobs.get(id);
        if (scheduledTask) {
          scheduledTask.stop();
          this.scheduledJobs.delete(id);
        }
      }
      
      // Delete from database
      await prisma.$executeRaw`
        DELETE FROM scraper_schedules WHERE id = ${id}
      `;
      
      return true;
    } catch (error) {
      logger.error(`Error deleting schedule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all schedules
   */
  async getSchedules(includeInactive = false): Promise<any[]> {
    try {
      let schedules;
      
      if (!includeInactive) {
        schedules = await prisma.$queryRaw<any[]>`
          SELECT * FROM scraper_schedules
          WHERE isActive = 1
          ORDER BY updatedAt DESC
        `;
      } else {
        schedules = await prisma.$queryRaw<any[]>`
          SELECT * FROM scraper_schedules
          ORDER BY updatedAt DESC
        `;
      }
      return schedules;
    } catch (error) {
      logger.error('Error getting schedules:', error);
      throw error;
    }
  }

  /**
   * Get a specific schedule by ID
   */
  async getScheduleById(id: string): Promise<any> {
    try {
      const schedules = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE id = ${id}
      `;
      
      return schedules.length > 0 ? schedules[0] : null;
    } catch (error) {
      logger.error(`Error getting schedule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Run a schedule immediately
   */
  async runScheduleNow(id: string): Promise<string> {
    try {
      const schedules = await prisma.$queryRaw<any[]>`
        SELECT * FROM scraper_schedules WHERE id = ${id}
      `;
      
      if (schedules.length === 0) {
        throw new Error(`Schedule not found: ${id}`);
      }
      
      const schedule = schedules[0];
      
      // Parse the job configuration
      const config = JSON.parse(schedule.config);
      
      // Create a job record
      const jobId = await this.createJobRecord(id, schedule.scraperType, config);
      
      // Execute the job in the background
      setImmediate(() => {
        this.executeJob(id, schedule.scraperType, config);
      });
      
      return jobId;
    } catch (error) {
      logger.error(`Error running schedule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.isRunning) {
      this.unscheduleAllJobs();
      this.isRunning = false;
      logger.info('Job scheduler stopped');
    }
  }
}

// Export a singleton instance
export const jobScheduler = new JobScheduler();
