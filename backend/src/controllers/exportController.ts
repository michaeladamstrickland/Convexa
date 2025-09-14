import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import { logger } from '../utils/logger';
import { featureFlags } from '../config/featureFlags';

const prisma = new PrismaClient();

/**
 * Export leads to CSV
 */
export async function exportLeadsToCSV(req: Request, res: Response) {
  // Check if export feature is enabled
  if (!featureFlags.EXPORT_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Export feature is not enabled',
      correlationId: req.correlationId
    });
  }

  try {
    // Get query filters
    const { status, temperature } = req.query;
    
    // Build where clause for filters
    const whereClause: any = {};
    
    if (status) {
      whereClause.status = status as string;
    }
    
    if (temperature) {
      whereClause.temperature_tag = temperature as string;
    }
    
    // Get all leads based on filters
    // @ts-ignore - Ignore Prisma typing for raw queries
    let query = `
      SELECT 
        id, address, owner_name, temperature_tag, 
        phone, email, phones, emails, status, 
        motivation_score, lead_score, aiScore, 
        equity, estimated_value, condition_score, 
        tax_debt, violations, is_probate, is_vacant,
        source_type, source, 
        created_at, updated_at, skip_traced_at
      FROM leads
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    if (temperature) {
      query += ` AND temperature_tag = ?`;
      params.push(temperature);
    }
    
    query += ` ORDER BY updated_at DESC`;
    
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leads = await prisma.$queryRawUnsafe(query, ...params);
    
    if (!leads || (leads as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leads found for export',
      });
    }
    
    // Process leads for CSV export
    const processedLeads = (leads as any[]).map(lead => {
      // Parse JSON fields
      let phones = [];
      let emails = [];
      
      try {
        if (lead.phones) {
          phones = JSON.parse(lead.phones);
        }
      } catch (e) {
        logger.error(`Error parsing phones for lead ${lead.id}:`, e);
      }
      
      try {
        if (lead.emails) {
          emails = JSON.parse(lead.emails);
        }
      } catch (e) {
        logger.error(`Error parsing emails for lead ${lead.id}:`, e);
      }
      
      // Format dates
      const createdAt = lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : '';
      const updatedAt = lead.updated_at ? new Date(lead.updated_at).toISOString().split('T')[0] : '';
      const skipTracedAt = lead.skip_traced_at ? new Date(lead.skip_traced_at).toISOString().split('T')[0] : '';
      
      // Return flattened lead object for CSV
      return {
        ID: lead.id,
        Address: lead.address,
        Owner_Name: lead.owner_name,
        Phone: lead.phone || (phones.length > 0 ? phones[0] : ''),
        Email: lead.email || (emails.length > 0 ? emails[0] : ''),
        All_Phones: phones.join(', '),
        All_Emails: emails.join(', '),
        Status: lead.status,
        Temperature: lead.temperature_tag,
        Motivation_Score: lead.motivation_score,
        Lead_Score: lead.lead_score,
        AI_Score: lead.aiScore,
        Equity: lead.equity ? `$${lead.equity.toLocaleString()}` : '',
        Estimated_Value: lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '',
        Condition_Score: lead.condition_score,
        Tax_Debt: lead.tax_debt ? `$${lead.tax_debt.toLocaleString()}` : '',
        Violations: lead.violations,
        Is_Probate: lead.is_probate ? 'Yes' : 'No',
        Is_Vacant: lead.is_vacant ? 'Yes' : 'No',
        Source_Type: lead.source_type,
        Source: lead.source,
        Created_Date: createdAt,
        Updated_Date: updatedAt,
        Skip_Traced_Date: skipTracedAt,
      };
    });
    
    // Convert to CSV
    const fields = [
      'ID', 'Address', 'Owner_Name', 'Phone', 'Email', 
      'All_Phones', 'All_Emails', 'Status', 'Temperature', 
      'Motivation_Score', 'Lead_Score', 'AI_Score',
      'Equity', 'Estimated_Value', 'Condition_Score',
      'Tax_Debt', 'Violations', 'Is_Probate', 'Is_Vacant',
      'Source_Type', 'Source',
      'Created_Date', 'Updated_Date', 'Skip_Traced_Date'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(processedLeads);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
    
    // Send CSV data
    return res.status(200).send(csv);
    
  } catch (error) {
    logger.error('Error exporting leads to CSV:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export leads',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });
  }
}
