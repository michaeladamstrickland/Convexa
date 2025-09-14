import * as dotenv from "dotenv";
import type { AxiosInstance } from "axios";
import { makeClient, logApiCall } from "../utils/vendorClient";

dotenv.config();

// Check if ATTOM integration is enabled
const isAttomEnabled = process.env.FEATURE_ATTOM_ENABLED === 'true';

// Create ATTOM API client
const attomBaseUrl = process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com';
const attomApiKey = process.env.ATTOM_API_KEY || '';

// Only create the client if ATTOM is enabled and API key is provided
const attom = isAttomEnabled && attomApiKey 
  ? makeClient(attomBaseUrl, { apikey: attomApiKey }) 
  : null;

// Expose the raw ATTOM client for advanced use-cases (e.g., comps)
export async function getAttomClient(): Promise<AxiosInstance | null> {
  if (!isAttomEnabled || !attom) return null;
  return attom as AxiosInstance;
}

/**
 * Search for properties by ZIP code
 * 
 * @param zipCode - ZIP code to search
 * @param pageSize - Number of results to return (default: 10)
 * @returns Array of property data or empty array if feature disabled
 */
export async function searchByZip(zipCode: string, pageSize: number = 10) {
  // If ATTOM is disabled or client wasn't initialized, return empty results
  if (!isAttomEnabled || !attom) {
    console.warn('ATTOM API is disabled. Returning empty results.');
    return { properties: [], status: 'disabled' };
  }

  const startTime = Date.now();
  const endpoint = `/propertyapi/v1.0.0/property/address`;

  try {
    const { data, status } = await attom.get(endpoint, {
      params: {
        postalcode: encodeURIComponent(zipCode),
        page: 1,
        pagesize: pageSize
      }
    });

    // Log the successful API call
    logApiCall('ATTOM', `${endpoint} (ZIP: ${zipCode})`, status, startTime);

    return { 
      properties: data.property || [],
      status: 'success'
    };
  } catch (error: any) {
    // Log the failed API call
    logApiCall('ATTOM', `${endpoint} (ZIP: ${zipCode})`, error.response?.status || 0, startTime, error);

    // Return empty results with an error status
    return { 
      properties: [],
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Get property details by address
 * 
 * @param address - Street address
 * @param city - City name
 * @param state - State code
 * @param zip - ZIP code
 * @returns Property details or null if not found or disabled
 */
export async function getPropertyByAddress(address: string, city: string, state: string, zip: string) {
  // If ATTOM is disabled or client wasn't initialized, return null
  if (!isAttomEnabled || !attom) {
    console.warn('ATTOM API is disabled. Returning null.');
    return { property: null, status: 'disabled' };
  }

  const startTime = Date.now();
  const endpoint = `/propertyapi/v1.0.0/property/address`;

  try {
    const { data, status } = await attom.get(endpoint, {
      params: {
        address1: encodeURIComponent(address),
        address2: `${encodeURIComponent(city)}, ${state} ${zip}`
      }
    });

    // Log the successful API call
    logApiCall('ATTOM', `${endpoint} (Address: ${address})`, status, startTime);

    // Get the first property from results
    const property = data.property?.[0] || null;

    return { 
      property,
      status: 'success'
    };
  } catch (error: any) {
    // Log the failed API call
    logApiCall('ATTOM', `${endpoint} (Address: ${address})`, error.response?.status || 0, startTime, error);

    // Return null with an error status
    return { 
      property: null,
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Get property details by ATTOM ID
 * 
 * @param attomId - ATTOM property ID
 * @returns Property details or null if not found or disabled
 */
export async function getPropertyById(attomId: string) {
  // If ATTOM is disabled or client wasn't initialized, return null
  if (!isAttomEnabled || !attom) {
    console.warn('ATTOM API is disabled. Returning null.');
    return { property: null, status: 'disabled' };
  }

  const startTime = Date.now();
  const endpoint = `/propertyapi/v1.0.0/property/basicprofile`;

  try {
    const { data, status } = await attom.get(endpoint, {
      params: {
        attomid: attomId
      }
    });

    // Log the successful API call
    logApiCall('ATTOM', `${endpoint} (ID: ${attomId})`, status, startTime);

    // Get the first property from results
    const property = data.property?.[0] || null;

    return { 
      property,
      status: 'success'
    };
  } catch (error: any) {
    // Log the failed API call
    logApiCall('ATTOM', `${endpoint} (ID: ${attomId})`, error.response?.status || 0, startTime, error);

    // Return null with an error status
    return { 
      property: null,
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Check if ATTOM API is available and working
 * 
 * @returns Status of the ATTOM API
 */
export async function checkHealth() {
  // If ATTOM is disabled or client wasn't initialized, return disabled status
  if (!isAttomEnabled || !attom) {
    return {
      service: 'ATTOM API',
      enabled: false,
      status: 'disabled',
      message: 'ATTOM API is disabled in configuration.'
    };
  }

  const startTime = Date.now();
  const endpoint = `/propertyapi/v1.0.0/property/basicprofile`;

  try {
    // Try a basic endpoint with a dummy ID
    const { status } = await attom.get(endpoint, {
      params: {
        attomid: '1234567'
      }
    });

    // Log the health check
    logApiCall('ATTOM', `${endpoint} (Health Check)`, status, startTime);

    return {
      service: 'ATTOM API',
      enabled: true,
      status: 'healthy',
      latency: Date.now() - startTime
    };
  } catch (error: any) {
    // Log the health check failure
    logApiCall('ATTOM', `${endpoint} (Health Check)`, error.response?.status || 0, startTime, error);

    return {
      service: 'ATTOM API',
      enabled: true,
      status: 'unhealthy',
      message: error.message,
      statusCode: error.response?.status,
      latency: Date.now() - startTime
    };
  }
}

export default {
  searchByZip,
  getPropertyByAddress,
  getPropertyById,
  checkHealth
};
