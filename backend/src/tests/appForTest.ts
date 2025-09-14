import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Real routes and middleware
import authRoutes from '../routes/auth';
import leadRoutes from '../routes/leads';
import campaignsRoutes from '../routes/campaigns';
import callsRoutes from '../routes/calls';
import scraperRoutes from '../routes/scraper';
import skipTraceRoutes from '../routes/skipTrace';
import analyticsRoutes from '../routes/analytics';
import organizationsRoutes from '../routes/organizations';
import zipSearchRoutes from '../routes/zipSearch';
import realEstateRoutes from '../routes/realEstateRoutes';
import { errorHandler } from '../middleware/errorHandler';

// Non-listening Express app for Supertest-based controller/integration tests
export function createTestApp() {
  const app = express();

  // Minimal hardened middleware for tests
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false } as any));
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Basic health for smoke
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'OK',
      environment: process.env.NODE_ENV || 'test',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes (mount a representative set for controller tests)
  app.use('/api/auth', authRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/campaigns', campaignsRoutes);
  app.use('/api/calls', callsRoutes);
  app.use('/api/scraper', scraperRoutes);
  app.use('/api/skip-trace', skipTraceRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/organizations', organizationsRoutes);
  app.use('/api/zip-search', zipSearchRoutes);
  app.use('/api/real-estate', realEstateRoutes);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export default createTestApp;
