/**
 * Skip Trace Service
 * 
 * This service coordinates skip tracing operations, including caching,
 * quota management, and database persistence of contact information.
 * It provides support for multiple providers, advanced error handling,
 * and compliance features.
 */

import batchDataAdapter from './batchDataAdapter.js';
import whitePagesAdapter from './whitePagesAdapter.js';
import DNCService from './dncService.js';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneUtils.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Configuration
const SKIP_TRACE_CACHE_DAYS = parseInt(process.env.SKIP_TRACE_CACHE_DAYS || '7', 10);
const DAILY_QUOTA = parseInt(process.env.SKIP_TRACE_DAILY_QUOTA || '100', 10);
const MAX_RETRIES = parseInt(process.env.SKIP_TRACE_MAX_RETRIES || '2', 10);
const FALLBACK_ENABLED = process.env.SKIP_TRACE_FALLBACK_ENABLED === 'true';
const PRIMARY_PROVIDER = process.env.SKIP_TRACE_PRIMARY_PROVIDER || 'batchdata';
const RETRY_DELAY_MS = parseInt(process.env.SKIP_TRACE_RETRY_DELAY_MS || '2000', 10);

// Provider mapping
const providers = {
  batchdata: batchDataAdapter,
  whitepages: whitePagesAdapter
};

/**
 * Skip Trace Service
 */
class SkipTraceService {
  /**
   * Constructor
   * @param db - SQLite database instance
   */
  constructor(db) {
    this.db = db;
    this.dncService = new DNCService(db);
    this.initDatabase();
    this.retryMap = new Map(); // Track retry attempts
  }

  /**
   * Initialize database tables if they don't exist
   */
  initDatabase() {
    // Create or update tables using the new schema
    // Ensure all new fields and tables are available
    
    // Execute the schema update SQL
    try {
      // Check if phone_numbers table exists, if not apply full schema
      const tableCheck = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='phone_numbers'"
      ).get();
      
      if (!tableCheck) {
        // Get current file's directory using ES modules pattern
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // Apply schema update from file
        const schemaPath = path.join(__dirname, '../db/skip_trace_schema_update.sql');
        
        if (fs.existsSync(schemaPath)) {
          const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
          this.db.exec(schemaSQL);
          console.log('Applied full skip trace schema update');
        } else {
          // Fallback to basic tables if schema file not found
          this.createBasicTables();
        }
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      // Fallback to basic tables
      this.createBasicTables();
    }
  }
  
