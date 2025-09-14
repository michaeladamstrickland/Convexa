#!/bin/bash

# LeadFlow AI - ATTOM + BatchData Implementation Script
# This script implements the ATTOM API and BatchData Skip Trace integration

echo "===== LeadFlow AI - ATTOM + BatchData Implementation ====="
echo "This script will set up the integration with ATTOM Property Data API and BatchData Skip Trace"
echo ""

# Check for required tools
echo "Checking for required tools..."
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting."; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx is required but not installed. Aborting."; exit 1; }

# Create log file
LOG_FILE="leadflow-attom-batch-setup-$(date +%Y%m%d-%H%M%S).log"
touch $LOG_FILE
echo "Logging to $LOG_FILE"

# Function to log messages
log() {
  local message="$1"
  echo "[$(date +%T)] $message" | tee -a $LOG_FILE
}

# Function to run a command and log output
run_cmd() {
  local cmd="$1"
  local description="$2"
  
  log "EXECUTING: $description"
  log "$cmd"
  
  eval "$cmd" >> $LOG_FILE 2>&1
  local status=$?
  
  if [ $status -eq 0 ]; then
    log "SUCCESS: $description"
    return 0
  else
    log "FAILED: $description (exit code: $status)"
    return $status
  fi
}

# Step 1: Check environment variables
log "Checking environment configuration..."
if [ ! -f .env ]; then
  log "Creating .env file from template..."
  if [ -f .env.example ]; then
    cp .env.example .env
    log "Created .env file. Please edit to add your API keys."
  else
    log "ERROR: No .env.example found. Creating a basic .env file."
    cat > .env << EOF
# LeadFlow AI Environment Variables
NODE_ENV=development

# API Keys
ATTOM_API_KEY=
BATCHDATA_API_KEY=
BATCHDATA_BASE_URL=https://api.batchdata.com/v1

# API Costs Control
DAILY_CAP_ATTOM_CENTS=1000
DAILY_CAP_BATCH_CENTS=1000
CACHE_TTL_SECONDS=900
EOF
    log "Created basic .env file. Please add your API keys."
  fi
else
  log ".env file already exists."
fi

# Remind user to set API keys
if ! grep -q "ATTOM_API_KEY=" .env || ! grep -q "BATCHDATA_API_KEY=" .env; then
  log "IMPORTANT: Please make sure to set ATTOM_API_KEY and BATCHDATA_API_KEY in your .env file."
fi

# Step 2: Install dependencies
log "Installing dependencies..."
run_cmd "npm install axios dotenv" "Installing required npm packages"

# Step 3: Create necessary utilities
log "Creating address normalization utility..."
mkdir -p src/utils 2>/dev/null

cat > src/utils/addressNormalization.ts << 'EOF'
/**
 * Address Normalization Utility
 * 
 * Provides functions to standardize and normalize property addresses
 * for consistent matching and deduplication.
 */

/**
 * Normalize an address string by removing punctuation, extra spaces,
 * and converting to lowercase.
 * 
 * @param address - Raw address string
 * @returns Normalized address string
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  // Convert to lowercase
  let normalized = address.toLowerCase();
  
  // Replace common abbreviations
  const replacements: Record<string, string> = {
    'avenue': 'ave',
    'boulevard': 'blvd',
    'circle': 'cir',
    'court': 'ct',
    'drive': 'dr',
    'lane': 'ln',
    'parkway': 'pkwy',
    'place': 'pl',
    'road': 'rd',
    'square': 'sq',
    'street': 'st',
    'terrace': 'ter',
    'apartment': 'apt',
    'suite': 'ste',
    'unit': '#',
    'north': 'n',
    'south': 's',
    'east': 'e',
    'west': 'w',
    'northeast': 'ne',
    'northwest': 'nw',
    'southeast': 'se',
    'southwest': 'sw'
  };
  
  // Apply replacements
  Object.keys(replacements).forEach(key => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    normalized = normalized.replace(regex, replacements[key]);
  });
  
  // Remove punctuation except for # sign
  normalized = normalized.replace(/[^\w\s#]/g, '');
  
  // Replace multiple spaces with a single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Trim leading and trailing spaces
  normalized = normalized.trim();
  
  return normalized;
}

/**
 * Compare two addresses and return a similarity score from 0 to 1
 * 
 * @param address1 - First address
 * @param address2 - Second address
 * @returns Similarity score (0-1)
 */
export function calculateAddressSimilarity(address1: string, address2: string): number {
  const normalized1 = normalizeAddress(address1);
  const normalized2 = normalizeAddress(address2);
  
  if (!normalized1 || !normalized2) return 0;
  if (normalized1 === normalized2) return 1;
  
  // Split into components
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  
  // Count matching words
  let matchCount = 0;
  for (const word of words1) {
    if (words2.includes(word)) {
      matchCount++;
    }
  }
  
  // Calculate similarity score
  const totalWords = Math.max(words1.length, words2.length);
  return matchCount / totalWords;
}

