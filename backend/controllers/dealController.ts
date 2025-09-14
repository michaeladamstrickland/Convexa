import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DealAnalysis, Comparable, computeRoi, computeArvFromComps, mapAttomToDeal, mapCompsToComparables } from '../../shared/types/deal';
import { v4 as uuidv4 } from 'uuid';
import { fetchAttomPropertyData, fetchAttomComps } from '../services/attomService';
import { generatePdf } from '../services/pdfService';
import { logApiCost } from '../services/costTrackingService';
import { isFeatureEnabled } from '../config/featureFlags';

const prisma = new PrismaClient();

// Helper function to track ATTOM API calls
async function trackAttomApiCost(details: string, costEstimate: number = 0.02) {
  try {
    await logApiCost({
      apiType: 'ATTOM',
      cost: costEstimate,
      details
    });
  } catch (error) {
    console.error('Failed to log API cost:', error);
  }
}

// Get deal analysis for a lead, create one if it doesn't exist
export async function getDeal(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    
    // Validate leadId
    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }
    
    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Look for existing deal analysis
    let dealAnalysis = await prisma.dealAnalysis.findFirst({
      where: { lead_id: leadId }
    });
    
    // If no deal analysis exists, create a basic one
    if (!dealAnalysis) {
      // Initialize with default values based on lead data
      const initialDealAnalysis: DealAnalysis = {
        leadId,
        source: "Manual",
        temperature: lead.temperature_tag as any || "WARM",
        property: {
          address: lead.address,
          city: "",  // These would be parsed from the address
          state: "",
          zip: ""
        },
        purchase: {
          offerPrice: lead.estimated_value || 0,
          closingCostsPct: 0.02,
          holdingMonths: 3,
          rateAPR: 0.10,
          sellingCostsPct: 0.06
        },
        renovation: {
          budget: 0,
          lineItems: []
        },
        comps: [],
        results: {
          totalInvestment: 0,
          netProfit: 0,
          roiPct: 0,
          riskScore: 50,
          recommendation: "REVIEW"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Create a new deal analysis record
      dealAnalysis = await prisma.dealAnalysis.create({
        data: {
          id: uuidv4(),
          lead_id: leadId,
          analysis_json: JSON.stringify(initialDealAnalysis),
          recommendation: "REVIEW"
        }
      });
      
      return res.status(201).json(initialDealAnalysis);
    }
    
    // Parse and return existing deal analysis
    return res.json(JSON.parse(dealAnalysis.analysis_json));
  } catch (error) {
    console.error('Error getting deal:', error);
    return res.status(500).json({ error: 'Failed to get deal analysis' });
  }
}

// Create or update a deal analysis
export async function upsertDeal(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    const dealData: DealAnalysis = req.body;
    
    // Validate lead ID
    if (!leadId || leadId !== dealData.leadId) {
      return res.status(400).json({ error: 'Lead ID mismatch or missing' });
    }
    
    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Update timestamps
    dealData.updatedAt = new Date().toISOString();
    
    // Extract key metrics for denormalized storage
    const {
      property: { arv },
      renovation: { budget },
      results: { totalInvestment, netProfit, roiPct, riskScore, recommendation }
    } = dealData;
    
    // Look for existing deal analysis
    const existingDeal = await prisma.dealAnalysis.findFirst({
      where: { lead_id: leadId }
    });
    
    if (existingDeal) {
      // Update existing deal
      await prisma.dealAnalysis.update({
        where: { id: existingDeal.id },
        data: {
          analysis_json: JSON.stringify(dealData),
          arv,
          budget,
          total_investment: totalInvestment,
          net_profit: netProfit,
          roi_pct: roiPct,
          risk_score: riskScore,
          recommendation,
          updated_at: new Date()
        }
      });
    } else {
      // Create new deal
      await prisma.dealAnalysis.create({
        data: {
          id: uuidv4(),
          lead_id: leadId,
          analysis_json: JSON.stringify(dealData),
          arv,
          budget,
          total_investment: totalInvestment,
          net_profit: netProfit,
          roi_pct: roiPct,
          risk_score: riskScore,
          recommendation,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }
    
    // Also update lead temperature and status based on deal analysis
    if (recommendation === "PROCEED" && roiPct >= 0.15) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          temperature_tag: "HOT",
          status: "NEGOTIATING"
        }
      });
    }
    
    return res.json(dealData);
  } catch (error) {
    console.error('Error saving deal:', error);
    return res.status(500).json({ error: 'Failed to save deal analysis' });
  }
}

