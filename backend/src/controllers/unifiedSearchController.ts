/**
 * Unified Search Controller
 * 
 * Handles search requests from various data sources including ATTOM API
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { attomClient } from '../services/attomClient';
import { normalizeAddress, createDedupeKey } from '../utils/addressNormalization';

const prisma = new PrismaClient();

/**
 * Unified search endpoint
 * Supports multiple data sources including ATTOM API
 */
export async function unifiedSearch(req: Request, res: Response) {
  try {
    // Generate correlation ID for request tracking
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    console.log(`Search request ${correlationId} started`);
    
    // Get search parameters
    const { 
      city, 
      state, 
      zip, 
      county, 
      page = 1, 
      pageSize = 10,
      source
    } = req.method === 'POST' ? req.body : req.query;
    
    // Validate parameters
    if (!source) {
      return res.status(400).json({ 
        success: false, 
        message: 'Source parameter is required' 
      });
    }
    
    // Convert to numeric values
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    
    let leads = [];
    let sourceMeta = {};
    let totalCount = 0;
    
    // Use ATTOM API if requested and enabled
    if (source === 'attom' && process.env.ATTOM_API_KEY) {
      const results = await searchAttom({
        city: city as string,
        state: state as string,
        zip: zip as string,
        county: county as string,
        page: pageNum,
        pageSize: pageSizeNum,
        correlationId: correlationId as string
      });
      
      leads = results.leads;
      totalCount = results.totalCount;
      sourceMeta = results.meta;
    } 
    // Use database search for other sources
    else {
      const results = await searchDatabase({
        city: city as string,
        state: state as string,
        zip: zip as string,
        page: pageNum,
        pageSize: pageSizeNum
      });
      
      leads = results.leads;
      totalCount = results.totalCount;
      sourceMeta = { provider: 'database', cached: false };
    }
    
    console.log(`Search request ${correlationId} completed: ${leads.length} results found`);
    
    // Return results
    return res.status(200).json({
      success: true,
      leads,
      pagination: {
        total: totalCount,
        page: pageNum,
        pageSize: pageSizeNum,
        pages: Math.ceil(totalCount / pageSizeNum)
      },
      sourceMeta
    });
  } catch (error: any) {
    console.error('Error in unified search:', error);
    
    // Handle rate limit exceeded
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Daily API cap exceeded. Please try again tomorrow.'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred during search',
      error: error.message
    });
  }
}

/**
 * Search using ATTOM API
 */
async function searchAttom(params: any) {
  const { city, state, zip, county, page, pageSize, correlationId } = params;
  
  console.log(`ATTOM search with correlationId ${correlationId}`);
  
  // Get properties from ATTOM API
  const startTime = Date.now();
  const properties = await attomClient.getPropertiesByGeo({
    city,
    state,
    zip,
    county,
    page,
    pageSize
  });
  const apiDuration = Date.now() - startTime;
  
  // Get current cost information
  const costInfo = attomClient.getDailySpend();
  
  // Process and save properties
  const leads = await saveAttomProperties(properties);
  
  return {
    leads,
    totalCount: leads.length, // This would ideally come from the API's count
    meta: {
      provider: 'attom',
      cached: false, // This would be true if from cache
      costCents: costInfo.cents,
      durationMs: apiDuration
    }
  };
}

/**
 * Save ATTOM properties to database and return as leads
 */
async function saveAttomProperties(properties: any[]) {
  const leads = [];
  
  for (const property of properties) {
    // Create dedupe key
    const address = property.address;
    const normalizedAddr = address.normalizedAddress;
    const ownerName = property.owner.name;
    const dedupeKey = createDedupeKey(normalizedAddr, ownerName);
    
    // Check for existing lead
    let lead = await prisma.lead.findFirst({
      where: {
        normalizedAddress: normalizedAddr,
        ownerName: ownerName
      }
    });
    
    // Create or update lead
    if (lead) {
      // Update existing lead
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          estimatedValue: property.estValue || lead.estimatedValue,
          equity: property.equityPct || lead.equity,
          source: property.source || lead.source,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new lead
      lead = await prisma.lead.create({
        data: {
          propertyAddress: address.line1,
          city: address.city,
          state: address.state,
          zipCode: address.zip,
          normalizedAddress: normalizedAddr,
          ownerName: property.owner.name,
          estimatedValue: property.estValue || 0,
          equity: property.equityPct || 0,
          source: property.source || 'attom:property-detail',
          temperatureTag: 'WARM', // Default temperature
          status: 'NEW', // Default status
          aiScore: 50, // Default AI score
          isProbate: false,
          isVacant: false,
        }
      });
    }
    
    leads.push(lead);
  }
  
  return leads;
}

/**
 * Search database for leads
 */
async function searchDatabase(params: any) {
  const { city, state, zip, page, pageSize } = params;
  
  // Build where clause
  const where: any = {};
  
  if (city) {
    where.city = {
      contains: city,
      mode: 'insensitive'
    };
  }
  
  if (state) {
    where.state = state.toUpperCase();
  }
  
  if (zip) {
    where.zipCode = zip;
  }
  
  // Get total count
  const totalCount = await prisma.lead.count({ where });
  
  // Get paginated results
  const leads = await prisma.lead.findMany({
    where,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  return {
    leads,
    totalCount
  };
}

/**
 * Skip trace a lead
 */
export async function skipTraceLead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: `Lead not found with id: ${id}`
      });
    }
    
    // Check if BatchData is configured
    if (!process.env.BATCHDATA_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Skip tracing is not configured'
      });
    }
    
    // Import dynamically to avoid circular dependencies
    const { batchSkipTraceService } = await import('../services/batchSkipTraceService');
    
    // Skip trace the lead
    const result = await batchSkipTraceService.skipTraceLead(id);
    
    return res.status(200).json({
      success: true,
      skipTrace: {
        phones: result.phones,
        emails: result.emails,
        provider: result.provider,
        costCents: result.costCents,
        tracedAt: new Date()
      }
    });
  } catch (error: any) {
    console.error('Error in skip trace:', error);
    
    // Handle rate limit exceeded
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Daily skip trace API cap exceeded. Please try again tomorrow.'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred during skip trace',
      error: error.message
    });
  }
}

/**
 * Get system status including API availability and caps
 */
export function getSystemStatus(req: Request, res: Response) {
  // Import cost tracking information if available
  let attomCost = { cents: 0, resetAt: new Date() };
  let batchCost = { cents: 0, resetAt: new Date() };
  
  try {
    const { attomClient } = require('../services/attomClient');
    attomCost = attomClient.getDailySpend();
  } catch (e) {
    // Ignore errors if service not available
  }
  
  try {
    const { batchSkipTraceService } = require('../services/batchSkipTraceService');
    batchCost = batchSkipTraceService.getDailySpend();
  } catch (e) {
    // Ignore errors if service not available
  }
  
  return res.status(200).json({
    success: true,
    status: 'operational',
    attomEnabled: !!process.env.ATTOM_API_KEY,
    skipTraceEnabled: !!process.env.BATCHDATA_API_KEY,
    caps: {
      attom: parseInt(process.env.DAILY_CAP_ATTOM_CENTS || '1500'),
      batch: parseInt(process.env.DAILY_CAP_BATCH_CENTS || '2000')
    },
    currentSpend: {
      attom: attomCost.cents,
      batch: batchCost.cents
    },
    resetAt: {
      attom: attomCost.resetAt,
      batch: batchCost.resetAt
    },
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '900')
  });
}

export default {
  unifiedSearch,
  skipTraceLead,
  getSystemStatus
};
