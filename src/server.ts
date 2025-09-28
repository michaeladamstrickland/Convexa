import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import axios from 'axios';
import client, { Counter, Gauge, register } from 'prom-client';
// import { ObituaryDeathMiner } from './intelligence/obituaryDeathMiner';
import { RevenueMetrics, LeadProfile, ProcessedDeal } from './types';
import searchRoutes from './routes/searchRoutes';
import experimentalRoutes from './routes/experimentalRoutes';
import devQueueRoutes from './routes/devQueueRoutes';
import publicProperties from './routes/publicProperties';
import { startDailyScheduler } from './scheduler/dailyScheduler';
import leadRoutes from './routes/leadRoutes';
import adminMetrics from './routes/adminMetrics';
import webhookAdmin from './routes/webhookAdmin';
import callRoutes from './routes/callRoutes';
import dealRoutes from './routes/dealRoutes';
import os from 'os';
import skipTraceRoutes from './routes/skipTraceRoutes';
import { basicAuthMiddleware } from './middleware/basicAuth';
import { redactPIIInObject } from './utils/piiRedactor';

// Load environment variables
dotenv.config();

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
  new winston.transports.File({ filename: 'convexa-ai.log' })
  ]
});

// Initialize Prometheus metrics
export const httpRequestErrorsTotal = new Counter({
  name: 'http_requests_errors_total',
  help: 'Total number of HTTP requests that resulted in a 5xx error.',
  labelNames: ['method', 'path', 'status'],
});

export const convexaCacheHitTotal = new Counter({
  name: 'convexa_cache_hit_total',
  help: 'Total number of cache hits.',
  labelNames: ['operation', 'cache_name'],
});

export const convexaCacheTotal = new Counter({
  name: 'convexa_cache_total',
  help: 'Total number of cache operations (hits + misses).',
  labelNames: ['operation', 'cache_name'],
});

export const convexaQuotaFraction = new Gauge({
  name: 'convexa_quota_fraction',
  help: 'Fraction of configured budget/quota currently used (0-1).',
  labelNames: ['resource'],
});

export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current depth of processing queues.',
  labelNames: ['queue_name'],
});

export const dlqDepth = new Gauge({
  name: 'dlq_depth',
  help: 'Current depth of dead-letter queues.',
  labelNames: ['queue_name'],
});

export const convexaWeeklyExportsTotal = new Counter({
  name: 'convexa_weekly_exports_total',
  help: 'Total number of weekly exports.',
});

export const convexaImportRowsTotal = new Counter({
  name: 'convexa_import_rows_total',
  help: 'Total number of rows imported, labeled by result (success/failure).',
  labelNames: ['result'],
});

// Register default metrics
client.collectDefaultMetrics();

class LeadFlowAIServer {
  private app: express.Application;
  private obituaryMiner: any; // temporarily any (obituary miner disabled in test context)
  private revenueMetrics: RevenueMetrics;
  private isRunning: boolean = false;

