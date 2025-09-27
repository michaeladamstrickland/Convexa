import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import attomClient from '../services/attomClient';
import batchSkipTraceService from '../services/batchSkipTraceService';
import { normalizeAddress } from '../utils/addressNormalization';

const prisma = new PrismaClient();

/**
 * Unified Search Controller
 * 
 * This controller integrates multiple data sources (ATTOM and BatchData)
 * to provide a comprehensive property search and lead generation system.
 */
export class UnifiedSearchController {
  
  /**
   * Search for a property by address
   * 
   * @param req Express request
   * @param res Express response
   */
  async searchByAddress(req: Request, res: Response) {
    try {
      const { address, city, state, zipCode, skipTrace } = req.body;
      
      if (!address || !city || !state || !zipCode) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: address, city, state, zipCode'
        });
      }
      
      // Normalize the address for deduplication
      const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
      const normalizedAddress = normalizeAddress(fullAddress);
      
      // Check if property already exists in our database
      let lead = await prisma.lead.findFirst({
        where: {
          address: normalizedAddress
        }
      });
      
      let propertyFound = false;
      let skipTracePerformed = false;
      let totalCostCents = 0;
      
      // If we don't have the property, search ATTOM API
      if (!lead) {
        const propertyData = await attomClient.getPropertyByAddress(address, city, state, zipCode);
        
        if (propertyData) {
          propertyFound = true;
          totalCostCents += 5; // ATTOM lookup cost
          
          // Save the property to our database
          lead = await prisma.lead.create({
            data: {
              source: 'attom:property-detail',
              address: propertyData.propertyAddress,
              source_type: 'attom',
              status: 'NEW'
            }
          });
        }
      } else {
        propertyFound = true;
      }
      
      // Skip trace the property if requested and we have a lead
      if (skipTrace === true && lead) {
        // Check if we already have skip trace data
        const needsSkipTrace = !lead.phone;
        
        if (needsSkipTrace) {
          const skipTraceResult = await batchSkipTraceService.skipTraceByAddress({
            address,
            city,
            state,
            zipCode
          });
          
          if (skipTraceResult.success) {
            skipTracePerformed = true;
            totalCostCents += skipTraceResult.cost;
            
            // Update the lead with skip trace data
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                owner_name: skipTraceResult.ownerName,
                phone: skipTraceResult.ownerPhone,
                email: skipTraceResult.ownerEmail,
                phones: skipTraceResult.phonesJson || "[]",
                emails: skipTraceResult.emailsJson || "[]",
                dnc_flag: skipTraceResult.dncFlag ? 1 : 0,
                skip_trace_provider: 'batchdata',
                skip_trace_cost_cents: skipTraceResult.cost,
                skip_traced_at: new Date()
              }
            });
            
            // Get the updated lead
            lead = await prisma.lead.findUnique({
              where: { id: lead.id }
            });
          }
        } else {
          skipTracePerformed = true;
        }
      }
      
      return res.json({
        success: true,
        propertyFound,
        skipTracePerformed,
        costCents: totalCostCents,
        lead
      });
    } catch (error) {
      console.error('Error searching by address:', error);
      return res.status(500).json({
        success: false,
        message: 'Error searching for property',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * Search for properties by ZIP code
   * 
   * @param req Express request
   * @param res Express response
   */
  async searchByZipCode(req: Request, res: Response) {
    try {
      const { zipCode, limit = 10, skipTrace } = req.body;
      
      if (!zipCode) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: zipCode'
        });
      }
      
      // Search ATTOM API for properties in this ZIP code
      const properties = await attomClient.getPropertiesByZipCode(zipCode, limit);
      const totalCostCents = 5; // ZIP code search cost
      
      // Save the properties to our database
      const leads = [];
      
      for (const property of properties) {
        // Normalize the address
        const fullAddress = `${property.propertyAddress}, ${property.city}, ${property.state} ${property.zipCode}`;
        const normalizedAddress = normalizeAddress(fullAddress);
        
        // Check if property already exists in our database
        let existingLead = await prisma.lead.findFirst({
          where: {
            address: normalizedAddress
          }
        });
        
        // Save the property if it doesn't exist
        if (!existingLead) {
          existingLead = await prisma.lead.create({
            data: {
              source: 'attom:zip-search',
              address: normalizedAddress,
              source_type: 'api',
              estimated_value: property.estimatedValue || undefined,
              equity: property.equity || undefined
            }
          });
        }
        
        leads.push(existingLead);
      }
      
      // Skip trace properties if requested
      if (skipTrace === true && leads.length > 0) {
        // Skip trace up to 10 properties to manage costs
        const leadsToSkipTrace = leads.slice(0, 10).filter(lead => !lead.phone);
        
        if (leadsToSkipTrace.length > 0) {
          const skipTraceRequests = leadsToSkipTrace.map(lead => ({
            address: lead.address,
            city: '', // City info not stored separately in our schema
            state: '',
            zipCode: ''
          }));
          
          const skipTraceResults = await batchSkipTraceService.batchSkipTrace(skipTraceRequests);
          
          // Update leads with skip trace data
          for (let i = 0; i < leadsToSkipTrace.length; i++) {
            const lead = leadsToSkipTrace[i];
            const result = skipTraceResults[i];
            
            if (result.success) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  owner_name: result.ownerName,
                  phone: result.ownerPhone,
                  email: result.ownerEmail,
                  phones: result.phonesJson || '[]',
                  emails: result.emailsJson || '[]',
                  dnc_flag: result.dncFlag ? 1 : 0,
                  skip_trace_provider: 'batchdata',
                  skip_trace_cost_cents: result.cost || 0,
                  skip_traced_at: new Date()
                }
              });
            }
          }
        }
      }
      
      // Get fresh data after updates
      const updatedLeads = await prisma.lead.findMany({
        where: {
          id: { in: leads.map(lead => lead.id) }
        }
      });
      
      return res.json({
        success: true,
        leads: updatedLeads,
        count: updatedLeads.length,
        costCents: totalCostCents,
        skipTracePerformed: skipTrace === true
      });
    } catch (error) {
      console.error('Error searching by ZIP code:', error);
      return res.status(500).json({
        success: false,
        message: 'Error searching for properties by ZIP code',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * Get skip trace information for an existing lead
   * 
   * @param req Express request
   * @param res Express response
   */
  async skipTraceLead(req: Request, res: Response) {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: leadId'
        });
      }
      
      // Get the lead
      const lead = await prisma.lead.findUnique({
        where: { id: leadId }
      });
      
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }
      
      // Check if we already have skip trace data
      const needsSkipTrace = !lead.phone;
      
      if (!needsSkipTrace) {
        return res.json({
          success: true,
          message: 'Lead already has skip trace data',
          lead
        });
      }
      
      // Skip trace the lead
      const skipTraceResult = await batchSkipTraceService.skipTraceByAddress({
        address: lead.address,
        city: '', // City info not stored separately
        state: '',
        zipCode: ''
      });
      
      if (!skipTraceResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Skip trace failed',
          costCents: skipTraceResult.cost
        });
      }
      
      // Update the lead with skip trace data
      const updatedLead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          owner_name: skipTraceResult.ownerName,
          phone: skipTraceResult.ownerPhone,
          email: skipTraceResult.ownerEmail,
          phones: skipTraceResult.phonesJson || '[]',
          emails: skipTraceResult.emailsJson || '[]',
          dnc_flag: skipTraceResult.dncFlag ? 1 : 0,
          skip_trace_provider: 'batchdata',
          skip_trace_cost_cents: skipTraceResult.cost || 0,
          skip_traced_at: new Date()
        }
      });
      
      return res.json({
        success: true,
        lead: updatedLead,
        costCents: skipTraceResult.cost
      });
    } catch (error) {
      console.error('Error skip tracing lead:', error);
      return res.status(500).json({
        success: false,
        message: 'Error skip tracing lead',
        error: (error as Error).message
      });
    }
  }
}

export default new UnifiedSearchController();
