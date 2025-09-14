/**
 * BatchData Skip Trace API Adapter
 * 
 * This service interfaces with the BatchData API to perform skip tracing
 * operations, enriching property leads with contact information.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API configuration
const BATCHDATA_API_URL = process.env.BATCHDATA_API_URL || 'https://api.batchdata.com/api';
const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY;

// Cost per skip trace request
const SKIP_TRACE_COST = 0.25; // Default cost per lookup

// BatchData API adapter
const batchDataAdapter = {
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
    if (!BATCHDATA_API_KEY) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'batchdata',
        error: 'BatchData API key not configured'
      };
    }

    try {
      // Format the request payload
      const payload = {
        name: ownerName,
        address: address,
        city: city,
        state: state,
        zip: zipCode
      };

      // Call the BatchData API
      const startTime = Date.now();
      const response = await axios.post(`${BATCHDATA_API_URL}/v1/property/owner/contact`, payload, {
        headers: {
          'X-API-KEY': BATCHDATA_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      const endTime = Date.now();
      
      // Calculate API call duration
      const duration = endTime - startTime;
      
      // Check for successful response
      if (response.status === 200 && response.data) {
        const data = response.data;
        
        // Format phone numbers
        const phones = data.phones?.map((phone) => ({
          number: phone.number,
          type: phone.type || 'unknown',
          isPrimary: phone.is_primary || false,
          isDoNotCall: phone.is_dnc || false,
          confidence: phone.confidence || 0
        })) || [];
        
        // Format email addresses
        const emails = data.emails?.map((email) => ({
          address: email.address,
          type: email.type || 'unknown',
          isPrimary: email.is_primary || false,
          confidence: email.confidence || 0
        })) || [];
        
        // Return the formatted skip trace result
        return {
          success: true,
          leadId,
          phones,
          emails,
          cost: data.cost || 0.25, // Default cost if not provided
          provider: 'batchdata',
          requestId: data.request_id,
          cached: false
        };
      } else {
        // Handle API error
        return {
          success: false,
          leadId,
          phones: [],
          emails: [],
          cost: 0,
          provider: 'batchdata',
          error: `API error: ${response.status} ${response.statusText}`,
          requestId: response.data?.request_id
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
        provider: 'batchdata',
        error: `Exception: ${error.message}`,
      };
    }
  }
};

export { batchDataAdapter as default };