  constructor() {
    this.app = express();
  // this.obituaryMiner = new ObituaryDeathMiner();
  this.revenueMetrics = this.initializeRevenueMetrics();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging with PII redaction
    this.app.use((req, res, next) => {
      const redactedMeta = redactPIIInObject({
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body, // Redact request body
      });
      logger.info(`${req.method} ${req.path}`, {
        ip: redactedMeta.ip,
        userAgent: redactedMeta.userAgent,
        body: redactedMeta.body,
      });
      next();
    });

    // Error metrics middleware
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (res.statusCode >= 500 && res.statusCode < 600) {
        httpRequestErrorsTotal.inc({
          method: req.method,
          path: req.path,
          status: res.statusCode,
        });
      }
      next(err);
    });
  }

  private setupRoutes(): void {
    // Register API routes
    this.app.use('/api/search', searchRoutes);
    this.app.use('/api/leads', leadRoutes);
    this.app.use('/api/skip-trace', skipTraceRoutes);
  this.app.use('/api/_experimental', experimentalRoutes);
    this.app.use('/api/dev', devQueueRoutes); // queue dev endpoints
    this.app.use('/api/queue', devQueueRoutes); // queue dev endpoints
  this.app.use('/api/properties', publicProperties);
    this.app.use('/api/admin', basicAuthMiddleware, adminMetrics);
    this.app.use('/api/admin', basicAuthMiddleware, webhookAdmin);
    this.app.use('/api/calls', callRoutes);
    this.app.use('/api/deals', dealRoutes);

    // New route for weekly exports
    this.app.post('/api/exports/bundle', basicAuthMiddleware, (req, res) => {
      convexaWeeklyExportsTotal.inc();
      logger.info('Weekly export bundle endpoint hit, incrementing convexa_weekly_exports_total');
      res.json({ success: true, message: 'Export counted.' });
    });

    // Apply basic auth to /metrics endpoint
    this.app.use('/metrics', basicAuthMiddleware);

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // Lightweight proxy to integrated ATTOM server (port 5002)
    // Allows frontend to use a single base URL (http://localhost:3001/api)
    this.app.all('/api/attom/*', async (req, res) => {
      try {
        const targetUrl = `http://localhost:5002${req.originalUrl}`;
        const method = req.method.toLowerCase() as
          | 'get'
          | 'post'
          | 'put'
          | 'patch'
          | 'delete'
          | 'head'
          | 'options';
        const response = await axios({
          url: targetUrl,
          method,
          // Forward query for GET/HEAD, body for others
          params: method === 'get' || method === 'head' ? req.query : undefined,
          data: method !== 'get' && method !== 'head' ? req.body : undefined,
          // Keep it JSON-focused; integrated server already sets headers
          headers: {
            Accept: 'application/json',
          },
          timeout: 8000,
        });
        res.status(response.status).send(response.data);
      } catch (err: any) {
        const status = err?.response?.status || 502;
        const payload = err?.response?.data || {
          status: 'error',
          message: 'ATTOM proxy error',
          error: err?.message || 'Unknown error',
        };
        res.status(status).send(payload);
      }
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          obituaryMiner: this.isRunning,
          aiEngine: !!process.env.OPENAI_API_KEY,
          searchApi: true,
          experimentalApi: true
        }
      });
    });


    // Revenue dashboard
    this.app.get('/revenue', (req, res) => {
      res.json({
        success: true,
        metrics: this.revenueMetrics,
        lastUpdated: new Date().toISOString()
      });
    });

    // Start intelligence mining
    this.app.post('/intelligence/start', async (req, res) => {
      try {
        const { markets = ['phoenix', 'tampa', 'orlando', 'miami', 'austin'] } = req.body;
        
  logger.info('🚀 Starting Convexa AI Intelligence Engine...', { markets });
        
        if (this.isRunning) {
          return res.json({ 
            success: false, 
            message: 'Intelligence engine already running' 
          });
        }

        this.isRunning = true;
        
        // Start the money-making engine
        this.startIntelligenceEngine(markets);
        
        res.json({
          success: true,
          message: '💰 Convexa AI Intelligence Engine ACTIVATED!',
          markets,
          expectedLeadsPerHour: 50,
          estimatedDailyRevenue: 5000
        });

      } catch (error) {
        logger.error('Failed to start intelligence engine:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to start intelligence engine' 
        });
      }
    });

    // Stop intelligence mining
    this.app.post('/intelligence/stop', (req, res) => {
      this.isRunning = false;
      logger.info('⏹️ Intelligence engine stopped');
      res.json({ 
        success: true, 
        message: 'Intelligence engine stopped' 
      });
    });

    // Get current leads
    this.app.get('/leads', (req, res) => {
      // Mock leads for now - will connect to database later
      const mockLeads = this.generateMockLeads();
      res.json({
        success: true,
        leads: mockLeads,
        count: mockLeads.length,
        totalValue: mockLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)
      });
    });

    // Generate instant leads (for testing)
    this.app.post('/leads/generate', async (req, res) => {
      try {
        const { market = 'phoenix', count = 10 } = req.body;
        
        logger.info(`🎯 Generating ${count} instant leads for ${market}...`);
        
  const leads: any[] = []; // obituary miner disabled
        
        // Update revenue metrics
        this.revenueMetrics.totalLeads += leads.length;
        this.revenueMetrics.leadsBySource.obituary_death_mining += leads.length;
        
        res.json({
          success: true,
          message: `💰 Generated ${leads.length} high-value leads!`,
          leads: leads.slice(0, count),
          estimatedValue: leads.length * 2500, // $2,500 avg per lead
          market
        });

      } catch (error) {
        logger.error('Failed to generate leads:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to generate leads' 
        });
      }
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      res.json({
        success: true,
        status: {
          running: this.isRunning,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0'
        },
        intelligence: {
          obituaryMiner: 'active',
          probateTracker: 'coming_soon',
          violationMonitor: 'coming_soon',
          vacancyDetector: 'coming_soon'
        }
      });
    });
  }

  private async startIntelligenceEngine(markets: string[]): Promise<void> {
    logger.info('🧠 Starting ultra-intelligent lead generation...');
    
    // Run continuously
    while (this.isRunning) {
      try {
        // Mine obituaries for death intelligence
        const deathIntelligence = await this.obituaryMiner.mineDeathIntelligence(markets);
        
        if (deathIntelligence.length > 0) {
          logger.info(`💰 Found ${deathIntelligence.length} money-making opportunities!`);
          
          // Update metrics
          this.revenueMetrics.totalLeads += deathIntelligence.length;
          this.revenueMetrics.leadsBySource.obituary_death_mining += deathIntelligence.length;
          
          // Calculate potential revenue
          const potentialRevenue = deathIntelligence.length * 2500; // $2,500 per lead avg
          this.revenueMetrics.totalRevenue += potentialRevenue;
          
          logger.info(`💵 Potential revenue from this batch: $${potentialRevenue.toLocaleString()}`);
        }
        
        // Wait before next mining cycle (5 minutes)
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        
      } catch (error) {
        logger.error('Error in intelligence engine:', error);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds on error
      }
    }
  }

  private initializeRevenueMetrics(): RevenueMetrics {
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      contactedLeads: 0,
      dealsInProgress: 0,
      closedDeals: 0,
      totalRevenue: 0,
      avgDealSize: 2500,
      conversionRate: 0,
      costPerLead: 15,
      roi: 0,
      leadsBySource: {
        obituary_death_mining: 0,
        probate_intelligence: 0,
        code_violation_tracking: 0,
        tax_delinquency: 0,
        vacancy_detection: 0,
        divorce_records: 0,
        bankruptcy_filings: 0,
        pre_foreclosure: 0,
        notice_of_default: 0,
        absentee_owner: 0,
        expired_listings: 0,
        fsbo_tracking: 0,
        high_equity: 0,
        wholesale_leads: 0
      },
      revenueBySource: {
        obituary_death_mining: 0,
        probate_intelligence: 0,
        code_violation_tracking: 0,
        tax_delinquency: 0,
        vacancy_detection: 0,
        divorce_records: 0,
        bankruptcy_filings: 0,
        pre_foreclosure: 0,
        notice_of_default: 0,
        absentee_owner: 0,
        expired_listings: 0,
        fsbo_tracking: 0,
        high_equity: 0,
        wholesale_leads: 0
      }
    };
  }

  private generateMockLeads(): LeadProfile[] {
    return [
      {
        property_id: 'prop_001',
        address: '1234 Phoenix St, Phoenix, AZ 85001',
        owner_name: 'Estate of John Smith',
        estimated_value: 450000,
        condition_score: 75,
        vacancy_months: 2,
        tax_debt: 12000,
        foreclosure_stage: undefined,
        violations: [],
        is_probate: true,
        is_divorce: false,
        eviction_count: 0,
        days_on_market: undefined,
        price_reduction_count: undefined,
        is_absentee: true,
        owner_distance_miles: 250
      },
      {
        property_id: 'prop_002',
        address: '5678 Tampa Ave, Tampa, FL 33601',
        owner_name: 'Mary Johnson (Deceased)',
        estimated_value: 325000,
        condition_score: 60,
        vacancy_months: 4,
        tax_debt: 8500,
        foreclosure_stage: 'pre_foreclosure',
        violations: [],
        is_probate: true,
        is_divorce: false,
        eviction_count: 0,
        days_on_market: undefined,
        price_reduction_count: undefined,
        is_absentee: false,
        owner_distance_miles: 0
      }
    ];
  }

  public start(port: number = Number(process.env.PORT) || 3001): void {
    this.app.listen(port, () => {
  logger.info(`🚀 Convexa AI Server started on port ${port}`);
      logger.info('💰 Ready to generate MONEY! Use /intelligence/start to begin mining leads');
      logger.info(`📊 Revenue dashboard: http://localhost:${port}/revenue`);
      logger.info(`🎯 Generate leads: POST http://localhost:${port}/leads/generate`);
  // Start daily scheduler after server is listening
  startDailyScheduler();
    });
  }
}

// Direct execution removed for ESM compatibility; use npm scripts to start.

export default LeadFlowAIServer;
// Auto-start when this module is evaluated (ESM-friendly)
const __leadflowServerInstance = new LeadFlowAIServer();
__leadflowServerInstance.start();
export { __leadflowServerInstance };
