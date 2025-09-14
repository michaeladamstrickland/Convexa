#!/usr/bin/env node

// LeadFlow AI — Unified Backend Server (dev-friendly)

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config();

// Routes
import authRoutes from './routes/auth';
import leadRoutes from './routes/leads';
import campaignRoutes from './routes/campaigns';
import callRoutes from './routes/calls';
// Legacy scraper routes (deprecated) will be conditionally loaded below
// import scraperRoutes from './routes/scraper';
import scraperDebugRoutes from './routes/scraperDebug';
import skipTraceRoutes from './routes/skipTrace';
import analyticsRoutes from './routes/analytics';
import organizationRoutes from './routes/organizations';
import zipSearchRoutes from './routes/zipSearch';
import zipSearchRoutesNew from '../zip-search-routes-new';
import realEstateRoutes from './routes/realEstateRoutes';
import masterRealEstateRoutes from './routes/masterRealEstateRoutes';
import kanbanRoutes from './routes/kanbanRoutes';
import exportRoutes from './routes/exportRoutes';
import costRoutes from './routes/costRoutes';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import { correlationIdMiddleware } from './middleware/correlationId';
import { masterConfig } from './config/masterConfig';

const app = express();
const PORT = Number(process.env.PORT) || 5000; // keep 5000 to match Vite proxy

// Security & basics
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (for debugging)
app.use('/debug', express.static(path.join(__dirname, 'public')));

// Add correlation ID to all requests
app.use(correlationIdMiddleware);

// Rate limiting for API routes
app.use('/api/', rateLimit({ windowMs: 60_000, max: 600 }));

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', ts: new Date().toISOString(), version: '1.0.0' });
});

// System status (lightweight, uses masterConfig if available)
app.get('/api/system/status', (req, res) => {
  try {
    const systemStatus = masterConfig.getSystemStatus();
    const apiStatus = masterConfig.validateAPIAvailability();
    
    // Import feature flags
    const { featureFlags, requestTracking } = require('./config/featureFlags');
    
    // Get last 5 recent requests
    const recentRequests = requestTracking.recentRequests.slice(0, 5);
    const lastRequestId = recentRequests.length > 0 ? recentRequests[0].id : null;
    
    res.json({
      ...systemStatus,
      available_apis: apiStatus.available,
      missing_api_keys: apiStatus.missing,
      configuration_valid: apiStatus.missing.length === 0,
      feature_flags: featureFlags,
      request_stats: {
        recent_count: requestTracking.recentRequests.length,
        last_request_id: lastRequestId,
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    console.error('Error in system status:', error);
    res.json({ 
      status: 'degraded', 
      message: 'Error getting full system status',
      correlation_id: req.correlationId
    });
  }
});

app.get('/api/system/cost-estimate', (req, res) => {
  try {
    // Import cost tracking
    const { costTracking, featureFlags } = require('./config/featureFlags');
    
    // Get base cost data
    const estimatedCost = masterConfig.getEstimatedCostPerSearch();
    const dailyLimit = masterConfig.getDailyBudgetLimit();
    const tierInfo = masterConfig.getTierInfo();
    
    // Get cost tracking data if enabled
    const costData = featureFlags.COST_TRACKING_ENABLED 
      ? costTracking.getCostData() 
      : { perProvider: { batch: { today_cents: 0, month_cents: 0 }, openai: { today_cents: 0, month_cents: 0 } } };
    
    res.json({
      cost_per_search: estimatedCost,
      daily_budget_limit: dailyLimit,
      max_searches_per_day: Math.floor(dailyLimit / Math.max(estimatedCost, 0.0001)),
      tier: tierInfo.name,
      monthly_cost_range: tierInfo.costPerMonth,
      max_monthly_searches: tierInfo.maxMonthlySearches,
      cost_tracking_enabled: featureFlags.COST_TRACKING_ENABLED,
      today_spend: costData.perProvider,
      limits: {
        batch_cents: costData.limits?.batch_cents,
        openai_cents: costData.limits?.openai_cents
      },
      correlation_id: req.correlationId
    });
  } catch (error) {
    console.error('Error in cost estimate:', error);
    res.json({ 
      cost_per_search: 0, 
      daily_budget_limit: 0, 
      max_searches_per_day: 0,
      correlation_id: req.correlationId
    });
  }
});

// API Routes
app.use('/', healthRoutes); // exposes /healthz and /readyz
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/calls', callRoutes);
// Importing the simplified routes and monitor routes
import simpleScraperRoutes from './routes/simpleScraperRoutes';
import scraperMonitorRoutes from './routes/scraperMonitorRoutes';
import errorSummaryRoutes from './routes/errorSummaryRoutes';

// Use the simplified routes for scraper endpoints
app.use('/api/scraper', simpleScraperRoutes);

// Add monitor routes for debugging
app.use('/api/scraper-monitor', scraperMonitorRoutes);
app.use('/api/error-summary', errorSummaryRoutes);
// Conditionally mount legacy scraper only if explicitly enabled
if (process.env.ENABLE_LEGACY_SCRAPER === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const legacy = require('./routes/scraper.legacy');
  app.use('/api/legacy-scraper', legacy.default || legacy);
  console.warn('[legacy] Legacy scraper routes ENABLED at /api/legacy-scraper');
}
app.use('/api/scraper-debug', scraperDebugRoutes);
app.use('/api/skip-trace', skipTraceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/zip-search', zipSearchRoutes);
app.use('/api/zip-search-new', zipSearchRoutesNew);
app.use('/api/real-estate', realEstateRoutes);
app.use('/api/master', masterRealEstateRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/costs', costRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Errors
app.use(errorHandler);

// Import HTTP for WebSocket support
import http from 'http';
import scraperWebSocketService from './utils/scraperWebSocketService';

// Create HTTP server for WebSocket
const server = http.createServer(app);

// Initialize WebSocket service
scraperWebSocketService.initialize(server);

// Start
server.listen(PORT, () => {
  console.log(`🚀 LeadFlow AI backend listening on http://localhost:${PORT}`);
  console.log(`� Health:  http://localhost:${PORT}/health`);
  console.log(`� Status:  http://localhost:${PORT}/api/system/status`);
  console.log(`� WebSocket:  ws://localhost:${PORT}/api/ws/scraper`);
});

export default app;