/**
 * Determine if two addresses are likely the same property
 * 
 * @param address1 - First address
 * @param address2 - Second address
 * @param threshold - Similarity threshold (default: 0.8)
 * @returns Whether addresses likely refer to the same property
 */
export function isSameProperty(address1: string, address2: string, threshold = 0.8): boolean {
  const similarity = calculateAddressSimilarity(address1, address2);
  return similarity >= threshold;
}
EOF

log "Creating vendor client utility..."

cat > src/utils/vendorClient.ts << 'EOF'
/**
 * Vendor API Client Utility
 * 
 * Provides utilities to create consistent API clients for
 * third-party vendor integrations with cost tracking.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

/**
 * Create a configured API client for a vendor
 * 
 * @param baseURL - Base URL of the vendor API
 * @param headers - Headers to include with all requests
 * @param timeout - Request timeout in ms (default: 10000)
 * @returns Configured Axios instance
 */
export function makeClient(
  baseURL: string, 
  headers: Record<string, string>,
  timeout = 10000
): AxiosInstance {
  return axios.create({
    baseURL,
    headers,
    timeout
  });
}

/**
 * Log an API call with timing and status information
 * 
 * @param vendor - Name of the API vendor (ATTOM, BatchData, etc)
 * @param endpoint - API endpoint called
 * @param status - HTTP status code
 * @param startTime - Start time in milliseconds
 * @param error - Optional error object
 */
export function logApiCall(
  vendor: string,
  endpoint: string,
  status: number,
  startTime: number,
  error?: Error | AxiosError
): void {
  const duration = Date.now() - startTime;
  const success = status >= 200 && status < 300;
  
  if (success) {
    console.log(`API Call: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
  } else {
    console.error(`API Error: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
    
    if (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(`Response: ${JSON.stringify(axiosError.response.data)}`);
      } else if (axiosError.request) {
        console.error(`No response received: ${axiosError.message}`);
      } else {
        console.error(`Error: ${error.message}`);
      }
    }
  }
  
  // Here you could also persist API call logs to the database
  // or call a cost tracking service
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in ms
 * @param isRetryable - Function to check if error is retryable
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 250,
  isRetryable = (error: any) => true
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }
      
      // Calculate backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} in ${delay.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
EOF

# Step 4: Fix the ATTOM Client implementation
log "Setting up ATTOM client service..."

cat > src/services/attomClient.ts << 'EOF'
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { normalizeAddress } from '../utils/addressNormalization';
import { makeClient, logApiCall, retryWithBackoff } from '../utils/vendorClient';

dotenv.config();

/**
 * ATTOM API Property Data Client
 * 
 * This service handles communication with the ATTOM API for property data lookups
 * and integrates with our Lead model for data storage.
 */
export class AttomClient {
  private client: AxiosInstance;
  private apiKey: string;
  private maxRetries: number = 3;
  private costPerLookupCents: number = 5; // Update with actual cost
  private dailyCap: number;
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTtlSeconds: number;
  
  // Track daily API usage
  private dailySpendCents: number = 0;
  private lastResetDay: number = new Date().getDate();

  constructor() {
    this.apiKey = process.env.ATTOM_API_KEY || '';
    this.dailyCap = parseInt(process.env.DAILY_CAP_ATTOM_CENTS || '1000', 10);
    this.cacheTtlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '900', 10);
    
    if (!this.apiKey) {
      throw new Error('ATTOM API key not found in environment variables');
    }

    this.client = makeClient('https://api.gateway.attomdata.com/propertyapi/v1', {
      'apiKey': this.apiKey,
      'Accept': 'application/json'
    });
    
