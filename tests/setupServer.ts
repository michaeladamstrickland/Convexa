import express from 'express';

// Ensure attempts lowered for tests BEFORE loading any queues/workers
process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS || '3';

// Load routes and queue/worker modules after env is set
const devQueueRoutes = require('../src/routes/devQueueRoutes').default;
const adminMetrics = require('../src/routes/adminMetrics').default;
const webhookAdmin = require('../src/routes/webhookAdmin').default;
const propertiesFeed = require('../src/routes/propertiesFeed').default;
const callRoutes = require('../src/routes/callRoutes').default;

const scraperWorker = require('../src/workers/scraperWorker').scraperWorker;
const getScraperQueue = require('../src/queues/scraperQueue').getScraperQueue;
const webhookWorker = require('../src/workers/webhookWorker').webhookWorker;
const getWebhookQueue = require('../src/queues/webhookQueue').getWebhookQueue;
const matchmakingWorker = require('../src/workers/matchmakingWorker').matchmakingWorker;
const getMatchmakingQueue = require('../src/queues/matchmakingQueue').getMatchmakingQueue;
const enrichmentWorker = require('../src/workers/enrichmentWorker').enrichmentWorker;
const getEnrichmentQueue = require('../src/queues/enrichmentQueue').getEnrichmentQueue;

// Expose singleton instances for teardown
(global as any).__WEBHOOK_WORKER__ = webhookWorker;
(global as any).__WEBHOOK_QUEUE__ = getWebhookQueue();
// Scraper components
(global as any).__SCRAPER_WORKER__ = scraperWorker;
(global as any).__SCRAPER_QUEUE__ = getScraperQueue();
// Enrichment components
(global as any).__ENRICHMENT_WORKER__ = enrichmentWorker;
(global as any).__ENRICHMENT_QUEUE__ = getEnrichmentQueue();
// Matchmaking components
(global as any).__MATCHMAKING_WORKER__ = matchmakingWorker;
(global as any).__MATCHMAKING_QUEUE__ = getMatchmakingQueue();

export default async function globalSetup() {
  const app = express();
  app.use(express.json());
  // Lightweight signal/exit instrumentation to diagnose non-zero exits in CI
  try {
    const pid = process.pid;
    const tag = '[test-setup]';
    // Avoid duplicating listeners across Jest workers
    if (!(global as any).__TEST_SIGNAL_INSTRUMENTED__) {
      (global as any).__TEST_SIGNAL_INSTRUMENTED__ = true;
      const log = (evt: string, extra?: any) => {
        const payload = { level: 'warn', component: 'jest', evt, pid, ts: new Date().toISOString(), ...(extra || {}) };
        // Use JSON to keep logs grep-friendly
        console.log(JSON.stringify(payload));
      };
      process.on('SIGINT', () => log('SIGINT'));
      process.on('SIGTERM', () => log('SIGTERM'));
      process.on('SIGHUP', () => log('SIGHUP'));
      process.on('beforeExit', (code) => log('beforeExit', { code }));
      process.on('exit', (code) => log('exit', { code }));
      process.on('uncaughtException', (err) => log('uncaughtException', { message: err?.message }));
      process.on('unhandledRejection', (reason: any) => log('unhandledRejection', { message: reason?.message || String(reason) }));
    }
  } catch {}
  app.get('/health', (_req,res)=>res.json({status:'ok'}));
  app.use('/api/dev', devQueueRoutes);
  app.use('/api/admin', adminMetrics);
  app.use('/api/admin', webhookAdmin);
  app.use('/api/properties', propertiesFeed);
  app.use('/api/calls', callRoutes);
  // Mock receiver endpoint for retry success tests
  app.post('/_mock/webhook', (req,res) => {
    res.json({ received: true, event: req.body?.event });
  });
  const server = app.listen(3001);
  (global as any).__TEST_SERVER__ = server;
}
