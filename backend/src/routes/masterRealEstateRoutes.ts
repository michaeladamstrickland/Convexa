// Master Real Estate API Routes
// Comprehensive lead generation with all premium data sources

import express from 'express';
import { MasterRealEstateDataService } from '../services/masterRealEstateService';
import { MasterAPIConfig, MasterSearchParams } from '../types/masterDataTypes';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize the master service with comprehensive API configuration
const getMasterAPIConfig = (): MasterAPIConfig => {
  return {
    // Property Ownership & Public Records
    attomData: {
      apiKey: process.env.ATTOM_API_KEY || '',
      baseUrl: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0',
      rateLimit: 100,
      costPerRequest: 0.50,
      subscription: 'pro',
      dataType: 'property'
    },
    propMix: {
      apiKey: process.env.PROPMIX_API_KEY || '',
      baseUrl: 'https://api.propmix.io/v1',
      rateLimit: 200,
      costPerRequest: 0.25,
      subscription: 'pro',
      dataType: 'property'
    },
    estated: {
      apiKey: process.env.ESTATED_API_KEY || '',
      baseUrl: 'https://apis.estated.com/v4',
      rateLimit: 100,
      costPerRequest: 0.25,
      subscription: 'basic',
      dataType: 'property'
    },
    dataTree: {
      apiKey: process.env.DATA_TREE_API_KEY || '',
      baseUrl: 'https://api.datatree.com/api',
      rateLimit: 50,
      costPerLookup: 0.15,
      subscription: 'enterprise',
      requiresLicense: true,
      dataType: 'property'
    },
    coreLogicTrestle: {
      apiKey: process.env.CORELOGIC_TRESTLE_API_KEY || '',
      baseUrl: 'https://api.trestle.corelogic.com/v1',
      rateLimit: 100,
      costPerRequest: 2.00,
      subscription: 'enterprise',
      requiresLicense: true,
      dataType: 'mls'
    },
    regrid: {
      apiKey: process.env.REGRID_API_KEY || '',
      baseUrl: 'https://api.regrid.com/v1',
      rateLimit: 1000,
      costPerRequest: 0.10,
      subscription: 'basic',
      dataType: 'property'
    },

    // Deceased Owner & Probate Data
    usObituaryAPI: {
      apiKey: process.env.US_OBITUARY_API_KEY || '',
      baseUrl: 'https://api.usobituaryapi.com/v1',
      rateLimit: 100,
      costPerRequest: 0.30,
      subscription: 'pro',
      dataType: 'legal'
    },
    obitAPI: {
      apiKey: process.env.OBIT_API_KEY || '',
      baseUrl: 'https://api.obitapi.com/v2',
      rateLimit: 200,
      costPerRequest: 0.25,
      subscription: 'basic',
      dataType: 'legal'
    },
    tributesAPI: {
      apiKey: process.env.TRIBUTES_API_KEY || '',
      baseUrl: 'https://api.tributes.com/v1',
      rateLimit: 100,
      costPerRequest: 0.20,
      subscription: 'basic',
      dataType: 'legal'
    },
    peopleDataLabs: {
      apiKey: process.env.PDL_API_KEY || '',
      baseUrl: 'https://api.peopledatalabs.com/v5',
      rateLimit: 100,
      costPerRequest: 0.30,
      subscription: 'pro',
      dataType: 'contact'
    },

    // MLS & Listings
    mlsGrid: {
      apiKey: process.env.MLS_GRID_API_KEY || '',
      baseUrl: 'https://api.mlsgrid.com/v2',
      rateLimit: 100,
      costPerRequest: 1.00,
      subscription: 'enterprise',
      requiresLicense: true,
      dataType: 'mls'
    },
    trestle: {
      apiKey: process.env.TRESTLE_API_KEY || '',
      baseUrl: 'https://api.trestle.corelogic.com/v1',
      rateLimit: 100,
      costPerRequest: 2.00,
      subscription: 'enterprise',
      requiresLicense: true,
      dataType: 'mls'
    },
    zillowUnofficial: {
      apiKey: process.env.ZILLOW_RAPIDAPI_KEY || '',
      baseUrl: 'https://zillow-com1.p.rapidapi.com',
      rateLimit: 100,
      costPerRequest: 0.50,
      subscription: 'basic',
      dataType: 'mls'
    },
    realtorRapidAPI: {
      apiKey: process.env.REALTOR_RAPIDAPI_KEY || '',
      baseUrl: 'https://realtor.p.rapidapi.com',
      rateLimit: 100,
      costPerRequest: 0.75,
      subscription: 'pro',
      dataType: 'mls'
    },
    redfinScraper: {
      apiKey: process.env.REDFIN_API_KEY || '',
      baseUrl: 'https://api.redfin.com/v1',
      rateLimit: 50,
      costPerRequest: 0.25,
      subscription: 'basic',
      dataType: 'mls'
    },

    // Distress & Legal Data
    foreclosureCom: {
      apiKey: process.env.FORECLOSURE_COM_API_KEY || '',
      baseUrl: 'https://api.foreclosure.com/v1',
      rateLimit: 100,
      costPerRequest: 0.75,
      subscription: 'pro',
      dataType: 'legal'
    },
    propertyRadar: {
      apiKey: process.env.PROPERTY_RADAR_API_KEY || '',
      baseUrl: 'https://api.propertyradar.com/v1',
      rateLimit: 100,
      costPerRequest: 0.75,
      subscription: 'pro',
      dataType: 'legal'
    },
    pacerBankruptcy: {
      apiKey: process.env.PACER_API_KEY || '',
      baseUrl: 'https://api.pacer.gov/v1',
      rateLimit: 50,
      costPerRequest: 1.00,
      subscription: 'enterprise',
      dataType: 'legal'
    },
    localCountySites: {
      apiKey: process.env.COUNTY_SCRAPER_KEY || '',
      baseUrl: 'https://api.countyscraper.com/v1',
      rateLimit: 100,
      costPerRequest: 0.50,
      subscription: 'pro',
      dataType: 'legal'
    },

    // Skip Tracing & Contact Enrichment
    batchSkipTracing: {
      apiKey: process.env.BATCH_SKIP_TRACING_API_KEY || '',
      baseUrl: 'https://api.batchskiptracing.com/v2',
      rateLimit: 100,
      costPerLookup: 0.25,
      subscription: 'pro',
      dataType: 'contact'
    },
    idiDataLexisNexis: {
      apiKey: process.env.IDI_LEXISNEXIS_API_KEY || '',
      baseUrl: 'https://api.lexisnexis.com/idi/v1',
      rateLimit: 50,
      costPerLookup: 0.50,
      subscription: 'enterprise',
      requiresLicense: true,
      dataType: 'contact'
    },
    truePeopleSearch: {
      apiKey: process.env.TRUE_PEOPLE_SEARCH_KEY || '',
      baseUrl: 'https://api.truepeoplesearch.com/v1',
      rateLimit: 200,
      costPerRequest: 0.15,
      subscription: 'basic',
      dataType: 'contact'
    },
    clearbit: {
      apiKey: process.env.CLEARBIT_API_KEY || '',
      baseUrl: 'https://person.clearbit.com/v2',
      rateLimit: 100,
      costPerRequest: 0.30,
      subscription: 'pro',
      dataType: 'contact'
    },
    fullContact: {
      apiKey: process.env.FULLCONTACT_API_KEY || '',
      baseUrl: 'https://api.fullcontact.com/v3',
      rateLimit: 100,
      costPerRequest: 0.25,
      subscription: 'pro',
      dataType: 'contact'
    },

    // AI & Intelligence
    openAI: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1',
      rateLimit: 100,
      costPerRequest: 0.02,
      subscription: 'pro',
      dataType: 'ai'
    },
    twilioVoice: {
      apiKey: process.env.TWILIO_AUTH_TOKEN || '',
      baseUrl: 'https://api.twilio.com/2010-04-01',
      rateLimit: 1000,
      costPerRequest: 0.05,
      subscription: 'pro',
      dataType: 'ai'
    },
    twilioSMS: {
      apiKey: process.env.TWILIO_AUTH_TOKEN || '',
      baseUrl: 'https://api.twilio.com/2010-04-01',
      rateLimit: 1000,
      costPerRequest: 0.02,
      subscription: 'pro',
      dataType: 'ai'
    },
    googleMaps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      baseUrl: 'https://maps.googleapis.com/maps/api',
      rateLimit: 1000,
      costPerRequest: 0.01,
      subscription: 'basic',
      dataType: 'verification'
    },
    melissaData: {
      apiKey: process.env.MELISSA_DATA_API_KEY || '',
      baseUrl: 'https://api.melissa.com/v3',
      rateLimit: 1000,
      costPerRequest: 0.10,
      subscription: 'pro',
      dataType: 'verification'
    },

    // Additional Real Estate Data
    rentometer: {
      apiKey: process.env.RENTOMETER_API_KEY || '',
      baseUrl: 'https://api.rentometer.com/v1',
      rateLimit: 100,
      costPerRequest: 0.20,
      subscription: 'basic',
      dataType: 'property'
    },
    zillowRentEstimate: {
      apiKey: process.env.ZILLOW_RENT_API_KEY || '',
      baseUrl: 'https://api.zillow.com/rent/v1',
      rateLimit: 100,
      costPerRequest: 0.25,
      subscription: 'pro',
      dataType: 'property'
    },
    airDNA: {
      apiKey: process.env.AIRDNA_API_KEY || '',
      baseUrl: 'https://api.airdna.co/v1',
      rateLimit: 100,
      costPerRequest: 0.75,
      subscription: 'pro',
      dataType: 'property'
    },
    buildZoom: {
      apiKey: process.env.BUILDZOOM_API_KEY || '',
      baseUrl: 'https://api.buildzoom.com/v1',
      rateLimit: 100,
      costPerRequest: 0.30,
      subscription: 'basic',
      dataType: 'property'
    }
  };
};

