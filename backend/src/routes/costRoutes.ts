import express from 'express';
import { getCostAnalytics, trackApiCost, getCostSummary } from '../controllers/costController';
import { correlationIdMiddleware } from '../middleware/correlationId';

const router = express.Router();

// Add correlation ID middleware to all routes
router.use(correlationIdMiddleware);

// Get cost analytics
router.get('/analytics', getCostAnalytics);

// Get cost summary
router.get('/summary', getCostSummary);

// Track API cost
router.post('/track', trackApiCost);

export default router;
