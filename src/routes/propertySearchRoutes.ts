import express from 'express';
import unifiedSearchController from '../controllers/unifiedSearchController';

const router = express.Router();

/**
 * Property search routes for ATTOM and BatchData integration
 */

// Search for a property by address
router.post('/search/address', unifiedSearchController.searchByAddress);

// Search for properties by ZIP code
router.post('/search/zip', unifiedSearchController.searchByZipCode);

// Skip trace an existing lead
router.post('/leads/skip-trace', unifiedSearchController.skipTraceLead);

export default router;
