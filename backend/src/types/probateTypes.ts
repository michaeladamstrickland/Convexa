// Comprehensive Probate Lead Generation Types
// Advanced type definitions for probate property lead mining

export interface ProbateLeadParams {
  zipCode: string;
  radius?: number; // Miles from zip code center
  dateRange?: {
    start: string; // ISO date string
    end: string;   // ISO date string
  };
  minAge?: number; // Minimum age of deceased
  minEquity?: number;
  minValue?: number;
  maxValue?: number;
  propertyTypes?: string[]; // ['single-family', 'condo', 'townhouse', 'multi-family']
  minMotivationScore?: number; // 0-100 scale
  requireContact?: boolean; // Must have estate contact information
  probateStatusFilter?: string[]; // ['no_filing_found', 'probate_initiated', 'in_probate', 'probate_closed']
  limit?: number;
}

export interface ProbateLeadResult {
  success: boolean;
  error?: string;
  data: {
    searchId: string;
    totalResults: number;
    properties: ProbateProperty[];
    searchMetadata: ProbateSearchMetadata;
  } | null;
}

export interface ProbateSearchMetadata {
  searchId: string;
  executionTime: number; // milliseconds
  totalCost: number;
  costBreakdown: Record<string, number>;
  dataSourcesUsed: string[];
  searchParameters: ProbateLeadParams;
  timestamp: string;
}

export interface DeceasedOwnerRecord {
  deceasedId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfDeath: string; // ISO date string
  age: number;
  lastKnownAddress: PropertyAddress;
  properties: PropertyReference[];
  familyMembers: FamilyMember[];
  source: string; // 'obituary_api', 'people_data_labs', etc.
  confidence: number; // 0-1 scale
  verificationSource?: string;
  causeOfDeath?: string;
  funeralHome?: string;
  obituaryText?: string;
}

export interface PropertyReference {
  id: string;
  address: string;
  ownershipType: 'sole' | 'joint' | 'trust' | 'unknown';
  ownershipPercentage?: number;
  acquisitionDate?: string;
  lastKnownValue?: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'grandchild' | 'other';
  age?: number;
  isAdult: boolean;
  contact?: ContactInformation;
  isLocal?: boolean; // Lives within 50 miles
}

export interface ProbateProperty {
  propertyId: string;
  address: PropertyAddress;
  deceasedOwner: DeceasedOwnerRecord;
  propertyDetails: PropertyDetails;
  probateStatus: 'no_filing_found' | 'probate_initiated' | 'in_probate' | 'probate_closed' | 'pending_investigation' | 'status_unknown';
  probateFilings?: ProbateFilingData[];
  estateContacts?: EstateContact[];
  estimatedValue: number;
  estimatedEquity: number;
  marketConditions: MarketConditions;
  lastSaleDate?: string;
  lastSalePrice?: number;
  propertyType: string;
  squareFootage?: number;
  yearBuilt?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  motivationFactors: ProbateMotivationFactors;
  aiAnalysis?: ProbateAIAnalysis;
  dataSource: string;
  lastUpdated: string;
  urgencyIndicators?: UrgencyIndicator[];
  riskFactors?: RiskFactor[];
}