// Initialize the master service
let masterService: MasterRealEstateDataService;

try {
  const apiConfig = getMasterAPIConfig();
  masterService = new MasterRealEstateDataService(apiConfig);
  logger.info('🌟 Master Real Estate Data Service initialized with ALL premium APIs');
} catch (error) {
  logger.error('❌ Failed to initialize Master Real Estate Service:', error);
}

// ULTIMATE PROPERTY SEARCH - All data sources combined
router.post('/ultimate-search', async (req, res) => {
  try {
    const searchParams: MasterSearchParams = {
      zipCodes: req.body.zipCodes || [],
      counties: req.body.counties || [],
      states: req.body.states || [],
      cities: req.body.cities || [],
      
      // Property filters
      propertyTypes: req.body.propertyTypes || ['Single Family', 'Condo', 'Townhouse'],
      minValue: req.body.minValue || 50000,
      maxValue: req.body.maxValue || 2000000,
      minEquity: req.body.minEquity || 25000,
      minEquityPercent: req.body.minEquityPercent || 20,
      
      // Distress filters
      includeForeclosures: req.body.includeForeclosures !== false,
      includeProbate: req.body.includeProbate !== false,
      includeTaxDelinquent: req.body.includeTaxDelinquent !== false,
      includeBankruptcy: req.body.includeBankruptcy !== false,
      includeVacant: req.body.includeVacant !== false,
      includeCodeViolations: req.body.includeCodeViolations !== false,
      includeEvictions: req.body.includeEvictions !== false,
      includeDivorce: req.body.includeDivorce !== false,
      
      // Motivation filters
      minMotivationScore: req.body.minMotivationScore || 50,
      maxDaysOnMarket: req.body.maxDaysOnMarket || 365,
      includeExpiredListings: req.body.includeExpiredListings !== false,
      includeAbsenteeOwners: req.body.includeAbsenteeOwners !== false,
      
      // Contact filters
      requirePhoneNumber: req.body.requirePhoneNumber || false,
      requireEmailAddress: req.body.requireEmailAddress || false,
      skipTraceRequired: req.body.skipTraceRequired || false,
      
      // Results configuration
      limit: req.body.limit || 100,
      offset: req.body.offset || 0,
      sortBy: req.body.sortBy || 'overallScore',
      sortDirection: 'desc'
    };

    logger.info(`🔍 Ultimate property search initiated for ${searchParams.zipCodes?.length || 0} zip codes`);
    
    const results = await masterService.masterPropertySearch(searchParams);
    
    logger.info(`✅ Ultimate search completed: ${results.totalResults} properties found`);
    logger.info(`💰 Total cost: $${results.searchMetadata.totalCost.toFixed(2)}`);
    logger.info(`📊 Data sources used: ${results.searchMetadata.dataSourcesUsed.join(', ')}`);

    res.json({
      success: true,
      message: `Ultimate search completed: ${results.totalResults} high-quality leads found`,
      searchType: 'ultimate_comprehensive',
      ...results
    });

  } catch (error: any) {
    logger.error('❌ Ultimate property search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Ultimate property search failed',
      details: error.message
    });
  }
});

