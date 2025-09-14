import axios from 'axios';

// Get API URL from environment variables or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface SearchParams {
  query?: string;
  minValue?: number;
  maxValue?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  source?: string;
  temperature?: string;
  status?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface Lead {
  id: string;
  propertyAddress: string;
  ownerName: string | null;
  phone: string | null;
  phones: string[];
  email: string | null;
  emails: string[];
  estimatedValue: number | null;
  equity: number | null;
  motivationScore: number;
  aiScore: number;
  temperatureTag: string;
  status: string;
  source: string;
  sourceType: string;
  isProbate: boolean;
  isVacant: boolean;
  conditionScore: number | null;
  leadScore: number | null;
  notes: string | null;
  rawData: any;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  leads: Lead[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface AnalyticsResponse {
  analytics: {
    totalLeads: number;
    totalEstimatedValue: number;
    avgMotivationScore: number;
    temperatureDistribution: { tag: string; count: number }[];
    leadsBySource: { source: string; count: number }[];
    leadsByStatus: { status: string; count: number }[];
    potentialRevenue: number;
  };
}

const searchService = {
  /**
   * Search for leads with various filters
   */
  searchLeads: async (params: SearchParams): Promise<SearchResponse> => {
    try {
      const response = await axios.post(`${API_URL}/api/search`, params);
      return response.data;
    } catch (error) {
      console.error('Error searching leads:', error);
      throw error;
    }
  },

  /**
   * Get lead analytics
   */
  getAnalytics: async (): Promise<AnalyticsResponse> => {
    try {
      const response = await axios.get(`${API_URL}/api/search/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  },

  /**
   * Clear search cache
   */
  clearCache: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(`${API_URL}/api/search/clear-cache`);
      return response.data;
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
};

export default searchService;
