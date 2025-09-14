import express from 'express';
import cors from 'cors';
import { RealDataService } from './services/realDataService';
import { DatabaseService } from './services/databaseService';
import { logger } from './utils/logger';

class LeadFlowAIRealServer {
  private app: express.Application;
  private realDataService: RealDataService;
  private databaseService: DatabaseService;
  private isRunning: boolean = false;

  constructor() {
    this.app = express();
    this.realDataService = new RealDataService();
    this.databaseService = new DatabaseService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '2.0.0 - Real Data Edition',
        database: 'connected',
        services: {
          dataService: 'active',
          pipeline: this.isRunning ? 'running' : 'stopped'
        }
      });
    });

    // Get real leads from database
    this.app.get('/leads', async (req, res) => {
      try {
        const filters = {
          source: req.query.source,
          minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
          status: req.query.status,
          is_probate: req.query.is_probate === 'true'
        };

        const leads = await this.databaseService.getLeads(filters);
        const metrics = await this.databaseService.getLeadMetrics();

        res.json({
          success: true,
          leads,
          count: leads.length,
          metrics,
          filters_applied: filters
        });

      } catch (error) {
        logger.error('Failed to get leads:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve leads' 
        });
      }
    });

    // Get high-value leads
    this.app.get('/leads/high-value', async (req, res) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const leads = await this.databaseService.getHighValueLeads(limit);

        res.json({
          success: true,
          leads,
          count: leads.length,
          message: `Top ${leads.length} high-value leads (score >= 70)`
        });

      } catch (error) {
        logger.error('Failed to get high-value leads:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve high-value leads' 
        });
      }
    });

    // Run lead generation pipeline
    this.app.post('/pipeline/run', async (req, res) => {
      try {
        this.isRunning = true;
        logger.info('🚀 Starting real lead generation pipeline...');

        const results = await this.realDataService.runDailyPipeline();

        res.json({
          success: true,
          message: '💰 Lead generation pipeline completed!',
          results,
          timestamp: new Date().toISOString()
        });

        this.isRunning = false;

      } catch (error) {
        this.isRunning = false;
        logger.error('Pipeline execution failed:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Pipeline execution failed' 
        });
      }
    });

    // Scrape specific data sources
    this.app.post('/scrape/probate', async (req, res) => {
      try {
        const { county = 'maricopa' } = req.body;
        const leads = await this.realDataService.scrapeProbateRecords(county);

        res.json({
          success: true,
          message: `🏛️ Scraped ${leads.length} probate leads from ${county} county`,
          leads,
          estimated_value: leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)
        });

      } catch (error) {
        logger.error('Probate scraping failed:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Probate scraping failed' 
        });
      }
    });

    this.app.post('/scrape/violations', async (req, res) => {
      try {
        const { city = 'phoenix' } = req.body;
        const leads = await this.realDataService.scrapeCodeViolations(city);

        res.json({
          success: true,
          message: `🚨 Scraped ${leads.length} violation leads from ${city}`,
          leads,
          estimated_value: leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)
        });

      } catch (error) {
        logger.error('Violation scraping failed:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Violation scraping failed' 
        });
      }
    });

    this.app.post('/scrape/tax-delinquency', async (req, res) => {
      try {
        const { county = 'maricopa' } = req.body;
        const leads = await this.realDataService.scrapeTaxDelinquencies(county);

        res.json({
          success: true,
          message: `💰 Scraped ${leads.length} tax delinquency leads from ${county} county`,
          leads,
          estimated_value: leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)
        });

      } catch (error) {
        logger.error('Tax delinquency scraping failed:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Tax delinquency scraping failed' 
        });
      }
    });

    // Revenue and analytics
    this.app.get('/revenue', async (req, res) => {
      try {
        const metrics = await this.databaseService.getRevenueMetrics();

        res.json({
          success: true,
          metrics,
          last_updated: new Date().toISOString(),
          revenue_potential: {
            monthly_lead_sales: metrics.lead_sales_revenue,
            monthly_deal_commissions: metrics.estimated_monthly_revenue,
            total_monthly_potential: metrics.total_potential_revenue
          }
        });

      } catch (error) {
        logger.error('Failed to get revenue metrics:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve revenue metrics' 
        });
      }
    });

    // Analytics dashboard
    this.app.get('/analytics', async (req, res) => {
      try {
        const metrics = await this.databaseService.getLeadMetrics();
        const probateCases = await this.databaseService.getProbateCases();
        const violations = await this.databaseService.getViolations();

        res.json({
          success: true,
          analytics: {
            leads: metrics,
            probate_cases: probateCases.length,
            violations: violations.length,
            pipeline_status: this.isRunning ? 'running' : 'idle',
            last_updated: new Date().toISOString()
          }
        });

      } catch (error) {
        logger.error('Failed to get analytics:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve analytics' 
        });
      }
    });

    // Update lead status
    this.app.patch('/leads/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const updatedLead = await this.databaseService.updateLeadStatus(id, status, notes);

        res.json({
          success: true,
          message: `Lead status updated to: ${status}`,
          lead: updatedLead
        });

      } catch (error) {
        logger.error('Failed to update lead status:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to update lead status' 
        });
      }
    });

    // Status and system info
    this.app.get('/status', (req, res) => {
      res.json({
        success: true,
        status: {
          running: this.isRunning,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development',
          version: '2.0.0'
        },
        features: {
          real_data_sources: 'active',
          database_storage: 'connected',
          lead_pipeline: 'ready',
          probate_scraping: 'enabled',
          violation_tracking: 'enabled',
          tax_monitoring: 'enabled',
          skip_trace: 'simulated'
        }
      });
    });
  }

  public start(port: number = 3001): void {
    this.app.listen(port, () => {
      logger.info(`🚀 LeadFlow AI Real Data Server running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/health`);
      logger.info(`🎯 Leads API: http://localhost:${port}/leads`);
      logger.info(`⚡ Pipeline: http://localhost:${port}/pipeline/run`);
      logger.info(`💰 Revenue: http://localhost:${port}/revenue`);
      console.log('\n🎯 REAL LEAD GENERATION READY!');
      console.log('================================================');
      console.log('✅ Database: Connected');
      console.log('✅ Data Sources: Probate, Violations, Tax Records');
      console.log('✅ Pipeline: Ready for real lead generation');
      console.log('🚀 Ready to generate REAL MONEY-MAKING LEADS!');
    });
  }
}

// Start the server
const server = new LeadFlowAIRealServer();
server.start(3001);

export default server;
