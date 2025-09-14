import { Router } from 'express';
import { exportLeadsToCSV } from '../controllers/exportController';

const router = Router();

/**
 * @route   GET /api/export/leads
 * @desc    Export leads to CSV
 * @access  Private
 */
router.get('/leads', exportLeadsToCSV);

export default router;