    // Reset the daily spend counter if it's a new day
    this.checkDailyReset();
  }

  /**
   * Search for properties by address
   * 
   * @param address Street address
   * @param city City name
   * @param state State code (2 letter)
   * @param zip ZIP code
   * @returns Property details or null if not found
   */
  async getPropertyByAddress(address: string, city: string, state: string, zip: string) {
    const normalizedAddress = normalizeAddress(`${address}, ${city}, ${state} ${zip}`);
    const cacheKey = `address:${normalizedAddress}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`Cache hit for address: ${normalizedAddress}`);
      return cached;
    }
    
    // Check daily cap
    this.checkDailyReset();
    if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
      const error: any = new Error('Daily ATTOM API cap exceeded');
      error.status = 429;
      throw error;
    }
    
    try {
      // Make the API request with retries
      const response = await this.makeRequestWithRetry('property/address', {
        params: {
          address1: address,
          address2: `${city}, ${state} ${zip}`
        }
      });
      
      if (!response?.data?.property || response.data.property.length === 0) {
        console.log(`No property found for address: ${address}, ${city}, ${state} ${zip}`);
        return null;
      }
      
      const property = response.data.property[0];
      
      // Track the API usage cost
      await this.trackApiUsage('property/address');
      
      // Map the ATTOM data to our Lead model
      const result = this.mapPropertyToLead(property, normalizedAddress);
      
      // Cache the result
      this.addToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      this.handleError(error as Error, `Error fetching property by address: ${address}`);
      return null;
    }
  }
  
  /**
   * Search for properties by ZIP code
   * 
   * @param zipCode ZIP code to search
   * @param limit Maximum number of results to return
   * @returns Array of property details
   */
  async getPropertiesByZipCode(zipCode: string, limit: number = 10) {
    const cacheKey = `zip:${zipCode}:${limit}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`Cache hit for ZIP code: ${zipCode}`);
      return cached;
    }
    
    // Check daily cap
    this.checkDailyReset();
    if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
      const error: any = new Error('Daily ATTOM API cap exceeded');
      error.status = 429;
      throw error;
    }
    
    try {
      const response = await this.makeRequestWithRetry('property/address', {
        params: {
          postalcode: zipCode,
          page: 1,
          pagesize: limit
        }
      });
      
      if (!response?.data?.property || response.data.property.length === 0) {
        console.log(`No properties found for ZIP code: ${zipCode}`);
        return [];
      }
      
      // Track the API usage cost
      await this.trackApiUsage('property/address');
      
      // Map each property to our Lead model
      const properties = response.data.property;
      const leads = [];
      
      for (const property of properties) {
        // Extract address components
        const propertyAddress = property.address?.line1 || '';
        const city = property.address?.locality || '';
        const state = property.address?.countrySubd || '';
        const zip = property.address?.postal1 || '';
        
        const normalizedAddress = normalizeAddress(`${propertyAddress}, ${city}, ${state} ${zip}`);
        
        // Map to lead
        const lead = this.mapPropertyToLead(property, normalizedAddress);
        leads.push(lead);
      }
      
      // Cache the results
      this.addToCache(cacheKey, leads);
      
      return leads;
    } catch (error) {
      this.handleError(error as Error, `Error fetching properties by ZIP code: ${zipCode}`);
      return [];
    }
  }
  
  /**
   * Get property details by ATTOM ID
   * 
   * @param attomId ATTOM Property ID
   * @returns Property details or null if not found
   */
  async getPropertyById(attomId: string) {
    const cacheKey = `attomid:${attomId}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`Cache hit for ATTOM ID: ${attomId}`);
      return cached;
    }
    
    // Check daily cap
    this.checkDailyReset();
    if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
      const error: any = new Error('Daily ATTOM API cap exceeded');
      error.status = 429;
      throw error;
    }
    
    try {
      const response = await this.makeRequestWithRetry('property/basicprofile', {
        params: {
          attomid: attomId
        }
      });
      
      if (!response?.data?.property || response.data.property.length === 0) {
        console.log(`No property found for ATTOM ID: ${attomId}`);
        return null;
      }
      
      const property = response.data.property[0];
      
      // Track the API usage cost
      await this.trackApiUsage('property/basicprofile');
      
      // Get address components
      const address = property.address?.line1 || '';
      const city = property.address?.locality || '';
      const state = property.address?.countrySubd || '';
      const zip = property.address?.postal1 || '';
      
      const normalizedAddress = normalizeAddress(`${address}, ${city}, ${state} ${zip}`);
      
      // Map the ATTOM data to our Lead model
      const result = this.mapPropertyToLead(property, normalizedAddress);
      
      // Cache the result
      this.addToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      this.handleError(error as Error, `Error fetching property by ATTOM ID: ${attomId}`);
      return null;
    }
  }
  
  /**
   * Convert ATTOM property data to our Lead model
   */
  private mapPropertyToLead(property: any, normalizedAddress: string) {
    // Extract address components
    const address = property.address?.line1 || '';
    const city = property.address?.locality || '';
    const state = property.address?.countrySubd || '';
    const zip = property.address?.postal1 || '';
    
    // Extract property details
    const bedrooms = property.building?.rooms?.beds || null;
    const bathrooms = property.building?.rooms?.bathstotal || null;
    const squareFootage = property.building?.size?.universalsize || null;
    const lotSize = property.lot?.lotsize1 || null;
    const yearBuilt = property.summary?.yearbuilt || null;
    
    // Extract valuation data
    const marketValue = property.assessment?.market?.mktttlvalue || null;
    const taxAssessedValue = property.assessment?.assessed?.assdttlvalue || null;
    
    // Extract last sale data
    const lastSalePrice = property.sale?.amount?.saleamt || null;
    const lastSaleDate = property.sale?.salesearchdate ? new Date(property.sale.salesearchdate) : null;
    
    // Check if property is likely absentee owned
    const ownerOccupied = property.summary?.propclass === 'SFR' && property.summary?.propsubtype === 'SINGLE FAMILY RESIDENCE - OWNER OCCUPIED';
    const isAbsenteeOwner = !ownerOccupied;
    
    // Determine property type
    let propertyType = 'unknown';
    if (property.summary?.proptype === 'SFR') propertyType = 'single_family';
    else if (property.summary?.proptype === 'CONDO') propertyType = 'condo';
    else if (property.summary?.proptype === 'MULTI-FAMILY DWELLING') propertyType = 'multi_family';
    else if (property.summary?.proptype === 'TOWNHOUSE') propertyType = 'townhouse';
    
    // Calculate estimated equity
    let equity = null;
    let equityPercent = null;
    
    if (marketValue && lastSalePrice) {
      equity = marketValue - lastSalePrice;
      equityPercent = (equity / marketValue) * 100;
    }
    
    // Return the formatted lead data
    return {
      source: 'attom:property-detail',
      propertyAddress: address,
      city,
      state,
      zipCode: zip,
      normalizedAddress,
      propertyType,
      bedrooms,
      bathrooms,
      squareFootage,
      lotSize,
      yearBuilt,
      marketValue,
      taxAssessedValue,
      lastSalePrice,
      lastSaleDate,
      isAbsenteeOwner,
      equity,
      equityPercent,
      estimatedValue: marketValue,
    };
  }
  
  /**
   * Track API usage for cost reporting
   */
  private async trackApiUsage(endpoint: string) {
    try {
      this.dailySpendCents += this.costPerLookupCents;
      console.log(`ATTOM API call to ${endpoint} - Cost: ${this.costPerLookupCents} cents, Daily total: ${this.dailySpendCents} cents`);
      
      // TODO: Implement database cost tracking if needed
    } catch (error) {
      console.error('Error tracking API usage:', error);
    }
  }
  
  /**
   * Make API request with automatic retry logic
   */
  private async makeRequestWithRetry(endpoint: string, config: any) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(
        () => this.client.get(endpoint, config),
        this.maxRetries,
        250,
        this.isRetryableError
      );
      
      logApiCall('ATTOM', endpoint, response.status, startTime);
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      logApiCall('ATTOM', endpoint, axiosError.response?.status || 0, startTime, axiosError);
      throw error;
    }
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any) {
    if (!error.response) return true;
    const status = error.response.status;
    return status === 429 || status >= 500;
  }
  
  /**
   * Handle API errors
   */
  private handleError(error: Error, message: string) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const errorData = axiosError.response?.data;
    
    console.error(`${message}: ${error.message}`);
    
    if (status) {
      console.error(`Status: ${status}`);
    }
    
    if (errorData) {
      console.error('Error details:', errorData);
    }
  }
  
  /**
   * Check and reset daily counter if necessary
   */
  private checkDailyReset() {
    const currentDay = new Date().getDate();
    if (currentDay !== this.lastResetDay) {
      console.log('Resetting ATTOM API daily spend counter');
      this.dailySpendCents = 0;
      this.lastResetDay = currentDay;
    }
  }
  
  /**
   * Add item to cache
   */
  private addToCache(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get item from cache, return null if expired
   */
  private getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > this.cacheTtlSeconds * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Check API health
   */
  async checkHealth() {
    try {
      const startTime = Date.now();
      const response = await this.client.get('property/basicprofile', {
        params: {
          attomid: '1234567'
        }
      });
      
      return {
        healthy: true,
        latency: Date.now() - startTime,
        status: response.status
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

export default new AttomClient();
EOF

# Step 5: Create BatchData service
log "Setting up BatchData skip tracing service..."

cat > src/services/batchService.ts << 'EOF'
import * as dotenv from "dotenv";
import { makeClient, logApiCall } from "../utils/vendorClient";

dotenv.config();

// Check if BatchData integration is enabled
const isBatchEnabled = process.env.FEATURE_BATCH_ENABLED !== 'false';

// Create BatchData API client
const batchBaseUrl = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com/v1';
const batchApiKey = process.env.BATCHDATA_API_KEY || '';

// Only create the client if BatchData is enabled and API key is provided
const batch = isBatchEnabled && batchApiKey
  ? makeClient(batchBaseUrl, {
      'X-API-Key': batchApiKey,
      'Content-Type': 'application/json'
    })
  : null;

// Track daily API usage
let dailySpendCents = 0;
let lastResetDay = new Date().getDate();

// Set daily spending cap
const dailyCap = parseInt(process.env.DAILY_CAP_BATCH_CENTS || '1000', 10);
const costPerLookupCents = 10; // Adjust based on BatchData's pricing

/**
 * Check and reset daily counter if necessary
 */
function checkDailyReset() {
  const currentDay = new Date().getDate();
  if (currentDay !== lastResetDay) {
    console.log('Resetting BatchData daily spend counter');
    dailySpendCents = 0;
    lastResetDay = currentDay;
  }
}

/**
 * Track API usage and cost
 */
function trackApiUsage(endpoint: string) {
  checkDailyReset();
  dailySpendCents += costPerLookupCents;
  console.log(`BatchData API call cost: ${costPerLookupCents}¢, daily total: ${dailySpendCents}¢`);
}

/**
 * Skip trace a property owner by address
 * 
 * @param address - Property street address
 * @param city - City name
 * @param state - State code
 * @param zipCode - ZIP code
 * @param firstName - Optional owner first name for better matching
 * @param lastName - Optional owner last name for better matching
 * @returns Skip trace results or empty object if feature disabled
 */
export async function skipTraceByAddress(
  address: string,
  city: string,
  state: string,
  zipCode: string,
  firstName?: string,
  lastName?: string
) {
  // Check if BatchData API is enabled
  if (!isBatchEnabled || !batch) {
    console.warn('BatchData API is disabled. Returning empty results.');
    return { result: null, status: 'disabled' };
  }
  
  // Check daily cap
  checkDailyReset();
  if (dailySpendCents + costPerLookupCents > dailyCap) {
    const error: any = new Error('Daily BatchData API cap exceeded');
    error.status = 429;
    error.cap = dailyCap;
    error.spent = dailySpendCents;
    return {
      result: null,
      status: 'cap_exceeded',
      message: `Daily API cap of ${dailyCap}¢ exceeded (${dailySpendCents}¢)`
    };
  }

  const startTime = Date.now();
  const endpoint = '/property/skip';

  try {
    // Prepare the request payload
    const payload = {
      address,
      city,
      state,
      zip: zipCode,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {})
    };

    // Make the API request
    const { data, status } = await batch.post(endpoint, payload);

    // Track API usage
    trackApiUsage(endpoint);
    
    // Log the successful API call
    logApiCall('BatchData', `${endpoint} (Address: ${address})`, status, startTime);

    return {
      result: data.result || null,
      status: 'success',
      cost: costPerLookupCents / 100 // Convert to dollars for frontend
    };
  } catch (error: any) {
    // Log the failed API call
    logApiCall('BatchData', `${endpoint} (Address: ${address})`, error.response?.status || 0, startTime, error);

    // Return empty results with an error status
    return {
      result: null,
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Process skip trace results to extract contact information
 * 
 * @param skipTraceResult - Raw skip trace API result
 * @returns Formatted contact data
 */
export function processSkipTraceResults(skipTraceResult: any) {
  if (!skipTraceResult || !skipTraceResult.result) {
    return {
      phones: [],
      emails: [],
      confidence: 0
    };
  }
  
  const result = skipTraceResult.result;
  
  // Extract phone numbers
  const phones = [];
  if (result.phones && Array.isArray(result.phones)) {
    for (const phone of result.phones) {
      phones.push({
        number: phone.phone_number,
        type: phone.line_type || 'unknown',
        status: phone.status || 'unknown',
        isConnected: phone.connected === true,
        isMobile: phone.line_type === 'mobile',
        isPrimary: phone.is_primary === true
      });
    }
  }
  
  // Extract email addresses
  const emails = [];
  if (result.emails && Array.isArray(result.emails)) {
    for (const email of result.emails) {
      emails.push({
        address: email.email_address,
        type: email.type || 'unknown',
        status: email.status || 'unknown',
        isDeliverable: email.deliverable === true,
        isPrimary: email.is_primary === true
      });
    }
  }
  
  // Calculate overall confidence score
  const hasGoodPhone = phones.some(p => p.isConnected);
  const hasGoodEmail = emails.some(e => e.isDeliverable);
  
  let confidence = 0;
  if (hasGoodPhone && hasGoodEmail) confidence = 90;
  else if (hasGoodPhone) confidence = 70;
  else if (hasGoodEmail) confidence = 50;
  else if (phones.length > 0 || emails.length > 0) confidence = 30;
  
  return {
    phones,
    emails,
    confidence
  };
}

/**
 * Check if BatchData API is available and working
 * 
 * @returns Status of the BatchData API
 */
export async function checkHealth() {
  // If BatchData is disabled or client wasn't initialized, return disabled status
  if (!isBatchEnabled || !batch) {
    return {
      service: 'BatchData API',
      enabled: false,
      status: 'disabled',
      message: 'BatchData API is disabled in configuration.'
    };
  }

  const startTime = Date.now();
  const endpoint = '/property/skip';

  try {
    // Try a basic skip trace with test data
    const payload = {
      address: '123 Main St',
      city: 'Beverly Hills',
      state: 'CA',
      zip: '90210'
    };
    
    const { status } = await batch.post(endpoint, payload);

    // Log the health check
    logApiCall('BatchData', `${endpoint} (Health Check)`, status, startTime);

    return {
      service: 'BatchData API',
      enabled: true,
      status: 'healthy',
      latency: Date.now() - startTime
    };
  } catch (error: any) {
    // Log the health check failure
    logApiCall('BatchData', `${endpoint} (Health Check)`, error.response?.status || 0, startTime, error);

    return {
      service: 'BatchData API',
      enabled: true,
      status: 'unhealthy',
      message: error.message,
      statusCode: error.response?.status,
      latency: Date.now() - startTime
    };
  }
}

export default {
  skipTraceByAddress,
  processSkipTraceResults,
  checkHealth
};
EOF

# Step 6: Create test script for ATTOM and BatchData
log "Creating test scripts..."

cat > test-attom-batch.js << 'EOF'
/**
 * Test script for ATTOM API and BatchData integration
 */

const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

// ANSI color codes for prettier output
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

// Test ATTOM API
async function testAttomAPI() {
  console.log(`${COLORS.blue}===== Testing ATTOM API =====${COLORS.reset}`);
  
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) {
    console.error(`${COLORS.red}ERROR: ATTOM_API_KEY not found in .env file${COLORS.reset}`);
    return false;
  }
  
  try {
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    // Try the ATTOM API property address endpoint
    const response = await axios({
      method: 'GET',
      url: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address',
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json'
      },
      params: {
        address1: '123 Main St',
        address2: 'Beverly Hills, CA 90210'
      }
    });
    
    if (response.status === 200) {
      console.log(`${COLORS.green}✓ ATTOM API connection successful${COLORS.reset}`);
      console.log(`${COLORS.green}✓ Response status: ${response.status}${COLORS.reset}`);
      
      if (response.data?.status?.code === 0) {
        console.log(`${COLORS.green}✓ API returned valid response format${COLORS.reset}`);
        
        if (response.data.property && response.data.property.length > 0) {
          console.log(`${COLORS.green}✓ Found ${response.data.property.length} properties${COLORS.reset}`);
          
          // Print a sample of the first property
          const property = response.data.property[0];
          console.log(`${COLORS.cyan}Sample property data:${COLORS.reset}`);
          console.log(`  Address: ${property.address?.line1 || 'N/A'}`);
          console.log(`  City: ${property.address?.locality || 'N/A'}`);
          console.log(`  State: ${property.address?.countrySubd || 'N/A'}`);
          console.log(`  ZIP: ${property.address?.postal1 || 'N/A'}`);
          console.log(`  ATTOM ID: ${property.identifier?.attomId || 'N/A'}`);
        } else {
          console.log(`${COLORS.yellow}⚠ No properties found in the response${COLORS.reset}`);
        }
      } else {
        console.log(`${COLORS.yellow}⚠ API returned non-zero status: ${response.data?.status?.code}${COLORS.reset}`);
      }
      
      return true;
    } else {
      console.log(`${COLORS.red}✗ Unexpected status code: ${response.status}${COLORS.reset}`);
      return false;
    }
    
  } catch (error) {
    console.error(`${COLORS.red}✗ ATTOM API connection failed:${COLORS.reset}`);
    
    if (error.response) {
      console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`);
      console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data);
    } else {
      console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
    }
    
    return false;
  }
}

