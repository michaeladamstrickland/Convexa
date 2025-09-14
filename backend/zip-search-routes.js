import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from './src/utils/logger';
import { aiService } from './src/services/aiService';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to normalize addresses for comparison
const normalizeAddress = (address) => {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
};

// Get temperature tag based on motivation score
const getTemperatureTag = (motivationScore) => {
  if (motivationScore <= 25) return 'dead';
  if (motivationScore <= 50) return 'warm';
  if (motivationScore <= 75) return 'hot';
  return 'on_fire';
};

// Search leads by single zip code
router.post('/search-zip', async (req, res) => {
  try {
    const { zipCode } = req.body;
    
    if (!zipCode) {
      return res.status(400).json({ error: 'Zip code is required' });
    }

    // Search leads by zip code in address
    const leads = await prisma.lead.findMany({
      where: {
        address: {
          contains: zipCode
        }
      },
      orderBy: [
        { lead_score: 'desc' },
        { estimated_value: 'desc' }
      ]
    });
    
    logger.info(`Zip search: Found ${leads.length} leads in ${zipCode}`);
    
    // Format the lead response
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      motivationScore: lead.motivation_score,
      temperatureTag: lead.temperature_tag,
      status: lead.status,
      source: lead.source_type,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));
    
    res.json({
      success: true,
      zipCode,
      leadCount: leads.length,
      leads: formattedLeads,
      message: `Found ${leads.length} leads in zip code ${zipCode}`
    });
    
  } catch (error) {
    logger.error('Error searching zip code:', error);
    res.status(500).json({ error: 'Failed to search zip code' });
  }
});

// Search leads by multiple zip codes
router.post('/search-multiple-zips', async (req, res) => {
  try {
    const { zipCodes } = req.body;
    
    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return res.status(400).json({ error: 'Zip codes array is required' });
    }

    // Create OR conditions for each zip code
    const whereConditions = zipCodes.map(zip => ({
      address: { contains: zip }
    }));
    
    const leads = await prisma.lead.findMany({
      where: {
        OR: whereConditions
      },
      orderBy: [
        { lead_score: 'desc' },
        { estimated_value: 'desc' }
      ]
    });
    
    logger.info(`Multi-zip search: Found ${leads.length} leads across ${zipCodes.length} zip codes`);
    
    // Format the lead response
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      motivationScore: lead.motivation_score,
      temperatureTag: lead.temperature_tag,
      status: lead.status,
      source: lead.source_type,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));
    
    res.json({
      success: true,
      zipCodes,
      leadCount: leads.length,
      leads: formattedLeads,
      message: `Found ${leads.length} leads across ${zipCodes.length} zip codes`
    });
    
  } catch (error) {
    logger.error('Error searching multiple zip codes:', error);
    res.status(500).json({ error: 'Failed to search zip codes' });
  }
});

// Search entire target area (all Phoenix metro area)
router.post('/search-target-area', async (req, res) => {
  try {
    // Get all leads in the database
    const leads = await prisma.lead.findMany({
      orderBy: [
        { lead_score: 'desc' },
        { estimated_value: 'desc' }
      ]
    });
    
    logger.info(`Target area search: Found ${leads.length} total leads`);
    
    // Format the lead response
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      motivationScore: lead.motivation_score,
      temperatureTag: lead.temperature_tag,
      status: lead.status,
      source: lead.source_type,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));
    
    res.json({
      success: true,
      area: 'Phoenix Metro Area',
      leadCount: leads.length,
      leads: formattedLeads,
      message: `Found ${leads.length} leads in target area`
    });
    
  } catch (error) {
    logger.error('Error searching target area:', error);
    res.status(500).json({ error: 'Failed to search target area' });
  }
});

