import express from 'express';
import SkipTraceService from '../services/skipTraceService.js';
import db from '../database.js';
import { logInfo, logError } from '../utils/logger.js';

const router = express.Router();

// Initialize skip trace service with database connection
const skipTraceService = new SkipTraceService(db);

// Get skip trace for a specific lead
router.get('/:leadId', async (req, res) => {
  try {
    const leadId = req.params.leadId;
    
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }
    
    // Check for compliance query param
    const checkCompliance = req.query.compliance === 'true';
    
    // Get skip trace data using the enhanced service
    const result = await skipTraceService.getSkipTraceResult(leadId, checkCompliance);
    
    if (!result.success) {
      return res.status(404).json({ 
        success: false, 
        message: 'No skip trace data found for this lead',
        error: result.error 
      });
    }
    
    res.json(result);
  } catch (error) {
    logError(`Error getting skip trace data: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get skip trace data', error: error.message });
  }
});

// Run skip trace for a single lead
router.post('/', async (req, res) => {
  try {
    const { leadId, forceRefresh, provider, useFallback, fallbackProvider } = req.body;
    
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'Lead ID is required' });
    }
    
    // Check for lead existence before proceeding
    const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Use the enhanced skip trace service
    const result = await skipTraceService.skipTraceLeadById(leadId, {
      forceRefresh: forceRefresh === true,
      provider: provider || undefined,
      useFallback: useFallback === undefined ? true : useFallback,
      fallbackProvider: fallbackProvider || undefined
    });
    
    // Handle successful skip trace
    if (result.success) {
      // Get primary phone and email if available
      const primaryPhone = result.phones.find(p => p.isPrimary)?.number || 
                          (result.phones.length > 0 ? result.phones[0].number : null);
                          
      const primaryEmail = result.emails.find(e => e.isPrimary)?.address || 
                           (result.emails.length > 0 ? result.emails[0].address : null);
      
      // Update the lead with primary contact info (for backwards compatibility)
      if (primaryPhone || primaryEmail) {
        await db.prepare(`
          UPDATE leads SET 
            owner_phone = ?, 
            owner_email = ?,
            has_skip_trace = 1,
            updated_at = ?
          WHERE id = ?
        `).run(
          primaryPhone,
          primaryEmail,
          new Date().toISOString(),
          leadId
        );
      }
      
      logInfo(`Skip trace completed for lead ID: ${leadId}`);
    }
    
    res.json(result);
  } catch (error) {
    logError(`Error running skip trace: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to run skip trace', 
      error: error.message 
    });
  }
});

// Run bulk skip trace for multiple leads
router.post('/bulk', async (req, res) => {
  try {
    const { leadIds, forceRefresh, provider, useFallback, fallbackProvider } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead IDs array is required' 
      });
    }
    
    // Check remaining daily quota
    const quotaInfo = skipTraceService.getRemainingQuota(provider || undefined);
    if (quotaInfo.remaining < leadIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient daily quota. Remaining: ${quotaInfo.remaining}, Requested: ${leadIds.length}`,
        quotaInfo 
      });
    }
    
    // Use the enhanced bulk skip trace service
    const results = await skipTraceService.bulkSkipTraceLeads(leadIds, {
      forceRefresh: forceRefresh === true,
      provider: provider || undefined,
      useFallback: useFallback === undefined ? true : useFallback,
      fallbackProvider: fallbackProvider || undefined
    });
    
    // Update lead records with primary contact info (for backwards compatibility)
    for (const result of results) {
      if (result.success) {
        // Get primary phone and email if available
        const primaryPhone = result.phones.find(p => p.isPrimary)?.number || 
                             (result.phones.length > 0 ? result.phones[0].number : null);
                             
        const primaryEmail = result.emails.find(e => e.isPrimary)?.address || 
                             (result.emails.length > 0 ? result.emails[0].address : null);
        
        if (primaryPhone || primaryEmail) {
          await db.prepare(`
            UPDATE leads SET 
              owner_phone = ?, 
              owner_email = ?,
              has_skip_trace = 1,
              updated_at = ?
            WHERE id = ?
          `).run(
            primaryPhone,
            primaryEmail,
            new Date().toISOString(),
            result.leadId
          );
        }
      }
    }
    
    logInfo(`Bulk skip trace completed for ${results.filter(r => r.success).length} out of ${leadIds.length} leads`);
    res.json(results);
  } catch (error) {
    logError(`Error running bulk skip trace: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to run bulk skip trace', 
      error: error.message 
    });
  }
});

