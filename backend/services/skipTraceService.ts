/**
 * Skip Trace Service
 * 
 * This service coordinates skip tracing operations, including caching,
 * quota management, and database persistence of contact information.
 */

import batchDataAdapter, { SkipTraceResult } from './batchDataAdapter';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

// Load environment variables
dotenv.config();

// Configuration
const SKIP_TRACE_CACHE_DAYS = 7;
const DAILY_QUOTA = parseInt(process.env.SKIP_TRACE_DAILY_QUOTA || '100', 10);

/**
 * Skip Trace Service
 */
class SkipTraceService {
  private db: Database.Database;

  /**
   * Constructor
   * @param db - SQLite database instance
   */
  constructor(db: Database.Database) {
    this.db = db;
    this.initDatabase();
  }

  /**
   * Initialize database tables if they don't exist
   */
  private initDatabase() {
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
  }

  /**
   * Check if we've reached the daily quota
   * @returns Boolean indicating if quota is reached
   */
  private async checkDailyQuota(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM provider_calls 
        WHERE created_at BETWEEN ? AND ?
      `).get(todayStart, todayEnd);

      return result.count >= DAILY_QUOTA;
    } catch (error) {
      console.error('Error checking daily quota:', error);
      return false;
    }
  }

  /**
   * Check if we have cached skip trace results for this lead
   * @param leadId - The lead ID to check
   * @returns Cached skip trace result or null
   */
  private getCachedResult(leadId: string): SkipTraceResult | null {
    try {
      // Calculate date for cache expiration
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - SKIP_TRACE_CACHE_DAYS);
      const cacheDateStr = cacheDate.toISOString();

      // Check for cached result
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
   */
  private logProviderCall(
    leadId: string,
    provider: string,
    requestId: string | undefined,
    cost: number,
    durationMs: number,
    status: string,
    errorMessage?: string
  ) {
    try {
      const now = new Date().toISOString();

      this.db.prepare(`
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
    } catch (error) {
      console.error('Error logging provider call:', error);
    }
  }

  /**
   * Save skip trace result to database
   * @param result - The skip trace result to save
   */
  private saveResult(result: SkipTraceResult) {
    try {
      const now = new Date().toISOString();

      // Check if we already have a record for this lead
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

      // Update the lead record with primary contact info
      if (result.phones.length > 0 || result.emails.length > 0) {
        const primaryPhone = result.phones.find(p => p.isPrimary)?.number || result.phones[0]?.number;
        const primaryEmail = result.emails.find(e => e.isPrimary)?.address || result.emails[0]?.address;

        if (primaryPhone || primaryEmail) {
          this.db.prepare(`
            UPDATE leads 
            SET 
              phone = COALESCE(?, phone),
              email = COALESCE(?, email),
              updated_at = ?
            WHERE id = ?
          `).run(
            primaryPhone || null,
            primaryEmail || null,
            now,
            result.leadId
          );
        }
      }
    } catch (error) {
      console.error('Error saving skip trace result:', error);
    }
  }

  /**
   * Skip trace a lead by ID
   * @param leadId - The lead ID to skip trace
   * @returns Skip trace result with contact information
   */
  async skipTraceLeadById(leadId: string): Promise<SkipTraceResult> {
    // Check for cached result first
    const cachedResult = this.getCachedResult(leadId);
    if (cachedResult) {
      return cachedResult;
    }

    // Check if we've hit our daily quota
    const quotaReached = await this.checkDailyQuota();
    if (quotaReached) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'quota',
        error: 'Daily skip trace quota reached'
      };
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

      // Extract address components
      const addressParts = lead.address?.split(',').map((part: string) => part.trim()) || [];
      let streetAddress = addressParts[0] || '';
      let city = addressParts[1] || '';
      let stateZip = addressParts[2] || '';
      
      // Extract state and ZIP code
      const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})/);
      let state = stateZipMatch ? stateZipMatch[1] : '';
      let zipCode = stateZipMatch ? stateZipMatch[2] : '';

      // Measure API call duration
      const startTime = Date.now();
      
      // Call BatchData adapter
      const result = await batchDataAdapter.skipTraceLead(
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

      // Save the result if successful
      if (result.success) {
        this.saveResult(result);
      }

      return result;
    } catch (error: any) {
      // Handle any exceptions
      console.error('Error in skip trace service:', error);
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
   * Get total skip trace cost for a date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Total cost and count of skip traces
   */
  getSkipTraceCost(startDate: string, endDate: string): { cost: number; count: number } {
    try {
      const result = this.db.prepare(`
        SELECT 
          SUM(cost) as total_cost, 
          COUNT(*) as count 
        FROM provider_calls 
        WHERE created_at BETWEEN ? AND ?
      `).get(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);

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
   * @returns Array of daily cost data
   */
  getSkipTraceCostByDay(startDate: string, endDate: string): Array<{ date: string; cost: number; count: number }> {
    try {
      const results = this.db.prepare(`
        SELECT 
          date(created_at) as date, 
          SUM(cost) as cost, 
          COUNT(*) as count 
        FROM provider_calls 
        WHERE created_at BETWEEN ? AND ? 
        GROUP BY date(created_at)
        ORDER BY date(created_at)
      `).all(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);

      return results.map((row: any) => ({
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
   * Get remaining skip trace quota for today
   * @returns Object with quota information
   */
  getRemainingQuota(): { used: number; total: number; remaining: number } {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM provider_calls 
        WHERE created_at BETWEEN ? AND ?
      `).get(todayStart, todayEnd);

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
   * Bulk skip trace leads
   * @param leadIds - Array of lead IDs to skip trace
   * @returns Array of skip trace results
   */
  async bulkSkipTraceLeads(leadIds: string[]): Promise<SkipTraceResult[]> {
    const results: SkipTraceResult[] = [];

    // Get current quota info
    const quota = this.getRemainingQuota();
    
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
      const result = await this.skipTraceLeadById(leadId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get skip trace results for a lead
   * @param leadId - The lead ID
   * @returns Skip trace result
   */
  getSkipTraceResult(leadId: string): SkipTraceResult | null {
    try {
      const result = this.db.prepare(`
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

      if (result) {
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
      console.error('Error getting skip trace result:', error);
      return null;
    }
  }
}

export default SkipTraceService;
