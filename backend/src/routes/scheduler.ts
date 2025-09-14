import express from 'express';
import { jobScheduler } from '../services/scheduler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

// Initialize the scheduler when the server starts
(async () => {
  try {
    await jobScheduler.initialize();
    logger.info('Job scheduler initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job scheduler:', error);
  }
})();

// Type-safe authenticate middleware wrapper
const auth = (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as AuthenticatedRequest, res, next);
};

// Get all schedules
router.get('/schedules', auth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const schedules = await jobScheduler.getSchedules(includeInactive);
    res.json({ schedules });
  } catch (error) {
    logger.error('Error getting schedules:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// Get a specific schedule by ID
router.get('/schedules/:id', auth, async (req, res) => {
  try {
    const schedule = await jobScheduler.getScheduleById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json({ schedule });
  } catch (error) {
    logger.error(`Error getting schedule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// Create a new schedule
router.post('/schedules', auth, async (req, res) => {
  try {
    const { name, scraperType, cronExpression, config } = req.body;
    
    if (!name || !scraperType || !cronExpression || !config) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'scraperType', 'cronExpression', 'config']
      });
    }
    
    const schedule = await jobScheduler.createSchedule({
      name,
      scraperType,
      cronExpression,
      config
    });
    
    res.status(201).json({ schedule });
  } catch (error) {
    logger.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update a schedule
router.put('/schedules/:id', auth, async (req, res) => {
  try {
    const { name, cronExpression, config, isActive } = req.body;
    
    const schedule = await jobScheduler.updateSchedule(req.params.id, {
      name,
      cronExpression,
      config,
      isActive
    });
    
    res.json({ schedule });
  } catch (error) {
    logger.error(`Error updating schedule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete a schedule
router.delete('/schedules/:id', auth, async (req, res) => {
  try {
    await jobScheduler.deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting schedule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Run a schedule immediately
router.post('/schedules/:id/run', auth, async (req, res) => {
  try {
    const jobId = await jobScheduler.runScheduleNow(req.params.id);
    res.json({ success: true, jobId });
  } catch (error) {
    logger.error(`Error running schedule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to run schedule' });
  }
});

export default router;
