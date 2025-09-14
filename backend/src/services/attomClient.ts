/**
 * ATTOM Property Data API Client
 * 
 * Handles all interactions with the ATTOM API for property data
 * Includes caching, retry logic, and cost tracking
 */

import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import { normalizeAddress } from '../utils/addressNormalization';

// Types
interface AttomGeoParams {
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  page: number;
  pageSize: number;
}

interface NormalizedPropertyResponse {
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    normalizedAddress: string;
  };
  parcelId: string;
  owner: {
    name: string;
    mailingAddress?: {
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  estValue: number;
  equityPct?: number;
  distressFlags: {
    foreclosure?: boolean;
    preforeclosure?: boolean;
  };
  source: string;
}

// Configuration
const API_KEY = process.env.ATTOM_API_KEY;
const DAILY_CAP_CENTS = parseInt(process.env.DAILY_CAP_ATTOM_CENTS || '1500');
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '900');
const BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// Cache configuration
const cache = new NodeCache({ stdTTL: CACHE_TTL });

// Cost tracking global (should be moved to database in production)
let dailySpendCents = 0;
let dailySpendReset = new Date();

// Reset daily spend at midnight
function resetDailySpendIfNeeded() {
  const now = new Date();
  if (now.getDate() !== dailySpendReset.getDate() || 
      now.getMonth() !== dailySpendReset.getMonth() ||
      now.getFullYear() !== dailySpendReset.getFullYear()) {
    console.log('Resetting ATTOM daily spend counter');
    dailySpendCents = 0;
    dailySpendReset = now;
  }
}

/**
 * Check if the daily cap would be exceeded
 * @param estimatedCostCents Cost of the next API call in cents
 * @returns True if cap would be exceeded, false otherwise
 */
function wouldExceedCap(estimatedCostCents: number = 10): boolean {
  resetDailySpendIfNeeded();
  return (dailySpendCents + estimatedCostCents) > DAILY_CAP_CENTS;
}

/**
 * Track the cost of an API call
 * @param costCents Cost in cents
 */
function trackCost(costCents: number = 10) {
  resetDailySpendIfNeeded();
  dailySpendCents += costCents;
  console.log(`ATTOM API call cost: ${costCents}¢, daily total: ${dailySpendCents}¢`);
}

/**
 * Create a cache key from query parameters
 * @param params Query parameters
 * @returns Cache key string
 */
function createCacheKey(params: AttomGeoParams): string {
  return JSON.stringify(params);
}

/**
 * Get properties by geographic criteria
 * @param params Geographic search parameters
 * @returns Normalized property data
 */
export async function getPropertiesByGeo(params: AttomGeoParams): Promise<NormalizedPropertyResponse[]> {
  // Check if ATTOM API is enabled
  if (!API_KEY) {
    throw new Error('ATTOM API is not configured');
  }
  
  // Check daily cap
  if (wouldExceedCap()) {
    const error: any = new Error('Daily ATTOM API cap exceeded');
    error.status = 429;
    throw error;
  }
  
  // Try to get from cache first
  const cacheKey = createCacheKey(params);
  const cachedResult = cache.get<NormalizedPropertyResponse[]>(cacheKey);
  if (cachedResult) {
    console.log('ATTOM cache hit');
    return cachedResult;
  }
  
  // Prepare request parameters
  const { city, state, zip, county, page = 1, pageSize = 10 } = params;
  let endpoint = '/property/address';
  let searchParams = new URLSearchParams();
  
  // Build search parameters
  if (zip) {
    searchParams.append('postalcode', zip);
  } else if (city && state) {
    searchParams.append('city', city);
    searchParams.append('state', state);
  } else if (county && state) {
    searchParams.append('county', county);
    searchParams.append('state', state);
  } else {
    throw new Error('Invalid search parameters: need zip OR (city + state) OR (county + state)');
  }
  
  // Add pagination
  searchParams.append('page', page.toString());
  searchParams.append('pageSize', pageSize.toString());
  
  // Add request ID for tracking
  const requestId = uuidv4();
  console.log(`ATTOM API request ${requestId} started: ${searchParams.toString()}`);
  
  try {
    // Make the API call with retries
    const response = await makeRequestWithRetry(endpoint, searchParams);
    
    // Process and normalize response
    const properties = normalizeResponse(response.data);
    
    // Store in cache
    cache.set(cacheKey, properties);
    
    // Track cost
    const costPerProperty = 10; // cents per property
    const costCents = properties.length * costPerProperty;
    trackCost(costCents);
    
    console.log(`ATTOM API request ${requestId} completed: ${properties.length} properties found`);
    return properties;
  } catch (error) {
    console.error(`ATTOM API request ${requestId} failed:`, error);
    throw error;
  }
}