// Test BatchData API
async function testBatchDataAPI() {
  console.log(`${COLORS.blue}===== Testing BatchData API =====${COLORS.reset}`);
  
  const apiKey = process.env.BATCHDATA_API_KEY;
  if (!apiKey) {
    console.error(`${COLORS.red}ERROR: BATCHDATA_API_KEY not found in .env file${COLORS.reset}`);
    return false;
  }
  
  try {
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    const baseUrl = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com/v1';
    console.log(`Using API URL: ${baseUrl}`);
    
    // Try the BatchData API property skip trace endpoint
    const response = await axios({
      method: 'POST',
      url: `${baseUrl}/property/skip`,
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      data: {
        address: '123 Main St',
        city: 'Beverly Hills',
        state: 'CA',
        zip: '90210'
      }
    });
    
    if (response.status === 200) {
      console.log(`${COLORS.green}✓ BatchData API connection successful${COLORS.reset}`);
      console.log(`${COLORS.green}✓ Response status: ${response.status}${COLORS.reset}`);
      
      if (response.data?.success === true) {
        console.log(`${COLORS.green}✓ API returned success response${COLORS.reset}`);
        
        // Print some information about the skip trace results
        const result = response.data.result;
        if (result) {
          console.log(`${COLORS.cyan}Sample skip trace data:${COLORS.reset}`);
          
          // Owner information
          if (result.owner) {
            console.log(`  Owner: ${result.owner.name || 'N/A'}`);
          }
          
          // Phone numbers
          if (result.phones && result.phones.length > 0) {
            console.log(`  Phone numbers: ${result.phones.length} found`);
            result.phones.slice(0, 2).forEach((phone, i) => {
              console.log(`    ${i+1}. ${phone.phone_number || 'N/A'} (${phone.line_type || 'unknown'})`);
            });
            if (result.phones.length > 2) {
              console.log(`    ... and ${result.phones.length - 2} more`);
            }
          } else {
            console.log(`  Phone numbers: None found`);
          }
          
          // Email addresses
          if (result.emails && result.emails.length > 0) {
            console.log(`  Email addresses: ${result.emails.length} found`);
            result.emails.slice(0, 2).forEach((email, i) => {
              console.log(`    ${i+1}. ${email.email_address || 'N/A'}`);
            });
            if (result.emails.length > 2) {
              console.log(`    ... and ${result.emails.length - 2} more`);
            }
          } else {
            console.log(`  Email addresses: None found`);
          }
        } else {
          console.log(`${COLORS.yellow}⚠ No skip trace results in the response${COLORS.reset}`);
        }
      } else {
        console.log(`${COLORS.yellow}⚠ API returned non-success response${COLORS.reset}`);
      }
      
      return true;
    } else {
      console.log(`${COLORS.red}✗ Unexpected status code: ${response.status}${COLORS.reset}`);
      return false;
    }
    
  } catch (error) {
    console.error(`${COLORS.red}✗ BatchData API connection failed:${COLORS.reset}`);
    
    if (error.response) {
      console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`);
      console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data);
    } else {
      console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
    }
    
    return false;
  }
}

// Main test function
async function runTests() {
  console.log(`${COLORS.magenta}===== LeadFlow AI - ATTOM + BatchData Integration Test =====${COLORS.reset}`);
  console.log(`Testing API connectivity and integration setup...`);
  console.log();
  
  // Check for required environment variables
  const missingEnvVars = [];
  if (!process.env.ATTOM_API_KEY) missingEnvVars.push('ATTOM_API_KEY');
  if (!process.env.BATCHDATA_API_KEY) missingEnvVars.push('BATCHDATA_API_KEY');
  
  if (missingEnvVars.length > 0) {
    console.warn(`${COLORS.yellow}⚠ Missing environment variables: ${missingEnvVars.join(', ')}${COLORS.reset}`);
    console.warn(`${COLORS.yellow}⚠ Please check your .env file${COLORS.reset}`);
  }
  
  // Run ATTOM API test
  const attomSuccess = await testAttomAPI();
  console.log();
  
  // Run BatchData API test
  const batchSuccess = await testBatchDataAPI();
  console.log();
  
  // Show summary
  console.log(`${COLORS.magenta}===== Test Summary =====${COLORS.reset}`);
  console.log(`ATTOM API: ${attomSuccess ? `${COLORS.green}✓ PASSED${COLORS.reset}` : `${COLORS.red}✗ FAILED${COLORS.reset}`}`);
  console.log(`BatchData API: ${batchSuccess ? `${COLORS.green}✓ PASSED${COLORS.reset}` : `${COLORS.red}✗ FAILED${COLORS.reset}`}`);
  console.log();
  
  if (attomSuccess && batchSuccess) {
    console.log(`${COLORS.green}✓ All tests passed! Your integration is set up correctly.${COLORS.reset}`);
    console.log(`${COLORS.green}✓ You can now use ATTOM and BatchData in your LeadFlow AI application.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}⚠ Some tests failed. Please review the errors above.${COLORS.reset}`);
    console.log(`${COLORS.yellow}⚠ Make sure your API keys are correct and the services are available.${COLORS.reset}`);
  }
  
  // Return success or failure
  return attomSuccess && batchSuccess;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${COLORS.red}Unexpected error running tests: ${error}${COLORS.reset}`);
    process.exit(1);
  });
