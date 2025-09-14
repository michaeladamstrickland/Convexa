// Real Estate API Routes - PRODUCTION IMPLEMENTATION
// Connects frontend to real property APIs with premium data sources

import express from 'express';
import { RealPropertyDataService } from '../services/realPropertyDataService';
import { APIConfig, PropertySearchParams } from '../types/realPropertyTypes';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize the real property data service with API configuration
const getAPIConfig = (): APIConfig => {
  return {
    zillow: {
      apiKey: process.env.ZILLOW_API_KEY || '',
      baseUrl: 'https://zillow-com1.p.rapidapi.com',
      rateLimit: 100
    },
    rentspree: {
      apiKey: process.env.RENTSPREE_API_KEY || '',
      baseUrl: 'https://api.rentspree.com/v1',
      rateLimit: 1000
    },
    attomData: {
      apiKey: process.env.ATTOM_API_KEY || '',
      baseUrl: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0',
      rateLimit: 100
    },
    realtyMole: {
      apiKey: process.env.REALTY_MOLE_API_KEY || '',
      baseUrl: 'https://realty-mole-property-api.p.rapidapi.com',
      rateLimit: 100
    },
    batchSkipTracing: {
      apiKey: process.env.BATCH_SKIP_TRACING_API_KEY || '',
      baseUrl: 'https://api.batchskiptracing.com/v2',
      costPerLookup: 0.25
    },
    whitepagesPro: {
      apiKey: process.env.WHITEPAGES_PRO_API_KEY || '',
      baseUrl: 'https://proapi.whitepages.com/3.0',
      costPerLookup: 0.30
    },
    propertyRadar: {
      apiKey: process.env.PROPERTY_RADAR_API_KEY || '',
      baseUrl: 'https://api.propertyradar.com/v1',
      rateLimit: 100
    },
    dataTree: {
      apiKey: process.env.DATA_TREE_API_KEY || '',
      baseUrl: 'https://api.datatree.com/api',
      costPerQuery: 0.15
    },
    postalService: {
      apiKey: process.env.USPS_API_KEY || '',
      baseUrl: 'https://secure.shippingapis.com/ShippingAPI.dll',
      rateLimit: 1000
    }
  };
};

// Initialize service
let propertyService: RealPropertyDataService;

try {
  const apiConfig = getAPIConfig();
  propertyService = new RealPropertyDataService(apiConfig);
  logger.info('🚀 Real Property Data Service initialized with premium APIs');
} catch (error) {
  logger.error('❌ Failed to initialize Real Property Data Service:', error);
}

// REAL ZIP CODE SEARCH - Connects to actual property APIs
router.post('/search-real-zip', async (req, res) => {
  try {
    const { zipCode, filters = {} } = req.body;
    
    if (!zipCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Zip code is required' 
      });
    }

    logger.info(`🔍 REAL property search initiated for zip code: ${zipCode}`);

    const searchParams: PropertySearchParams = {
      zipCodes: [zipCode],
      filters: {
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        minEquityPercent: filters.minEquityPercent || 20,
        requireDistressSignals: filters.requireDistressSignals || false,
        includeForeclosures: filters.includeForeclosures !== false,
        includeProbate: filters.includeProbate !== false,
        includeTaxDelinquent: filters.includeTaxDelinquent !== false,
        includeVacant: filters.includeVacant !== false,
        includeAbsenteeOwners: filters.includeAbsenteeOwners !== false
      },
      sorting: {
        field: filters.sortBy || 'leadScore',
        direction: 'desc'
      },
      pagination: {
        limit: filters.limit || 50,
        offset: filters.offset || 0
      }
    };

    // Execute REAL property search
    const results = await propertyService.searchProperties(searchParams);

    logger.info(`✅ REAL search completed: ${results.totalCount} properties found, Cost: $${results.searchMetadata.totalCost.toFixed(2)}`);

    res.json({
      success: true,
      zipCode,
      leadCount: results.totalCount,
      leads: results.properties.map(property => ({
        id: property.zpid || `prop-${Date.now()}-${Math.random()}`,
        propertyAddress: property.address,
        ownerName: property.owner.name,
        ownerPhone: property.contacts.find(c => c.type === 'phone')?.value || null,
        ownerEmail: property.contacts.find(c => c.type === 'email')?.value || null,
        marketValue: property.zestimate,
        aiScore: property.leadScore,
        source: 'real_estate_apis',
        motivationScore: property.motivationScore,
        status: 'new',
        leadNotes: [],
        tags: [
          ...(property.distressSignals.foreclosureNotice ? ['foreclosure'] : []),
          ...(property.taxDelinquency.isDelinquent ? ['tax_delinquent'] : []),
          ...(property.distressSignals.probateStatus.isInProbate ? ['probate'] : []),
          ...(property.owner.isAbsenteeOwner ? ['absentee_owner'] : []),
          ...(property.equityPercent > 50 ? ['high_equity'] : [])
        ],
        createdAt: property.lastUpdated,
        // Additional real estate data
        realEstateData: {
          equity: property.equity,
          equityPercent: property.equityPercent,
          propertyType: property.propertyType,
          yearBuilt: property.yearBuilt,
          squareFootage: property.squareFootage,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          dealPotential: property.dealPotential,
          distressSignals: property.distressSignals,
          taxDelinquency: property.taxDelinquency
        }
      })),
      metadata: results.searchMetadata,
      aggregations: results.aggregations,
      message: `Found ${results.totalCount} REAL properties in zip code ${zipCode} using premium APIs`
    });
    
  } catch (error: any) {
    logger.error('❌ REAL property search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Real property search failed', 
      details: error.message 
    });
  }
});

