import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { aiService } from '../services/aiService';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to normalize addresses for comparison
const normalizeAddress = (address: string | null): string => {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
};

// Get temperature tag based on motivation score
const getTemperatureTag = (motivationScore: number): string => {
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
    
    // Format the lead response for consistent API
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
      propertyAddress: { contains: zip }
    }));
    
    const leads = await prisma.lead.findMany({
      where: {
        OR: whereConditions
      },
      orderBy: [
        { aiScore: 'desc' },
        { marketValue: 'desc' }
      ]
    });
    
    logger.info(`Multi-zip search: Found ${leads.length} leads across ${zipCodes.length} zip codes`);
    
    res.json({
      success: true,
      zipCodes,
      leadCount: leads.length,
      leads,
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
        { aiScore: 'desc' },
        { marketValue: 'desc' }
      ]
    });
    
    logger.info(`Target area search: Found ${leads.length} total leads`);
    
    res.json({
      success: true,
      area: 'Phoenix Metro Area',
      leadCount: leads.length,
      leads,
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
        propertyAddress: true,
        marketValue: true,
        aiScore: true,
        ownerPhone: true
      }
    });
    
    // Group leads by zip code (extract from address)
    const zipGroups: Record<string, any[]> = {};
    
    leads.forEach(lead => {
      const zipMatch = lead.propertyAddress.match(/\b(\d{5})\b/);
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
      const avgValue = zipLeads.reduce((sum, lead) => sum + (lead.marketValue || 0), 0) / leadCount;
      const avgScore = zipLeads.reduce((sum, lead) => sum + (lead.aiScore || 0), 0) / leadCount;
      const callableLeads = zipLeads.filter(lead => lead.ownerPhone && lead.ownerPhone.trim() !== '').length;
      const totalValue = zipLeads.reduce((sum, lead) => sum + (lead.marketValue || 0), 0);
      
      // Determine city based on common Arizona zip code ranges
      let city = 'Other';
      const zip = parseInt(zipCode);
      if (zip >= 85001 && zip <= 85099) city = 'Phoenix';
      else if (zip >= 85250 && zip <= 85266) city = 'Scottsdale';
      else if (zip >= 85281 && zip <= 85287) city = 'Tempe';
      else if (zip >= 85201 && zip <= 85215) city = 'Mesa';
      
      return {
        zipCode,
        city,
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
    
    res.json({
      success: true,
      lead,
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
    
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    
    const lead = await prisma.lead.update({
      where: { id },
      data: updateData
    });
    
    logger.info(`Updated lead ${id} status to ${status}`);
    
    res.json({
      success: true,
      lead,
      message: 'Lead updated successfully'
    });
    
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    logger.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get revenue analytics
router.get('/revenue-analytics', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      select: {
        marketValue: true,
        aiScore: true,
        ownerPhone: true,
        tags: true
      }
    });
    
    const analytics = {
      totalLeads: leads.length,
      totalPropertyValue: leads.reduce((sum, lead) => sum + (lead.marketValue || 0), 0),
      avgPropertyValue: leads.length > 0 ? leads.reduce((sum, lead) => sum + (lead.marketValue || 0), 0) / leads.length : 0,
      avgLeadScore: leads.length > 0 ? leads.reduce((sum, lead) => sum + (lead.aiScore || 0), 0) / leads.length : 0,
      callableLeads: leads.filter(lead => lead.ownerPhone && lead.ownerPhone.trim() !== '').length,
      hotLeads: leads.filter(lead => (lead.aiScore || 0) >= 80).length,
      warmLeads: leads.filter(lead => (lead.aiScore || 0) >= 60).length,
      probateLeads: leads.filter(lead => lead.tags.includes('probate')).length,
      totalTaxDebt: 0, // Not available in current schema
      totalViolations: 0 // Not available in current schema
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
    
    const firstName = lead.ownerName ? lead.ownerName.split(' ')[0] : 'there';
    const offerRange = {
      low: Math.round((lead.marketValue || 0) * 0.75),
      high: Math.round((lead.marketValue || 0) * 0.85)
    };
    
    const script = {
      opening: `Hi ${firstName}, I'm a local real estate investor. I help property owners in situations where they need to sell quickly. I believe you own the property at ${lead.propertyAddress}?`,
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
      lead,
      script,
      message: 'Contact script generated'
    });
    
  } catch (error) {
    logger.error('Error generating contact script:', error);
    res.status(500).json({ error: 'Failed to generate contact script' });
  }
});

export default router;
