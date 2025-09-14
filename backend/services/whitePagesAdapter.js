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

// API configuration
const WHITEPAGES_API_URL = process.env.WHITEPAGES_API_URL || 'https://api.whitepages.com/3.3/person';
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

    try {
      // Format the request payload
      const params = {
        api_key: WHITEPAGES_API_KEY,
        name: ownerName,
        address: address,
        city: city,
        state_code: state,
        postal_code: zipCode,
        country_code: 'US'
      };

      // Call the WhitePages API
      const startTime = Date.now();
      const response = await axios.get(WHITEPAGES_API_URL, { params });
      const endTime = Date.now();
      
      // Calculate API call duration
      const duration = endTime - startTime;
      
      // Check for successful response
      if (response.status === 200 && response.data && response.data.results?.length > 0) {
        const data = response.data;
        const personResult = data.results[0];
        
        // Format phone numbers
        const phones = personResult.phones?.map((phone) => ({
          number: phone.phone_number,
          type: phone.line_type || 'unknown',
          isPrimary: false, // WhitePages doesn't specify primary
          isDoNotCall: false, // Would require additional lookup
          confidence: Math.min(99, Math.floor((phone.is_valid ? 70 : 50) + (phone.is_connected ? 20 : 0)))
        })) || [];
        
        // Format email addresses
        const emails = personResult.emails?.map((email) => ({
          address: email.email_address,
          type: 'unknown', // WhitePages doesn't specify type
          isPrimary: false,
          confidence: 70 // Default confidence level
        })) || [];
        
        // Return the formatted skip trace result
        return {
          success: true,
          leadId,
          phones,
          emails,
          cost: SKIP_TRACE_COST, // Fixed cost per lookup
          provider: 'whitepages',
          requestId: data.request_id || `wp-${Date.now()}`,
          cached: false
        };
      } else {
        // No results found or error
        return {
          success: false,
          leadId,
          phones: [],
          emails: [],
          cost: 0,
          provider: 'whitepages',
          error: response.data?.error_message || 'No results found',
          requestId: response.data?.request_id || `wp-${Date.now()}`
        };
      }
    } catch (error) {
      // Handle exceptions
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'whitepages',
        error: `Exception: ${error.message}`,
      };
    }
  }
};

export { whitePagesAdapter as default };
