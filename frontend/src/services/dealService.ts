import { DealAnalysis } from '../../../shared/types/deal';

// Base API URL
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Generic fetch wrapper with error handling
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Add auth headers from local storage if available
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }
  
  return response;
}

// Get a deal analysis by leadId
export async function getDeal(leadId: string): Promise<DealAnalysis> {
  const response = await fetchWithAuth(`${API_URL}/deals/${leadId}`);
  return response.json();
}

// Save a deal analysis
export async function saveDeal(leadId: string, dealData: DealAnalysis): Promise<DealAnalysis> {
  const response = await fetchWithAuth(`${API_URL}/deals/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify(dealData)
  });
  return response.json();
}

// Run a new deal analysis (refresh data from ATTOM if available)
export async function runDealAnalysis(leadId: string, feedback?: {
  removedCompIds?: string[];
  userArv?: number;
  userBudget?: number;
  notes?: string;
}): Promise<{
  dealData: DealAnalysis;
  attomAvailable: boolean;
  errors?: string[];
}> {
  const response = await fetchWithAuth(`${API_URL}/deals/${leadId}/run`, {
    method: 'POST',
    body: JSON.stringify({ feedback })
  });
  return response.json();
}

// Get comparable properties by address
export async function getComparablesByAddress(address: string, radius: number = 1): Promise<{
  comps: Array<any>;
  arv?: number;
  errors?: string[];
}> {
  const params = new URLSearchParams({
    address,
    radius: radius.toString()
  });
  
  const response = await fetchWithAuth(`${API_URL}/deals/comps?${params}`);
  return response.json();
}

// Export deal analysis to PDF or CSV
export async function exportDealToPdf(leadId: string, format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> {
  const response = await fetchWithAuth(`${API_URL}/deals/${leadId}/export?format=${format}`, {
    headers: {
      'Accept': format === 'pdf' ? 'application/pdf' : 'text/csv'
    }
  });
  
  return response.blob();
}

// Mock implementation for development when API is not available
export function useMockDealService(): boolean {
  return !process.env.REACT_APP_USE_REAL_API || process.env.REACT_APP_USE_REAL_API !== 'true';
}

// Additional helper methods can be added as needed
export function getDefaultDealAnalysis(leadId: string): DealAnalysis {
  return {
    leadId,
    source: 'Manual',
    temperature: 'WARM',
    property: {
      address: '',
      city: '',
      state: '',
      zip: '',
      beds: 3,
      baths: 2,
      sqft: 1500,
    },
    purchase: {
      offerPrice: 0,
      closingCostsPct: 0.02,
      holdingMonths: 4,
      rateAPR: 0.10,
      sellingCostsPct: 0.06
    },
    renovation: {
      budget: 25000,
      lineItems: []
    },
    comps: [],
    results: {
      totalInvestment: 0,
      netProfit: 0,
      roiPct: 0,
      riskScore: 50,
      recommendation: 'REVIEW'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
