/**
 * Batch Skip Tracing Service
 * 
 * Handles integration with BatchData API for contact information
 * Includes cost tracking and budget management
 */

import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Configuration
const API_KEY = process.env.BATCHDATA_API_KEY;
const BASE_URL = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com/v1';
const DAILY_CAP_CENTS = parseInt(process.env.DAILY_CAP_BATCH_CENTS || '2000');

// Cost tracking global (should be moved to database in production)
let dailySpendCents = 0;
let dailySpendReset = new Date();

// Types
interface PhoneData {
  number: string;
  type?: string;
  confidence?: number;
  isDnc?: boolean;
}

interface EmailData {
  address: string;
  confidence?: number;
}

interface SkipTraceResult {
  success: boolean;
  message?: string;
  phones: PhoneData[];
  emails: EmailData[];
  costCents: number;
  provider: string;
  leadId: string;
}

/**
 * Reset daily spend counter at midnight
 */
function resetDailySpendIfNeeded() {
  const now = new Date();
  if (now.getDate() !== dailySpendReset.getDate() || 
      now.getMonth() !== dailySpendReset.getMonth() ||
      now.getFullYear() !== dailySpendReset.getFullYear()) {
    console.log('Resetting BatchData daily spend counter');
    dailySpendCents = 0;
    dailySpendReset = now;
  }
}

/**
 * Check if the daily cap would be exceeded
 * @param estimatedCostCents Cost of the next API call in cents
 * @returns True if cap would be exceeded, false otherwise
 */
function wouldExceedCap(estimatedCostCents: number = 25): boolean {
  resetDailySpendIfNeeded();
  return (dailySpendCents + estimatedCostCents) > DAILY_CAP_CENTS;
}

/**
 * Track the cost of an API call
 * @param costCents Cost in cents
 */
function trackCost(costCents: number) {
  resetDailySpendIfNeeded();
  dailySpendCents += costCents;
  console.log(`BatchData API call cost: ${costCents}¢, daily total: ${dailySpendCents}¢`);
}

/**
 * Skip trace a lead using BatchData API
 * @param leadId ID of the lead to skip trace
 * @returns Skip trace results
 */
export async function skipTraceLead(leadId: string): Promise<SkipTraceResult> {
  // Check if BatchData API is enabled
  if (!API_KEY) {
    throw new Error('BatchData API is not configured');
  }
  
  // Check daily cap
  if (wouldExceedCap()) {
    const error: any = new Error('Daily BatchData API cap exceeded');
    error.status = 429;
    throw error;
  }
  
  // Get lead from database
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  });
  
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }
  
  // Extract address and owner information
  const addressLine1 = lead.address || '';
  const city = lead.city || '';
  const state = lead.state || '';
  const zip = lead.zip || '';
  const ownerName = lead.owner_name || '';
  
  if (!addressLine1 || !city || !state || !zip) {
    throw new Error('Incomplete address information');
  }
  
  // Add request ID for tracking
  const requestId = uuidv4();
  console.log(`BatchData skip trace request ${requestId} started for lead ${leadId}`);
  
  try {
    // Call BatchData API with retries
    const skipTraceData = await makeSkipTraceRequestWithRetry({
      address: addressLine1,
      city,
      state,
      zip,
      name: ownerName,
    });
    
    // Process response
    const phones = parsePhoneNumbers(skipTraceData);
    const emails = parseEmails(skipTraceData);
    
    // Calculate cost - this would depend on BatchData's pricing model
    const costCents = estimateSkipTraceCost(skipTraceData);
    
    // Track cost
    trackCost(costCents);
    
    // Update lead in database
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        phones_json: JSON.stringify(phones),
        emails_json: JSON.stringify(emails),
        skip_trace_provider: 'batchdata',
        skip_trace_cost_cents: costCents,
        skip_traced_at: new Date()
      }
    });
    
    console.log(`BatchData skip trace request ${requestId} completed: ${phones.length} phones, ${emails.length} emails`);
    
    return {
      success: true,
      phones,
      emails,
      costCents,
      provider: 'batchdata',
      leadId
    };
  } catch (error) {
    console.error(`BatchData skip trace request ${requestId} failed:`, error);
    throw error;
  }
}

/**
 * Make skip trace request with retry logic
 * @param data Property data for skip tracing
 * @returns API response
 */
async function makeSkipTraceRequestWithRetry(data: any, retries = 2): Promise<any> {
  // BatchData API endpoint for property skip tracing
  const endpoint = `${BASE_URL}/property/skip`;
  
  // Request configuration
  const config = {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 seconds
  };
  
  try {
    const response = await axios.post(endpoint, data, config);
    return response.data;
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
    const backoff = Math.min(500 * (2 ** (2 - retries)), 2000) + Math.random() * 200;
    console.log(`BatchData API retrying in ${backoff}ms (${retries} retries left)`);
    
    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoff));
    
    // Retry the request
    return makeSkipTraceRequestWithRetry(data, retries - 1);
  }
}

/**
 * Parse phone numbers from BatchData response
 * @param data API response data
 * @returns Array of phone data objects
 */
function parsePhoneNumbers(data: any): PhoneData[] {
  if (!data || !data.phones || !Array.isArray(data.phones)) {
    return [];
  }
  
  return data.phones.map((phone: any) => ({
    number: phone.number || '',
    type: phone.type || 'unknown',
    confidence: phone.confidence || 0,
    isDnc: phone.dnc === true
  })).filter(phone => phone.number);
}

/**
 * Parse email addresses from BatchData response
 * @param data API response data
 * @returns Array of email data objects
 */
function parseEmails(data: any): EmailData[] {
  if (!data || !data.emails || !Array.isArray(data.emails)) {
    return [];
  }
  
  return data.emails.map((email: any) => ({
    address: email.address || '',
    confidence: email.confidence || 0
  })).filter(email => email.address);
}

/**
 * Estimate the cost of a skip trace request
 * @param data Skip trace response data
 * @returns Estimated cost in cents
 */
function estimateSkipTraceCost(data: any): number {
  // This would depend on BatchData's pricing model
  // For now, using a simple flat rate plus per contact found
  const baseCost = 25; // 25 cents base cost
  const phoneCount = data.phones?.length || 0;
  const emailCount = data.emails?.length || 0;
  const contactCost = (phoneCount + emailCount) * 5; // 5 cents per contact
  
  return baseCost + contactCost;
}

/**
 * Optional: Validate phone numbers using Twilio Lookup
 * This would be implemented separately if Twilio integration is needed
 */
async function validatePhoneWithTwilio(phoneNumber: string): Promise<any> {
  // Implementation would go here if Twilio Lookup is needed
  // This would call Twilio's Lookup API to validate the phone number
  return { isValid: true, type: 'mobile' };
}

export const batchSkipTraceService = {
  skipTraceLead,
  getDailySpend: () => ({
    cents: dailySpendCents,
    resetAt: dailySpendReset
  })
};

export default batchSkipTraceService;
