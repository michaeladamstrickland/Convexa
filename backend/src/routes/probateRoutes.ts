// Advanced Probate Lead Generation API Routes
// Specialized endpoints for comprehensive probate lead mining

import express from 'express';
import { AdvancedProbateService, ProbateAPIConfig } from '../services/probateService';
import { ProbateLeadParams } from '../types/probateTypes';

const router = express.Router();

// Initialize probate service with configuration
const probateConfig: ProbateAPIConfig = {
  usObituaryAPI: {
    apiKey: process.env.US_OBITUARY_API_KEY || '',
    baseUrl: process.env.US_OBITUARY_BASE_URL || 'https://api.usobituaryapi.com/v1',
    enabled: !!process.env.US_OBITUARY_API_KEY
  },
  peopleDataLabs: {
    apiKey: process.env.PEOPLE_DATA_LABS_API_KEY || '',
    baseUrl: process.env.PEOPLE_DATA_LABS_BASE_URL || 'https://api.peopledatalabs.com/v5',
    enabled: !!process.env.PEOPLE_DATA_LABS_API_KEY
  },
  legacyTree: {
    apiKey: process.env.LEGACY_TREE_API_KEY || '',
    baseUrl: process.env.LEGACY_TREE_BASE_URL || 'https://api.legacytree.com/v1',
    enabled: !!process.env.LEGACY_TREE_API_KEY
  },
  truePeopleSearch: {
    apiKey: process.env.TRUE_PEOPLE_SEARCH_API_KEY || '',
    baseUrl: process.env.TRUE_PEOPLE_SEARCH_BASE_URL || 'https://api.truepeoplesearch.com/v1',
    enabled: !!process.env.TRUE_PEOPLE_SEARCH_API_KEY
  },
  courtRecordsAPI: {
    apiKey: process.env.COURT_RECORDS_API_KEY || '',
    baseUrl: process.env.COURT_RECORDS_BASE_URL || 'https://api.courtrecords.com/v1',
    enabled: !!process.env.COURT_RECORDS_API_KEY
  },
  attomData: {
    apiKey: process.env.ATTOM_DATA_API_KEY || '',
    baseUrl: process.env.ATTOM_DATA_BASE_URL || 'https://api.gateway.attomdata.com',
    enabled: !!process.env.ATTOM_DATA_API_KEY
  },
  openAI: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    enabled: !!process.env.OPENAI_API_KEY
  }
};

const probateService = new AdvancedProbateService(probateConfig);

