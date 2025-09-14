#!/usr/bin/env node

// LeadFlow AI Master System Server
// Enhanced real estate platform with comprehensive API integration

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import master configuration and testing
import { masterConfig } from './config/masterConfig';
import { MasterConfigTester } from './tests/masterConfigTest';

// Import existing routes
import authRoutes from './routes/auth';
import leadRoutes from './routes/leads';
import campaignRoutes from './routes/campaigns';
import callRoutes from './routes/calls';
import scraperRoutes from './routes/scraper';
import skipTraceRoutes from './routes/skipTrace';
import analyticsRoutes from './routes/analytics';
import organizationRoutes from './routes/organizations';
import zipSearchRoutes from './routes/zipSearch';
import realEstateRoutes from './routes/realEstateRoutes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';

async function startServer() {
  const app = express();
  
  console.log('🚀 Starting LeadFlow AI Master Platform');
  console.log('=====================================\n');

  try {
    // Step 1: Validate Configuration
    console.log('1️⃣ Validating Configuration...');
    
    try {
      const tester = new MasterConfigTester();
      await tester.runAllTests();
      
      const results = tester.getResults();
      const criticalErrors = results.filter(r => 
        r.status === 'error' && ['Configuration', 'Environment'].includes(r.api)
      );

      if (criticalErrors.length > 0) {
        console.log('⚠️  Some configuration issues detected, but proceeding...');
      } else {
        console.log('✅ Configuration validated successfully');
      }
    } catch (configError) {
      console.log('⚠️  Configuration testing failed, proceeding with basic setup...');
    }

    // Step 2: Configure Express
    console.log('\n2️⃣ Setting up Express server...');
    
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests, please try again later.',
        retryAfter: 900
      }
    });
    app.use('/api/', limiter);

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging (simple version)
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Step 3: Health and System Endpoints
    app.get('/health', (req, res) => {
      try {
        const systemStatus = masterConfig.getSystemStatus();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          tier: systemStatus.tier,
          apis_enabled: systemStatus.enabledAPIs,
          total_apis: systemStatus.totalAPIs
        });
      } catch (error) {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          note: 'Basic health check - master config not fully loaded'
        });
      }
    });

    app.get('/api/system/status', (req, res) => {
      try {
        const systemStatus = masterConfig.getSystemStatus();
        const apiStatus = masterConfig.validateAPIAvailability();
        
        res.json({
          ...systemStatus,
          available_apis: apiStatus.available,
          missing_api_keys: apiStatus.missing,
          configuration_status: 'loaded'
        });
      } catch (error) {
        res.json({
          error: 'Master configuration not available',
          message: 'Check environment variables and configuration',
          basic_status: 'Server running in basic mode'
        });
      }
    });

    app.get('/api/system/cost-estimate', (req, res) => {
      try {
        const estimatedCost = masterConfig.getEstimatedCostPerSearch();
        const dailyLimit = masterConfig.getDailyBudgetLimit();
        const tierInfo = masterConfig.getTierInfo();
        
        res.json({
          cost_per_search: estimatedCost,
          daily_budget_limit: dailyLimit,
          max_searches_per_day: Math.floor(dailyLimit / estimatedCost),
          tier: tierInfo.name,
          monthly_cost_range: tierInfo.costPerMonth
        });
      } catch (error) {
        res.json({
          error: 'Cost estimation not available',
          message: 'Master configuration not loaded'
        });
      }
    });

    // Step 4: Mount Application Routes
    console.log('3️⃣ Mounting application routes...');
    
    app.use('/api/auth', authRoutes);
    app.use('/api/leads', leadRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/calls', callRoutes);
    app.use('/api/scraper', scraperRoutes);
    app.use('/api/skip-trace', skipTraceRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/organizations', organizationRoutes);
    app.use('/api/zip-search', zipSearchRoutes);
    app.use('/api/real-estate', realEstateRoutes);

    // Master routes (if available)
    try {
      const masterRoutes = require('./routes/masterRealEstateRoutes');
      app.use('/api/master', masterRoutes.router || masterRoutes.default);
      console.log('   ✅ Master real estate routes loaded');
    } catch (error) {
      console.log('   ⚠️  Master routes not available yet');
    }

    // Step 5: Error handling
    app.use(errorHandler);

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.path} does not exist`,
        available_endpoints: [
          'GET /health',
          'GET /api/system/status',
          'GET /api/system/cost-estimate',
          'POST /api/auth/*',
          'GET /api/leads/*',
          'GET /api/real-estate/*'
        ]
      });
    });

    // Step 6: Start Server
    const port = process.env.PORT || 3001;
    
    app.listen(port, () => {
      console.log(`\n🎯 LeadFlow AI Server Started!`);
      console.log(`   🌐 URL: http://localhost:${port}`);
      console.log(`   📊 Health: http://localhost:${port}/health`);
      console.log(`   🔧 Status: http://localhost:${port}/api/system/status`);
      
      try {
        const systemStatus = masterConfig.getSystemStatus();
        console.log(`\n📈 System Info:`);
        console.log(`   Tier: ${systemStatus.tier}`);
        console.log(`   APIs: ${systemStatus.enabledAPIs}/${systemStatus.totalAPIs}`);
        console.log(`   Daily Budget: $${systemStatus.dailyBudgetLimit}`);
      } catch (error) {
        console.log(`\n⚠️  Master config not loaded - check environment setup`);
      }
      
      console.log(`\n🚀 Ready for real estate lead generation!`);
    });

  } catch (error: any) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer().catch(console.error);
}