// Run a new analysis with the latest data
export async function runDeal(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    const userFeedback = req.body?.feedback;
    
    // Get existing deal or initialize
    let dealData: DealAnalysis;
    const existingDeal = await prisma.dealAnalysis.findFirst({
      where: { lead_id: leadId }
    });
    
    if (existingDeal) {
      dealData = JSON.parse(existingDeal.analysis_json);
    } else {
      // If no existing deal, get the lead and create a basic deal
      const lead = await prisma.lead.findUnique({
        where: { id: leadId }
      });
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      dealData = {
        leadId,
        source: "Manual",
        temperature: lead.temperature_tag as any || "WARM",
        property: {
          address: lead.address,
          city: "",
          state: "",
          zip: ""
        },
        purchase: {
          offerPrice: lead.estimated_value || 0,
          closingCostsPct: 0.02,
          holdingMonths: 3,
          rateAPR: 0.10,
          sellingCostsPct: 0.06
        },
        renovation: {
          budget: 0,
          lineItems: []
        },
        comps: [],
        results: {
          totalInvestment: 0,
          netProfit: 0,
          roiPct: 0,
          riskScore: 50,
          recommendation: "REVIEW"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // Initialize result status
    const result = {
      dealData,
      attomAvailable: false,
      compsFound: 0,
      errors: [] as string[]
    };
    
    // 1. Pull freshest property facts from ATTOM if enabled
    if (isFeatureEnabled('FEATURE_ATTOM_COMPS')) {
      try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }
        
        // Track the API call
        await trackAttomApiCost(`Property details for ${lead.address}`);
        
        // Parse address
        const { address } = lead;
        const attomData = await fetchAttomPropertyData(address);
        
        if (attomData) {
          // Map ATTOM data to our model
          const attomDeal = mapAttomToDeal(attomData, leadId);
          result.attomAvailable = true;
          
          // Update property details while preserving user edits
          dealData.property = {
            ...dealData.property,
            ...attomDeal.property,
            // Keep user-defined ARV if it exists
            arv: dealData.property.arv || attomDeal.property?.arv
          };
          
          dealData.source = "ATTOM";
        }
      } catch (error) {
        console.error('ATTOM property data error:', error);
        result.errors.push('Failed to fetch property details from ATTOM');
      }
    }
    
    // 2. Fetch comps from ATTOM if enabled
    if (isFeatureEnabled('FEATURE_ATTOM_COMPS') && dealData.property.address) {
      try {
        // Track the API call
        await trackAttomApiCost(`Comps for ${dealData.property.address}`);
        
        // Format address for ATTOM
        const addressParams = {
          line: dealData.property.address,
          city: dealData.property.city,
          state: dealData.property.state,
          zip: dealData.property.zip
        };
        
        // Fetch comps with filters
        const attomComps = await fetchAttomComps(addressParams, {
          radius: 1.0,                     // 1 mile radius
          monthsBack: 9,                   // Last 9 months
          bedsDelta: 1,                    // +/- 1 bed
          bathsDelta: 1,                   // +/- 1 bath
          sqftDeltaPct: 0.25,              // +/- 25% sqft
          excludeIds: userFeedback?.removedCompIds || []
        });
        
        if (attomComps && attomComps.length > 0) {
          // Map to our comparable model
          const mappedComps = mapCompsToComparables(attomComps);
          result.compsFound = mappedComps.length;
          
          // Apply the comp data
          dealData.comps = mappedComps;
        }
      } catch (error) {
        console.error('ATTOM comps error:', error);
        result.errors.push('Failed to fetch comparable sales from ATTOM');
      }
    }
    
    // 3. Compute ARV from comps or use user override
    if (dealData.comps.length > 0 && dealData.property.sqft) {
      // Use user-provided ARV if available in feedback
      if (userFeedback?.userArv) {
        dealData.property.arv = userFeedback.userArv;
      } else {
        // Calculate from comps
        const { arv, adjusted } = computeArvFromComps(dealData.property.sqft, dealData.comps);
        
        // Update the adjusted prices in our comps
        dealData.comps = adjusted;
        dealData.property.arv = arv;
      }
    }
    
    // 4. Use user-provided renovation budget if available
    if (userFeedback?.userBudget) {
      dealData.renovation.budget = userFeedback.userBudget;
    }
    
    // 5. Compute ROI based on current parameters
    if (dealData.property.arv && dealData.purchase.offerPrice) {
      const roi = computeRoi(
        dealData.property.arv,
        dealData.purchase.offerPrice,
        dealData.renovation.budget,
        dealData.purchase.closingCostsPct,
        dealData.purchase.sellingCostsPct,
        dealData.purchase.holdingMonths,
        dealData.purchase.rateAPR
      );
      
      // Update results
      dealData.results.totalInvestment = roi.totalInvestment;
      dealData.results.netProfit = roi.netProfit;
      dealData.results.roiPct = roi.roiPct;
      
      // 6. Compute risk score and recommendation
      let riskScore = 50; // Default medium risk
      
      // Adjust risk based on comps
      if (dealData.comps.length >= 5) {
        riskScore -= 10; // Less risk with more comps
      } else if (dealData.comps.length <= 2) {
        riskScore += 10; // More risk with fewer comps
      }
      
      // Adjust risk based on ROI
      if (roi.roiPct >= 0.25) {
        riskScore -= 15; // Excellent ROI reduces risk
      } else if (roi.roiPct <= 0.05) {
        riskScore += 15; // Poor ROI increases risk
      }
      
      // Cap risk score
      dealData.results.riskScore = Math.max(0, Math.min(100, riskScore));
      
      // Set recommendation based on ROI and risk
      if (roi.roiPct >= 0.15 && riskScore < 60) {
        dealData.results.recommendation = "PROCEED";
      } else if (roi.roiPct < 0.05 || riskScore > 75) {
        dealData.results.recommendation = "PASS";
      } else {
        dealData.results.recommendation = "REVIEW";
      }
    }
    
    // Update timestamps
    dealData.updatedAt = new Date().toISOString();
    
    // Save the updated deal analysis
    if (existingDeal) {
      await prisma.dealAnalysis.update({
        where: { id: existingDeal.id },
        data: {
          analysis_json: JSON.stringify(dealData),
          arv: dealData.property.arv,
          budget: dealData.renovation.budget,
          total_investment: dealData.results.totalInvestment,
          net_profit: dealData.results.netProfit,
          roi_pct: dealData.results.roiPct,
          risk_score: dealData.results.riskScore,
          recommendation: dealData.results.recommendation,
          updated_at: new Date()
        }
      });
    } else {
      await prisma.dealAnalysis.create({
        data: {
          id: uuidv4(),
          lead_id: leadId,
          analysis_json: JSON.stringify(dealData),
          arv: dealData.property.arv,
          budget: dealData.renovation.budget,
          total_investment: dealData.results.totalInvestment,
          net_profit: dealData.results.netProfit,
          roi_pct: dealData.results.roiPct,
          risk_score: dealData.results.riskScore,
          recommendation: dealData.results.recommendation,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }
    
    // Also update lead temperature and status based on deal analysis
    if (dealData.results.recommendation === "PROCEED" && dealData.results.roiPct >= 0.15) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          temperature_tag: "HOT",
          status: "NEGOTIATING"
        }
      });
    }
    
    // Return the deal data and result status
    return res.json({
      ...result,
      dealData
    });
  } catch (error) {
    console.error('Error running deal analysis:', error);
    return res.status(500).json({ error: 'Failed to run deal analysis' });
  }
}