// PROBATE LEADS SEARCH - Focus on deceased owner properties
router.post('/probate-leads', async (req, res) => {
  try {
    const searchParams: MasterSearchParams = {
      zipCodes: req.body.zipCodes || [],
      includeProbate: true,
      includeVacant: true,
      includeAbsenteeOwners: true,
      minEquityPercent: 30, // Higher equity for probate deals
      skipTraceRequired: true, // Need to find heirs
      limit: req.body.limit || 50,
      sortBy: 'motivationScore'
    };

    logger.info('⚰️ Probate leads search initiated');

    const results = await masterService.masterPropertySearch(searchParams);

    // Filter for highest probate probability
    const probateLeads = results.properties.filter(p => 
      p.distressSignals?.probate || 
      p.aiAnalysis.motivationScore > 70
    );

    res.json({
      success: true,
      searchType: 'probate_specialized',
      totalResults: probateLeads.length,
      properties: probateLeads,
      message: `Found ${probateLeads.length} probate lead opportunities`,
      searchMetadata: results.searchMetadata,
      costBreakdown: results.costBreakdown
    });

  } catch (error: any) {
    logger.error('❌ Probate search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Probate search failed',
      details: error.message
    });
  }
});

// FORECLOSURE LEADS SEARCH - Focus on distressed properties
router.post('/foreclosure-leads', async (req, res) => {
  try {
    const searchParams: MasterSearchParams = {
      zipCodes: req.body.zipCodes || [],
      includeForeclosures: true,
      includeTaxDelinquent: true,
      includeCodeViolations: true,
      minEquity: 50000, // Must have equity for wholesale deals
      requirePhoneNumber: true, // Need contact info
      limit: req.body.limit || 75,
      sortBy: 'urgencyScore'
    };

    logger.info('🏠 Foreclosure leads search initiated');

    const results = await masterService.masterPropertySearch(searchParams);

    // Filter for highest urgency
    const foreclosureLeads = results.properties.filter(p => 
      p.distressSignals?.foreclosure || 
      p.distressSignals?.taxDelinquency ||
      p.aiAnalysis.urgencyScore > 60
    );

    res.json({
      success: true,
      searchType: 'foreclosure_specialized',
      totalResults: foreclosureLeads.length,
      properties: foreclosureLeads,
      message: `Found ${foreclosureLeads.length} foreclosure lead opportunities`,
      searchMetadata: results.searchMetadata,
      costBreakdown: results.costBreakdown
    });

  } catch (error: any) {
    logger.error('❌ Foreclosure search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Foreclosure search failed',
      details: error.message
    });
  }
});

