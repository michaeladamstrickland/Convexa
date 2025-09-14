// Real Estate Lead Generation Service - PRODUCTION READY
// Integrates with premium APIs for real property data

export interface RealPropertyData {
  zpid?: string; // Zillow Property ID
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Property Details
  propertyType: 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land';
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize?: number;
  yearBuilt: number;
  
  // Financial Data
  zestimate: number; // Zillow estimate
  rentEstimate?: number;
  taxAssessedValue: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  mortgageBalance?: number;
  equity: number;
  equityPercent: number;
  
  // Tax Information
  taxDelinquency: {
    isDelinquent: boolean;
    yearsDelinquent: number;
    totalOwed: number;
    lastPaymentDate?: string;
  };
  
  // Owner Information
  owner: {
    name: string;
    mailingAddress?: string;
    isAbsenteeOwner: boolean;
    ownershipDuration: number; // years
  };
  
  // Distress Indicators
  distressSignals: {
    foreclosureNotice: boolean;
    preForeclosure: boolean;
    codeViolations: CodeViolation[];
    vacancyIndicators: VacancyIndicator[];
    probateStatus: ProbateStatus;
  };
  
  // Lead Scoring
  leadScore: number; // 0-100
  motivationScore: number; // 0-100
  dealPotential: 'poor' | 'fair' | 'good' | 'excellent';
  
  // Contact Information (from skip tracing)
  contacts: ContactMethod[];
  
  // Data Sources
  dataSources: DataSource[];
  lastUpdated: string;
}

export interface CodeViolation {
  violationType: string;
  description: string;
  dateIssued: string;
  status: 'open' | 'closed' | 'pending';
  fineAmount?: number;
  complianceDeadline?: string;
}

export interface VacancyIndicator {
  type: 'utility_disconnect' | 'mail_hold' | 'visual_signs' | 'neighbor_report';
  confidence: number; // 0-100
  detectedDate: string;
  description: string;
  source: string;
}

export interface ProbateStatus {
  isInProbate: boolean;
  caseNumber?: string;
  filingDate?: string;
  courtName?: string;
  estimatedValue?: number;
  heirs?: ProbateHeir[];
}

export interface ProbateHeir {
  name: string;
  relationship: string;
  contactInfo?: ContactMethod[];
}

export interface ContactMethod {
  type: 'phone' | 'email' | 'address';
  value: string;
  confidence: number; // 0-100
  source: string;
  verified: boolean;
  lastVerified?: string;
}

export interface DataSource {
  provider: string;
  endpoint: string;
  lastSync: string;
  cost: number;
}

// API Configuration
export interface APIConfig {
  // Property Data APIs
  zillow: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
  rentspree: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
  attomData: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
  realtyMole: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
  
  // Skip Tracing APIs
  batchSkipTracing: {
    apiKey: string;
    baseUrl: string;
    costPerLookup: number;
  };
  whitepagesPro: {
    apiKey: string;
    baseUrl: string;
    costPerLookup: number;
  };
  
  // Public Records APIs
  propertyRadar: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
  dataTree: {
    apiKey: string;
    baseUrl: string;
    costPerQuery: number;
  };
  
  // Utility APIs
  postalService: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
  };
}

// Search Parameters
export interface PropertySearchParams {
  zipCodes: string[];
  filters: {
    minValue?: number;
    maxValue?: number;
    minEquityPercent?: number;
    maxDaysOnMarket?: number;
    requireDistressSignals?: boolean;
    includeForeclosures?: boolean;
    includeProbate?: boolean;
    includeTaxDelinquent?: boolean;
    includeVacant?: boolean;
    includeAbsenteeOwners?: boolean;
  };
  sorting: {
    field: 'leadScore' | 'motivationScore' | 'equity' | 'value' | 'lastUpdated';
    direction: 'asc' | 'desc';
  };
  pagination: {
    limit: number;
    offset: number;
  };
}

// Search Results
export interface PropertySearchResults {
  properties: RealPropertyData[];
  totalCount: number;
  searchMetadata: {
    zipCodesSearched: string[];
    apiCallsMade: number;
    totalCost: number;
    searchDuration: number; // milliseconds
    dataFreshness: string; // timestamp of oldest data
  };
  aggregations: {
    avgLeadScore: number;
    avgPropertyValue: number;
    totalEquity: number;
    distressSignalBreakdown: Record<string, number>;
    contactabilityRate: number; // percentage with phone/email
  };
}

// Lead Generation Configuration
export interface LeadGenerationConfig {
  targetMarkets: string[]; // zip codes
  refreshInterval: number; // hours
  maxBudgetPerDay: number; // dollars
  priorityFilters: {
    minLeadScore: number;
    requiredDistressSignals: string[];
    maxCompetitionLevel: number;
  };
  notifications: {
    webhookUrl?: string;
    emailAlerts: boolean;
    smsAlerts: boolean;
  };
  skipTracing: {
    enabled: boolean;
    autoSkipTrace: boolean;
    maxCostPerLead: number;
  };
}

export default RealPropertyData;