// Get comparable properties by address
export async function getComps(req: Request, res: Response) {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Valid address is required' });
    }
    
    // Check if ATTOM API is enabled
    if (!isFeatureEnabled('FEATURE_ATTOM_COMPS')) {
      return res.status(503).json({ 
        error: 'Comparables API is currently disabled',
        mockData: true,
        comps: [] // Could return mock data here if needed
      });
    }
    
    // Track API call
    await trackAttomApiCost(`Standalone comps for ${address}`);
    
    // Parse address (simplified - in production would use a proper address parser)
    const addressParts = address.split(',').map(part => part.trim());
    const addressParams = {
      line: addressParts[0] || '',
      city: addressParts[1] || '',
      state: addressParts[2]?.split(' ')[0] || '',
      zip: addressParts[2]?.split(' ')[1] || ''
    };
    
    // Fetch comps
    const attomComps = await fetchAttomComps(addressParams, {
      radius: 1.0,
      monthsBack: 9,
      bedsDelta: 1,
      bathsDelta: 1,
      sqftDeltaPct: 0.25
    });
    
    // Map to our comparable model
    const comps = mapCompsToComparables(attomComps);
    
    return res.json({
      address,
      count: comps.length,
      comps
    });
  } catch (error) {
    console.error('Error fetching comps:', error);
    return res.status(500).json({ error: 'Failed to fetch comparable properties' });
  }
}

