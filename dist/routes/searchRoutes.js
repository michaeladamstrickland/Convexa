import express from 'express';
import searchService from '../services/searchService';
// Create router
const router = express.Router();
// GET /api/search - Handle search with query parameters
router.get('/', async (req, res) => {
    try {
        const params = {
            query: req.query.query,
            minValue: req.query.minValue ? parseInt(req.query.minValue) : undefined,
            maxValue: req.query.maxValue ? parseInt(req.query.maxValue) : undefined,
            city: req.query.city,
            state: req.query.state,
            zipCode: req.query.zipCode,
            propertyType: req.query.propertyType,
            source: req.query.source,
            temperature: req.query.temperature,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            page: req.query.page ? parseInt(req.query.page) : 1,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder || 'desc',
        };
        const results = await searchService.searchLeads(params);
        res.json(results);
    }
    catch (error) {
        console.error('Error in search endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/search - Handle search with request body
router.post('/', async (req, res) => {
    try {
        const params = req.body;
        const results = await searchService.searchLeads(params);
        res.json(results);
    }
    catch (error) {
        console.error('Error in search endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/search/analytics - Get lead analytics
router.get('/analytics', async (_req, res) => {
    try {
        const analytics = await searchService.getLeadAnalytics();
        res.json({ analytics });
    }
    catch (error) {
        console.error('Error in analytics endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/search/clear-cache - Clear search cache
router.post('/clear-cache', (_req, res) => {
    try {
        const result = searchService.clearCache();
        res.json(result);
    }
    catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
//# sourceMappingURL=searchRoutes.js.map