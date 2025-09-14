import express from 'express';
import { getDeal, upsertDeal, runDeal, getComps, getProperty, exportDeal } from '../controllers/dealController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes are protected by authentication middleware
router.use(authenticateToken);

// Deal analysis endpoints
router.get('/deals/:leadId', getDeal);
router.post('/deals/:leadId', upsertDeal);
router.post('/deals/:leadId/run', runDeal);
router.post('/deals/:leadId/export', exportDeal);

// Property data endpoints
router.get('/comps', getComps);
router.get('/property', getProperty);

export default router;