// HIGH-EQUITY LEADS - Focus on cash-rich properties
router.post('/high-equity-leads', async (req, res) => {
  try {
    const searchParams: MasterSearchParams = {
      zipCodes: req.body.zipCodes || [],
      minEquityPercent: 60, // High equity properties
      includeAbsenteeOwners: true,
      includeVacant: true,
      maxDaysOnMarket: 180, // Motivated sellers
      skipTraceRequired: true,
      limit: req.body.limit || 50,
      sortBy: 'dealPotentialScore'
    };

    logger.info('💰 High-equity leads search initiated');

    const results = await masterService.masterPropertySearch(searchParams);

    // Filter for best deal potential
    const highEquityLeads = results.properties.filter(p => 
      (p.equity?.equityPercentage || 0) > 50 &&
      p.aiAnalysis.dealPotentialScore > 65
    );

    res.json({
      success: true,
      searchType: 'high_equity_specialized',
      totalResults: highEquityLeads.length,
      properties: highEquityLeads,
      message: `Found ${highEquityLeads.length} high-equity lead opportunities`,
      searchMetadata: results.searchMetadata,
      costBreakdown: results.costBreakdown
    });

  } catch (error: any) {
    logger.error('❌ High-equity search failed:', error);
    res.status(500).json({
      success: false,
      error: 'High-equity search failed',
      details: error.message
    });
  }
});