export interface PropertyAddress {
  fullAddress: string;
  streetNumber: string;
  streetName: string;
  unit?: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyDetails {
  apn: string; // Assessor's Parcel Number
  legalDescription?: string;
  zoning?: string;
  lotDescription?: string;
  subdivisionName?: string;
  hoaInfo?: HOAInformation;
  taxInfo: PropertyTaxInfo;
  mortgageInfo?: MortgageInformation;
  titleInfo?: TitleInformation;
  utilities?: UtilityInformation;
  permits?: BuildingPermit[];
  violations?: CodeViolation[];
  insurance?: InsuranceInformation;
  marketComps?: ComparableProperty[];
}

export interface ProbateFilingData {
  caseNumber: string;
  filingDate: string;
  courtName: string;
  courtCounty: string;
  petitioner: PersonInfo;
  decedent: PersonInfo;
  executor?: PersonInfo;
  administrator?: PersonInfo;
  attorney?: AttorneyInfo;
  status: 'petition_filed' | 'administration_granted' | 'inventory_filed' | 'estate_closed' | 'contested';
  assets?: EstateAsset[];
  debts?: EstateDebt[];
  distributions?: EstateDistribution[];
  filingDocuments?: FilingDocument[];
  nextHearingDate?: string;
  estimatedValue?: number;
}

export interface EstateContact {
  contactId: string;
  name: string;
  relationship: 'executor' | 'administrator' | 'attorney' | 'spouse' | 'child' | 'heir' | 'personal_representative';
  contactInfo: ContactInformation;
  reliability: 'high' | 'medium' | 'low';
  source: 'court_records' | 'family_records' | 'public_records' | 'social_media';
  verificationDate?: string;
  preferredContactMethod?: 'phone' | 'email' | 'mail';
  bestTimeToContact?: string;
  notes?: string;
}

export interface ContactInformation {
  phones: PhoneNumber[];
  emails: EmailAddress[];
  addresses: MailingAddress[];
  socialMedia?: SocialMediaProfile[];
}

export interface PhoneNumber {
  number: string;
  type: 'mobile' | 'home' | 'work' | 'unknown';
  isPrimary: boolean;
  isVerified: boolean;
  lastVerified?: string;
}

export interface EmailAddress {
  email: string;
  type: 'personal' | 'work' | 'unknown';
  isPrimary: boolean;
  isVerified: boolean;
  lastVerified?: string;
}

export interface MailingAddress {
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  type: 'home' | 'work' | 'previous' | 'unknown';
  isCurrent: boolean;
  lastVerified?: string;
}

export interface ProbateMotivationFactors {
  timeUrgency: number; // 0-100: Urgency based on time since death
  financialPressure: number; // 0-100: Financial pressure on estate
  propertyCondition: number; // 0-100: Property maintenance needs
  heirSituation: number; // 0-100: Complexity of heir situation
  marketFactors: number; // 0-100: Market conditions favoring sale
  overallScore: number; // 0-100: Combined motivation score
}

export interface ProbateAIAnalysis {
  motivationScore: number; // 0-100
  urgencyScore: number; // 0-100
  dealPotentialScore: number; // 0-100
  contactabilityScore: number; // 0-100
  discountPotential: number; // Percentage discount expected
  reasoning: string;
  recommendation: string;
  keyFactors: string[];
  riskAssessment: 'low' | 'medium' | 'high';
  estimatedTimeToClose: number; // Days
  suggestedApproach: string;
}

export interface MarketConditions {
  medianHomePrice: number;
  averageDaysOnMarket: number;
  priceAppreciationRate: number; // Annual percentage
  inventory: 'low' | 'medium' | 'high';
  marketTrend: 'buyers' | 'sellers' | 'balanced';
  seasonalAdjustment: number;
  competitionLevel: 'low' | 'medium' | 'high';
}

export interface UrgencyIndicator {
  type: 'tax_delinquency' | 'mortgage_default' | 'maintenance_issues' | 'family_dispute' | 'court_deadline' | 'market_decline';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImpact: number; // 0-100
  timeframe?: string; // "30 days", "3 months", etc.
}

export interface RiskFactor {
  type: 'title_issues' | 'multiple_heirs' | 'contested_estate' | 'tax_liens' | 'structural_problems' | 'market_volatility';
  probability: number; // 0-100
  impact: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

// Supporting interfaces
export interface PersonInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  ssn?: string; // Last 4 digits only
}

export interface AttorneyInfo extends PersonInfo {
  barNumber?: string;
  firmName?: string;
  specialization?: string[];
}

export interface EstateAsset {
  type: 'real_estate' | 'bank_account' | 'investment' | 'personal_property' | 'business' | 'other';
  description: string;
  estimatedValue: number;
  location?: string;
}

export interface EstateDebt {
  creditor: string;
  type: 'mortgage' | 'credit_card' | 'loan' | 'tax' | 'medical' | 'other';
  amount: number;
  priority: 'secured' | 'unsecured' | 'administrative';
}

export interface EstateDistribution {
  beneficiary: string;
  relationship: string;
  percentage?: number;
  amount?: number;
  assetType?: string;
}

export interface FilingDocument {
  documentType: string;
  filingDate: string;
  pageCount?: number;
  summary?: string;
}

export interface HOAInformation {
  name?: string;
  monthlyFee?: number;
  annualFee?: number;
  amenities?: string[];
  restrictions?: string[];
  financialHealth?: 'good' | 'fair' | 'poor';
}

export interface PropertyTaxInfo {
  annualTax: number;
  assessedValue: number;
  taxRate: number;
  isDelinquent: boolean;
  delinquentAmount?: number;
  exemptions?: string[];
  lastPaymentDate?: string;
}

export interface MortgageInformation {
  lender: string;
  originalAmount: number;
  currentBalance?: number;
  interestRate?: number;
  monthlyPayment?: number;
  isDelinquent?: boolean;
  foreclosureStatus?: 'current' | 'late' | 'default' | 'foreclosure';
}

export interface TitleInformation {
  titleCompany?: string;
  policyNumber?: string;
  titleIssues?: TitleIssue[];
  liens?: Lien[];
  easements?: Easement[];
}

export interface TitleIssue {
  type: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  resolutionRequired: boolean;
}

export interface Lien {
  type: 'tax' | 'mechanic' | 'judgment' | 'hoa' | 'other';
  amount: number;
  creditor: string;
  filingDate: string;
  priority: number;
}

export interface Easement {
  type: 'utility' | 'access' | 'drainage' | 'other';
  description: string;
  grantee: string;
  impact: 'minimal' | 'moderate' | 'significant';
}

export interface UtilityInformation {
  electric: UtilityProvider;
  gas?: UtilityProvider;
  water: UtilityProvider;
  sewer: UtilityProvider;
  internet?: UtilityProvider[];
}

export interface UtilityProvider {
  company: string;
  accountStatus: 'active' | 'inactive' | 'delinquent';
  averageMonthlyBill?: number;
}

export interface BuildingPermit {
  permitNumber: string;
  type: string;
  description: string;
  issueDate: string;
  completionDate?: string;
  status: 'issued' | 'in_progress' | 'completed' | 'expired';
  contractor?: string;
}

export interface CodeViolation {
  violationId: string;
  type: string;
  description: string;
  issueDate: string;
  status: 'open' | 'resolved' | 'pending';
  fineAmount?: number;
}

export interface InsuranceInformation {
  carrier?: string;
  policyNumber?: string;
  coverage?: InsuranceCoverage;
  premiumAmount?: number;
  status: 'active' | 'lapsed' | 'unknown';
}

export interface InsuranceCoverage {
  dwelling: number;
  personalProperty: number;
  liability: number;
  deductible: number;
}

export interface ComparableProperty {
  address: string;
  saleDate: string;
  salePrice: number;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  distance: number; // Miles from subject property
  adjustedPrice: number;
}

export interface SocialMediaProfile {
  platform: string;
  username?: string;
  url?: string;
  lastActive?: string;
  isVerified: boolean;
}
