import express, { Request, Response } from 'express';
import searchService, { SearchParams } from '../services/searchService';

// Create router
const router = express.Router();

// GET /api/search - Handle search with query parameters
router.get('/', async (req: Request, res: Response) => {
  try {
    const params: SearchParams = {
      query: req.query.query as string,
      minValue: req.query.minValue ? parseInt(req.query.minValue as string) : undefined,
      maxValue: req.query.maxValue ? parseInt(req.query.maxValue as string) : undefined,
      city: req.query.city as string,
      state: req.query.state as string,
      zipCode: req.query.zipCode as string,
      propertyType: req.query.propertyType as string,
      source: req.query.source as string,
      temperature: req.query.temperature as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    const results = await searchService.searchLeads(params);
    res.json(results);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search - Handle search with request body
router.post('/', async (req: Request, res: Response) => {
  try {
    const params: SearchParams = req.body;
    const results = await searchService.searchLeads(params);
    res.json(results);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/search/analytics - Get lead analytics
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const analytics = await searchService.getLeadAnalytics();
    res.json({ analytics });
  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search/clear-cache - Clear search cache
router.post('/clear-cache', (_req: Request, res: Response) => {
  try {
    const result = searchService.clearCache();
    res.json(result);
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