// REAL MULTIPLE ZIP SEARCH
router.post('/search-real-multiple-zips', async (req, res) => {
  try {
    const { zipCodes, filters = {} } = req.body;
    
    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Zip codes array is required' 
      });
    }

    logger.info(`🔍 REAL property search initiated for ${zipCodes.length} zip codes: ${zipCodes.join(', ')}`);

    const searchParams: PropertySearchParams = {
      zipCodes,
      filters: {
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        minEquityPercent: filters.minEquityPercent || 20,
        requireDistressSignals: filters.requireDistressSignals || false,
        includeForeclosures: filters.includeForeclosures !== false,
        includeProbate: filters.includeProbate !== false,
        includeTaxDelinquent: filters.includeTaxDelinquent !== false,
        includeVacant: filters.includeVacant !== false,
        includeAbsenteeOwners: filters.includeAbsenteeOwners !== false
      },
      sorting: {
        field: filters.sortBy || 'leadScore',
        direction: 'desc'
      },
      pagination: {
        limit: filters.limit || 100,
        offset: filters.offset || 0
      }
    };

    const results = await propertyService.searchProperties(searchParams);

    logger.info(`✅ REAL multi-zip search completed: ${results.totalCount} properties found, Cost: $${results.searchMetadata.totalCost.toFixed(2)}`);

    res.json({
      success: true,
      zipCodes,
      leadCount: results.totalCount,
      leads: results.properties.map(property => ({
        id: property.zpid || `prop-${Date.now()}-${Math.random()}`,
        propertyAddress: property.address,
        ownerName: property.owner.name,
        ownerPhone: property.contacts.find(c => c.type === 'phone')?.value || null,
        ownerEmail: property.contacts.find(c => c.type === 'email')?.value || null,
        marketValue: property.zestimate,
        aiScore: property.leadScore,
        source: 'real_estate_apis',
        motivationScore: property.motivationScore,
        status: 'new',
        leadNotes: [],
        tags: [
          ...(property.distressSignals.foreclosureNotice ? ['foreclosure'] : []),
          ...(property.taxDelinquency.isDelinquent ? ['tax_delinquent'] : []),
          ...(property.distressSignals.probateStatus.isInProbate ? ['probate'] : []),
          ...(property.owner.isAbsenteeOwner ? ['absentee_owner'] : []),
          ...(property.equityPercent > 50 ? ['high_equity'] : [])
        ],
        createdAt: property.lastUpdated,
        realEstateData: {
          equity: property.equity,
          equityPercent: property.equityPercent,
          propertyType: property.propertyType,
          yearBuilt: property.yearBuilt,
          squareFootage: property.squareFootage,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          dealPotential: property.dealPotential,
          distressSignals: property.distressSignals,
          taxDelinquency: property.taxDelinquency
        }
      })),
      metadata: results.searchMetadata,
      aggregations: results.aggregations,
      message: `Found ${results.totalCount} REAL properties across ${zipCodes.length} zip codes using premium APIs`
    });
    
  } catch (error: any) {
    logger.error('❌ REAL multi-zip search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Real multi-zip search failed', 
      details: error.message 
    });
  }
});