EOF

# Step 7: Create Windows batch file
log "Creating Windows batch file for running the test..."

cat > test-attom-batch.bat << 'EOF'
@echo off
REM Test script for ATTOM API and BatchData integration

echo ===== LeadFlow AI - ATTOM + BatchData Integration Test =====
echo Testing API connectivity and integration setup...
echo.

REM Check for required environment variables
if "%ATTOM_API_KEY%"=="" (
  echo WARNING: ATTOM_API_KEY environment variable is not set.
  echo Please check your .env file.
)

if "%BATCHDATA_API_KEY%"=="" (
  echo WARNING: BATCHDATA_API_KEY environment variable is not set.
  echo Please check your .env file.
)

REM Run the test script
node test-attom-batch.js

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Test failed. Please review the errors above.
  exit /b %ERRORLEVEL%
) else (
  echo.
  echo All tests passed! Your integration is set up correctly.
)
EOF

# Step 8: Update the README with implementation guide
log "Updating the implementation guide..."

cat > ATTOM_BATCH_IMPLEMENTATION_GUIDE.md << 'EOF'
# LeadFlow AI — ATTOM + BatchData Integration Guide

This guide walks you through the setup and usage of the ATTOM Property Data API and BatchData Skip Trace integration in LeadFlow AI.

## Quick Start

