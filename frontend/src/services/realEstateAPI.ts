// Frontend API Service for Real Estate Lead Generation
// Connects React components to real property APIs

import axios from 'axios';

// Vite uses import.meta.env.*; default to proxying to /api in dev
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for property searches
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🔍 Making API request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API response received: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Types for API requests and responses
export interface PropertySearchFilters {
  minValue?: number;
  maxValue?: number;
  minEquityPercent?: number;
  requireDistressSignals?: boolean;
  includeForeclosures?: boolean;
  includeProbate?: boolean;
  includeTaxDelinquent?: boolean;
  includeVacant?: boolean;
  includeAbsenteeOwners?: boolean;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export interface PropertyLead {
  id: string;
  propertyAddress: string;
  ownerName: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  marketValue: number;
  aiScore: number;
  source: string;
  motivationScore: number;
  status: string;
  leadNotes: any[];
  tags: string[];
  createdAt: string;
  realEstateData: {
    equity: number;
    equityPercent: number;
    propertyType: string;
    yearBuilt: number;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
    dealPotential: string;
    distressSignals: any;
    taxDelinquency: any;
  };
}

export interface PropertySearchResponse {
  success: boolean;
  zipCode?: string;
  zipCodes?: string[];
  area?: string;
  leadCount: number;
  leads: PropertyLead[];
  metadata: {
    totalCost: number;
    apiCallsUsed: number;
    searchDuration: number;
    filters: any;
  };
  aggregations: {
    averageValue: number;
    averageEquity: number;
    propertyTypes: Record<string, number>;
    distressLevels: Record<string, number>;
  };
  message: string;
}

export interface APIUsageStats {
  success: boolean;
  stats: {
    totalCosts: number;
    requestCount: number;
    costBreakdown: Record<string, string>;
    recommendations: string[];
  };
}

// Real Estate API Service Class
export class RealEstateAPIService {
  // Search properties by single zip code with REAL APIs
  static async searchRealZipCode(
    zipCode: string, 
    filters: PropertySearchFilters = {}
  ): Promise<PropertySearchResponse> {
    try {
      console.log(`🏠 Initiating REAL property search for zip code: ${zipCode}`);
      
      const response = await api.post('/api/real-estate/search-real-zip', {
        zipCode,
        filters
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Property search failed');
      }

      console.log(`✅ REAL search completed: ${response.data.leadCount} properties found`);
      console.log(`💰 Search cost: $${response.data.metadata.totalCost.toFixed(2)}`);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Real zip code search failed:', error);
      throw new Error(
        error.response?.data?.details || 
        error.response?.data?.error || 
        'Failed to search properties'
      );
    }
  }

  // Search properties across multiple zip codes with REAL APIs
  static async searchRealMultipleZips(
    zipCodes: string[], 
    filters: PropertySearchFilters = {}
  ): Promise<PropertySearchResponse> {
    try {
      console.log(`🌍 Initiating REAL property search for ${zipCodes.length} zip codes`);
      
      const response = await api.post('/api/real-estate/search-real-multiple-zips', {
        zipCodes,
        filters
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Multi-zip search failed');
      }

      console.log(`✅ REAL multi-zip search completed: ${response.data.leadCount} properties found`);
      console.log(`💰 Search cost: $${response.data.metadata.totalCost.toFixed(2)}`);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Real multi-zip search failed:', error);
      throw new Error(
        error.response?.data?.details || 
        error.response?.data?.error || 
        'Failed to search multiple zip codes'
      );
    }
  }

  // Search Phoenix Metro target area with REAL APIs
  static async searchRealTargetArea(
    filters: PropertySearchFilters = {}
  ): Promise<PropertySearchResponse> {
    try {
      console.log('🎯 Initiating REAL target area search for Phoenix Metro');
      
      const response = await api.post('/api/real-estate/search-real-target-area', {
        filters
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Target area search failed');
      }

      console.log(`✅ REAL target area search completed: ${response.data.leadCount} properties found`);
      console.log(`💰 Search cost: $${response.data.metadata.totalCost.toFixed(2)}`);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Real target area search failed:', error);
      throw new Error(
        error.response?.data?.details || 
        error.response?.data?.error || 
        'Failed to search target area'
      );
    }
  }

  // Get API usage statistics and costs
  static async getAPIUsageStats(): Promise<APIUsageStats> {
    try {
      const response = await api.get('/api/real-estate/api-usage-stats');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get usage stats');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get API usage stats:', error);
      throw new Error(
        error.response?.data?.error || 
        'Failed to retrieve usage statistics'
      );
    }
  }

  // Reset cost counters (development/testing only)
  static async resetCounters(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/api/real-estate/reset-counters');
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to reset counters:', error);
      throw new Error(
        error.response?.data?.error || 
        'Failed to reset counters'
      );
    }
  }

  // Format currency for display
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  }

  // Format property address for display
  static formatAddress(address: string): string {
    return address.replace(/,\s*/g, ', ').trim();
  }

  // Calculate lead quality score
  static calculateLeadQuality(lead: PropertyLead): 'excellent' | 'good' | 'fair' | 'poor' {
    const score = lead.aiScore;
    const motivation = lead.motivationScore;
    const hasContact = !!(lead.ownerPhone || lead.ownerEmail);
    
    const combinedScore = (score + motivation) / 2;
    
    if (combinedScore >= 80 && hasContact) return 'excellent';
    if (combinedScore >= 65) return 'good';
    if (combinedScore >= 45) return 'fair';
    return 'poor';
  }

  // Get color for lead quality
  static getLeadQualityColor(quality: string): string {
    switch (quality) {
      case 'excellent': return '#10B981'; // green
      case 'good': return '#3B82F6';      // blue
      case 'fair': return '#F59E0B';      // yellow
      case 'poor': return '#EF4444';      // red
      default: return '#6B7280';          // gray
    }
  }

  // Generate contact script based on property data
  static generateContactScript(lead: PropertyLead): string {
    const hasDistress = lead.tags.some(tag => 
      ['foreclosure', 'tax_delinquent', 'probate', 'code_violations'].includes(tag)
    );
    
    const isAbsentee = lead.tags.includes('absentee_owner');
    const hasHighEquity = lead.tags.includes('high_equity');
    
    let script = `Hi ${lead.ownerName}, I hope you're doing well. `;
    
    if (hasDistress) {
      script += `I noticed you might be dealing with some challenges regarding your property at ${lead.propertyAddress}. `;
      script += `I work with homeowners in situations like yours and might be able to help. `;
    } else if (isAbsentee) {
      script += `I see you own a property at ${lead.propertyAddress}. `;
      script += `As an out-of-area owner, you might be interested in discussing your options for this property. `;
    } else {
      script += `I'm reaching out about your property at ${lead.propertyAddress}. `;
    }
    
    if (hasHighEquity) {
      script += `Given the current market conditions and your property's equity position, `;
      script += `there might be some interesting opportunities worth discussing. `;
    }
    
    script += `Would you be open to a brief conversation about your property? `;
    script += `I'm available at your convenience and promise to be respectful of your time.`;
    
    return script;
  }
}

export default RealEstateAPIService;
