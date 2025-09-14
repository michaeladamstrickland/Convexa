// Deprecated placeholder. Legacy implementation moved to scraper.legacy.ts
// This stub intentionally exports an empty router to satisfy old import paths.
// To enable the legacy scraper, set ENABLE_LEGACY_SCRAPER=true and rely on conditional mount in server.ts.
import { Router } from 'express';

const router = Router();

router.get('/__deprecated', (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Scraper route deprecated. See docs/SCRAPER_DOCUMENTATION.md and use new data ingestion pipeline.'
  });
});

export default router;