  /**
   * Create basic tables for skip tracing if schema update fails
   */
  createBasicTables() {
    // Create skip trace results table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skip_trace_results (
        lead_id TEXT PRIMARY KEY,
        phones TEXT,
        emails TEXT,
        provider TEXT,
        cost REAL,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    // Create provider calls table for auditing and cost tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS provider_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT,
        provider TEXT,
        request_id TEXT,
        cost REAL,
        duration_ms INTEGER,
        status TEXT,
        error_message TEXT,
        created_at TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads (id)
      )
    `);
    
    // Create phone_numbers table for normalized storage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phone_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        phone_type TEXT,
        is_primary BOOLEAN DEFAULT 0,
        is_dnc BOOLEAN DEFAULT 0,
        confidence INTEGER DEFAULT 0,
        source TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(lead_id, phone_number, source)
      )
    `);
    
    // Create email_addresses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        email_address TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT 0,
        confidence INTEGER DEFAULT 0,
        source TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(lead_id, email_address, source)
      )
    `);
  }

  /**
   * Check if we've reached the daily quota
   * @param provider - The provider to check quota for (optional)
   * @returns Boolean indicating if quota is reached
   */
  async checkDailyQuota(provider = null) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Check if we have a provider_quota_usage record
      if (provider) {
        const quotaRecord = this.db.prepare(`
          SELECT used, quota FROM provider_quota_usage 
          WHERE provider = ? AND date = ?
        `).get(provider, today);
        
        if (quotaRecord) {
          return quotaRecord.used >= quotaRecord.quota;
        }
      }
      
      // Fall back to counting provider_calls
      const todayStart = `${today}T00:00:00.000Z`;
      const todayEnd = `${today}T23:59:59.999Z`;
      
      const query = provider 
        ? `SELECT COUNT(*) as count FROM provider_calls 
           WHERE created_at BETWEEN ? AND ? AND provider = ?`
        : `SELECT COUNT(*) as count FROM provider_calls 
           WHERE created_at BETWEEN ? AND ?`;
           
      const params = provider 
        ? [todayStart, todayEnd, provider]
        : [todayStart, todayEnd];
        
      const result = this.db.prepare(query).get(...params);
      return result.count >= DAILY_QUOTA;
    } catch (error) {
      console.error('Error checking daily quota:', error);
      // Default to false to allow operation to proceed
      return false;
    }
  }
  
  /**
   * Update the quota usage for a provider
   * @param provider - The provider name
   * @param increment - The number to increment by
   */
  updateQuotaUsage(provider, increment = 1) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    try {
      // Check if we have a record for today
      const existingRecord = this.db.prepare(`
        SELECT used, quota FROM provider_quota_usage 
        WHERE provider = ? AND date = ?
      `).get(provider, today);
      
      if (existingRecord) {
        // Update existing record
        this.db.prepare(`
          UPDATE provider_quota_usage 
          SET used = used + ?, updated_at = ?
          WHERE provider = ? AND date = ?
        `).run(increment, now, provider, today);
      } else {
        // Create new record
        this.db.prepare(`
          INSERT INTO provider_quota_usage (
            provider, date, used, quota, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(provider, today, increment, DAILY_QUOTA, now, now);
      }
    } catch (error) {
      console.error('Error updating quota usage:', error);
    }
  }

  /**
   * Check if we have cached skip trace results for this lead
   * @param leadId - The lead ID to check
   * @returns Cached skip trace result or null
   */
  getCachedResult(leadId) {
    try {
      // Calculate date for cache expiration
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - SKIP_TRACE_CACHE_DAYS);
      const cacheDateStr = cacheDate.toISOString();

      // Check if this lead has force_refresh_needed flag
      const leadCheck = this.db.prepare(`
        SELECT force_refresh_needed 
        FROM leads 
        WHERE id = ? AND force_refresh_needed = 1
      `).get(leadId);
      
      if (leadCheck) {
        // Lead needs refresh, don't use cache
        return null;
      }
      
      // Check skip_trace_cache_until field
      const leadCacheCheck = this.db.prepare(`
        SELECT skip_trace_cache_until
        FROM leads
        WHERE id = ? AND skip_trace_cache_until > ?
      `).get(leadId, new Date().toISOString());
      
      if (!leadCacheCheck) {
        // Cache expired or not set
        return null;
      }

      // Get normalized phone numbers and emails
      const phones = this.db.prepare(`
        SELECT 
          phone_number as number, 
          phone_type as type, 
          is_primary as isPrimary, 
          is_dnc as isDoNotCall,
          confidence
        FROM phone_numbers
        WHERE lead_id = ?
        ORDER BY is_primary DESC, confidence DESC
      `).all(leadId);
      
      const emails = this.db.prepare(`
        SELECT 
          email_address as address, 
          is_primary as isPrimary, 
          confidence
        FROM email_addresses
        WHERE lead_id = ?
        ORDER BY is_primary DESC, confidence DESC
      `).all(leadId);
      
      // If we have normalized data, use it
      if (phones.length > 0 || emails.length > 0) {
        // Format the data
        const formattedPhones = phones.map(p => ({
          ...p,
          isPrimary: p.isPrimary === 1,
          isDoNotCall: p.isDoNotCall === 1
        }));
        
        const formattedEmails = emails.map(e => ({
          ...e,
          isPrimary: e.isPrimary === 1,
          type: 'unknown'
        }));
        
        return {
          success: true,
          leadId,
          phones: formattedPhones,
          emails: formattedEmails,
          cost: 0, // No cost for cached results
          provider: 'cache',
          cached: true
        };
      }

      // Fall back to legacy cache
      const result = this.db.prepare(`
        SELECT 
          lead_id, 
          phones, 
          emails, 
          provider, 
          cost, 
          updated_at 
        FROM skip_trace_results 
        WHERE lead_id = ? AND updated_at > ?
      `).get(leadId, cacheDateStr);

      if (result) {
        // Return cached result
        return {
          success: true,
          leadId: result.lead_id,
          phones: JSON.parse(result.phones),
          emails: JSON.parse(result.emails),
          cost: result.cost,
          provider: result.provider,
          cached: true
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting cached result:', error);
      return null;
    }
  }

  /**
   * Log a provider API call
   * @param leadId - The lead ID
   * @param provider - The provider name
   * @param requestId - The provider request ID
   * @param cost - The cost of the call
   * @param durationMs - The duration of the call in milliseconds
   * @param status - The status of the call
   * @param errorMessage - Any error message
   * @returns The ID of the log entry
   */
  logProviderCall(
    leadId,
    provider,
    requestId,
    cost,
    durationMs,
    status,
    errorMessage
  ) {
    try {
      const now = new Date().toISOString();

      const result = this.db.prepare(`
        INSERT INTO provider_calls (
          lead_id, provider, request_id, cost, duration_ms, 
          status, error_message, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId,
        provider,
        requestId || null,
        cost,
        durationMs,
        status,
        errorMessage || null,
        now
      );
      
      // Update provider quota
      if (status === 'success' && cost > 0) {
        this.updateQuotaUsage(provider);
      }
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error logging provider call:', error);
      return null;
    }
  }
  
  /**
   * Log a skip trace operation to the audit log
   * @param leadId - The lead ID
   * @param provider - The provider used
   * @param success - Whether the skip trace was successful
   * @param cost - The cost of the skip trace
   * @param phonesFound - Number of phones found
   * @param emailsFound - Number of emails found
   * @param cached - Whether result was from cache
   * @param error - Any error message
   * @param requestPayload - The request payload (optional)
   * @param responseData - The response data (optional)
   */
  logSkipTrace(
    leadId,
    provider,
    success,
    cost,
    phonesFound,
    emailsFound,
    cached,
    error = null,
    requestPayload = null,
    responseData = null
  ) {
    try {
      const now = new Date().toISOString();
      
      this.db.prepare(`
        INSERT INTO skip_trace_logs (
          lead_id, provider, success, cost, phones_found, 
          emails_found, cached, error, request_payload, 
          response_data, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId,
        provider,
        success ? 1 : 0,
        cost,
        phonesFound,
        emailsFound,
        cached ? 1 : 0,
        error,
        requestPayload ? JSON.stringify(requestPayload) : null,
        responseData ? JSON.stringify(responseData) : null,
        now
      );
    } catch (error) {
      console.error('Error logging skip trace:', error);
    }
  }

  /**
   * Save phones to normalized storage
   * @param leadId - The lead ID
   * @param phones - Array of phone objects
   * @param source - Source of the data
   */
  savePhones(leadId, phones, source) {
    if (!phones || !phones.length) return;
    
    const now = new Date().toISOString();
    let primaryPhone = null;
    let hasDNC = false;
    
    try {
      // Begin transaction
      this.db.prepare('BEGIN TRANSACTION').run();
      
      // Process each phone
      phones.forEach(phone => {
        // Normalize the phone number
        const normalizedPhone = normalizePhoneNumber(phone.number);
        if (!normalizedPhone) return; // Skip invalid numbers
        
        // Track primary phone and DNC status
        if (phone.isPrimary && !primaryPhone) {
          primaryPhone = normalizedPhone;
        }
        
        if (phone.isDoNotCall) {
          hasDNC = true;
        }
        
        // Insert or update the phone record
        this.db.prepare(`
          INSERT OR REPLACE INTO phone_numbers (
            lead_id, phone_number, phone_type, is_primary, 
            is_dnc, confidence, source, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          leadId,
          normalizedPhone,
          phone.type || 'unknown',
          phone.isPrimary ? 1 : 0,
          phone.isDoNotCall ? 1 : 0,
          phone.confidence || 0,
          source,
          now
        );
      });
      
      // Update lead record with counts and flags
      this.db.prepare(`
        UPDATE leads SET
          phones_count = (SELECT COUNT(*) FROM phone_numbers WHERE lead_id = ?),
          has_dnc = ?,
          primary_phone = ?,
          skip_trace_verified_at = ?,
          skip_trace_cache_until = ?,
          force_refresh_needed = 0,
          updated_at = ?
        WHERE id = ?
      `).run(
        leadId,
        hasDNC ? 1 : 0,
        primaryPhone,
        now,
        this.calculateCacheExpiry(),
        now,
        leadId
      );
      
      // Commit transaction
      this.db.prepare('COMMIT').run();
    } catch (error) {
      // Rollback on error
      try {
        this.db.prepare('ROLLBACK').run();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      console.error('Error saving phones:', error);
    }
  }
  
  /**
   * Save emails to normalized storage
   * @param leadId - The lead ID
   * @param emails - Array of email objects
   * @param source - Source of the data
   */
  saveEmails(leadId, emails, source) {
    if (!emails || !emails.length) return;
    
    const now = new Date().toISOString();
    let primaryEmail = null;
    
    try {
      // Begin transaction
      this.db.prepare('BEGIN TRANSACTION').run();
      
      // Process each email
      emails.forEach(email => {
        if (!email.address) return; // Skip empty emails
        
        // Track primary email
        if (email.isPrimary && !primaryEmail) {
          primaryEmail = email.address;
        }
        
        // Insert or update the email record
        this.db.prepare(`
          INSERT OR REPLACE INTO email_addresses (
            lead_id, email_address, is_primary, 
            confidence, source, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          leadId,
          email.address,
          email.isPrimary ? 1 : 0,
          email.confidence || 0,
          source,
          now
        );
      });
      
      // Update lead record
      this.db.prepare(`
        UPDATE leads SET
          emails_count = (SELECT COUNT(*) FROM email_addresses WHERE lead_id = ?),
          primary_email = ?,
          skip_trace_verified_at = ?,
          skip_trace_cache_until = ?,
          force_refresh_needed = 0,
          updated_at = ?
        WHERE id = ?
      `).run(
        leadId,
        primaryEmail,
        now,
        this.calculateCacheExpiry(),
        now,
        leadId
      );
      
      // Commit transaction
      this.db.prepare('COMMIT').run();
    } catch (error) {
      // Rollback on error
      try {
        this.db.prepare('ROLLBACK').run();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      console.error('Error saving emails:', error);
    }
  }
  
  /**
   * Calculate the cache expiry date
   * @returns ISO date string for cache expiry
   */
  calculateCacheExpiry() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SKIP_TRACE_CACHE_DAYS);
    return expiryDate.toISOString();
  }

  /**
   * Save skip trace result to database
   * @param result - The skip trace result to save
   */
  saveResult(result) {
    try {
      const now = new Date().toISOString();

      // Save to the normalized tables
      if (result.phones && result.phones.length > 0) {
        this.savePhones(result.leadId, result.phones, result.provider);
      }
      
      if (result.emails && result.emails.length > 0) {
        this.saveEmails(result.leadId, result.emails, result.provider);
      }

      // Legacy storage - for backwards compatibility
      const existing = this.db.prepare(
        'SELECT lead_id FROM skip_trace_results WHERE lead_id = ?'
      ).get(result.leadId);

      if (existing) {
        // Update existing record
        this.db.prepare(`
          UPDATE skip_trace_results 
          SET 
            phones = ?,
            emails = ?,
            provider = ?,
            cost = ?,
            updated_at = ?
          WHERE lead_id = ?
        `).run(
          JSON.stringify(result.phones),
          JSON.stringify(result.emails),
          result.provider,
          result.cost,
          now,
          result.leadId
        );
      } else {
        // Insert new record
        this.db.prepare(`
          INSERT INTO skip_trace_results (
            lead_id, phones, emails, provider, cost, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          result.leadId,
          JSON.stringify(result.phones),
          JSON.stringify(result.emails),
          result.provider,
          result.cost,
          now,
          now
        );
      }
      
      // Log the skip trace operation
      this.logSkipTrace(
        result.leadId,
        result.provider,
        true,
        result.cost,
        result.phones.length,
        result.emails.length,
        result.cached || false
      );
    } catch (error) {
      console.error('Error saving skip trace result:', error);
    }
  }
  
  /**
   * Call a specific provider to skip trace a lead
   * @param leadId - The lead ID
   * @param lead - The lead object
   * @param provider - The provider to use
   * @returns Skip trace result
   */
  async callProvider(leadId, lead, provider) {
    if (!providers[provider]) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider,
        error: `Provider ${provider} not found`
      };
    }
    
    // Check quota for this provider
    const quotaReached = await this.checkDailyQuota(provider);
    if (quotaReached) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider,
        error: `Daily quota reached for ${provider}`
      };
    }
    
    // Extract address components
    const addressParts = lead.address?.split(',').map(part => part.trim()) || [];
    let streetAddress = addressParts[0] || '';
    let city = addressParts[1] || '';
    let stateZip = addressParts[2] || '';
    
    // Extract state and ZIP code
    const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})/);
    let state = stateZipMatch ? stateZipMatch[1] : '';
    let zipCode = stateZipMatch ? stateZipMatch[2] : '';
    
    // Measure API call duration
    const startTime = Date.now();
    
    // Call provider adapter
    const adapter = providers[provider];
    const result = await adapter.skipTraceLead(
      leadId,
      lead.owner_name || '',
      streetAddress,
      city,
      state,
      zipCode
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log the provider call
    this.logProviderCall(
      leadId,
      result.provider,
      result.requestId,
      result.cost,
      duration,
      result.success ? 'success' : 'error',
      result.error
    );
    
    return result;
  }
  
  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Skip trace a lead by ID with enhanced features:
   * - Multi-provider support
   * - Retry logic
   * - Fallback providers
   * 
   * @param leadId - The lead ID to skip trace
   * @param options - Options object with settings
   * @returns Skip trace result with contact information
   */
  async skipTraceLeadById(leadId, options = {}) {
    // Extract options with defaults
    const {
      forceRefresh = false,
      provider = PRIMARY_PROVIDER,
      useFallback = FALLBACK_ENABLED,
      maxRetries = MAX_RETRIES,
      fallbackProvider = 'whitepages'
    } = options;
    
    // Check for cached result if not forcing refresh
    if (!forceRefresh) {
      const cachedResult = this.getCachedResult(leadId);
      if (cachedResult) {
        return cachedResult;
      }
    } else {
      // If forcing refresh, update the lead record
      this.db.prepare(`
        UPDATE leads
        SET force_refresh_needed = 0
        WHERE id = ?
      `).run(leadId);
    }

    try {
      // Get lead details
      const lead = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
      
      if (!lead) {
        return {
          success: false,
          leadId,
          phones: [],
          emails: [],
          cost: 0,
          provider: 'unknown',
          error: 'Lead not found'
        };
      }

      // Initialize retry count
      let retryCount = 0;
      let result = null;
      
      // Try primary provider first
      result = await this.callProvider(leadId, lead, provider);
      
      // If failed, retry up to maxRetries times
      while (!result.success && retryCount < maxRetries) {
        retryCount++;
        await this.sleep(RETRY_DELAY_MS); // Wait before retrying
        result = await this.callProvider(leadId, lead, provider);
      }
      
      // If still failed and fallback is enabled, try fallback provider
      if (!result.success && useFallback) {
        result = await this.callProvider(leadId, lead, fallbackProvider);
      }

      // Save the result if successful
      if (result.success) {
        this.saveResult(result);
      } else {
        // Log failure
        this.logSkipTrace(
          leadId,
          result.provider,
          false,
          result.cost,
          0,
          0,
          false,
          result.error
        );
      }

      return result;
    } catch (error) {
      // Handle any exceptions
      console.error('Error in skip trace service:', error);
      
      // Log error
      this.logSkipTrace(
        leadId,
        'error',
        false,
        0,
        0,
        0,
        false,
        `Service error: ${error.message}`
      );
      
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'error',
        error: `Service error: ${error.message}`
      };
    }
  }
  
  /**
   * Force refresh skip trace data for a lead
   * @param leadId - The lead ID
   */
  markLeadForRefresh(leadId) {
    try {
      this.db.prepare(`
        UPDATE leads
        SET force_refresh_needed = 1
        WHERE id = ?
      `).run(leadId);
      
      return { success: true };
    } catch (error) {
      console.error('Error marking lead for refresh:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get total skip trace cost for a date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param provider - Optional provider to filter by
   * @returns Total cost and count of skip traces
   */
  getSkipTraceCost(startDate, endDate, provider = null) {
    try {
      const query = provider
        ? `SELECT 
            SUM(cost) as total_cost, 
            COUNT(*) as count 
          FROM provider_calls 
          WHERE created_at BETWEEN ? AND ?
          AND provider = ?`
        : `SELECT 
            SUM(cost) as total_cost, 
            COUNT(*) as count 
          FROM provider_calls 
          WHERE created_at BETWEEN ? AND ?`;
          
      const params = provider
        ? [`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`, provider]
        : [`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`];
        
      const result = this.db.prepare(query).get(...params);

      return {
        cost: result.total_cost || 0,
        count: result.count || 0
      };
    } catch (error) {
      console.error('Error getting skip trace cost:', error);
      return { cost: 0, count: 0 };
    }
  }

  /**
   * Get skip trace cost by day for a date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param provider - Optional provider to filter by
   * @returns Array of daily cost data
   */
  getSkipTraceCostByDay(startDate, endDate, provider = null) {
    try {
      const query = provider
        ? `SELECT 
            date(created_at) as date, 
            SUM(cost) as cost, 
            COUNT(*) as count 
          FROM provider_calls 
          WHERE created_at BETWEEN ? AND ? 
          AND provider = ?
          GROUP BY date(created_at)
          ORDER BY date(created_at)`
        : `SELECT 
            date(created_at) as date, 
            SUM(cost) as cost, 
            COUNT(*) as count 
          FROM provider_calls 
          WHERE created_at BETWEEN ? AND ? 
          GROUP BY date(created_at)
          ORDER BY date(created_at)`;
          
      const params = provider
        ? [`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`, provider]
        : [`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`];
      
      const results = this.db.prepare(query).all(...params);

      return results.map(row => ({
        date: row.date,
        cost: row.cost || 0,
        count: row.count || 0
      }));
    } catch (error) {
      console.error('Error getting skip trace cost by day:', error);
      return [];
    }
  }
  
  /**
   * Get skip trace stats by provider
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Array of provider stats
   */
  getSkipTraceStatsByProvider(startDate, endDate) {
    try {
      const results = this.db.prepare(`
        SELECT 
          provider,
          COUNT(*) as count,
          SUM(cost) as total_cost,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          AVG(duration_ms) as avg_duration
        FROM provider_calls
        WHERE created_at BETWEEN ? AND ?
        GROUP BY provider
        ORDER BY count DESC
      `).all(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);
      
      return results.map(row => ({
        provider: row.provider,
        count: row.count,
        cost: row.total_cost || 0,
        successRate: row.count > 0 ? (row.success_count / row.count) * 100 : 0,
        avgDuration: row.avg_duration || 0
      }));
    } catch (error) {
      console.error('Error getting provider stats:', error);
      return [];
    }
  }

  /**
   * Get remaining skip trace quota for today
   * @param provider - Optional provider to check quota for
   * @returns Object with quota information
   */
  getRemainingQuota(provider = null) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Try provider_quota_usage first
      if (provider) {
        const quotaRecord = this.db.prepare(`
          SELECT used, quota FROM provider_quota_usage 
          WHERE provider = ? AND date = ?
        `).get(provider, today);
        
        if (quotaRecord) {
          const used = quotaRecord.used || 0;
          const total = quotaRecord.quota || DAILY_QUOTA;
          const remaining = Math.max(0, total - used);
          
          return { used, total, remaining };
        }
      }
      
      // Fall back to counting provider_calls
      const todayStart = `${today}T00:00:00.000Z`;
      const todayEnd = `${today}T23:59:59.999Z`;
      
      const query = provider 
        ? `SELECT COUNT(*) as count FROM provider_calls 
           WHERE created_at BETWEEN ? AND ? AND provider = ?`
        : `SELECT COUNT(*) as count FROM provider_calls 
           WHERE created_at BETWEEN ? AND ?`;
           
      const params = provider 
        ? [todayStart, todayEnd, provider]
        : [todayStart, todayEnd];
      
      const result = this.db.prepare(query).get(...params);
      
      const used = result.count || 0;
      const remaining = Math.max(0, DAILY_QUOTA - used);

      return {
        used,
        total: DAILY_QUOTA,
        remaining
      };
    } catch (error) {
      console.error('Error checking quota:', error);
      return {
        used: 0,
        total: DAILY_QUOTA,
        remaining: DAILY_QUOTA
      };
    }
  }

  /**
   * Bulk skip trace leads with enhanced features
   * @param leadIds - Array of lead IDs to skip trace
   * @param options - Options for skip tracing
   * @returns Array of skip trace results
   */
  async bulkSkipTraceLeads(leadIds, options = {}) {
    const {
      forceRefresh = false,
      provider = PRIMARY_PROVIDER,
      useFallback = FALLBACK_ENABLED,
      maxRetries = MAX_RETRIES,
      fallbackProvider = 'whitepages'
    } = options;
    
    const results = [];

    // Get current quota info
    const quota = this.getRemainingQuota(provider);
    
    // Check if we have enough quota
    if (quota.remaining < leadIds.length) {
      // If not enough quota, return error for all leads
      for (const leadId of leadIds) {
        results.push({
          success: false,
          leadId,
          phones: [],
          emails: [],
          cost: 0,
          provider: 'quota',
          error: `Insufficient quota: ${quota.remaining} remaining, ${leadIds.length} requested`
        });
      }
      return results;
    }

    // Process each lead in sequence
    for (const leadId of leadIds) {
      const result = await this.skipTraceLeadById(leadId, {
        forceRefresh,
        provider,
        useFallback,
        maxRetries,
        fallbackProvider
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Get skip trace results for a lead with compliance checking
   * @param leadId - The lead ID
   * @param checkCompliance - Whether to check DNC compliance
   * @returns Skip trace result with compliance information
   */
  async getSkipTraceResult(leadId, checkCompliance = false) {
    try {
      // Get phones from normalized storage
      const phones = this.db.prepare(`
        SELECT 
          phone_number as number, 
          phone_type as type, 
          is_primary as isPrimary, 
          is_dnc as isDoNotCall,
          confidence,
          source
        FROM phone_numbers
        WHERE lead_id = ?
        ORDER BY is_primary DESC, confidence DESC
      `).all(leadId);
      
      // Get emails from normalized storage
      const emails = this.db.prepare(`
        SELECT 
          email_address as address, 
          'unknown' as type, 
          is_primary as isPrimary,
          confidence,
          source
        FROM email_addresses
        WHERE lead_id = ?
        ORDER BY is_primary DESC, confidence DESC
      `).all(leadId);
      
      // Format results with proper boolean values
      const formattedPhones = phones.map(p => ({
        ...p,
        isPrimary: p.isPrimary === 1,
        isDoNotCall: p.isDoNotCall === 1
      }));
      
      const formattedEmails = emails.map(e => ({
        ...e,
        isPrimary: e.isPrimary === 1
      }));
      
      // If no normalized data, fall back to legacy storage
      if (formattedPhones.length === 0 && formattedEmails.length === 0) {
        const legacyResult = this.db.prepare(`
          SELECT 
            lead_id, 
            phones, 
            emails, 
            provider, 
            cost, 
            updated_at 
          FROM skip_trace_results 
          WHERE lead_id = ?
        `).get(leadId);

        if (legacyResult) {
          const parsedPhones = JSON.parse(legacyResult.phones || '[]');
          const parsedEmails = JSON.parse(legacyResult.emails || '[]');
          
          // If we have legacy data, populate the normalized tables
          if ((parsedPhones.length > 0 || parsedEmails.length > 0) && 
              formattedPhones.length === 0 && formattedEmails.length === 0) {
            this.savePhones(leadId, parsedPhones, legacyResult.provider);
            this.saveEmails(leadId, parsedEmails, legacyResult.provider);
          }
          
          return {
            success: true,
            leadId: legacyResult.lead_id,
            phones: parsedPhones,
            emails: parsedEmails,
            cost: legacyResult.cost,
            provider: legacyResult.provider,
            cached: true
          };
        }
      }
      
      // If checking compliance, enhance with DNC status
      if (checkCompliance && formattedPhones.length > 0) {
        // Check DNC status for each phone
        const phonesWithCompliance = await Promise.all(
          formattedPhones.map(async (phone) => {
            const compliance = await this.dncService.canCall(phone.number);
            return {
              ...phone,
              isDoNotCall: compliance.isDNC,
              canCall: compliance.canCall,
              isQuietHours: compliance.isQuietHours
            };
          })
        );
        
        return {
          success: true,
          leadId,
          phones: phonesWithCompliance,
          emails: formattedEmails,
          cost: 0,
          provider: formattedPhones[0]?.source || formattedEmails[0]?.source || 'unknown',
          cached: true
        };
      }
      
      return {
        success: formattedPhones.length > 0 || formattedEmails.length > 0,
        leadId,
        phones: formattedPhones,
        emails: formattedEmails,
        cost: 0,
        provider: formattedPhones[0]?.source || formattedEmails[0]?.source || 'unknown',
        cached: true
      };
    } catch (error) {
      console.error('Error getting skip trace result:', error);
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'error',
        error: `Error retrieving skip trace data: ${error.message}`
      };
    }
  }
  
  /**
   * Check DNC compliance for a phone number
   * @param phoneNumber - The phone number to check
   * @returns Compliance check result
   */
  async checkDNCCompliance(phoneNumber) {
    return await this.dncService.canCall(phoneNumber);
  }
  
  /**
   * Log a contact attempt
   * @param leadId - The lead ID
   * @param contactType - The type of contact (CALL, TEXT, EMAIL)
   * @param contactInfo - The contact info (phone or email)
   * @param userId - The user ID making the contact
   * @param notes - Any notes about the contact
   * @param overrideReason - Reason for override if applicable
   * @returns The result of the operation
   */
  logContactAttempt(
    leadId,
    contactType,
    contactInfo,
    userId = null,
    notes = null,
    overrideReason = null
  ) {
    let phoneNumber = null;
    let emailAddress = null;
    
    if (contactType === 'CALL' || contactType === 'TEXT') {
      phoneNumber = normalizePhoneNumber(contactInfo);
    } else if (contactType === 'EMAIL') {
      emailAddress = contactInfo;
    }
    
    return this.dncService.logContactAttempt(
      leadId,
      contactType,
      phoneNumber,
      emailAddress,
      userId,
      notes,
      overrideReason
    );
  }
}

export { SkipTraceService as default };
