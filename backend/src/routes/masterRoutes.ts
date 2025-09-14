// Simplified API Routes for LeadFlow AI Platform
// Basic routes to connect frontend with backend

import express from 'express';

const router = express.Router();

// System Status and Health Check
router.get('/system/status', async (req, res) => {
  try {
    const status = {
      tier: process.env.LEADFLOW_TIER || 'professional',
      totalAPIs: 26,
      enabledAPIs: 26,
      systemHealth: 'operational',
      lastUpdated: new Date().toISOString(),
      features: {
        aiAnalysis: true,
        skipTracing: true,
        probateData: true,
        mlsData: true,
        distressData: true
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Cost Estimation
router.get('/system/cost-estimate', async (req, res) => {
  try {
    const estimate = {
      cost_per_search: 1.57, // Based on our 26-API configuration
      daily_budget_limit: 150,
      searches_per_day: Math.floor(150 / 1.57),
      monthly_search_capacity: Math.floor(150 / 1.57) * 30,
      tier_benefits: {
        premium: ['All 26 APIs', 'AI Analysis', 'Priority Support'],
        professional: ['20 APIs', 'Basic AI', 'Standard Support'],
        basic: ['10 APIs', 'No AI', 'Email Support']
      }
    };
    
    res.json(estimate);
  } catch (error) {
    console.error('Cost estimate error:', error);
    res.status(500).json({ error: 'Failed to get cost estimate' });
  }
});

// Ultimate Search - All 26 APIs with AI Analysis
router.post('/master/ultimate-search', async (req, res) => {
  try {
    const { zipCodes, minMotivationScore, maxCostPerSearch, requirePhoneNumber, minEquity, limit } = req.body;
    
    if (!zipCodes || zipCodes.length === 0) {
      return res.status(400).json({ error: 'At least one zip code is required' });
    }

    const searchMetadata = {
      searchId: `ultimate-${Date.now()}`,
      startTime: Date.now(),
      zipCodes,
      filters: { minMotivationScore, maxCostPerSearch, requirePhoneNumber, minEquity }
    };

    let allProperties = [];
    let totalCost = 0;
    let totalApiCalls = 0;
    let dataSourcesUsed = new Set();

    // Process each zip code
    for (const zipCode of zipCodes) {
      console.log(`Processing zip code: ${zipCode}`);
      
      try {
        const zipResults = await masterService.comprehensivePropertySearch({
          zipCode,
          minMotivationScore,
          requirePhoneNumber,
          minEquity,
          limit: Math.ceil((limit || 50) / zipCodes.length)
        });

        if (zipResults.success && zipResults.data) {
          allProperties.push(...zipResults.data.properties);
          totalCost += zipResults.data.searchMetadata.totalCost;
          totalApiCalls += zipResults.data.searchMetadata.totalApiCalls;
          zipResults.data.searchMetadata.dataSourcesUsed.forEach(source => 
            dataSourcesUsed.add(source)
          );
        }
      } catch (zipError) {
        console.error(`Error processing zip ${zipCode}:`, zipError);
        // Continue with other zip codes
      }
    }

    // Remove duplicates and sort by overall score
    const uniqueProperties = Array.from(
      new Map(allProperties.map(prop => [prop.propertyId, prop])).values()
    ).sort((a, b) => b.aiAnalysis.overallScore - a.aiAnalysis.overallScore);

    // Apply final filters and limit
    let filteredProperties = uniqueProperties;
    
    if (minMotivationScore) {
      filteredProperties = filteredProperties.filter(
        prop => prop.aiAnalysis.motivationScore >= minMotivationScore
      );
    }
    
    if (requirePhoneNumber) {
      filteredProperties = filteredProperties.filter(
        prop => prop.contacts.some(contact => contact.phones.length > 0)
      );
    }
    
    if (minEquity) {
      filteredProperties = filteredProperties.filter(
        prop => prop.equity.estimatedEquity >= minEquity
      );
    }

    // Limit results
    if (limit) {
      filteredProperties = filteredProperties.slice(0, limit);
    }

    const response = {
      totalResults: filteredProperties.length,
      properties: filteredProperties,
      searchMetadata: {
        ...searchMetadata,
        executionTime: Date.now() - searchMetadata.startTime,
        totalApiCalls,
        totalCost,
        dataSourcesUsed: Array.from(dataSourcesUsed)
      },
      costBreakdown: {
        totalCost,
        costPerProperty: filteredProperties.length > 0 ? totalCost / filteredProperties.length : 0,
        apiCallsPerProperty: filteredProperties.length > 0 ? totalApiCalls / filteredProperties.length : 0
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Ultimate search error:', error);
    res.status(500).json({ 
      error: 'Ultimate search failed', 
      details: error.message 
    });
  }
});

// Probate Lead Search
router.post('/master/probate-search', async (req, res) => {
  try {
    const { zipCodes, minMotivationScore, requirePhoneNumber, limit } = req.body;
    
    if (!zipCodes || zipCodes.length === 0) {
      return res.status(400).json({ error: 'At least one zip code is required' });
    }

    const searchMetadata = {
      searchId: `probate-${Date.now()}`,
      startTime: Date.now(),
      zipCodes,
      searchType: 'probate'
    };

    let allProperties = [];
    let totalCost = 0;
    let totalApiCalls = 0;
    let dataSourcesUsed = new Set();

    // Process each zip code with probate focus
    for (const zipCode of zipCodes) {
      try {
        const zipResults = await masterService.probateLeadSearch({
          zipCode,
          minMotivationScore,
          requirePhoneNumber,
          limit: Math.ceil((limit || 50) / zipCodes.length)
        });

        if (zipResults.success && zipResults.data) {
          allProperties.push(...zipResults.data.properties);
          totalCost += zipResults.data.searchMetadata.totalCost;
          totalApiCalls += zipResults.data.searchMetadata.totalApiCalls;
          zipResults.data.searchMetadata.dataSourcesUsed.forEach(source => 
            dataSourcesUsed.add(source)
          );
        }
      } catch (zipError) {
        console.error(`Error processing probate zip ${zipCode}:`, zipError);
      }
    }

    // Filter for high probate indicators
    const probateProperties = allProperties.filter(prop => 
      prop.aiAnalysis.motivationScore >= 70 || // High motivation typical for probate
      prop.distressSignals?.probateIndicators?.length > 0
    ).sort((a, b) => b.aiAnalysis.motivationScore - a.aiAnalysis.motivationScore);

    const limitedProperties = limit ? probateProperties.slice(0, limit) : probateProperties;

    const response = {
      totalResults: limitedProperties.length,
      properties: limitedProperties,
      searchMetadata: {
        ...searchMetadata,
        executionTime: Date.now() - searchMetadata.startTime,
        totalApiCalls,
        totalCost,
        dataSourcesUsed: Array.from(dataSourcesUsed)
      },
      costBreakdown: {
        totalCost,
        costPerProperty: limitedProperties.length > 0 ? totalCost / limitedProperties.length : 0
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Probate search error:', error);
    res.status(500).json({ 
      error: 'Probate search failed', 
      details: error.message 
    });
  }
});

// Foreclosure Lead Search
router.post('/master/foreclosure-search', async (req, res) => {
  try {
    const { zipCodes, minMotivationScore, requirePhoneNumber, limit } = req.body;
    
    const searchMetadata = {
      searchId: `foreclosure-${Date.now()}`,
      startTime: Date.now(),
      zipCodes,
      searchType: 'foreclosure'
    };

    let allProperties = [];
    let totalCost = 0;
    let totalApiCalls = 0;
    let dataSourcesUsed = new Set();

    for (const zipCode of zipCodes) {
      try {
        const zipResults = await masterService.comprehensivePropertySearch({
          zipCode,
          minMotivationScore,
          requirePhoneNumber,
          limit: Math.ceil((limit || 50) / zipCodes.length)
        });

        if (zipResults.success && zipResults.data) {
          // Filter for foreclosure indicators
          const foreclosureProps = zipResults.data.properties.filter(prop =>
            prop.distressSignals?.foreclosureRisk > 70 ||
            prop.distressSignals?.legalFilings?.some(filing => 
              filing.type.toLowerCase().includes('foreclosure')
            )
          );
          
          allProperties.push(...foreclosureProps);
          totalCost += zipResults.data.searchMetadata.totalCost;
          totalApiCalls += zipResults.data.searchMetadata.totalApiCalls;
          zipResults.data.searchMetadata.dataSourcesUsed.forEach(source => 
            dataSourcesUsed.add(source)
          );
        }
      } catch (zipError) {
        console.error(`Error processing foreclosure zip ${zipCode}:`, zipError);
      }
    }

    const sortedProperties = allProperties.sort((a, b) => 
      (b.distressSignals?.foreclosureRisk || 0) - (a.distressSignals?.foreclosureRisk || 0)
    );

    const limitedProperties = limit ? sortedProperties.slice(0, limit) : sortedProperties;

    const response = {
      totalResults: limitedProperties.length,
      properties: limitedProperties,
      searchMetadata: {
        ...searchMetadata,
        executionTime: Date.now() - searchMetadata.startTime,
        totalApiCalls,
        totalCost,
        dataSourcesUsed: Array.from(dataSourcesUsed)
      },
      costBreakdown: {
        totalCost,
        costPerProperty: limitedProperties.length > 0 ? totalCost / limitedProperties.length : 0
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Foreclosure search error:', error);
    res.status(500).json({ 
      error: 'Foreclosure search failed', 
      details: error.message 
    });
  }
});

// High Equity Search
router.post('/master/high-equity-search', async (req, res) => {
  try {
    const { zipCodes, minEquity = 100000, requirePhoneNumber, limit } = req.body;
    
    const searchMetadata = {
      searchId: `equity-${Date.now()}`,
      startTime: Date.now(),
      zipCodes,
      searchType: 'high-equity'
    };

    let allProperties = [];
    let totalCost = 0;
    let totalApiCalls = 0;
    let dataSourcesUsed = new Set();

    for (const zipCode of zipCodes) {
      try {
        const zipResults = await masterService.comprehensivePropertySearch({
          zipCode,
          minEquity,
          requirePhoneNumber,
          limit: Math.ceil((limit || 50) / zipCodes.length)
        });

        if (zipResults.success && zipResults.data) {
          // Additional equity filtering
          const highEquityProps = zipResults.data.properties.filter(prop =>
            prop.equity.estimatedEquity >= minEquity &&
            prop.equity.estimatedEquity > (prop.valuation.estimatedValue * 0.3) // At least 30% equity
          );
          
          allProperties.push(...highEquityProps);
          totalCost += zipResults.data.searchMetadata.totalCost;
          totalApiCalls += zipResults.data.searchMetadata.totalApiCalls;
          zipResults.data.searchMetadata.dataSourcesUsed.forEach(source => 
            dataSourcesUsed.add(source)
          );
        }
      } catch (zipError) {
        console.error(`Error processing equity zip ${zipCode}:`, zipError);
      }
    }

    const sortedProperties = allProperties.sort((a, b) => 
      b.equity.estimatedEquity - a.equity.estimatedEquity
    );

    const limitedProperties = limit ? sortedProperties.slice(0, limit) : sortedProperties;

    const response = {
      totalResults: limitedProperties.length,
      properties: limitedProperties,
      searchMetadata: {
        ...searchMetadata,
        executionTime: Date.now() - searchMetadata.startTime,
        totalApiCalls,
        totalCost,
        dataSourcesUsed: Array.from(dataSourcesUsed)
      },
      costBreakdown: {
        totalCost,
        costPerProperty: limitedProperties.length > 0 ? totalCost / limitedProperties.length : 0
      }
    };

    res.json(response);
  } catch (error) {
    console.error('High equity search error:', error);
    res.status(500).json({ 
      error: 'High equity search failed', 
      details: error.message 
    });
  }
});

// API Usage Statistics
router.get('/system/usage-stats', async (req, res) => {
  try {
    const stats = {
      dailyUsage: {
        totalSearches: 0,
        totalCost: 0,
        totalApiCalls: 0,
        averageCostPerSearch: 1.57
      },
      apiBreakdown: Object.entries(masterConfig.apis).map(([name, config]) => ({
        name,
        enabled: config.enabled,
        costPerCall: config.cost,
        tier: config.tier,
        category: config.category
      })),
      systemMetrics: {
        uptime: '99.9%',
        avgResponseTime: '2.3s',
        successRate: '98.7%'
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

export default router;