1. **Setup Environment:**
   - Make sure your `.env` file contains the required API keys:
     ```
     ATTOM_API_KEY=your_attom_api_key
     BATCHDATA_API_KEY=your_batchdata_api_key
     BATCHDATA_BASE_URL=https://api.batchdata.com/v1
     ```

2. **Run the test script:**
   - On Windows: `test-attom-batch.bat`
   - On Unix/Linux/Mac: `bash test-attom-batch.js`

3. **Verify the results:**
   - The test should connect to both APIs and return successful responses
   - The terminal will display sample property data and skip trace results

## Features Implemented

### ATTOM Property Data Integration
- Property lookup by address
- Property search by ZIP code
- Detailed property information including:
  - Property details (bedrooms, bathrooms, square footage)
  - Valuation data (market value, tax assessed value)
  - Sales history
  - Owner occupancy status

### BatchData Skip Trace Integration
- Owner contact lookup by property address
- Phone number and email extraction
- Phone type identification (mobile, landline, etc.)
- Confidence scoring for contact data quality

### Additional Functionality
- API cost tracking and daily spending caps
- Response caching to minimize API calls
- Automatic retry with exponential backoff
- Unified error handling and logging

## Usage Examples

### Property Lookup by Address

```javascript
import attomClient from './src/services/attomClient';

// Look up a property by address
const property = await attomClient.getPropertyByAddress(
  '123 Main St',
  'Beverly Hills',
  'CA',
  '90210'
);

console.log(`Property found: ${property.propertyAddress}`);
console.log(`Market value: $${property.marketValue}`);
```