// REAL TARGET AREA SEARCH - Phoenix Metro with all premium data
router.post('/search-real-target-area', async (req, res) => {
  try {
    const { filters = {} } = req.body;
    
    // Phoenix Metro Area zip codes
    const phoenixMetroZips = [
      // Phoenix
      '85001', '85003', '85004', '85006', '85007', '85008', '85009', '85012',
      '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
      '85021', '85022', '85023', '85024', '85027', '85028', '85029', '85032',
      '85033', '85034', '85035', '85037', '85040', '85041', '85042', '85043',
      
      // Scottsdale
      '85250', '85251', '85252', '85253', '85254', '85255', '85256', '85257',
      '85258', '85259', '85260', '85261', '85262', '85263', '85264', '85266',
      
      // Tempe
      '85281', '85282', '85283', '85284', '85285', '85287',
      
      // Mesa
      '85201', '85202', '85203', '85204', '85205', '85206', '85207', '85208'
    ];

    logger.info(`🌍 REAL target area search initiated for Phoenix Metro (${phoenixMetroZips.length} zip codes)`);

    const searchParams: PropertySearchParams = {
      zipCodes: phoenixMetroZips,
      filters: {
        minValue: filters.minValue || 100000,
        maxValue: filters.maxValue || 2000000,
        minEquityPercent: filters.minEquityPercent || 25,
        requireDistressSignals: filters.requireDistressSignals || true, // Focus on motivated sellers
        includeForeclosures: true,
        includeProbate: true,
        includeTaxDelinquent: true,
        includeVacant: true,
        includeAbsenteeOwners: true
      },
      sorting: {
        field: 'motivationScore', // Prioritize most motivated sellers
        direction: 'desc'
      },
      pagination: {
        limit: filters.limit || 200,
        offset: filters.offset || 0
      }
    };

    const results = await propertyService.searchProperties(searchParams);

    logger.info(`✅ REAL target area search completed: ${results.totalCount} properties found, Cost: $${results.searchMetadata.totalCost.toFixed(2)}`);

    res.json({
      success: true,
      area: 'Phoenix Metro Area',
      leadCount: results.totalCount,
      leads: results.properties.map(property => ({
        id: property.zpid || `prop-${Date.now()}-${Math.random()}`,
        propertyAddress: property.address,
        ownerName: property.owner.name,
        ownerPhone: property.contacts.find(c => c.type === 'phone')?.value || null,
        ownerEmail: property.contacts.find(c => c.type === 'email')?.value || null,
        marketValue: property.zestimate,
        aiScore: property.leadScore,
        source: 'real_estate_apis',
        motivationScore: property.motivationScore,
        status: 'new',
        leadNotes: [],
        tags: [
          ...(property.distressSignals.foreclosureNotice ? ['foreclosure'] : []),
          ...(property.taxDelinquency.isDelinquent ? ['tax_delinquent'] : []),
          ...(property.distressSignals.probateStatus.isInProbate ? ['probate'] : []),
          ...(property.owner.isAbsenteeOwner ? ['absentee_owner'] : []),
          ...(property.equityPercent > 50 ? ['high_equity'] : []),
          ...(property.distressSignals.vacancyIndicators.length > 0 ? ['vacant'] : []),
          ...(property.distressSignals.codeViolations.length > 0 ? ['code_violations'] : [])
        ],
        createdAt: property.lastUpdated,
        realEstateData: {
          equity: property.equity,
          equityPercent: property.equityPercent,
          propertyType: property.propertyType,
          yearBuilt: property.yearBuilt,
          squareFootage: property.squareFootage,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          dealPotential: property.dealPotential,
          distressSignals: property.distressSignals,
          taxDelinquency: property.taxDelinquency
        }
      })),
      metadata: results.searchMetadata,
      aggregations: results.aggregations,
      message: `Found ${results.totalCount} REAL motivated seller properties in Phoenix Metro using premium APIs`
    });
    
  } catch (error: any) {
    logger.error('❌ REAL target area search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Real target area search failed', 
      details: error.message 
    });
  }
});

// Get real-time costs and usage statistics
router.get('/api-usage-stats', async (req, res) => {
  try {
    if (!propertyService) {
      return res.status(503).json({
        success: false,
        error: 'Property service not available'
      });
    }

    res.json({
      success: true,
      stats: {
        totalCosts: propertyService.getTotalCosts(),
        requestCount: propertyService.getRequestCount(),
        costBreakdown: {
          zillow: 'Charged per property lookup',
          rentspree: 'MLS data access',
          attomData: 'Property details and ownership',
          batchSkipTracing: 'Phone/email discovery',
          propertyRadar: 'Foreclosure notices'
        },
        recommendations: [
          'Use filters to reduce API calls',
          'Focus on high-equity properties',
          'Enable skip tracing only for qualified leads',
          'Monitor daily budget limits'
        ]
      }
    });
  } catch (error: any) {
    logger.error('❌ Failed to get API usage stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage statistics' 
    });
  }
});

// Reset cost counters (for development/testing)
router.post('/reset-counters', async (req, res) => {
  try {
    if (propertyService) {
      propertyService.resetCounters();
    }
    
    res.json({
      success: true,
      message: 'Cost counters reset'
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset counters' 
    });
  }
});

export default router;
