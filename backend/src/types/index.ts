// Property Types
export interface PropertyDetails {
  address: string;
  propertyId: string;
  estimatedValue: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  yearBuilt?: number;
  squareFeet?: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  propertyType: string;
  zoning?: string;
  taxAssessment?: number;
}

// Owner Types
export interface OwnerInfo {
  name: string;
  mailingAddress?: string;
  phoneNumbers?: string[];
  emailAddresses?: string[];
  ownershipType: string;
  ownershipPercentage?: number;
  dateAcquired?: string;
}

// Probate Types
export interface ProbateCase {
  caseNumber: string;
  filingDate: string;
  county: string;
  state: string;
  courtName: string;
  deceasedName: string;
  estateValue?: number;
  propertyAddresses: string[];
  administrators?: string[];
  attorneys?: string[];
  status: string;
  nextHearingDate?: string;
}

// Address Validation Types
export interface ValidatedAddress {
  formattedAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  components: {
    streetNumber: string;
    street: string;
    city: string;
    county: string;
    state: string;
    zipCode: string;
    country: string;
  };
  neighborhood?: {
    name: string;
    medianHomeValue?: number;
    demographics?: any;
  };
}

// Lead Types
export interface LeadScore {
  score: number;
  confidence: number;
  factors: {
    equity: number;
    motivation: number;
    timeframe: number;
    contactability: number;
  };
  analysis: string;
  recommendations: string[];
}

// API Response Types
export interface GenerateLeadResponse {
  property: PropertyDetails;
  owner: OwnerInfo;
  probate?: ProbateCase;
  validatedAddress: ValidatedAddress;
  leadScore: LeadScore;
  generatedAt: string;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: any;
}