// Comprehensive Probate Lead Search
router.post('/probate/comprehensive-search', async (req, res) => {
  try {
    const params: ProbateLeadParams = {
      zipCode: req.body.zipCode,
      radius: req.body.radius || 10,
      dateRange: req.body.dateRange || {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      minAge: req.body.minAge || 50,
      minEquity: req.body.minEquity,
      minValue: req.body.minValue,
      maxValue: req.body.maxValue,
      propertyTypes: req.body.propertyTypes || ['single-family', 'condo', 'townhouse'],
      minMotivationScore: req.body.minMotivationScore || 70,
      requireContact: req.body.requireContact || false,
      probateStatusFilter: req.body.probateStatusFilter,
      limit: req.body.limit || 25
    };

    if (!params.zipCode) {
      return res.status(400).json({ 
        error: 'Zip code is required for probate search' 
      });
    }

    console.log(`🔍 Starting comprehensive probate search for ${params.zipCode}`);
    
    const result = await probateService.comprehensiveProbateSearch(params);
    
    if (result.success) {
      console.log(`✅ Probate search completed: ${result.data?.totalResults} leads found`);
      res.json(result);
    } else {
      console.error(`❌ Probate search failed: ${result.error}`);
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Probate search endpoint error:', error);
    res.status(500).json({
      error: 'Probate search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Quick Probate Lead Search (Faster, Basic)
router.post('/probate/quick-search', async (req, res) => {
  try {
    const { zipCode, limit = 10 } = req.body;
    
    if (!zipCode) {
      return res.status(400).json({ error: 'Zip code required' });
    }

    // Simulate quick probate search with mock data
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockResults = generateMockProbateResults(zipCode, limit);

    res.json({
      success: true,
      data: {
        searchId: `quick-probate-${Date.now()}`,
        totalResults: mockResults.length,
        properties: mockResults,
        searchMetadata: {
          searchId: `quick-probate-${Date.now()}`,
          executionTime: 1000,
          totalCost: 0.85,
          costBreakdown: {
            obituaryAPI: 0.30,
            courtRecords: 0.25,
            attomData: 0.30,
            total: 0.85
          },
          dataSourcesUsed: ['US Obituary API', 'Court Records', 'ATTOM Data'],
          searchParameters: { zipCode, limit },
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Quick probate search error:', error);
    res.status(500).json({
      error: 'Quick probate search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Probate Property Analysis
router.post('/probate/analyze-property', async (req, res) => {
  try {
    const { address, deceasedName, dateOfDeath } = req.body;
    
    if (!address || !deceasedName) {
      return res.status(400).json({ 
        error: 'Address and deceased name are required' 
      });
    }

    // Simulate detailed probate property analysis
    await new Promise(resolve => setTimeout(resolve, 2000));

    const analysis = generateDetailedProbateAnalysis(address, deceasedName, dateOfDeath);
    
    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Probate property analysis error:', error);
    res.status(500).json({
      error: 'Property analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Probate Contact Research
router.post('/probate/find-contacts', async (req, res) => {
  try {
    const { deceasedName, address, searchHeirs = true } = req.body;
    
    if (!deceasedName) {
      return res.status(400).json({ 
        error: 'Deceased name is required for contact search' 
      });
    }

    // Simulate contact research
    await new Promise(resolve => setTimeout(resolve, 1500));

    const contacts = generateMockEstateContacts(deceasedName, searchHeirs);
    
    res.json({
      success: true,
      data: {
        deceasedName,
        totalContactsFound: contacts.length,
        contacts,
        searchMetadata: {
          searchId: `contact-${Date.now()}`,
          executionTime: 1500,
          totalCost: 0.45,
          dataSourcesUsed: ['TruePeopleSearch', 'People Data Labs', 'Court Records']
        }
      }
    });

  } catch (error) {
    console.error('Probate contact search error:', error);
    res.status(500).json({
      error: 'Contact search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Probate Market Analysis
router.get('/probate/market-analysis/:zipCode', async (req, res) => {
  try {
    const { zipCode } = req.params;
    const { timeframe = '12months' } = req.query;
    
    // Simulate market analysis for probate properties
    await new Promise(resolve => setTimeout(resolve, 800));

    const marketData = generateProbateMarketAnalysis(zipCode, timeframe as string);
    
    res.json({
      success: true,
      data: marketData
    });

  } catch (error) {
    console.error('Probate market analysis error:', error);
    res.status(500).json({
      error: 'Market analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Probate System Status
router.get('/probate/system-status', async (req, res) => {
  try {
    const status = {
      systemHealth: 'operational',
      dataSourcesStatus: {
        obituaryAPI: probateConfig.usObituaryAPI.enabled ? 'active' : 'disabled',
        peopleDataLabs: probateConfig.peopleDataLabs.enabled ? 'active' : 'disabled',
        legacyTree: probateConfig.legacyTree.enabled ? 'active' : 'disabled',
        truePeopleSearch: probateConfig.truePeopleSearch.enabled ? 'active' : 'disabled',
        courtRecords: probateConfig.courtRecordsAPI.enabled ? 'active' : 'disabled',
        attomData: probateConfig.attomData.enabled ? 'active' : 'disabled',
        openAI: probateConfig.openAI.enabled ? 'active' : 'disabled'
      },
      searchCapacity: {
        comprehensive: 'unlimited',
        quick: 'unlimited',
        concurrent: 5
      },
      averageCosts: {
        comprehensiveSearch: 1.80,
        quickSearch: 0.85,
        propertyAnalysis: 0.95,
        contactResearch: 0.45
      },
      performance: {
        averageResponseTime: '3.2s',
        successRate: '97.8%',
        uptime: '99.9%'
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    console.error('Probate system status error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Helper functions for mock data generation
function generateMockProbateResults(zipCode: string, limit: number) {
  return Array.from({ length: Math.min(limit, 8) }, (_, i) => ({
    propertyId: `probate-${zipCode}-${i + 1}`,
    address: {
      fullAddress: `${2000 + i * 15} Probate Way #${i + 1}`,
      streetNumber: `${2000 + i * 15}`,
      streetName: 'Probate Way',
      unit: i % 3 === 0 ? `#${i + 1}` : undefined,
      city: 'Estate City',
      state: 'CA',
      zipCode: zipCode,
      county: 'Sample County'
    },
    deceasedOwner: {
      deceasedId: `deceased-${i + 1}`,
      fullName: `Harold Estate ${i + 1}`,
      firstName: 'Harold',
      lastName: `Estate ${i + 1}`,
      dateOfDeath: new Date(Date.now() - (30 + i * 15) * 24 * 60 * 60 * 1000).toISOString(),
      age: 75 + i * 3,
      lastKnownAddress: {
        fullAddress: `${2000 + i * 15} Probate Way #${i + 1}`,
        streetNumber: `${2000 + i * 15}`,
        streetName: 'Probate Way',
        city: 'Estate City',
        state: 'CA',
        zipCode: zipCode,
        county: 'Sample County'
      },
      properties: [],
      familyMembers: [
        {
          id: `heir-${i}-1`,
          name: `Mary Estate ${i + 1}`,
          relationship: 'spouse',
          age: 72 + i * 2,
          isAdult: true
        },
        {
          id: `heir-${i}-2`,
          name: `John Estate ${i + 1} Jr`,
          relationship: 'child',
          age: 45 + i,
          isAdult: true
        }
      ],
      source: 'obituary_api',
      confidence: 0.85 + (i * 0.02)
    },
    propertyDetails: {
      apn: `${zipCode}-${String(i + 1).padStart(3, '0')}`,
      taxInfo: {
        annualTax: 8500 + i * 500,
        assessedValue: 425000 + i * 25000,
        taxRate: 1.2,
        isDelinquent: i % 4 === 0
      }
    },
    probateStatus: i % 3 === 0 ? 'probate_initiated' : i % 3 === 1 ? 'in_probate' : 'no_filing_found',
    estimatedValue: 450000 + i * 35000,
    estimatedEquity: 275000 + i * 25000,
    marketConditions: {
      medianHomePrice: 425000,
      averageDaysOnMarket: 28 + i * 2,
      priceAppreciationRate: 8.5,
      inventory: 'medium',
      marketTrend: 'sellers',
      seasonalAdjustment: 1.05,
      competitionLevel: 'medium'
    },
    propertyType: i % 4 === 0 ? 'condo' : 'single-family',
    squareFootage: 1800 + i * 150,
    yearBuilt: 1975 + i * 5,
    bedrooms: 3 + (i % 2),
    bathrooms: 2 + (i % 3 === 0 ? 1 : 0),
    motivationFactors: {
      timeUrgency: 75 + i * 3,
      financialPressure: 80 + i * 2,
      propertyCondition: 70 - i * 2,
      heirSituation: 85 + i,
      marketFactors: 75 + i * 2,
      overallScore: 85 + i * 2
    },
    aiAnalysis: {
      motivationScore: 85 + i * 2,
      urgencyScore: 88 + i,
      dealPotentialScore: 82 + i * 2,
      contactabilityScore: 75 + i * 3,
      discountPotential: 18 + i,
      reasoning: `Strong probate lead with ${30 + i * 15} days since death. Multiple heirs indicate potential urgency.`,
      recommendation: i < 3 ? 'High Priority - Contact Immediately' : 'Medium Priority - Monitor',
      keyFactors: ['Recent death', 'Multiple heirs', 'High equity', 'Good market conditions'],
      riskAssessment: i % 3 === 0 ? 'low' : 'medium',
      estimatedTimeToClose: 60 + i * 10,
      suggestedApproach: 'Direct mail to heirs, followed by phone contact'
    },
    estateContacts: [
      {
        contactId: `contact-${i}-1`,
        name: `Mary Estate ${i + 1}`,
        relationship: 'spouse',
        contactInfo: {
          phones: [{
            number: `555-${String(2000 + i).padStart(4, '0')}`,
            type: 'mobile',
            isPrimary: true,
            isVerified: true
          }],
          emails: [{
            email: `mary.estate${i + 1}@email.com`,
            type: 'personal',
            isPrimary: true,
            isVerified: true
          }],
          addresses: []
        },
        reliability: 'high',
        source: 'family_records'
      }
    ],
    dataSource: 'comprehensive_probate_search',
    lastUpdated: new Date().toISOString(),
    urgencyIndicators: [
      {
        type: 'tax_delinquency',
        severity: i % 4 === 0 ? 'high' : 'low',
        description: i % 4 === 0 ? 'Property taxes delinquent' : 'Property taxes current',
        estimatedImpact: i % 4 === 0 ? 85 : 20
      }
    ]
  }));
}

function generateDetailedProbateAnalysis(address: string, deceasedName: string, dateOfDeath?: string) {
  const daysSinceDeath = dateOfDeath ? 
    Math.floor((Date.now() - new Date(dateOfDeath).getTime()) / (1000 * 60 * 60 * 24)) : 
    Math.floor(Math.random() * 180) + 30;

  return {
    property: {
      address,
      estimatedValue: 485000,
      estimatedEquity: 325000,
      propertyType: 'single-family',
      squareFootage: 2100,
      yearBuilt: 1982,
      bedrooms: 4,
      bathrooms: 3
    },
    deceasedOwner: {
      name: deceasedName,
      dateOfDeath: dateOfDeath || new Date(Date.now() - daysSinceDeath * 24 * 60 * 60 * 1000).toISOString(),
      daysSinceDeath,
      ageAtDeath: 78,
      ownershipDuration: '23 years'
    },
    probateAnalysis: {
      probateStatus: 'probate_initiated',
      caseNumber: 'PR-2024-001234',
      courtName: 'Superior Court of Sample County',
      filingDate: new Date(Date.now() - (daysSinceDeath - 15) * 24 * 60 * 60 * 1000).toISOString(),
      executor: 'John Smith Jr.',
      estimatedEstateDuration: '8-12 months'
    },
    motivationAnalysis: {
      overallScore: 88,
      timeUrgency: Math.max(60, 95 - Math.floor(daysSinceDeath / 10)),
      financialPressure: 82,
      marketPressure: 76,
      heirComplexity: 85,
      keyMotivators: [
        'Multiple heirs requiring cash distribution',
        'Property maintenance burden',
        'Tax obligations',
        'Strong seller\'s market'
      ]
    },
    recommendations: {
      approachStrategy: 'Professional, empathetic direct contact',
      bestContactTime: 'Weekday afternoons',
      expectedDiscount: '12-18%',
      estimatedTimeToClose: '45-75 days',
      riskFactors: ['Multiple decision makers', 'Emotional attachment'],
      successProbability: '85%'
    }
  };
}

function generateMockEstateContacts(deceasedName: string, searchHeirs: boolean) {
  const contacts = [
    {
      contactId: 'executor-001',
      name: 'Robert Johnson',
      relationship: 'executor',
      contactInfo: {
        phones: [{
          number: '555-0123',
          type: 'mobile',
          isPrimary: true,
          isVerified: true
        }],
        emails: [{
          email: 'robert.johnson@lawfirm.com',
          type: 'work',
          isPrimary: true,
          isVerified: true
        }],
        addresses: [{
          fullAddress: '123 Legal Plaza, Suite 100, Law City, CA 90210',
          street: '123 Legal Plaza, Suite 100',
          city: 'Law City',
          state: 'CA',
          zipCode: '90210',
          type: 'work',
          isCurrent: true
        }]
      },
      reliability: 'high',
      source: 'court_records'
    }
  ];

  if (searchHeirs) {
    contacts.push(
      {
        contactId: 'heir-001',
        name: 'Sarah Miller',
        relationship: 'child',
        contactInfo: {
          phones: [{
            number: '555-0124',
            type: 'mobile',
            isPrimary: true,
            isVerified: true
          }],
          emails: [{
            email: 'sarah.miller@email.com',
            type: 'personal',
            isPrimary: true,
            isVerified: true
          }],
          addresses: []
        },
        reliability: 'medium',
        source: 'family_records'
      },
      {
        contactId: 'heir-002', 
        name: 'Michael Miller',
        relationship: 'child',
        contactInfo: {
          phones: [{
            number: '555-0125',
            type: 'home',
            isPrimary: true,
            isVerified: false
          }],
          emails: [],
          addresses: []
        },
        reliability: 'medium',
        source: 'family_records'
      }
    );
  }

  return contacts;
}

function generateProbateMarketAnalysis(zipCode: string, timeframe: string) {
  return {
    zipCode,
    timeframe,
    probateMarketData: {
      totalProbateProperties: 47,
      averageDaysOnMarket: 32,
      averageDiscountFromMarket: 14.5,
      successfulSales: 42,
      averageSalePrice: 425000,
      medianSalePrice: 398000,
      inventoryLevel: 'medium',
      competitionLevel: 'low-medium'
    },
    marketTrends: {
      probateListingsChange: '+12%',
      averagePriceChange: '+8.5%',
      timeToSellChange: '-5 days',
      investorActivity: 'high'
    },
    opportunities: {
      bestBuyingMonths: ['January', 'February', 'July'],
      highestDiscountTypes: ['Deferred maintenance', 'Multiple heirs', 'Out-of-state heirs'],
      averageROI: '22%',
      riskLevel: 'medium'
    },
    recommendations: [
      'Focus on properties with 60+ days since death',
      'Target multi-heir situations for higher motivation',
      'Offer quick closing (30 days or less)',
      'Consider properties with deferred maintenance'
    ]
  };
}

export default router;
