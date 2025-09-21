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
import { buildSignatures, sha256 } from '../utils/normalization.js';
import { tokenBucket, dailyBudget, circuitBreaker } from '../../infra/guardrails.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Configuration
const SKIP_TRACE_CACHE_DAYS = parseInt(process.env.SKIP_TRACE_CACHE_DAYS || process.env.CACHE_TTL_DAYS || '7', 10);
const L1_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes in-memory cache
const DISABLE_L1 = String(process.env.SKIP_TRACE_DISABLE_L1 || '').toLowerCase() === 'true';
const DAILY_QUOTA = parseInt(process.env.SKIP_TRACE_DAILY_QUOTA || '100', 10);
const MAX_RETRIES = parseInt(process.env.SKIP_TRACE_MAX_RETRIES || '2', 10);
const FALLBACK_ENABLED = process.env.SKIP_TRACE_FALLBACK_ENABLED === 'true';
const PRIMARY_PROVIDER = process.env.SKIP_TRACE_PRIMARY_PROVIDER || 'batchdata';
const RETRY_DELAY_MS = parseInt(process.env.SKIP_TRACE_RETRY_DELAY_MS || '2000', 10);
const DEMO_MODE = process.env.SKIP_TRACE_DEMO_MODE === 'true';
const ALLOW_DEMO = process.env.SKIP_TRACE_ALLOW_DEMO === 'true';

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
    this.l1Cache = new Map(); // key -> { expiresAt, data }
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
          let raw = fs.readFileSync(schemaPath, 'utf8');
          // Remove all ALTER TABLE statements robustly (across lines) and execute remaining statements individually
          // Split on semicolons to get discrete statements
          const statements = raw
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => !/^ALTER\s+TABLE\s+/i.test(s));
          let applied = 0;
          for (const stmt of statements) {
            try {
              // Skip any stray ALTERs that slipped past
              if (/^ALTER\s+TABLE\s+/i.test(stmt)) continue;
              this.db.exec(stmt + ';');
              applied++;
            } catch (e) {
              const msg = String(e?.message || e);
              // Ignore benign idempotency errors
              if (/already\s+exists/i.test(msg) || /duplicate\s+column/i.test(msg)) {
                continue;
              }
              console.warn('Schema statement failed, continuing:', msg);
            }
          }
          if (applied > 0) {
            console.log(`Applied skip trace schema (${applied} statements)`);
          } else {
            console.warn('No applicable schema statements found; creating basic tables');
            this.createBasicTables();
          }
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

    // Always ensure critical tables exist even if the main schema already existed
    // This guards against partial upgrades where some new tables weren't created.
    try {
      // skip_trace_logs: high-level operation log
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS skip_trace_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          success BOOLEAN DEFAULT 0,
          cost REAL NOT NULL,
          phones_found INTEGER DEFAULT 0,
          emails_found INTEGER DEFAULT 0,
          cached BOOLEAN DEFAULT 0,
          error TEXT,
          request_payload TEXT,
          response_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure zip_hint_used column exists for skip_trace_logs
      try {
        const cols = this.db.prepare("PRAGMA table_info(skip_trace_logs)").all();
        const hasZipHint = Array.isArray(cols) && cols.some(c => c.name === 'zip_hint_used');
        if (!hasZipHint) {
          this.db.exec("ALTER TABLE skip_trace_logs ADD COLUMN zip_hint_used INTEGER DEFAULT 0");
        }
      } catch (e) {
        console.warn('⚠️ Could not ensure zip_hint_used column on skip_trace_logs:', e?.message || e);
      }

      // provider_quota_usage: daily quota tracking
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS provider_quota_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          date TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          quota INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider, date)
        )
      `);

      // Legacy compatibility table to prevent read/update errors
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
    } catch (postInitErr) {
      console.error('Error ensuring skip-trace tables exist:', postInitErr);
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

  computeLeadSignatures = (lead) => {
    const { street, city, state, zip } = this.parseAddress(lead?.address || '');
    const { first, last } = this.splitOwner(lead?.owner_name || '');
    const sigs = buildSignatures({ street, city, state, zip, first, last });
    return sigs; // { primary, secondary, normalized_address, normalized_person, hasUnit }
  }

  // --- L1 cache helpers ---
  l1Get(key) {
    if (DISABLE_L1) return null;
    const hit = this.l1Cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) { this.l1Cache.delete(key); return null; }
    return hit.data;
  }
  l1Set(key, data) {
    if (DISABLE_L1) return;
    this.l1Cache.set(key, { expiresAt: Date.now() + L1_CACHE_TTL_MS, data });
  }

  // --- L2 cache helpers (SQLite) ---
  l2Get(provider, idemKey) {
    try {
      const row = this.db.prepare(`
        SELECT id, payload_hash, response_json, parsed_contacts_json, ttl_expires_at
        FROM skiptrace_cache
        WHERE provider = ? AND idempotency_key = ? AND ttl_expires_at > CURRENT_TIMESTAMP
      `).get(provider, idemKey);
      if (!row) return null;
      // touch last_seen
      this.db.prepare('UPDATE skiptrace_cache SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      const parsed = JSON.parse(row.parsed_contacts_json || '{}');
      return parsed;
    } catch (e) {
      console.error('L2 cache read error:', e);
      return null;
    }
  }
  l2Set(provider, idemKey, payloadHash, responseJsonObj, parsedObj, ttlDays = SKIP_TRACE_CACHE_DAYS) {
    try {
      const ttlDate = new Date();
      ttlDate.setDate(ttlDate.getDate() + (ttlDays || 7));
      const response_json = JSON.stringify(responseJsonObj ?? {});
      const parsed_contacts_json = JSON.stringify(parsedObj ?? {});
      this.db.prepare(`
        INSERT INTO skiptrace_cache (
          provider, idempotency_key, payload_hash, response_json, parsed_contacts_json, ttl_expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, idempotency_key) DO UPDATE SET
          payload_hash=excluded.payload_hash,
          response_json=excluded.response_json,
          parsed_contacts_json=excluded.parsed_contacts_json,
          ttl_expires_at=excluded.ttl_expires_at,
          last_seen=CURRENT_TIMESTAMP
      `).run(provider, idemKey, payloadHash, response_json, parsed_contacts_json, ttlDate.toISOString());
    } catch (e) {
      console.error('L2 cache write error:', e);
    }
  }

  updateLastProviderCallWithIdem(leadId, provider, idemKey, result) {
    try {
      const latest = this.db.prepare(`SELECT id FROM provider_calls WHERE lead_id = ? AND provider = ? ORDER BY id DESC LIMIT 1`).get(leadId, provider);
      if (!latest) return;
      const status_code = result?._debug?.response?.status ?? null;
      const error_text = result?.success ? null : (result?.error || null);
      const request_json = result?._debug?.request ? JSON.stringify(result._debug.request) : null;
      const response_json = result?._debug?.response ? JSON.stringify(result._debug.response) : null;
      const payload_hash = this.stableHash(result?._debug?.response ?? null);
      const cost_cents = Math.round((result?.cost || 0) * 100);
      // Detect whether cost_cents column exists
      const cols = this.db.prepare("PRAGMA table_info(provider_calls)").all().map(c => c.name);
      if (cols.includes('cost_cents')) {
        this.db.prepare(`
          UPDATE provider_calls
          SET idempotency_key = ?,
              status_code = ?,
              error_text = ?,
              request_json = ?,
              response_json = ?,
              payload_hash = ?,
              cost_cents = ?
          WHERE id = ?
        `).run(idemKey, status_code, error_text, request_json, response_json, payload_hash, cost_cents, latest.id);
      } else {
        this.db.prepare(`
          UPDATE provider_calls
          SET idempotency_key = ?,
              status_code = ?,
              error_text = ?,
              request_json = ?,
              response_json = ?,
              payload_hash = ?,
              cost = ?
          WHERE id = ?
        `).run(idemKey, status_code, error_text, request_json, response_json, payload_hash, (result?.cost || 0), latest.id);
      }
    } catch (e) {
      console.error('Failed to update provider_calls with idempotency:', e);
    }
  }

  safeHash(s) {
    try {
      // Lightweight stable hash (not crypto-grade, fine for cache keying payload_hash fallback)
      let h = 0, i, chr;
      const str = String(s);
      if (str.length === 0) return '0';
      for (i = 0; i < str.length; i++) { chr = str.charCodeAt(i); h = ((h << 5) - h) + chr; h |= 0; }
      return String(h >>> 0);
    } catch {
      return '0';
    }
  }

  // Deep-stable stringify and sha256 for payload_hash
  stableStringify(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(v => this.stableStringify(v)).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + this.stableStringify(obj[k])).join(',') + '}';
  }
  stableHash(obj) {
    try { return sha256(this.stableStringify(obj)); } catch { return '0'; }
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
        // If no quota record exists for this provider today, treat used as 0.
        // We do NOT fallback to provider_calls when a provider is specified,
        // because provider_calls may include failed attempts and would block dev/testing.
        return false;
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
    errorMessage,
    runId = null
  ) {
    try {
      const now = new Date().toISOString();

      const result = this.db.prepare(`
        INSERT INTO provider_calls (
          lead_id, provider, request_id, cost, duration_ms, 
          status, error_message, created_at, run_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId,
        provider,
        requestId || null,
        cost,
        durationMs,
        status,
        errorMessage || null,
        now,
        runId
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
    responseData = null,
    zipHintUsed = false
  ) {
    try {
      const now = new Date().toISOString();
      // Sanitize sensitive values in request/response before logging
      const sanitize = (obj) => {
        try {
          const clone = JSON.parse(JSON.stringify(obj));
          if (clone && clone.params && typeof clone.params === 'object') {
            if (clone.params.api_key) clone.params.api_key = '***';
            if (clone.params.apikey) clone.params.apikey = '***';
            if (clone.params.key) clone.params.key = '***';
          }
          if (clone && clone.headers && typeof clone.headers === 'object') {
            if (clone.headers.Authorization) clone.headers.Authorization = '***';
            if (clone.headers['X-API-KEY']) clone.headers['X-API-KEY'] = '***';
            if (clone.headers['x-api-key']) clone.headers['x-api-key'] = '***';
          }
          return clone;
        } catch (_) {
          return obj;
        }
      };
      
      this.db.prepare(`
        INSERT INTO skip_trace_logs (
          lead_id, provider, success, cost, phones_found, 
          emails_found, cached, error, request_payload, 
          response_data, created_at, zip_hint_used
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId,
        provider,
        success ? 1 : 0,
        cost,
        phonesFound,
        emailsFound,
        cached ? 1 : 0,
        error,
        requestPayload ? JSON.stringify(sanitize(requestPayload)) : null,
        responseData ? JSON.stringify(sanitize(responseData)) : null,
        now,
        zipHintUsed ? 1 : 0
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
  saveResult(result, zipHintUsed = false, attemptReason = null) {
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
      
      // Log the skip trace operation (include zip hint flag)
      const reqPayload = result._debug ? (result._debug.request || null) : null;
      const augmentedReq = reqPayload
        ? { ...reqPayload, meta: { ...(reqPayload.meta || {}), attempt_reason: attemptReason || (reqPayload.meta && reqPayload.meta.attempt_reason) || undefined } }
        : (attemptReason ? { meta: { attempt_reason: attemptReason } } : null);

      this.logSkipTrace(
        result.leadId,
        result.provider,
        true,
        result.cost,
        result.phones.length,
        result.emails.length,
        result.cached || false,
        null,
        // Include sanitized debug payloads when available so /api/debug captures them
        augmentedReq,
        result._debug ? (result._debug.response || null) : null,
        zipHintUsed
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
  async callProvider(leadId, lead, provider, opts = {}) {
    const started = Date.now();
    let requestId = null;
    let cost = 0;
    let status = 'error';
    let errMsg = null;
    let result = null;
  const p = provider;
  const runId = opts?.runId || null;
  const { zipOverride = null, streetOverride = null } = opts || {};
    let usedZipHint = false;

    try {
      if (!providers[p]) {
        errMsg = `Provider ${p} not found`;
        return { success: false, leadId, phones: [], emails: [], cost: 0, provider: p, error: errMsg, zipHintUsed: false };
      }

      // Quota check
      const quotaReached = await this.checkDailyQuota(p);
      if (quotaReached) {
        errMsg = `Daily quota reached for ${p}`;
        return { success: false, leadId, phones: [], emails: [], cost: 0, provider: p, error: errMsg };
      }

      // Guardrails: budget cap, breaker, RPS
      if (dailyBudget.atCap()) {
        const r = { success: false, leadId, phones: [], emails: [], cost: 0, provider: p, error: 'BudgetPause' };
        r._debug = { ...(r._debug || {}), _httpStatus: 429 };
        return r;
      }
      if (!circuitBreaker.allow()) {
        const r = { success: false, leadId, phones: [], emails: [], cost: 0, provider: p, error: 'CircuitOpen' };
        r._debug = { ...(r._debug || {}), _httpStatus: 503 };
        return r;
      }
      await tokenBucket.take(1);

      // Extract address components (robust parsing for multi-comma addresses)
      const parseAddr = (addrStr) => {
        const parts = (addrStr || '').split(',').map(s => s.trim()).filter(Boolean);
        let street = '', city = '', state = '', zip = '';
        if (parts.length >= 3) {
          // Prefer the last part as "ST ZIP" and the penultimate as city; join the rest as street
          const last = parts[parts.length - 1];
          let m = last.match(/([A-Z]{2})\s*(\d{5})(?:-\d{4})?/i);
          if (m) {
            state = (m[1] || '').toUpperCase();
            zip = m[2] || '';
            city = parts[parts.length - 2] || '';
            street = parts.slice(0, parts.length - 2).join(', ');
          } else if (parts.length >= 4) {
            // Sometimes the ZIP is in the second-to-last segment
            const cand = parts[parts.length - 2];
            m = cand.match(/([A-Z]{2})\s*(\d{5})(?:-\d{4})?/i);
            if (m) {
              state = (m[1] || '').toUpperCase();
              zip = m[2] || '';
              city = parts[parts.length - 3] || '';
              street = parts.slice(0, parts.length - 3).join(', ');
            } else {
              // Fallback: assume last is city, previous contains state
              city = last;
              const prev = parts[parts.length - 2] || '';
              const m2 = prev.match(/([A-Z]{2})/i);
              state = m2 ? (m2[1] || '').toUpperCase() : '';
              street = parts.slice(0, parts.length - 2).join(', ');
            }
          } else {
            // Minimal: street, city, state/zip in third part
            street = parts[0] || '';
            city = parts[1] || '';
            const m3 = (parts[2] || '').match(/([A-Z]{2})\s*(\d{5})(?:-\d{4})?/i);
            if (m3) { state = (m3[1] || '').toUpperCase(); zip = m3[2] || ''; }
          }
        } else if (parts.length === 2) {
          street = parts[0];
          city = parts[1];
        } else {
          street = parts[0] || '';
        }
        return { street, city, state, zip };
      };

  let { street: streetRaw, city, state, zip: parsedZip } = parseAddr(lead.address || '');
      // Preserve unit/suite information (important for condos/apartments)
      const streetAddress = (() => {
        // If caller provided a sanitized override, use it directly
        if (streetOverride && typeof streetOverride === 'string' && streetOverride.trim()) {
          return streetOverride.trim();
        }
        let s = String(streetRaw || '');
        // Collapse duplicate spaces/commas and trim
        s = s.replace(/\s{2,}/g, ' ')
             .replace(/\s*,\s*,+/g, ', ')
             .replace(/^,\s*|,\s*$/g, '')
             .trim();
        return s;
      })();
  let zipCode = parsedZip;

      // If state is missing, infer for known cities (deterministic hinting)
      const cityUpper0 = String(city).toUpperCase();
      if (!state) {
        if (['COLLINGSWOOD', 'HADDON TOWNSHIP', 'OCEAN CITY'].includes(cityUpper0)) {
          state = 'NJ';
        }
      }

      // Apply ZIP override or hint if zip is missing
      if (zipOverride) {
        zipCode = zipOverride;
        usedZipHint = true;
      } else if (!zipCode) {
        const cityUpper = String(city).toUpperCase();
        const stateUpper = String(state).toUpperCase();
        if (stateUpper === 'NJ') {
          if (cityUpper === 'COLLINGSWOOD') {
            zipCode = '08108';
            usedZipHint = true;
          } else if (cityUpper === 'HADDON TOWNSHIP') {
            // Primary hint; secondary handled by caller if needed
            zipCode = '08108';
            usedZipHint = true;
          } else if (cityUpper === 'OCEAN CITY') {
            zipCode = '08226';
            usedZipHint = true;
          }
        }
      }

      // Call adapter
      const adapter = providers[p];
      result = await adapter.skipTraceLead(
        leadId,
        lead.owner_name || '',
        streetAddress,
        city,
        state,
        zipCode
      );

      requestId = result.requestId || null;
      cost = result.cost || 0;
      status = result.success ? 'success' : 'error';
      // Record guardrails outcomes
      if (result.success) {
        const costCents = Math.round(100 * (Number(result.cost) || 0));
        dailyBudget.add(costCents || 25); // default 25¢ if provider reported 0
        try { circuitBreaker.record(true); } catch (_) {}
      } else {
        try { circuitBreaker.record(false); } catch (_) {}
      }
      if (!result.success && !errMsg) {
        errMsg = result.error || null;
      }
      return { ...result, zipHintUsed: usedZipHint };
    } catch (e) {
      errMsg = e?.message || String(e);
      try { circuitBreaker.record(false); } catch (_) {}
      return { success: false, leadId, phones: [], emails: [], cost: 0, provider: p, error: errMsg, zipHintUsed: usedZipHint };
    } finally {
      const duration = Date.now() - started;
      this.logProviderCall(leadId, p, requestId, cost, duration, status, errMsg, runId);
    }
  }

  /**
   * Generate deterministic demo data when real providers are not configured
   */
  generateDemoResult(leadId, lead) {
    // Derive a deterministic suffix from leadId/address for stable output
    const src = `${leadId}-${lead.address || ''}`;
    let hash = 0;
    for (let i = 0; i < src.length; i++) hash = ((hash << 5) - hash) + src.charCodeAt(i);
    const num = Math.abs(hash % 10000);
    const suffix = String(num).padStart(4, '0');
    const area = '856'; // South Jersey area code
    const phone = `${area}-555-${suffix}`;
    const emailLocal = `owner${suffix}`;
    const emailDomain = 'demo.convexa.local';
    return {
      success: true,
      leadId,
      phones: [{ number: phone, type: 'mobile', isPrimary: true, isDoNotCall: false, confidence: 80 }],
      emails: [{ address: `${emailLocal}@${emailDomain}`, type: 'unknown', isPrimary: true, confidence: 75 }],
      cost: 0,
      provider: 'demo',
      requestId: `demo-${suffix}`,
      cached: false
    };
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
      fallbackProvider = 'whitepages',
      runId = null
    } = options;
    
    // Hard constraint: if demo could be used, fail fast
    if (DEMO_MODE || ALLOW_DEMO) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'error',
        error: 'DEMO DETECTED'
      };
    }

    // Compute idempotency signatures early (used for logging even on failures/stub)
    let idemPrimary = null;
    let idemSecondary = null;
    try {
      const leadRow0 = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
      if (leadRow0) {
        const sigs0 = this.computeLeadSignatures(leadRow0);
        idemPrimary = sigs0.primary;
        idemSecondary = sigs0.secondary;
      }
    } catch (_) { /* ignore */ }

    // Check for cached result if not forcing refresh
    if (!forceRefresh) {
      // New: Idempotent cache by normalized signature (L1 then L2)
      try {
        const leadRow = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (leadRow) {
          const sigs = this.computeLeadSignatures(leadRow);
          const providerKey = provider || PRIMARY_PROVIDER || 'batchdata';
          const l1Key = `${providerKey}:${sigs.primary}`;
          const l1Hit = this.l1Get(l1Key);
          if (l1Hit) return { ...l1Hit, cached: true };
          const l2Hit = this.l2Get(providerKey, sigs.primary);
          if (l2Hit) { this.l1Set(l1Key, l2Hit); return { ...l2Hit, cached: true }; }
        }
      } catch (e) {
        console.warn('Idempotent cache check failed, falling back to legacy cache:', e?.message || e);
      }
      // Legacy per-lead cache fallback
      const cachedResult = this.getCachedResult(leadId);
      if (cachedResult) return cachedResult;
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
  let lastZipHintUsed = false;
      
    // Try primary provider first
  result = await this.callProvider(leadId, lead, provider, { runId });
  lastZipHintUsed = Boolean(result?.zipHintUsed);

      // If failed, retry up to maxRetries times
      while (!result.success && retryCount < maxRetries) {
        retryCount++;
        await this.sleep(RETRY_DELAY_MS); // Wait before retrying
  result = await this.callProvider(leadId, lead, provider, { runId });
        lastZipHintUsed = lastZipHintUsed || Boolean(result?.zipHintUsed);
      }
      
      // If still failed and we have a Haddon Township hint secondary ZIP, try secondary ZIP before provider fallback (independent of fallback toggle)
      if (!result.success) {
        try {
          const addressParts = lead.address?.split(',').map(part => part.trim()) || [];
          const city = addressParts[1] || '';
          const stateZip = addressParts[2] || '';
          const m = stateZip.match(/([A-Z]{2})/);
          const state = m ? m[1] : '';
          if (String(city).toUpperCase() === 'HADDON TOWNSHIP' && String(state).toUpperCase() === 'NJ') {
            const secondaryZip = '08107';
            const secondary = await this.callProvider(leadId, lead, provider, { zipOverride: secondaryZip, runId });
            lastZipHintUsed = lastZipHintUsed || Boolean(secondary?.zipHintUsed);
            if (secondary.success) {
              result = secondary;
            }
          }
        } catch (_) { /* ignore */ }
      }

      // If still failed and fallback is enabled, try fallback provider
      if (!result.success && useFallback) {
  result = await this.callProvider(leadId, lead, fallbackProvider, { runId });
        lastZipHintUsed = lastZipHintUsed || Boolean(result?.zipHintUsed);
      }

      // If result has no contacts, consider it a failure for enrichment purposes
      const hasContacts = Array.isArray(result?.phones) && result.phones.length > 0 ||
                          Array.isArray(result?.emails) && result.emails.length > 0;
      // One-time address-sanitized retry (strip unit/floor/suite tokens) if first result lacks contacts
      if (!hasContacts) {
        try {
          // Build sanitized street override: remove apt|unit|ste|suite|fl|floor|# <value>
          const streetOnly = String(lead.address || '').split(',')[0] || '';
          const sanitized = streetOnly.replace(/\b(?:apt|unit|ste|suite|fl|floor)\b\s*\S+|#\s*\S+/ig, '').replace(/\s{2,}/g, ' ').trim();
          if (sanitized && sanitized !== streetOnly.trim()) {
            const retrySan = await this.callProvider(leadId, lead, provider, { streetOverride: sanitized });
            lastZipHintUsed = lastZipHintUsed || Boolean(retrySan?.zipHintUsed);
            const retryHasContacts = Array.isArray(retrySan?.phones) && retrySan.phones.length > 0 || Array.isArray(retrySan?.emails) && retrySan.emails.length > 0;
            if (retryHasContacts) {
              // Tag attempt reason on the successful result for logging/analytics
              retrySan._debug = retrySan._debug || {};
              retrySan._debug.request = retrySan._debug.request || {};
              retrySan._debug.request.meta = { ...(retrySan._debug.request.meta || {}), attempt_reason: 'address_sanitized' };
              result = retrySan;
            }
          }
        } catch (_) { /* ignore */ }
      }
      // Recompute hasContacts after optional sanitized retry
      const finalHasContacts = Array.isArray(result?.phones) && result.phones.length > 0 || Array.isArray(result?.emails) && result.emails.length > 0;
      if (!finalHasContacts) {
        // Never synthesize demo unless explicitly allowed via separate flag
        // Mark as failure so callers/metrics reflect the miss
        if (result && result.success) {
          result.success = false;
          result.error = result.error || 'No contacts returned by provider';
        }
        if (DEMO_MODE && ALLOW_DEMO) {
          // Optional: only if both DEMO_MODE and ALLOW_DEMO true
          result = this.generateDemoResult(leadId, lead);
        }
      }

      // Strict: do not auto-synthesize on general failure unless explicitly allowed
      if (!result.success && DEMO_MODE && ALLOW_DEMO) {
        result = this.generateDemoResult(leadId, lead);
      }

      // Save the result if successful
      if (result.success) {
        // Save and log with zip hint flag; pass attempt_reason if present
        const attemptReason = result?._debug?.request?.meta?.attempt_reason || null;
        this.saveResult(result, lastZipHintUsed, attemptReason);

        // Idempotent write-through: choose primary vs secondary key when address_sanitized
        try {
          const leadRow2 = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
          if (leadRow2) {
            const sigs2 = this.computeLeadSignatures(leadRow2);
            const providerKey = result.provider || provider || PRIMARY_PROVIDER || 'batchdata';
            const useSecondary = attemptReason === 'address_sanitized';
            const idemKey = useSecondary ? (idemSecondary || sigs2.secondary) : (idemPrimary || sigs2.primary);
            // Update provider_calls row to include idempotency + payload details
            this.updateLastProviderCallWithIdem(leadId, providerKey, idemKey, result);
            // Prepare parsed contacts object for cache (contracts expected by /contacts)
            const parsedObj = {
              success: true,
              leadId,
              phones: Array.isArray(result.phones) ? result.phones : [],
              emails: Array.isArray(result.emails) ? result.emails : [],
              cost: 0,
              provider: result.provider,
              cached: false
            };
            const responseJsonObj = result?._debug?.response || { status: 200 };
            const payloadHash = this.stableHash(responseJsonObj);
            this.l2Set(providerKey, idemKey, payloadHash, responseJsonObj, parsedObj, SKIP_TRACE_CACHE_DAYS);
            this.l1Set(`${providerKey}:${idemKey}`, parsedObj);
          }
        } catch (e) {
          console.warn('Write-through cache failed:', e?.message || e);
        }
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
          result.error,
          // Store debug payloads when available (sanitized)
          result._debug ? (result._debug.request || null) : null,
          result._debug ? (result._debug.response || null) : null,
          lastZipHintUsed
        );
        // Even on failure, persist idempotency key for observability if we can compute it
        try {
          const providerKey = result.provider || provider || PRIMARY_PROVIDER || 'batchdata';
          const idemKey = idemPrimary || null;
          if (idemKey) this.updateLastProviderCallWithIdem(leadId, providerKey, idemKey, result);
        } catch (_) { /* ignore */ }
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
        `Service error: ${error.message}`,
        null,
        null,
        false
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