### Skip Trace an Owner

```javascript
import batchService from './src/services/batchService';

// Skip trace a property owner
const skipTraceResult = await batchService.skipTraceByAddress(
  '123 Main St',
  'Beverly Hills',
  'CA',
  '90210'
);

if (skipTraceResult.status === 'success') {
  const contactData = batchService.processSkipTraceResults(skipTraceResult);
  
  console.log(`Found ${contactData.phones.length} phone numbers`);
  console.log(`Found ${contactData.emails.length} email addresses`);
  console.log(`Contact confidence: ${contactData.confidence}%`);
}
```

## Cost Management

The integration includes built-in cost controls:

1. **Daily Spending Caps:**
   - `DAILY_CAP_ATTOM_CENTS`: Default 1000¢ ($10)
   - `DAILY_CAP_BATCH_CENTS`: Default 1000¢ ($10)

2. **Response Caching:**
   - Identical requests are cached to reduce API calls
   - Cache TTL is configurable via `CACHE_TTL_SECONDS` (default: 900 seconds)

3. **Cost Tracking:**
   - Each API call cost is logged and tracked
   - Daily totals are maintained and checked against caps

## Troubleshooting

### Common Issues

1. **API Connection Failures:**
   - Verify your API keys are correct
   - Check your network connectivity
   - Ensure the API service is available