// Get property details by address
export async function getProperty(req: Request, res: Response) {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Valid address is required' });
    }
    
    // Check if ATTOM API is enabled
    if (!isFeatureEnabled('FEATURE_ATTOM_COMPS')) {
      return res.status(503).json({ 
        error: 'Property API is currently disabled',
        mockData: true,
        property: null // Could return mock data here if needed
      });
    }
    
    // Track API call
    await trackAttomApiCost(`Standalone property data for ${address}`);
    
    // Fetch property data
    const attomData = await fetchAttomPropertyData(address);
    
    if (!attomData) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Map to our property model
    const propertyData = mapAttomToDeal(attomData, '');
    
    return res.json({
      address,
      property: propertyData.property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    return res.status(500).json({ error: 'Failed to fetch property details' });
  }
}

// Export deal analysis to PDF/CSV
export async function exportDeal(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    const { format = 'pdf' } = req.query;
    
    // Get the deal analysis
    const dealAnalysis = await prisma.dealAnalysis.findFirst({
      where: { lead_id: leadId }
    });
    
    if (!dealAnalysis) {
      return res.status(404).json({ error: 'Deal analysis not found' });
    }
    
    const dealData: DealAnalysis = JSON.parse(dealAnalysis.analysis_json);
    
    // Generate PDF
    if (format === 'pdf') {
      const pdfBuffer = await generatePdf(dealData);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="deal-analysis-${leadId}.pdf"`);
      return res.send(pdfBuffer);
    } 
    
    // Generate CSV
    if (format === 'csv') {
      // Implement CSV export
      // Here we'd generate a CSV with key deal metrics
      const csvLines = [
        'Property,ARV,Purchase Price,Renovation Budget,Total Investment,Net Profit,ROI',
        `"${dealData.property.address}",${dealData.property.arv || 0},${dealData.purchase.offerPrice},${dealData.renovation.budget},${dealData.results.totalInvestment},${dealData.results.netProfit},${(dealData.results.roiPct * 100).toFixed(2)}%`
      ];
      
      const csvContent = csvLines.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="deal-analysis-${leadId}.csv"`);
      return res.send(csvContent);
    }
    
    return res.status(400).json({ error: 'Invalid export format. Use "pdf" or "csv".' });
  } catch (error) {
    console.error('Error exporting deal:', error);
    return res.status(500).json({ error: 'Failed to export deal analysis' });
  }
}
