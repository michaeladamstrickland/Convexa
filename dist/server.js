"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__leadflowServerInstance = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const winston_1 = __importDefault(require("winston"));
const searchRoutes_1 = __importDefault(require("./routes/searchRoutes"));
const experimentalRoutes_1 = __importDefault(require("./routes/experimentalRoutes"));
const devQueueRoutes_1 = __importDefault(require("./routes/devQueueRoutes"));
const publicProperties_1 = __importDefault(require("./routes/publicProperties"));
const dailyScheduler_1 = require("./scheduler/dailyScheduler");
const leadRoutes_1 = __importDefault(require("./routes/leadRoutes"));
const adminMetrics_1 = __importDefault(require("./routes/adminMetrics"));
const webhookAdmin_1 = __importDefault(require("./routes/webhookAdmin"));
const callRoutes_1 = __importDefault(require("./routes/callRoutes"));
// Load environment variables
dotenv_1.default.config();
// Configure logging
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({ filename: 'convexa-ai.log' })
    ]
});
class LeadFlowAIServer {
    constructor() {
        this.isRunning = false;
        this.app = (0, express_1.default)();
        // this.obituaryMiner = new ObituaryDeathMiner();
        this.revenueMetrics = this.initializeRevenueMetrics();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }
    setupRoutes() {
        // Register API routes
        this.app.use('/api/search', searchRoutes_1.default);
        this.app.use('/api/leads', leadRoutes_1.default);
        this.app.use('/api/_experimental', experimentalRoutes_1.default);
        this.app.use('/api/dev', devQueueRoutes_1.default); // queue dev endpoints
        this.app.use('/api/properties', publicProperties_1.default);
        this.app.use('/api/admin', adminMetrics_1.default);
        this.app.use('/api/admin', webhookAdmin_1.default);
        this.app.use('/api/calls', callRoutes_1.default);
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
            }
            catch (error) {
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
                const leads = []; // obituary miner disabled
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
            }
            catch (error) {
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
    async startIntelligenceEngine(markets) {
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
            }
            catch (error) {
                logger.error('Error in intelligence engine:', error);
                await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds on error
            }
        }
    }
    initializeRevenueMetrics() {
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
    generateMockLeads() {
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
    start(port = 3001) {
        this.app.listen(port, () => {
            logger.info(`🚀 Convexa AI Server started on port ${port}`);
            logger.info('💰 Ready to generate MONEY! Use /intelligence/start to begin mining leads');
            logger.info(`📊 Revenue dashboard: http://localhost:${port}/revenue`);
            logger.info(`🎯 Generate leads: POST http://localhost:${port}/leads/generate`);
            // Start daily scheduler after server is listening
            (0, dailyScheduler_1.startDailyScheduler)();
        });
    }
}
// Direct execution removed for ESM compatibility; use npm scripts to start.
exports.default = LeadFlowAIServer;
// Auto-start when this module is evaluated (ESM-friendly)
const __leadflowServerInstance = new LeadFlowAIServer();
exports.__leadflowServerInstance = __leadflowServerInstance;
__leadflowServerInstance.start(3001);
//# sourceMappingURL=server.js.map