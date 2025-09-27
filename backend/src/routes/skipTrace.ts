import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  skipTraceLead,
  getSkipTraceHistory,
  getSkipTraceCostEstimate
} from '../controllers/skipTraceController';
import {
  bulkSkipTrace,
  getSkipTraceMetrics
} from '../controllers/bulkSkipTraceController';

const router = Router();

// Apply authentication middleware to all routes
router.use((req, res, next) => {
  authenticate(req as any, res, next).catch(next);
});

// Skip trace a lead
router.post('/leads/:leadId', skipTraceLead);

// Bulk skip trace multiple leads
router.post('/bulk', bulkSkipTrace);

// Get skip trace metrics
router.get('/metrics', getSkipTraceMetrics);

// Get skip trace history for a lead
router.get('/leads/:leadId/history', getSkipTraceHistory);

// Get cost estimate for skip tracing
router.get('/estimate', getSkipTraceCostEstimate);

// Base endpoint
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Skip Trace API' });
});

export default router;
