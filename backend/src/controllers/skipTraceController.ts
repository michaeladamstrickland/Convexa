import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { skipTraceService, SkipTraceRequest, SkipTraceResult } from '../services/skipTraceService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Skip trace a lead and update the lead with the results
 */
export async function skipTraceLead(req: Request, res: Response) {
  const { leadId } = req.params;
  
  try {
    // Fetch the lead to get required information
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Prepare skip trace request
    const request: SkipTraceRequest = {
      fullName: lead.owner_name || '',
      address: lead.propertyAddress || '',
      city: '', // Extract from address if possible
      state: '', // Extract from address if possible
      zipCode: '', // Extract from address if possible
      phone: lead.phone || undefined,
      email: lead.email || undefined,
    };
    
    // Try to extract city, state, zip from address
    const addressParts = lead.propertyAddress.split(',');
    if (addressParts.length >= 2) {
      request.city = addressParts[1].trim();
      
      // Try to extract state and zip
      if (addressParts.length >= 3) {
        const stateZipMatch = addressParts[2].trim().match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
        if (stateZipMatch) {
          request.state = stateZipMatch[1];
          request.zipCode = stateZipMatch[2];
        }
      }
    }
    
    logger.info(`Running skip trace for lead ${leadId} with name: ${request.fullName}, address: ${request.address}`);
    
    // Run skip trace
    const result = await skipTraceService.runSkipTrace(leadId, request);
    
    if (result.success) {
      // Update lead with skip trace results
      const phones = result.data.phones?.map(p => p.number) || [];
      const emails = result.data.emails?.map(e => e.address) || [];
      
      // Update lead with new contact info
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          phone: phones.length > 0 ? phones[0] : lead.phone, // Primary phone
          email: emails.length > 0 ? emails[0] : lead.email, // Primary email
          phones: JSON.stringify(phones), // All phones
          emails: JSON.stringify(emails), // All emails
          skip_traced_at: new Date(),
        },
      });
      
      return res.json({
        success: true,
        message: 'Skip trace completed successfully',
        result,
        cost: result.cost,
      });
    } else {
      return res.json({
        success: false,
        message: 'Skip trace completed with no results',
        result,
      });
    }
  } catch (error) {
    logger.error(`Error skip-tracing lead ${leadId}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error running skip trace',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get skip trace history for a lead
 */
export async function getSkipTraceHistory(req: Request, res: Response) {
  const { leadId } = req.params;
  
  try {
    const history = await skipTraceService.getSkipTraceHistory(leadId);
    
    return res.json({
      success: true,
      history,
    });
  } catch (error) {
    logger.error(`Error getting skip trace history for lead ${leadId}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error getting skip trace history',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get skip trace cost estimate
 */
export async function getSkipTraceCostEstimate(req: Request, res: Response) {
  const { provider = 'batch_skip_tracing' } = req.query;
  
  try {
    const cost = skipTraceService.estimateCost(provider as any);
    
    return res.json({
      success: true,
      cost,
      provider,
    });
  } catch (error) {
    logger.error('Error getting skip trace cost estimate:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error getting cost estimate',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