// Get zip code statistics
router.get('/zip-stats', async (req, res) => {
  try {
    // Get all leads to process zip code stats
    const leads = await prisma.lead.findMany({
      select: {
        address: true,
        estimated_value: true,
        lead_score: true,
        phone: true
      }
    });
    
    // Group leads by zip code (extract from address)
    const zipGroups = {};
    
    leads.forEach(lead => {
      const zipMatch = lead.address?.match(/\b(\d{5})\b/);
      if (zipMatch) {
        const zip = zipMatch[1];
        if (!zipGroups[zip]) {
          zipGroups[zip] = [];
        }
        zipGroups[zip].push(lead);
      }
    });
    
    // Calculate statistics for each zip code
    const stats = Object.entries(zipGroups).map(([zipCode, zipLeads]) => {
      const leadCount = zipLeads.length;
      const avgValue = zipLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0) / leadCount;
      const avgScore = zipLeads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / leadCount;
      const callableLeads = zipLeads.filter(lead => lead.phone && lead.phone.trim() !== '').length;
      const totalValue = zipLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
      
      // Determine city based on address patterns
      const cityCounts = {};
      zipLeads.forEach(lead => {
        let city = 'Other';
        if (lead.address?.includes('Phoenix')) city = 'Phoenix';
        else if (lead.address?.includes('Scottsdale')) city = 'Scottsdale';
        else if (lead.address?.includes('Tempe')) city = 'Tempe';
        else if (lead.address?.includes('Mesa')) city = 'Mesa';
        
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      });
      
      // Find the most common city
      let mostCommonCity = 'Unknown';
      let maxCount = 0;
      Object.entries(cityCounts).forEach(([city, count]) => {
        if (count > maxCount) {
          mostCommonCity = city;
          maxCount = count;
        }
      });
      
      return {
        zipCode,
        city: mostCommonCity,
        county: 'Maricopa',
        leadCount,
        avgValue: Math.round(avgValue || 0),
        avgScore: Math.round((avgScore || 0) * 10) / 10,
        callableLeads,
        totalValue: totalValue || 0
      };
    });
    
    // Sort by lead count descending
    stats.sort((a, b) => b.leadCount - a.leadCount);
    
    logger.info(`Generated zip stats for ${stats.length} zip codes`);
    
    res.json({
      success: true,
      stats,
      totalZipCodes: stats.length,
      message: `Statistics for ${stats.length} zip codes`
    });
    
  } catch (error) {
    logger.error('Error getting zip stats:', error);
    res.status(500).json({ error: 'Failed to get zip code statistics' });
  }
});

// Get lead details by ID
router.get('/lead/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Format the lead response
    const formattedLead = {
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source_type,
      motivationScore: lead.motivation_score,
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      conditionScore: lead.condition_score,
      taxDebt: lead.tax_debt,
      violations: lead.violations,
      isProbate: lead.is_probate,
      isVacant: lead.is_vacant,
      daysOnMarket: lead.days_on_market,
      leadScore: lead.lead_score,
      temperatureTag: lead.temperature_tag,
      status: lead.status,
      notes: lead.notes,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
    
    res.json({
      success: true,
      lead: formattedLead,
      message: 'Lead details retrieved'
    });
    
  } catch (error) {
    logger.error('Error getting lead details:', error);
    res.status(500).json({ error: 'Failed to get lead details' });
  }
});

