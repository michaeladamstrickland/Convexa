import express from 'express';
import systemHealthController from '../controllers/systemHealthController';

const router = express.Router();

/**
 * System health and monitoring routes
 */

// Get overall system health status
router.get('/health', systemHealthController.getSystemHealth);

// Check vendor API health
router.get('/vendor-health', systemHealthController.checkVendorHealth);

export default router;
