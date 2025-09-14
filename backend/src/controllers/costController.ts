import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { featureFlags } from '../config/featureFlags';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Get cost analytics for API usage and lead generation
 */
export const getCostAnalytics = async (req: Request, res: Response) => {
  try {
    if (!featureFlags.COST_TRACKING_ENABLED) {
      return res.status(404).json({ error: 'Cost tracking feature is not enabled' });
    }

    // Aggregate API costs by type
    const apiCosts = await prisma.$queryRaw`
      SELECT 
        api_type AS apiType,
        SUM(cost) AS totalCost,
        COUNT(*) AS callCount
      FROM api_cost_entries
      GROUP BY api_type
      ORDER BY totalCost DESC
    `;

    // Get lead acquisition costs
    const leadCosts = await prisma.$queryRaw`
      SELECT 
        lead_source AS leadSource,
        COUNT(*) AS leadCount,
        AVG(acquisition_cost) AS averageCost,
        SUM(acquisition_cost) AS totalCost
      FROM leads
      WHERE acquisition_cost IS NOT NULL
      GROUP BY lead_source
      ORDER BY totalCost DESC
    `;

    // Get cost per conversion metrics
    const conversionCosts = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) AS leadCount,
        SUM(acquisition_cost) AS totalCost,
        AVG(acquisition_cost) AS costPerLead
      FROM leads
      WHERE status IS NOT NULL AND acquisition_cost IS NOT NULL
      GROUP BY status
      ORDER BY status
    `;

    // Daily cost trends over the last 30 days
    const dailyCosts = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) AS date,
        SUM(cost) AS dailyCost,
        COUNT(*) AS apiCalls
      FROM api_cost_entries
      WHERE created_at >= datetime('now', '-30 day')
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    return res.status(200).json({
      apiCosts,
      leadCosts,
      conversionCosts,
      dailyCosts,
    });
  } catch (error: any) {
    console.error('Error getting cost analytics:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Track a new API cost entry
 */
export const trackApiCost = async (req: Request, res: Response) => {
  try {
    if (!featureFlags.COST_TRACKING_ENABLED) {
      return res.status(404).json({ error: 'Cost tracking feature is not enabled' });
    }

    const { apiType, cost, details } = req.body;

    if (!apiType || cost === undefined) {
      return res.status(400).json({ error: 'API type and cost are required' });
    }

    // Create entry using raw SQL since the table might not exist in Prisma schema yet
    // @ts-ignore - Ignore Prisma typing for raw queries
    await prisma.$executeRaw`
      INSERT INTO api_cost_entries (api_type, cost, details, created_at)
      VALUES (${apiType}, ${cost}, ${details || null}, datetime('now'))
    `;
    
    // Return the newly created entry
    const costEntry = {
      apiType,
      cost,
      details: details || null,
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json(costEntry);
  } catch (error: any) {
    console.error('Error tracking API cost:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get cost summary with total spending and breakdown
 */
export const getCostSummary = async (req: Request, res: Response) => {
  try {
    if (!featureFlags.COST_TRACKING_ENABLED) {
      return res.status(404).json({ error: 'Cost tracking feature is not enabled' });
    }

    // Get date range filters
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    
    if (startDate && endDate) {
      dateFilter = `WHERE created_at BETWEEN '${startDate}' AND '${endDate}'`;
    } else if (startDate) {
      dateFilter = `WHERE created_at >= '${startDate}'`;
    } else if (endDate) {
      dateFilter = `WHERE created_at <= '${endDate}'`;
    }

    // Total API costs
    // @ts-ignore - Ignore Prisma typing for raw queries
    const apiCostResult = await prisma.$queryRaw`
      SELECT SUM(cost) AS totalApiCost 
      FROM api_cost_entries
      ${dateFilter}
    `;
    const totalApiCost = (apiCostResult as any[])[0]?.totalApiCost || 0;

    // Total lead acquisition costs
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leadCostResult = await prisma.$queryRaw`
      SELECT SUM(acquisition_cost) AS totalLeadCost
      FROM leads
      WHERE acquisition_cost IS NOT NULL
      ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}
    `;
    const totalLeadCost = (leadCostResult as any[])[0]?.totalLeadCost || 0;

    return res.status(200).json({
      totalCost: totalApiCost + totalLeadCost,
      apiCosts: totalApiCost,
      leadCosts: totalLeadCost,
      period: {
        start: startDate || 'all time',
        end: endDate || 'present'
      }
    });
  } catch (error: any) {
    console.error('Error getting cost summary:', error);
    return res.status(500).json({ error: error.message });
  }
};
