import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { skipTraceService } from '../services/skipTraceService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Skip trace multiple leads in bulk
 */
export async function bulkSkipTrace(req: Request, res: Response) {
  const { leadIds, respectQuietHours = true } = req.body;
  
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: leadIds must be a non-empty array'
    });
  }
  
  // Limit batch size for performance
  const MAX_BATCH_SIZE = 100;
  if (leadIds.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      success: false,
      message: `Batch size too large. Maximum allowed: ${MAX_BATCH_SIZE}`
    });
  }
  
  try {
    // Fetch all leads in bulk
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds }
      }
    });
    
    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching leads found'
      });
    }
    
    // Process each lead
    const results = [];
    let totalCost = 0;
    let successCount = 0;
    let noHitCount = 0;
    let errorCount = 0;
    
    for (const lead of leads) {
      try {
        // Prepare skip trace request
        const request = {
          fullName: lead.owner_name || '',
          address: lead.propertyAddress || '',
          city: '', 
          state: '', 
          zipCode: '',
          phone: lead.phone || undefined,
          email: lead.email || undefined,
        };
        
        // Try to extract city, state, zip from address
        const addressParts = lead.propertyAddress?.split(',') || [];
        if (addressParts.length >= 2) {
          request.city = addressParts[1].trim();
          
          if (addressParts.length >= 3) {
            const stateZipMatch = addressParts[2].trim().match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
            if (stateZipMatch) {
              request.state = stateZipMatch[1];
              request.zipCode = stateZipMatch[2];
            }
          }
        }
        
        // Run skip trace
        const result = await skipTraceService.runSkipTrace(lead.id, request);
        
        // Determine status
        let status = 'error';
        let matches = 0;
        
        if (result.success) {
          const phones = result.data.phones?.length || 0;
          const emails = result.data.emails?.length || 0;
          matches = phones + emails;
          
          if (matches > 0) {
            status = 'success';
            successCount++;
            
            // Update lead with new contact info
            const phoneNumbers = result.data.phones?.map(p => p.number) || [];
            const emailAddresses = result.data.emails?.map(e => e.address) || [];
            
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                phone: phoneNumbers.length > 0 ? phoneNumbers[0] : lead.phone,
                email: emailAddresses.length > 0 ? emailAddresses[0] : lead.email,
                phones: JSON.stringify(phoneNumbers),
                emails: JSON.stringify(emailAddresses),
                skip_traced_at: new Date(),
              },
            });
          } else {
            status = 'no_hit';
            noHitCount++;
          }
        } else {
          status = 'error';
          errorCount++;
        }
        
        totalCost += result.cost;
        
        // Add to results
        results.push({
          leadId: lead.id,
          status,
          matches,
          cost: result.cost
        });
      } catch (error) {
        logger.error(`Error processing lead ${lead.id} in bulk skip trace:`, error);
        
        results.push({
          leadId: lead.id,
          status: 'error',
          matches: 0,
          cost: 0
        });
        
        errorCount++;
      }
    }
    
    // Return bulk results
    return res.json({
      success: true,
      summary: {
        requested: leadIds.length,
        processed: leads.length,
        hits: successCount,
        noHits: noHitCount,
        errors: errorCount,
        cost: totalCost
      },
      results
    });
    
  } catch (error) {
    logger.error('Error processing bulk skip trace:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing bulk skip trace',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get metrics for skip tracing activity
 */
export async function getSkipTraceMetrics(req: Request, res: Response) {
  const { range = '30d' } = req.query;
  
  try {
    let dateFilter: any;
    
    // Parse date range
    switch (range) {
      case '7d':
        dateFilter = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case 'year':
        dateFilter = { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default:
        dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
    
    // Get all skip trace records in range
    const skipTraceRecords = await prisma.skipTraceRecord.findMany({
      where: {
        completedAt: dateFilter
      },
      orderBy: {
        completedAt: 'desc'
      }
    });
    
    // Calculate metrics
    const totalTraces = skipTraceRecords.length;
    const successfulTraces = skipTraceRecords.filter(r => r.status === 'completed').length;
    const totalCost = skipTraceRecords.reduce((sum, record) => sum + record.cost, 0);
    
    // Calculate hit rate
    const hitRate = totalTraces > 0 ? successfulTraces / totalTraces : 0;
    
    // Calculate cost per contact lead
    const cpcl = successfulTraces > 0 ? totalCost / successfulTraces : 0;
    
    // Group by provider
    const providers = [...new Set(skipTraceRecords.map(r => r.provider))];
    const providerStats = providers.map(provider => {
      const records = skipTraceRecords.filter(r => r.provider === provider);
      const providerSuccessful = records.filter(r => r.status === 'completed').length;
      const providerCost = records.reduce((sum, record) => sum + record.cost, 0);
      
      return {
        name: provider,
        traces: records.length,
        hitRate: records.length > 0 ? providerSuccessful / records.length : 0,
        avgCost: providerSuccessful > 0 ? providerCost / providerSuccessful : 0
      };
    });
    
    return res.json({
      success: true,
      traces: totalTraces,
      hitRate,
      cost: totalCost,
      cpcl,
      byProvider: providerStats
    });
    
  } catch (error) {
    logger.error('Error getting skip trace metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting skip trace metrics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
