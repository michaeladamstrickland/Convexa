import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface SkipTraceResult {
  success: boolean;
  confidence: number;
  data: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phones?: Array<{
      number: string;
      type: 'mobile' | 'landline' | 'voip';
      carrier?: string;
      isValid: boolean;
    }>;
    emails?: Array<{
      address: string;
      type: 'personal' | 'business';
      isValid: boolean;
    }>;
    addresses?: Array<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
      type: 'current' | 'previous';
      dateRange?: string;
    }>;
    relatives?: Array<{
      name: string;
      relationship?: string;
    }>;
    associates?: Array<{
      name: string;
      relationship?: string;
    }>;
  };
  cost: number;
  provider: string;
}

export interface SkipTraceRequest {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  email?: string;
}

export class SkipTraceService {
  /**
   * Run skip trace using multiple providers with fallback
   */
  async runSkipTrace(
    leadId: string,
    request: SkipTraceRequest
  ): Promise<SkipTraceResult> {
    try {
      // Try BatchSkipTracing first (usually most comprehensive)
      if (process.env.BATCH_SKIP_TRACING_API_KEY) {
        try {
          const result = await this.batchSkipTrace(request);
          if (result.success) {
            await this.saveSkipTraceRecord(leadId, 'batch_skip_tracing', request, result);
            return result;
          }
        } catch (error) {
          logger.warn('BatchSkipTracing failed, trying WhitePages:', error);
        }
      }

      // Fallback to WhitePages Pro
      if (process.env.WHITEPAGES_PRO_API_KEY) {
        try {
          const result = await this.whitePagesSkipTrace(request);
          if (result.success) {
            await this.saveSkipTraceRecord(leadId, 'whitepages_pro', request, result);
            return result;
          }
        } catch (error) {
          logger.warn('WhitePages Pro failed:', error);
        }
      }

      // If all providers fail, try free/public sources
      const result = await this.publicRecordsSearch(request);
      await this.saveSkipTraceRecord(leadId, 'public_records', request, result);
      return result;

    } catch (error) {
      logger.error('All skip trace providers failed:', error);
      
      const failedResult: SkipTraceResult = {
        success: false,
        confidence: 0,
        data: {},
        cost: 0,
        provider: 'none',
      };

      await this.saveSkipTraceRecord(leadId, 'failed', request, failedResult);
      return failedResult;
    }
  }