/**
 * Make API request with retry logic
 * @param endpoint API endpoint
 * @param searchParams Query parameters
 * @returns API response
 */
async function makeRequestWithRetry(endpoint: string, searchParams: URLSearchParams, retries = 3): Promise<any> {
  const url = `${BASE_URL}${endpoint}?${searchParams.toString()}`;
  const config = {
    headers: {
      'apikey': API_KEY,
      'Accept': 'application/json',
    },
    timeout: 8000, // 8 seconds
  };
  
  try {
    return await axios.get(url, config);
  } catch (error) {
    const axiosError = error as AxiosError;
    
    // Don't retry client errors except rate limits
    if (axiosError.response && axiosError.response.status < 500 && axiosError.response.status !== 429) {
      throw error;
    }
    
    // Out of retries
    if (retries <= 0) {
      throw error;
    }
    
    // Calculate backoff with jitter
    const backoff = Math.min(250 * (2 ** (3 - retries)), 2000) + Math.random() * 100;
    console.log(`ATTOM API retrying in ${backoff}ms (${retries} retries left)`);
    
    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoff));
    
    // Retry the request
    return makeRequestWithRetry(endpoint, searchParams, retries - 1);
  }
}

/**
 * Normalize ATTOM API response
 * @param responseData Raw API response
 * @returns Normalized property data
 */
function normalizeResponse(responseData: any): NormalizedPropertyResponse[] {
  // Ensure response has the expected structure
  if (!responseData?.property) {
    return [];
  }
  
  // Process each property
  return responseData.property.map((prop: any) => {
    // Extract address components
    const address = prop.address || {};
    const line1 = address.line1 || '';
    const city = address.locality || '';
    const state = address.countrySubd || '';
    const zip = address.postal1 || '';
    
    // Extract owner information
    const owner = prop.owner?.[0] || {};
    const ownerName = owner.name1 || '';
    
    // Extract valuation
    const assessment = prop.assessment?.[0] || {};
    const estValue = assessment.marketValueAmount || 0;
    
    // Calculate equity if loan data is available
    let equityPct;
    if (prop.mortgage?.[0]?.amount && estValue > 0) {
      const loanAmount = prop.mortgage[0].amount;
      equityPct = Math.max(0, Math.round((1 - (loanAmount / estValue)) * 100));
    }
    
    // Check for distress flags
    const distressFlags = {
      foreclosure: !!prop.foreclosure,
      preforeclosure: !!prop.preforeclosure,
    };
    
    // Normalize the address
    const normalizedAddress = normalizeAddress({
      line1,
      city,
      state,
      zip
    });
    
    // Build the response object
    return {
      address: {
        line1,
        city,
        state,
        zip,
        normalizedAddress
      },
      parcelId: prop.identifier?.apnOrig || prop.identifier?.apn || '',
      owner: {
        name: ownerName,
        mailingAddress: owner.mailingAddress ? {
          line1: owner.mailingAddress.line1 || '',
          city: owner.mailingAddress.locality || '',
          state: owner.mailingAddress.countrySubd || '',
          zip: owner.mailingAddress.postal1 || ''
        } : undefined
      },
      estValue,
      equityPct,
      distressFlags,
      source: 'attom:property-detail'
    };
  });
}

export const attomClient = {
  getPropertiesByGeo,
  getCachedKeys: () => cache.keys(),
  clearCache: () => cache.flushAll(),
  getDailySpend: () => ({
    cents: dailySpendCents,
    resetAt: dailySpendReset
  })
};

export default attomClient;