// Update lead status
router.patch('/lead/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const updateData = {
      updated_at: new Date()
    };
    
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    
    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: updateData
      });
      
      logger.info(`Updated lead ${id} status to ${status}`);
      
      res.json({
        success: true,
        lead: {
          id: lead.id,
          status: lead.status,
          notes: lead.notes,
          updatedAt: lead.updated_at
        },
        message: 'Lead updated successfully'
      });
    } catch (updateError) {
      if (updateError.code === 'P2025') {
        return res.status(404).json({ error: 'Lead not found' });
      }
      throw updateError;
    }
    
  } catch (error) {
    logger.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get revenue analytics
router.get('/revenue-analytics', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany();
    
    // Calculate analytics
    const analytics = {
      totalLeads: leads.length,
      totalPropertyValue: leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
      avgPropertyValue: leads.length > 0 ? 
                       leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0) / leads.length : 0,
      avgLeadScore: leads.length > 0 ? 
                   leads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / leads.length : 0,
      callableLeads: leads.filter(lead => lead.phone && lead.phone.trim() !== '').length,
      hotLeads: leads.filter(lead => (lead.lead_score || 0) >= 80).length,
      warmLeads: leads.filter(lead => (lead.lead_score || 0) >= 60).length,
      probateLeads: leads.filter(lead => lead.is_probate).length,
      totalTaxDebt: leads.reduce((sum, lead) => sum + (lead.tax_debt || 0), 0),
      totalViolations: leads.reduce((sum, lead) => sum + (lead.violations || 0), 0)
    };
    
    // Calculate revenue potential
    const avgDealMargin = 0.15; // 15% margin
    const closingRate = 0.05; // 5% closing rate
    const avgAssignmentFee = 5000;
    
    const dealPotential = analytics.totalPropertyValue * avgDealMargin * closingRate;
    const assignmentPotential = analytics.callableLeads * avgAssignmentFee * closingRate;
    const totalRevenuePotential = dealPotential + assignmentPotential;
    
    const result = {
      ...analytics,
      dealPotential: Math.round(dealPotential),
      assignmentPotential: Math.round(assignmentPotential),
      totalRevenuePotential: Math.round(totalRevenuePotential),
      avgDealMargin,
      closingRate,
      avgAssignmentFee
    };
    
    logger.info(`Generated revenue analytics: $${Math.round(totalRevenuePotential)} potential`);
    
    res.json({
      success: true,
      analytics: result,
      message: 'Revenue analytics retrieved'
    });
    
  } catch (error) {
    logger.error('Error getting revenue analytics:', error);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
});

// Get contact script for a lead
router.get('/lead/:id/contact-script', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : 'there';
    const offerRange = {
      low: Math.round((lead.estimated_value || 0) * 0.75),
      high: Math.round((lead.estimated_value || 0) * 0.85)
    };
    
    // Try to generate an AI-based script if AI service is available
    try {
      const motivationFactors = [];
      if (lead.is_probate) motivationFactors.push('probate');
      if (lead.is_vacant) motivationFactors.push('vacant property');
      if (lead.tax_debt > 0) motivationFactors.push('tax debt');
      if (lead.violations > 0) motivationFactors.push('property violations');
      
      const scriptData = {
        ownerName: lead.owner_name,
        propertyAddress: lead.address,
        motivationFactors: motivationFactors,
        propertyType: 'Single Family', // Default assumption
        timeOnMarket: lead.days_on_market
      };
      
      const aiScript = await aiService.generateCallScript(scriptData);
      
      if (aiScript) {
        return res.json({
          success: true,
          lead: {
            id: lead.id,
            propertyAddress: lead.address,
            ownerName: lead.owner_name
          },
          script: aiScript,
          isAiGenerated: true,
          message: 'AI-generated contact script'
        });
      }
    } catch (aiError) {
      logger.warn('AI script generation failed, using template script', aiError);
      // Fall back to template script
    }
    
    // Fallback to template script
    const script = {
      opening: `Hi ${firstName}, I'm a local real estate investor. I help property owners in situations where they need to sell quickly. I believe you own the property at ${lead.address}?`,
      valueProposition: "I can close in 10-14 days, all cash, no inspections, no repairs needed, and handle all the paperwork.",
      followUp: "Would you be interested in hearing a no-obligation offer?",
      offerRange: `$${offerRange.low.toLocaleString()} - $${offerRange.high.toLocaleString()}`,
      objectionHandling: {
        needMoreMoney: "I understand. What would you need to get to make this work?",
        needMoreTime: "No problem. When would be a better time to consider this?",
        notInterested: "I completely understand. Can I leave my information in case your situation changes?"
      }
    };
    
    res.json({
      success: true,
      lead: {
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name
      },
      script,
      isAiGenerated: false,
      message: 'Contact script generated'
    });
    
  } catch (error) {
    logger.error('Error generating contact script:', error);
    res.status(500).json({ error: 'Failed to generate contact script' });
  }
});

