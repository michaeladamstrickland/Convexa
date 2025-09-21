import axios, { AxiosError, AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { normalizeAddress } from '../utils/addressNormalization';

dotenv.config();

const prisma = new PrismaClient();

interface SkipTraceRequest {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  firstName?: string;
  lastName?: string;
}

interface SkipTraceResult {
  success: boolean;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  phonesJson?: string;
  emailsJson?: string;
  dncFlag?: boolean;
  cost: number; // in cents
}

/**
 * BatchData Skip Trace Service
 * 
 * This service handles communication with the BatchData API for skip tracing
 * property owners and retrieving contact information.
 */
export class BatchSkipTraceService {
  private client: AxiosInstance;
  private apiKey: string;
  private maxRetries: number = 3;
  private costPerLookupCents: number = 12; // Update with actual cost
  private rateLimitPerMinute: number = 50;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  
  constructor() {
    this.apiKey = process.env.BATCHDATA_API_KEY || '';
    
    if (!this.apiKey) {
      // Disabled mode: allow server to run without key; routes will respond with success: false
      console.warn('BatchData API key not found; Skip Trace service is running in disabled mode. Set BATCHDATA_API_KEY to enable.');
      // Minimal client to satisfy typing; not used in disabled mode
      this.client = axios.create();
      (this as any)._disabled = true;
      return;
    }

    this.client = axios.create({
      baseURL: 'https://api.batchdata.com/api',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 15000
    });
  }
  
  /**
   * Skip trace a property by address to find owner contact information
   * 
   * @param request Skip trace request object
   * @returns Skip trace result with contact information
   */
  async skipTraceByAddress(request: SkipTraceRequest): Promise<SkipTraceResult> {
    try {
      // Disabled mode short-circuit
      if ((this as any)._disabled) {
        return { success: false, cost: 0 };
      }
      // Check rate limits
      await this.checkRateLimit();
      
      // Create the normalized address for deduplication
      const fullAddress = `${request.address}, ${request.city}, ${request.state} ${request.zipCode}`;
      const normalizedAddress = normalizeAddress(fullAddress);
      
      // Check if we've already skip traced this property
      const existingLead: any = await (prisma as any).lead.findFirst({
        where: {
          // cast: schema may differ; use raw field or fallback
          normalizedAddress,
          skipTracedAt: { not: null }
        }
      });
      
  if (existingLead && (existingLead.ownerPhone || existingLead.phone)) {
        console.log(`Skip trace data already exists for ${normalizedAddress}`);
        
        return {
          success: true,
          ownerName: existingLead.ownerName || existingLead.owner_name || undefined,
          ownerPhone: existingLead.ownerPhone || existingLead.phone || undefined,
          ownerEmail: existingLead.ownerEmail || existingLead.email || undefined,
          ownerAddress: existingLead.ownerAddress || existingLead.mailing_address || undefined,
          phonesJson: existingLead.phonesJson || existingLead.phones_json || undefined,
          emailsJson: existingLead.emailsJson || existingLead.emails_json || undefined,
          dncFlag: existingLead.dncFlag || existingLead.dnc_flag || false,
          cost: 0 // No cost since we're using cached data
        };
      }
      
      // Make the API request with retries
      const response = await this.makeRequestWithRetry('/v1/property/skip', {
        method: 'POST',
        data: {
          address: request.address,
          city: request.city,
          state: request.state,
          zip: request.zipCode,
          firstName: request.firstName,
          lastName: request.lastName
        }
      });
      
      if (!response?.data || response.data.status !== 'success') {
        console.log(`Skip trace failed for address: ${fullAddress}`);
        return { success: false, cost: 0 };
      }
      
      // Track the API usage cost
      const cost = this.costPerLookupCents;
      await this.trackApiUsage('property/skip', cost);
      
      // Process the skip trace results
      const result = response.data.result;
      const ownerInfo = this.processOwnerInfo(result);
      
      // Update the lead if it exists
      if (existingLead) {
        await (prisma as any).lead.update({
          where: { id: existingLead.id },
          data: {
            ownerName: ownerInfo.ownerName,
            ownerPhone: ownerInfo.ownerPhone,
            ownerEmail: ownerInfo.ownerEmail,
            ownerAddress: ownerInfo.ownerAddress,
            phonesJson: ownerInfo.phonesJson,
            emailsJson: ownerInfo.emailsJson,
            dncFlag: ownerInfo.dncFlag || false,
            skipTraceProvider: 'batchdata',
            skipTraceCostCents: cost,
            skipTracedAt: new Date()
          }
        });
      }
      
      return {
        ...ownerInfo,
        success: true,
        cost
      };
    } catch (error) {
      this.handleError(error as Error, `Error skip tracing property: ${request.address}`);
      return { success: false, cost: 0 };
    }
  }
  
  /**
   * Skip trace multiple properties in batch
   * 
   * @param requests Array of skip trace requests
   * @returns Array of skip trace results
   */
  async batchSkipTrace(requests: SkipTraceRequest[]): Promise<SkipTraceResult[]> {
    // Disabled mode short-circuit
    if ((this as any)._disabled) {
      return requests.map(() => ({ success: false, cost: 0 }));
    }
    const results: SkipTraceResult[] = [];
    
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      // Process each batch with a delay between them
      const batchResults = await Promise.all(
        batch.map(request => this.skipTraceByAddress(request))
      );
      
      results.push(...batchResults);
      
      // Add a delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }
  
  /**
   * Process the owner information from the API response
   */
  private processOwnerInfo(result: any) {
    // Extract owner name
    const firstName = result.first_name || '';
    const lastName = result.last_name || '';
    const ownerName = (firstName && lastName) ? `${firstName} ${lastName}` : result.name || '';
    
    // Extract contact information
    const phones = result.phones || [];
    const emails = result.emails || [];
    
    // Get the best phone number (mobile preferred)
    let bestPhone = '';
    if (phones.length > 0) {
      const mobile = phones.find((p: any) => p.phone_type === 'mobile');
      bestPhone = mobile ? mobile.phone_number : phones[0].phone_number;
    }
    
    // Get the best email
    const ownerEmail = emails.length > 0 ? emails[0].email : '';
    
    // Get the owner address if different from property
    const ownerAddress = result.owner_address || '';
    
    // Check if on do-not-call list
    const dncFlag = result.dnc_flag || false;
    
    return {
      ownerName,
      ownerPhone: bestPhone,
      ownerEmail,
      ownerAddress,
      phonesJson: JSON.stringify(phones),
      emailsJson: JSON.stringify(emails),
      dncFlag
    };
  }
  
  /**
   * Check if we're within rate limits, wait if necessary
   */
  private async checkRateLimit() {
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - this.lastResetTime) / (60 * 1000);
    
    if (elapsedMinutes >= 1) {
      // Reset counter if a minute has passed
      this.requestCount = 0;
      this.lastResetTime = currentTime;
    }
    
    if (this.requestCount >= this.rateLimitPerMinute) {
      // Wait until the next minute if we've hit the limit
      const waitTime = 60 * 1000 - (currentTime - this.lastResetTime);
      console.log(`Rate limit reached, waiting ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset counter
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestCount++;
  }
  
  /**
   * Track API usage for cost reporting
   */
  private async trackApiUsage(endpoint: string, cost: number) {
    try {
      // Implement cost tracking logic here
      console.log(`API call to ${endpoint} - Cost: ${cost} cents`);
      
      // You could log to database or another tracking system here
    } catch (error) {
      console.error('Error tracking API usage:', error);
    }
  }
  
  /**
   * Make API request with automatic retry logic
   */
  private async makeRequestWithRetry(endpoint: string, config: any, retries: number = 0): Promise<any> {
    try {
      if (config.method === 'POST') {
        return await this.client.post(endpoint, config.data);
      } else {
        return await this.client.get(endpoint, config);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (retries < this.maxRetries && this.isRetryableError(axiosError)) {
        console.log(`Retrying API call to ${endpoint} (attempt ${retries + 1}/${this.maxRetries})`);
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(endpoint, config, retries + 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: AxiosError) {
    const status = error.response?.status;
    return !status || status === 429 || status >= 500;
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
}

export default new BatchSkipTraceService();