// Get comprehensive API usage and cost statistics
router.get('/master-usage-stats', async (req, res) => {
  try {
    if (!masterService) {
      return res.status(503).json({
        success: false,
        error: 'Master service not available'
      });
    }

    const apiConfig = getMasterAPIConfig();
    
    res.json({
      success: true,
      stats: {
        totalCosts: masterService.getTotalCosts(),
        requestCount: masterService.getRequestCount(),
        apiEndpoints: Object.keys(apiConfig).length,
        costBreakdown: {
          'Property Data (ATTOM, Estated, PropMix)': '$0.25-0.50 per lookup',
          'MLS Data (Trestle, MLS Grid)': '$1.00-2.00 per search',
          'Skip Tracing (Batch, IDI, PDL)': '$0.25-0.50 per contact',
          'Distress Data (PropertyRadar, Foreclosure)': '$0.75 per property',
          'AI Analysis (OpenAI)': '$0.02 per analysis',
          'Contact Enrichment (Clearbit, FullContact)': '$0.25-0.30 per enrichment'
        },
        estimatedMonthlyCosts: {
          basic: '$500-1000 (Estated + Skip Tracing + AI)',
          professional: '$1500-3000 (All property APIs + premium skip tracing)',
          enterprise: '$3000-5000 (Full stack + MLS + LexisNexis)'
        },
        dataSourcesAvailable: [
          'ATTOM Data - Property ownership & tax records',
          'Estated - Nationwide property database',
          'PropMix - Parcel data & permits',
          'MLS Grid - Active & expired listings',
          'PropertyRadar - Foreclosure notices',
          'Batch Skip Tracing - Contact discovery',
          'PeopleDataLabs - Contact enrichment',
          'US Obituary API - Probate identification',
          'OpenAI - Lead scoring & strategy',
          'Google Maps - Geographic intelligence'
        ],
        recommendations: [
          'Start with basic tier: Estated + Skip Tracing + AI ($500-1000/month)',
          'Add foreclosure tracking: PropertyRadar (+$100/month)',
          'Include probate mining: Obituary APIs (+$200/month)',
          'Upgrade to enterprise: Full stack with MLS access',
          'Monitor costs with daily budget limits',
          'Use high-equity filters to maximize ROI'
        ]
      }
    });
  } catch (error: any) {
    logger.error('❌ Failed to get master usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

// Reset all cost counters
router.post('/reset-master-counters', async (req, res) => {
  try {
    if (masterService) {
      masterService.resetCounters();
    }
    
    res.json({
      success: true,
      message: 'Master service cost counters reset'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset master counters'
    });
  }
});

export default router;