// Add a new unified search endpoint
router.get('/search', async (req, res) => {
  try {
    const {
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      propertyType,
      source,
      temperature,
      limit = 50,
      page = 1
    } = req.query;
    
    const where = {};
    
    // Add filters based on query parameters
    if (query) {
      where.OR = [
        { address: { contains: query } },
        { owner_name: { contains: query } }
      ];
    }
    
    if (city) where.address = { contains: city };
    if (state && !where.address) where.address = { contains: state };
    else if (state) where.AND = [{ address: { contains: state } }];
    
    if (zipCode) where.address = { ...where.address, contains: zipCode };
    if (propertyType) where.source_type = { equals: propertyType };
    if (source) where.source_type = { equals: source };
    if (temperature) where.temperature_tag = { equals: temperature };
    
    if (minValue || maxValue) {
      where.estimated_value = {};
      if (minValue) where.estimated_value.gte = parseFloat(minValue);
      if (maxValue) where.estimated_value.lte = parseFloat(maxValue);
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get leads with pagination
    const leads = await prisma.lead.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' }
    });
    
    // Count total leads for pagination
    const totalLeads = await prisma.lead.count({ where });
    
    // Process leads for deduplication
    const seenAddresses = new Set();
    const deduplicatedLeads = leads.filter(lead => {
      const propertyAddress = lead.address || '';
      const normalized = normalizeAddress(propertyAddress);
      
      if (normalized && seenAddresses.has(normalized)) {
        return false;
      }
      
      if (normalized) {
        seenAddresses.add(normalized);
      }
      
      return true;
    });
    
    // Format response with temperature tags
    const formattedLeads = deduplicatedLeads.map(lead => {
      return {
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score,
        temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
        status: lead.status,
        source: lead.source_type,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at
      };
    });
    
    // Return results
    res.json({
      leads: formattedLeads,
      pagination: {
        total: totalLeads,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalLeads / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update temperature tag for a lead
router.post('/update-temperature/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { temperature } = req.body;
    
    if (!temperature) {
      return res.status(400).json({ error: 'Temperature tag is required' });
    }
    
    const lead = await prisma.lead.findUnique({ where: { id } });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Create analysis data for AI service
    const analysisData = {
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      listPrice: lead.estimated_value,
      equity: lead.equity || 0,
      equityPercent: lead.equity && lead.estimated_value ? 
                     (lead.equity / lead.estimated_value * 100) : undefined,
      isAbsenteeOwner: false, // This would need to be determined
      tags: [
        lead.is_probate ? 'probate' : '',
        lead.is_vacant ? 'vacant' : '',
        lead.tax_debt > 0 ? 'tax_delinquent' : '',
        lead.violations > 0 ? 'code_violations' : ''
      ].filter(Boolean)
    };
    
    // Get AI analysis
    const analysis = await aiService.analyzeLeadPotential(analysisData);
    
    // Update lead with analysis and temperature
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        motivation_score: analysis.motivationScore,
        lead_score: analysis.dealScore,
        temperature_tag: temperature,
        updated_at: new Date()
      }
    });
    
    res.json({
      success: true,
      lead: {
        id: updatedLead.id,
        temperatureTag: updatedLead.temperature_tag,
        motivationScore: updatedLead.motivation_score
      }
    });
  } catch (error) {
    logger.error('Error updating temperature tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update all leads without temperature tags
router.post('/update-all-temperatures', async (req, res) => {
  try {
    // Find leads with missing temperature tags
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { temperature_tag: null },
          { temperature_tag: '' },
          { temperature_tag: 'unknown' },
        ]
      }
    });
    
    logger.info(`Found ${leads.length} leads with missing temperature tags`);
    
    // Update each lead
    const updates = [];
    
    for (const lead of leads) {
      const temperatureTag = getTemperatureTag(lead.motivation_score || 0);
      
      updates.push(
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            temperature_tag: temperatureTag,
            updated_at: new Date()
          }
        })
      );
    }
    
    // Execute all updates
    const results = await Promise.all(updates);
    
    res.json({
      success: true,
      updated: results.length,
      message: `Updated ${results.length} leads with temperature tags`
    });
  } catch (error) {
    logger.error('Error updating all temperatures:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