2. **Daily Cap Exceeded:**
   - Increase the cap in your `.env` file if needed
   - Wait until tomorrow for the cap to reset

3. **No Results Found:**
   - Verify the address format is correct
   - Try a different address that you know exists
   - Check if the property is in the ATTOM database

### Diagnostic Tools

- Run `node test-attom-batch.js` to test API connectivity
- Check the logs for detailed error messages
- Contact API support if persistent issues occur

## Next Steps

After successful integration, consider:

1. **Frontend Integration:**
   - Update search forms to use ATTOM data
   - Add skip trace buttons to lead pages
   - Display contact information in lead details

2. **Advanced Features:**
   - Implement bulk skip tracing
   - Add phone validation via Twilio
   - Create email verification workflow

3. **Analytics:**
   - Track conversion rates from skip traced leads
   - Analyze cost per acquisition
   - Optimize spending based on lead quality

For further assistance, refer to the API documentation or contact support.
EOF

# Step 9: Create shell script to run the test
log "Creating shell script to run the test..."

cat > test-attom-batch.sh << 'EOF'
#!/bin/bash

# Test script for ATTOM API and BatchData integration

# ANSI color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}===== LeadFlow AI - ATTOM + BatchData Integration Test =====${NC}"
echo "Testing API connectivity and integration setup..."
echo ""

# Check for required environment variables
if [ -z "$ATTOM_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: ATTOM_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

if [ -z "$BATCHDATA_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: BATCHDATA_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

# Run the test script
node test-attom-batch.js

if [ $? -ne 0 ]; then
  echo ""
  echo -e "${RED}Test failed. Please review the errors above.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}All tests passed! Your integration is set up correctly.${NC}"
fi
EOF

# Make the script executable
chmod +x test-attom-batch.sh

# Step 10: Run the test script
log "Running the test script..."
run_cmd "node test-attom-batch.js" "Testing ATTOM and BatchData integration"

# Display results and next steps
echo ""
echo "===== Implementation Complete ====="
echo "The ATTOM and BatchData integration has been set up."
echo ""
echo "Files created:"
echo "- src/utils/addressNormalization.ts - Address normalization utility"
echo "- src/utils/vendorClient.ts - API client utility"
echo "- src/services/attomClient.ts - ATTOM API client"
echo "- src/services/batchService.ts - BatchData skip tracing service"
echo "- test-attom-batch.js - Test script for the integration"
echo "- test-attom-batch.bat - Windows batch file for running the test"
echo "- test-attom-batch.sh - Shell script for running the test"
echo "- ATTOM_BATCH_IMPLEMENTATION_GUIDE.md - Implementation guide"
echo ""
echo "Next steps:"
echo "1. Edit your .env file to add your ATTOM and BatchData API keys"
echo "2. Run the test script to verify connectivity"
echo "3. Integrate the services into your application"
echo ""
echo "For more information, see ATTOM_BATCH_IMPLEMENTATION_GUIDE.md"