// Skip trace a property directly (without creating a lead first)
router.post('/property', async (req, res) => {
  try {
    const {
      attomId,
      ownerName,
      address,
      city,
      state,
      zipCode
    } = req.body;
    
    if (!ownerName && !address) {
      return res.status(400).json({
        success: false,
        message: 'Owner name or address is required'
      });
    }
    
    // Create a temporary lead object for skip tracing
    const tempLeadId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fullAddress = `${address}, ${city || ''}, ${state || ''} ${zipCode || ''}`.trim();
    
    // Check quota first
    const quotaInfo = skipTraceService.getRemainingQuota();
    if (quotaInfo.remaining <= 0) {
      return res.status(429).json({ 
        success: false, 
        message: 'Daily skip trace quota exceeded',
        quotaInfo 
      });
    }
    
    // Check if we already have skip trace data for this ATTOM ID
    let existingData = null;
    if (attomId) {
      existingData = await db.prepare(`
        SELECT * FROM skip_trace_results 
        WHERE property_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(attomId);
    }
    
    if (existingData) {
      // Parse phone and email data
      const phones = JSON.parse(existingData.phones_data || '[]');
      const emails = JSON.parse(existingData.emails_data || '[]');
      
      return res.json({
        success: true,
        message: 'Skip trace data retrieved from cache',
        phones,
        emails,
        cost: existingData.cost,
        cached: true,
        provider: existingData.provider
      });
    }
    
    // Perform the skip trace using the service
    const result = await skipTraceService.skipTraceProperty({
      id: tempLeadId,
      address: fullAddress,
      owner_name: ownerName,
      attomId: attomId,
      isPropertySearch: true
    });
    
    if (result.success) {
      // Store the result with the ATTOM ID for future reference
      if (attomId) {
        await db.prepare(`
          INSERT OR IGNORE INTO skip_trace_results 
          (property_id, phones_data, emails_data, provider, cost, created_at) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          attomId,
          JSON.stringify(result.phones),
          JSON.stringify(result.emails),
          result.provider,
          result.cost,
          new Date().toISOString()
        );
      }
    }
    
    res.json({
      success: result.success,
      message: result.success ? 'Skip trace completed successfully' : 'Skip trace failed',
      data: {
        phones: result.phones,
        emails: result.emails,
        cost: result.cost,
        provider: result.provider
      },
      error: result.error
    });
  } catch (error) {
    logError(`Error skip tracing property: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to skip trace property', 
      error: error.message 
    });
  }
});

// Get skip trace analytics and stats
router.get('/analytics/stats', async (req, res) => {
  try {
    // Get date range from query params or default to this month
    const today = new Date();
    const startDate = req.query.startDate || 
      new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = req.query.endDate || 
      new Date().toISOString().split('T')[0];
      
    // Get provider from query params
    const provider = req.query.provider || null;
    
    // Get total skip traces with phones/emails
    const phonesCount = db.prepare(`
      SELECT COUNT(*) as count FROM phone_numbers
    `).get()?.count || 0;
    
    const emailsCount = db.prepare(`
      SELECT COUNT(*) as count FROM email_addresses
    `).get()?.count || 0;
    
    // Count distinct leads with phone or email
    const leadsWithContactsCount = db.prepare(`
      SELECT COUNT(DISTINCT lead_id) as count FROM (
        SELECT lead_id FROM phone_numbers
        UNION
        SELECT lead_id FROM email_addresses
      )
    `).get()?.count || 0;
    
    // Get cost data from the enhanced service
    const costData = skipTraceService.getSkipTraceCost(startDate, endDate, provider);
    
    // Get daily cost breakdown
    const costByDay = skipTraceService.getSkipTraceCostByDay(startDate, endDate, provider);
    
    // Get provider stats
    const providerStats = skipTraceService.getSkipTraceStatsByProvider(startDate, endDate);
    
    // Get remaining quota for today
    const quotaInfo = skipTraceService.getRemainingQuota(provider);
    
    res.json({
      totalLeadsWithContacts: leadsWithContactsCount,
      phonesFound: phonesCount,
      emailsFound: emailsCount,
      totalCost: costData.cost || 0,
      lookupCount: costData.count || 0,
      dailyQuota: quotaInfo,
      costByDay,
      providerStats
    });
  } catch (error) {
    logError(`Error getting skip trace stats: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get skip trace statistics', 
      error: error.message 
    });
  }
});

// Check DNC compliance for a phone number
router.get('/compliance/check/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    const result = await skipTraceService.checkDNCCompliance(phoneNumber);
    res.json(result);
  } catch (error) {
    logError(`Error checking DNC compliance: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check DNC compliance', 
      error: error.message 
    });
  }
});

// Log a contact attempt
router.post('/contact-attempt', async (req, res) => {
  try {
    const { 
      leadId, 
      contactType, 
      contactInfo,
      userId,
      notes,
      overrideReason
    } = req.body;
    
    if (!leadId || !contactType || !contactInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead ID, contact type, and contact info are required' 
      });
    }
    
    // Validate contact type
    if (!['CALL', 'TEXT', 'EMAIL'].includes(contactType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Contact type must be CALL, TEXT, or EMAIL' 
      });
    }
    
    const result = skipTraceService.logContactAttempt(
      leadId,
      contactType,
      contactInfo,
      userId,
      notes,
      overrideReason
    );
    
    res.json(result);
  } catch (error) {
    logError(`Error logging contact attempt: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to log contact attempt', 
      error: error.message 
    });
  }
});

// Force refresh skip trace data
router.post('/refresh/:leadId', async (req, res) => {
  try {
    const leadId = req.params.leadId;
    
    if (!leadId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead ID is required' 
      });
    }
    
    const result = skipTraceService.markLeadForRefresh(leadId);
    res.json(result);
  } catch (error) {
    logError(`Error marking lead for refresh: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark lead for refresh', 
      error: error.message 
    });
  }
});

export default router;