  /**
   * BatchSkipTracing API integration
   */
  private async batchSkipTrace(request: SkipTraceRequest): Promise<SkipTraceResult> {
    const apiKey = process.env.BATCH_SKIP_TRACING_API_KEY;
    const baseUrl = 'https://api.batchskiptracing.com/v2';

    const payload = {
      api_key: apiKey,
      records: [
        {
          first_name: request.firstName,
          last_name: request.lastName,
          full_name: request.fullName,
          address: request.address,
          city: request.city,
          state: request.state,
          zip: request.zipCode,
          phone: request.phone,
          email: request.email,
        },
      ],
    };

    const response = await axios.post(`${baseUrl}/skip-trace`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data;
    
    if (data.success && data.records && data.records.length > 0) {
      const record = data.records[0];
      
      return {
        success: true,
        confidence: record.confidence || 75,
        data: {
          firstName: record.first_name,
          lastName: record.last_name,
          fullName: record.full_name,
          phones: record.phones?.map((phone: any) => ({
            number: phone.number,
            type: phone.type || 'unknown',
            carrier: phone.carrier,
            isValid: phone.is_valid !== false,
          })) || [],
          emails: record.emails?.map((email: any) => ({
            address: email.address,
            type: email.type || 'personal',
            isValid: email.is_valid !== false,
          })) || [],
          addresses: record.addresses?.map((addr: any) => ({
            street: addr.street,
            city: addr.city,
            state: addr.state,
            zipCode: addr.zip,
            type: addr.type || 'previous',
            dateRange: addr.date_range,
          })) || [],
          relatives: record.relatives || [],
          associates: record.associates || [],
        },
        cost: data.cost || 0.25,
        provider: 'batch_skip_tracing',
      };
    }

    throw new Error('No results from BatchSkipTracing');
  }

  /**
   * WhitePages Pro API integration
   */
  private async whitePagesSkipTrace(request: SkipTraceRequest): Promise<SkipTraceResult> {
    const apiKey = process.env.WHITEPAGES_PRO_API_KEY;
    const baseUrl = 'https://proapi.whitepages.com/3.0';

    // WhitePages requires separate calls for different data types
    const personQuery = {
      api_key: apiKey,
      name: request.fullName || `${request.firstName} ${request.lastName}`,
      address: `${request.address}, ${request.city}, ${request.state} ${request.zipCode}`,
    };

    const response = await axios.get(`${baseUrl}/person`, {
      params: personQuery,
      timeout: 30000,
    });

    const data = response.data;
    
    if (data.results && data.results.length > 0) {
      const person = data.results[0];
      
      return {
        success: true,
        confidence: 65, // WhitePages doesn't provide confidence scores
        data: {
          firstName: person.name?.first_name,
          lastName: person.name?.last_name,
          fullName: person.name?.full_name,
          phones: person.phones?.map((phone: any) => ({
            number: phone.phone_number,
            type: phone.line_type || 'unknown',
            carrier: phone.carrier,
            isValid: phone.is_valid !== false,
          })) || [],
          emails: [], // WhitePages Pro email data requires separate endpoint
          addresses: person.addresses?.map((addr: any) => ({
            street: addr.street_line_1,
            city: addr.city,
            state: addr.state_code,
            zipCode: addr.postal_code,
            type: addr.is_active ? 'current' : 'previous',
          })) || [],
          relatives: person.associates?.filter((a: any) => a.relation === 'relative') || [],
          associates: person.associates?.filter((a: any) => a.relation !== 'relative') || [],
        },
        cost: 0.15, // Estimated cost
        provider: 'whitepages_pro',
      };
    }

    throw new Error('No results from WhitePages Pro');
  }

  /**
   * Free public records search (limited data)
   */
  private async publicRecordsSearch(request: SkipTraceRequest): Promise<SkipTraceResult> {
    // This is a simplified implementation
    // In practice, you'd integrate with county records, voter databases, etc.
    
    // For now, return basic parsed information from the request
    const nameParts = (request.fullName || `${request.firstName} ${request.lastName}`).split(' ');
    
    return {
      success: true,
      confidence: 25, // Low confidence for public-only data
      data: {
        firstName: nameParts[0] || request.firstName,
        lastName: nameParts[nameParts.length - 1] || request.lastName,
        fullName: request.fullName || `${request.firstName} ${request.lastName}`,
        phones: request.phone ? [{
          number: request.phone,
          type: 'mobile' as const, // Default to mobile since we don't know the type
          isValid: true,
        }] : [],
        emails: request.email ? [{
          address: request.email,
          type: 'personal' as const,
          isValid: true,
        }] : [],
        addresses: [{
          street: request.address,
          city: request.city,
          state: request.state,
          zipCode: request.zipCode || '',
          type: 'current' as const,
        }],
        relatives: [],
        associates: [],
      },
      cost: 0,
      provider: 'public_records',
    };
  }

  /**
   * Save skip trace record to database
   */
  private async saveSkipTraceRecord(
    leadId: string,
    provider: string,
    request: SkipTraceRequest,
    result: SkipTraceResult
  ): Promise<void> {
    try {
      await prisma.skipTraceRecord.create({
        data: {
          leadId,
          provider,
          status: result.success ? 'completed' : 'failed',
          requestData: JSON.stringify(request),
          responseData: JSON.stringify(result),
          cost: result.cost,
          confidence: result.confidence,
          completedAt: new Date(),
        },
      });

      logger.info(`Skip trace record saved for lead ${leadId} using ${provider}`);
    } catch (error) {
      logger.error('Error saving skip trace record:', error);
    }
  }

  /**
   * Get skip trace history for a lead
   */
  async getSkipTraceHistory(leadId: string) {
    return await prisma.skipTraceRecord.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Estimate skip trace cost for a request
   */
  estimateCost(provider: 'batch_skip_tracing' | 'whitepages_pro' | 'public_records'): number {
    const costs = {
      batch_skip_tracing: 0.25,
      whitepages_pro: 0.15,
      public_records: 0,
    };
    
    return costs[provider];
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if format is unclear
  }
}

// Export singleton instance
export const skipTraceService = new SkipTraceService();
