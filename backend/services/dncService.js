/**
 * Do Not Call (DNC) Service
 * 
 * This service handles compliance checking for phone numbers,
 * including DNC list validation and quiet hours enforcement.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { isQuietHours } from '../utils/phoneUtils.js';

// Load environment variables
dotenv.config();

// API configuration
const DNC_API_URL = process.env.DNC_API_URL;
const DNC_API_KEY = process.env.DNC_API_KEY;
const ENFORCE_QUIET_HOURS = process.env.ENFORCE_QUIET_HOURS === 'true';
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'America/New_York';

/**
 * DNC (Do Not Call) Service
 */
class DNCService {
  /**
   * Constructor
   * @param db - SQLite database instance
   */
  constructor(db) {
    this.db = db;
    this.initDatabase();
    this.cache = new Map(); // In-memory cache for DNC checks
  }

  /**
   * Initialize database tables if they don't exist
   */
  initDatabase() {
    // Create DNC cache table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dnc_cache (
        phone_number TEXT PRIMARY KEY,
        is_dnc BOOLEAN NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);
  }

  /**
   * Check if a phone number is in the DNC list
   * @param phoneNumber - The phone number to check (E.164 format)
   * @returns Object indicating DNC status
   */
  async checkDNC(phoneNumber) {
    if (!phoneNumber) {
      return { isDNC: false, source: 'invalid' };
    }

    // Check in-memory cache first
    if (this.cache.has(phoneNumber)) {
      return this.cache.get(phoneNumber);
    }

    try {
      // Check database cache
      const now = new Date().toISOString();
      const cachedResult = this.db.prepare(`
        SELECT is_dnc, source FROM dnc_cache 
        WHERE phone_number = ? AND expires_at > ?
      `).get(phoneNumber, now);

      if (cachedResult) {
        const result = { 
          isDNC: cachedResult.is_dnc === 1, 
          source: cachedResult.source 
        };
        this.cache.set(phoneNumber, result);
        return result;
      }

      // If no DNC API, check for local record only
      if (!DNC_API_KEY || !DNC_API_URL) {
        const localDNC = this.checkLocalDNC(phoneNumber);
        this.cache.set(phoneNumber, localDNC);
        return localDNC;
      }

      // Call external DNC API
      const response = await axios.get(`${DNC_API_URL}/check`, {
        params: { phone: phoneNumber },
        headers: { 'X-API-Key': DNC_API_KEY }
      });

      // Process API response
      const result = {
        isDNC: response.data.is_dnc === true,
        source: response.data.source || 'api'
      };

      // Cache the result (30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      this.db.prepare(`
        INSERT OR REPLACE INTO dnc_cache (
          phone_number, is_dnc, source, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        phoneNumber, 
        result.isDNC ? 1 : 0, 
        result.source,
        now,
        expiresAt.toISOString()
      );

      this.cache.set(phoneNumber, result);
      return result;
    } catch (error) {
      console.error('Error checking DNC status:', error);
      
      // Fallback to local check on API error
      const localDNC = this.checkLocalDNC(phoneNumber);
      this.cache.set(phoneNumber, localDNC);
      return localDNC;
    }
  }

  /**
   * Check local database for DNC status
   * @param phoneNumber - The phone number to check
   * @returns Object indicating DNC status
   */
  checkLocalDNC(phoneNumber) {
    try {
      // Check if this number is marked as DNC in our database
      const result = this.db.prepare(`
        SELECT is_dnc FROM phone_numbers 
        WHERE phone_number = ? AND is_dnc = 1 
        LIMIT 1
      `).get(phoneNumber);

      return {
        isDNC: result ? true : false,
        source: result ? 'local' : 'none'
      };
    } catch (error) {
      console.error('Error checking local DNC:', error);
      return { isDNC: false, source: 'error' };
    }
  }

  /**
   * Check if it's safe to call a number based on DNC status and quiet hours
   * @param phoneNumber - The phone number to check
   * @param timezone - The timezone to use for quiet hours check
   * @returns Object with safety information
   */
  async canCall(phoneNumber, timezone = DEFAULT_TIMEZONE) {
    // Check DNC status
    const dncResult = await this.checkDNC(phoneNumber);
    
    // Check quiet hours if enforced
    const quietHoursCheck = ENFORCE_QUIET_HOURS ? 
      isQuietHours(timezone) : 
      false;

    return {
      canCall: !dncResult.isDNC && !quietHoursCheck,
      isDNC: dncResult.isDNC,
      dncSource: dncResult.source,
      isQuietHours: quietHoursCheck,
      timezone
    };
  }

  /**
   * Record a contact attempt for compliance purposes
   * @param leadId - The lead ID
   * @param contactType - The type of contact (CALL, TEXT, EMAIL)
   * @param phoneNumber - The phone number contacted (for CALL/TEXT)
   * @param emailAddress - The email address contacted (for EMAIL)
   * @param userId - The user ID making the contact
   * @param notes - Any notes about the contact
   * @param overrideReason - Reason for override if applicable
   * @returns The result of the operation
   */
  logContactAttempt(
    leadId,
    contactType,
    phoneNumber = null,
    emailAddress = null,
    userId = null,
    notes = null,
    overrideReason = null
  ) {
    try {
      const now = new Date().toISOString();

      const result = this.db.prepare(`
        INSERT INTO contact_attempts (
          lead_id, contact_type, phone_number, email_address, 
          user_id, notes, override_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId,
        contactType,
        phoneNumber,
        emailAddress,
        userId,
        notes,
        overrideReason,
        now
      );

      return {
        success: true,
        id: result.lastInsertRowid
      };
    } catch (error) {
      console.error('Error logging contact attempt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export { DNCService as default };
