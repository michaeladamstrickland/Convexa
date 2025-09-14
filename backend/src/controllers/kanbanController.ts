import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { featureFlags } from '../config/featureFlags';

const prisma = new PrismaClient();

// Lead statuses
const LEAD_STATUSES = ['NEW', 'CONTACTED', 'NEGOTIATING', 'UNDER_CONTRACT', 'CLOSED'];

// Simplified lead card for Kanban
interface LeadCard {
  id: string;
  address: string;
  owner_name: string | null;
  temperature_tag: string;
  ai_score: number | null;
  best_phone: string | null;
  best_email: string | null;
  last_activity_at: string | null;
  status: string;
}

// For user identification
interface User {
  id: string;
  [key: string]: any;
}

// Add user to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Get all leads organized by status for Kanban board
 */
export async function getKanbanBoard(req: Request, res: Response) {
  // Check if Kanban feature is enabled
  if (!featureFlags.KANBAN_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Kanban feature is not enabled',
      correlationId: req.correlationId
    });
  }
  
  try {
    // Get all leads - use raw query to avoid Prisma field mapping issues
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leads = await prisma.$queryRaw`
      SELECT 
        id, address, owner_name, temperature_tag, aiScore, 
        phone, email, phones, emails, status, 
        updated_at, activity_log_json
      FROM leads
      ORDER BY updated_at DESC
    `;
    
    // Organize leads by status
    const columns: Record<string, LeadCard[]> = {};
    
    // Initialize columns for all statuses
    LEAD_STATUSES.forEach(status => {
      columns[status] = [];
    });
    
    // Populate columns with leads
    for (const lead of leads as any[]) {
      const status = lead.status || 'NEW';
      
      // Parse phones and emails
      let phones: string[] = [];
      let emails: string[] = [];
      
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
      
      // Get last activity timestamp
      let lastActivityAt = new Date(lead.updated_at).toISOString();
      
      if (lead.activity_log_json) {
        try {
          const activities = JSON.parse(lead.activity_log_json);
          if (activities && activities.length > 0) {
            // Activities are sorted newest first
            lastActivityAt = activities[0].at || lastActivityAt;
          }
        } catch (e) {
          logger.error(`Error parsing activity log for lead ${lead.id}:`, e);
        }
      }
      
      // Create lead card
      const leadCard: LeadCard = {
        id: lead.id,
        address: lead.address || '',
        owner_name: lead.owner_name,
        temperature_tag: lead.temperature_tag || 'DEAD',
        ai_score: lead.aiScore,
        best_phone: lead.phone || (phones.length > 0 ? phones[0] : null),
        best_email: lead.email || (emails.length > 0 ? emails[0] : null),
        last_activity_at: lastActivityAt,
        status,
      };
      
      // Add lead to appropriate column
      if (columns[status]) {
        columns[status].push(leadCard);
      } else {
        columns['NEW'].push(leadCard);
      }
    }
    
    return res.json({
      success: true,
      columns,
    });
  } catch (error) {
    logger.error('Error fetching Kanban board:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Kanban board',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(req: Request, res: Response) {
  // Check if Kanban feature is enabled
  if (!featureFlags.KANBAN_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Kanban feature is not enabled',
      correlationId: req.correlationId
    });
  }
  
  const { id: leadId } = req.params;
  const { status } = req.body;
  
  // Validate status
  if (!status || !LEAD_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${LEAD_STATUSES.join(', ')}`,
      correlationId: req.correlationId,
    });
  }
  
  try {
    // Get current lead data using raw SQL to avoid Prisma field mapping issues
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leads = await prisma.$queryRaw`
      SELECT status, activity_log_json
      FROM leads
      WHERE id = ${leadId}
    `;
    
    if (!leads || leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
        correlationId: req.correlationId,
      });
    }
    
    const lead = leads[0] as any;
    
    // Skip if status hasn't changed
    if (lead.status === status) {
      return res.json({
        success: true,
        message: 'Status unchanged',
        correlationId: req.correlationId,
      });
    }
    
    // Create activity log entry
    const activityEntry = {
      type: 'status_change',
      from: lead.status,
      to: status,
      at: new Date().toISOString(),
      by: req.user?.id || 'system',
    };
    
    // Parse existing activity log
    let activities = [];
    try {
      if (lead.activity_log_json) {
        activities = JSON.parse(lead.activity_log_json);
      }
    } catch (e) {
      logger.error(`Error parsing activity log for lead ${leadId}:`, e);
    }
    
    // Add new activity to the beginning of the array
    activities.unshift(activityEntry);
    
    const activityLogStr = JSON.stringify(activities);
    
    // Update lead status and activity log using raw SQL
    // @ts-ignore - Ignore Prisma typing for raw queries
    await prisma.$executeRaw`
      UPDATE leads
      SET status = ${status}, activity_log_json = ${activityLogStr}
      WHERE id = ${leadId}
    `;
    
    // Get updated lead data
    // @ts-ignore - Ignore Prisma typing for raw queries
    const updatedLeads = await prisma.$queryRaw`
      SELECT 
        id, address, owner_name, temperature_tag, aiScore, 
        phone, email, phones, emails, status, updated_at
      FROM leads
      WHERE id = ${leadId}
    `;
    
    if (!updatedLeads || updatedLeads.length === 0) {
      throw new Error('Failed to retrieve updated lead data');
    }
    
    const updatedLead = updatedLeads[0] as any;
    
    // Parse phones and emails for response
    let phones: string[] = [];
    let emails: string[] = [];
    
    try {
      if (updatedLead.phones) {
        phones = JSON.parse(updatedLead.phones);
      }
    } catch (e) {
      logger.error(`Error parsing phones for lead ${leadId}:`, e);
    }
    
    try {
      if (updatedLead.emails) {
        emails = JSON.parse(updatedLead.emails);
      }
    } catch (e) {
      logger.error(`Error parsing emails for lead ${leadId}:`, e);
    }
    
    // Return lead card format
    const leadCard: LeadCard = {
      id: updatedLead.id,
      address: updatedLead.address || '',
      owner_name: updatedLead.owner_name,
      temperature_tag: updatedLead.temperature_tag || 'DEAD',
      ai_score: updatedLead.aiScore,
      best_phone: updatedLead.phone || (phones.length > 0 ? phones[0] : null),
      best_email: updatedLead.email || (emails.length > 0 ? emails[0] : null),
      last_activity_at: new Date(updatedLead.updated_at).toISOString(),
      status: updatedLead.status,
    };
    
    return res.json({
      success: true,
      message: 'Lead status updated',
      lead: leadCard,
    });
  } catch (error) {
    logger.error(`Error updating lead status for ${leadId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lead status',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });
  }
}

/**
 * Add a note to a lead
 */
export async function addLeadNote(req: Request, res: Response) {
  // Check if Kanban feature is enabled
  if (!featureFlags.KANBAN_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Kanban feature is not enabled',
      correlationId: req.correlationId
    });
  }
  
  const { id: leadId } = req.params;
  const { text } = req.body;
  
  // Validate note text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Note text is required',
      correlationId: req.correlationId,
    });
  }
  
  try {
    // Get current lead data using raw SQL
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leads = await prisma.$queryRaw`
      SELECT activity_log_json 
      FROM leads 
      WHERE id = ${leadId}
    `;
    
    if (!leads || (leads as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
        correlationId: req.correlationId,
      });
    }
    
    const lead = (leads as any[])[0];
    
    // Create activity log entry for the note
    const activityEntry = {
      type: 'note',
      text,
      at: new Date().toISOString(),
      by: req.user?.id || 'system',
    };
    
    // Parse existing activity log
    let activities = [];
    try {
      if (lead.activity_log_json) {
        activities = JSON.parse(lead.activity_log_json);
      }
    } catch (e) {
      logger.error(`Error parsing activity log for lead ${leadId}:`, e);
    }
    
    // Add new activity to the beginning of the array
    activities.unshift(activityEntry);
    
    const activityLogStr = JSON.stringify(activities);
    
    // Update lead with new activity log using raw SQL
    // @ts-ignore - Ignore Prisma typing for raw queries
    await prisma.$executeRaw`
      UPDATE leads 
      SET activity_log_json = ${activityLogStr} 
      WHERE id = ${leadId}
    `;
    
    return res.json({
      success: true,
      message: 'Note added to lead',
      activity: activityEntry,
    });
  } catch (error) {
    logger.error(`Error adding note to lead ${leadId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });
  }
}

/**
 * Get lead activity log
 */
export async function getLeadActivity(req: Request, res: Response) {
  // Check if Kanban feature is enabled
  if (!featureFlags.KANBAN_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Kanban feature is not enabled',
      correlationId: req.correlationId
    });
  }
  
  const { id: leadId } = req.params;
  
  try {
    // Get lead activity log using raw SQL
    // @ts-ignore - Ignore Prisma typing for raw queries
    const leads = await prisma.$queryRaw`
      SELECT activity_log_json
      FROM leads
      WHERE id = ${leadId}
    `;
    
    if (!leads || (leads as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
        correlationId: req.correlationId,
      });
    }
    
    const lead = (leads as any[])[0];
    
    // Parse activity log
    let activities = [];
    try {
      if (lead.activity_log_json) {
        activities = JSON.parse(lead.activity_log_json);
      }
    } catch (e) {
      logger.error(`Error parsing activity log for lead ${leadId}:`, e);
    }
    
    return res.json({
      success: true,
      activities,
    });
  } catch (error) {
    logger.error(`Error getting activity log for lead ${leadId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get activity log',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });
  }
}
