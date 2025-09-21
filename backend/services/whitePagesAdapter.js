/**
 * WhitePages Skip Trace API Adapter
 * 
 * This service interfaces with the WhitePages API to perform skip tracing
 * operations, providing a fallback to the primary BatchData provider.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API configuration (explicit Pro host, no guessing)
const WHITEPAGES_API_URL = process.env.WHITEPAGES_API_URL || 'https://proapi.whitepages.com/3.3';
const WHITEPAGES_API_KEY = process.env.WHITEPAGES_API_KEY;

// Cost per skip trace request
const SKIP_TRACE_COST = 0.30; // Default cost per lookup

// WhitePages API adapter
const whitePagesAdapter = {
  /**
   * Skip trace a lead by owner name and property address
   * 
   * @param leadId - The ID of the lead to skip trace
   * @param ownerName - The property owner's name
   * @param address - The property address
   * @param city - The property city
   * @param state - The property state
   * @param zipCode - The property ZIP code
   * @returns Skip trace result with contact information
   */
  skipTraceLead: async (
    leadId,
    ownerName,
    address,
    city,
    state,
    zipCode
  ) => {
    if (!WHITEPAGES_API_KEY) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'whitepages',
        error: 'WhitePages API key not configured'
      };
    }

    // Hoist for debugging in catch
    let lastUrl = `${WHITEPAGES_API_URL.replace(/\/$/, '')}/find_person.json`;
    let lastParams = null;

    try {
      // Build exact Pro find_person request
      const url = `${WHITEPAGES_API_URL.replace(/\/$/, '')}/find_person.json`;
      const cleaned = String(ownerName || '').trim();
      // Prefer splitting into firstname/lastname; if we cannot, fallback to name param
      let firstname = '', lastname = '';
      if (cleaned) {
        const tokens = cleaned.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          lastname = tokens[tokens.length - 1];
          firstname = tokens.slice(0, -1).join(' ');
        }
      }
      const params = {
        api_key: WHITEPAGES_API_KEY,
        firstname: firstname || 'Unknown',
        lastname: lastname || cleaned,
        house: address, // per Golden spec: house=full street
        city: city,
        state_code: state,
        postal_code: zipCode
      };
      lastUrl = url;
      lastParams = { ...params, api_key: '***' };

      const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);
      const response = await axios.get(url, { params, timeout: timeoutMs, validateStatus: () => true });

      if (response.status === 200 && response.data) {
        const data = response.data;
        const personResult = Array.isArray(data.results) && data.results.length ? data.results[0] : (data.person || null);
        const srcPhones = personResult?.phones || data.phones || [];
        const srcEmails = personResult?.emails || data.emails || [];
        const phones = (srcPhones || []).map((phone) => ({
          number: phone.phone_number || phone.number || phone.national_format || phone.e164 || phone.phone,
          type: phone.line_type || phone.type || 'unknown',
          isPrimary: Boolean(phone.is_primary),
          isDoNotCall: Boolean(phone.is_dnc),
          confidence: Math.min(99, Math.floor((phone.is_valid ? 70 : 50) + (phone.is_connected ? 20 : 0)))
        })).filter(p => p.number);
        const emails = (srcEmails || []).map((email) => ({
          address: email.email_address || email.address || email.email,
          type: email.type || 'unknown',
          isPrimary: Boolean(email.is_primary),
          confidence: email.confidence || 70
        })).filter(e => e.address);

        return {
          success: true,
          leadId,
          phones,
          emails,
          cost: SKIP_TRACE_COST,
          provider: 'whitepages',
          requestId: response?.data?.request_id || `wp-${Date.now()}`,
          cached: false,
          _debug: {
            request: { url, params: lastParams },
            response: { status: response.status, sample: Array.isArray(data?.results) ? data.results.slice(0,1) : data }
          }
        };
      }

      const providerCode = response?.data?.error?.code || response?.data?.code || null;
      const providerMsg = response?.data?.error?.message || response?.data?.error_message || response?.statusText || 'No results';
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'whitepages',
        error: `API ${(response && response.status) || 'N/A'}${providerCode ? ` [${providerCode}]` : ''}: ${providerMsg}`,
        requestId: response?.data?.request_id || `wp-${Date.now()}`,
        _debug: {
          request: { url: lastUrl, params: lastParams },
          response: { status: response && response.status, data: response && response.data }
        }
      };
    } catch (error) {
      // Handle exceptions
      const status = error.response?.status;
      const code = error.code || error.response?.data?.code;
      const msg = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'whitepages',
        error: `Exception${status ? ` ${status}` : ''}${code ? ` [${code}]` : ''}: ${msg}`,
        requestId: error.response?.data?.request_id || `wp-${Date.now()}`,
        _debug: {
          request: { url: lastUrl, params: lastParams },
          response: { status, data: error.response?.data }
        }
      };
    }
  }
};

export { whitePagesAdapter as default };
