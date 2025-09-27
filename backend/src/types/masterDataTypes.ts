// Master Data Types for Comprehensive Real Estate Intelligence
// Covers all major data sources: Property, Probate, Distress, MLS, Skip Tracing

// Supporting Types First (to avoid circular dependencies)
export interface ContactInfo {
  type: 'phone' | 'email' | 'address' | 'social_media';
  value: string;
  confidence_score: number; // 0-100
  last_verified?: Date;
  source: string;
}

export interface FamilyMember {
  name: string;
  relationship: 'spouse' | 'child' | 'sibling' | 'parent' | 'other';
  age?: number;
  location?: string;
  inheritance_priority: number; // 1-10 scale
  contact_attempts?: ContactAttempt[];
  skip_trace_results?: SkipTraceResult[];
}

export interface ContactAttempt {
  attempt_date: Date;
  method: 'phone' | 'sms' | 'email' | 'mail';
  status: 'successful' | 'no_answer' | 'voicemail' | 'invalid';
  notes?: string;
  follow_up_scheduled?: Date;
}

export interface AttorneyInfo {
  name: string;
  phone: string | null;
  email: string | null;
  firm: string | null;
  bar_number?: string;
  address?: string;
}

export interface PermitRecord {
  permitNumber: string;
  permitType: string;
  workDescription: string;
  issuedDate: Date;
  completedDate?: Date;
  permitValue: number;
  contractor: string;
  status: 'issued' | 'in_progress' | 'completed' | 'expired';
}

export interface TaxRecord {
  year: number;
  assessedValue: number;
  taxAmount: number;
  paidAmount: number;
  paymentDate?: Date;
  delinquent: boolean;
  penalties: number;
  interest: number;
}

export interface DetailedPropertyInfo {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  stories: number;
  garage: boolean;
  pool: boolean;
  condition: string;
  constructionType: string;
  roofType: string;
  heating: string;
  cooling: string;
}

export interface OwnershipRecord {
  ownerName: string;
  acquisitionDate: Date;
  saleDate?: Date;
  purchasePrice: number;
  salePrice?: number;
  deedType: string;
  ownershipDuration: number; // months
}

export interface ValuationRecord {
  valuationDate: Date;
  estimatedValue: number;
  valuationSource: string;
  confidence: number;
  comparableSales: number;
}

export interface TaxAssessment {
  assessmentYear: number;
  landValue: number;
  improvementValue: number;
  totalAssessedValue: number;
  exemptions: number;
  taxableValue: number;
  millageRate: number;
  annualTax: number;
}

export interface PropertyBasics {
  parcelNumber: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
}

export interface OwnerDetails {
  names: string[];
  mailingAddress: string;
  ownershipType: string;
  acquisitionDate: Date;
}

export interface ValuationDetails {
  estimatedValue: number;
  assessedValue: number;
  marketValue: number;
  lastSalePrice: number;
  lastSaleDate: Date;
}

export interface SaleRecord {
  saleDate: Date;
  salePrice: number;
  buyerName: string;
  sellerName: string;
  deedType: string;
  financing: string;
}

export interface RentalData {
  estimatedRent: number;
  rentRange: {
    low: number;
    high: number;
  };
  capRate: number;
  cashFlow: number;
}

export interface AssetRecord {
  assetType: string;
  description: string;
  value: number;
  secured: boolean;
  exemptionClaimed: boolean;
}

export interface TrusteeInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  appointmentDate: Date;
}

export interface CodeViolationRecord {
  violationId: string;
  violationType: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'severe';
  fineAmount: number;
  citationDate: Date;
  complianceDeadline: Date;
  status: 'open' | 'resolved' | 'appealed';
}

export interface VacancyIndicators {
  isVacant: boolean;
  vacancyDuration: number; // months
  indicators: string[];
  confidence: number;
}

export interface DivorceRecord {
  caseNumber: string;
  filingDate: Date;
  status: 'pending' | 'finalized' | 'dismissed';
  propertyDivision: boolean;
  urgencyScore: number;
}

export interface EvictionRecord {
  caseNumber: string;
  filingDate: Date;
  tenant: string;
  amount: number;
  status: 'filed' | 'judgment' | 'dismissed';
}

export interface ListingDistressSignals {
  daysOnMarket: number;
  priceReductions: number;
  originalPrice: number;
  currentPrice: number;
  reductionPercentage: number;
  listingComments: string[];
}

export interface JudgmentRecord {
  caseNumber: string;
  judgmentDate: Date;
  creditor: string;
  amount: number;
  status: 'active' | 'satisfied' | 'expired';
}

export interface ComparableSale {
  address: string;
  saleDate: Date;
  salePrice: number;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  distance: number;
}

export interface MarketTrend {
  period: string;
  averagePrice: number;
  salesVolume: number;
  daysOnMarket: number;
  priceChange: number;
}

export interface MasterAPIConfig {
  // Property Ownership & Public Records
  attomData: APIEndpoint;
  propMix: APIEndpoint;
  estated: APIEndpoint;
  dataTree: APIEndpoint;
  coreLogicTrestle: APIEndpoint;
  regrid: APIEndpoint;
  
  // Deceased Owner & Probate Data
  usObituaryAPI: APIEndpoint;
  obitAPI: APIEndpoint;
  tributesAPI: APIEndpoint;
  peopleDataLabs: APIEndpoint;
  
  // MLS & Listings
  mlsGrid: APIEndpoint;
  trestle: APIEndpoint;
  zillowUnofficial: APIEndpoint;
  realtorRapidAPI: APIEndpoint;
  redfinScraper: APIEndpoint;
  
  // Distress & Legal Data
  foreclosureCom: APIEndpoint;
  propertyRadar: APIEndpoint;
  pacerBankruptcy: APIEndpoint;
  localCountySites: APIEndpoint;
  
  // Skip Tracing & Contact Enrichment
  batchSkipTracing: APIEndpoint;
  idiDataLexisNexis: APIEndpoint;
  truePeopleSearch: APIEndpoint;
  clearbit: APIEndpoint;
  fullContact: APIEndpoint;
  
  // AI & Intelligence
  openAI: APIEndpoint;
  twilioVoice: APIEndpoint;
  twilioSMS: APIEndpoint;
  googleMaps: APIEndpoint;
  melissaData: APIEndpoint;
  
  // Additional Real Estate Data
  rentometer: APIEndpoint;
  zillowRentEstimate: APIEndpoint;
  airDNA: APIEndpoint;
  buildZoom: APIEndpoint;
}

export interface APIEndpoint {
  apiKey: string;
  baseUrl: string;
  rateLimit?: number;
  costPerCall?: number;
  costPerRequest?: number;
  costPerLookup?: number;
  subscription?: 'free' | 'basic' | 'pro' | 'enterprise';
  requiresLicense?: boolean;
  dataType?: 'property' | 'contact' | 'legal' | 'mls' | 'ai' | 'verification';
  enabled?: boolean;
}

// Property Ownership & Public Records Types
export interface AttomPropertyData {
  propertyId: string;
  address: PropertyAddress;
  owner: OwnerInformation;
  valuation: PropertyValuation;
  deeds: DeedRecord[];
  liens: LienRecord[];
  permits: PermitRecord[];
  taxData: TaxRecord;
  equity: EquityAnalysis;
  mortgageData: MortgageData;
}

export interface PropMixData {
  parcelId: string;
  propertyDetails: DetailedPropertyInfo;
  ownershipHistory: OwnershipRecord[];
  valuationHistory: ValuationRecord[];
  permits: PermitRecord[];
  taxAssessment: TaxAssessment;
}

export interface EstatedPropertyData {
  propertyId: string;
  basicInfo: PropertyBasics;
  ownerInfo: OwnerDetails;
  valuationData: ValuationDetails;
  salesHistory: SaleRecord[];
  rentalEstimate: RentalData;
}

// Deceased Owner & Probate Types
export interface ObituaryRecord {
  deceasedName: string;
  deathDate: Date;
  obituaryText: string;
  funeralHome?: string;
  cemetery?: string;
  survivingFamily: FamilyMember[];
  lastKnownAddress?: string;
  estimatedNetWorth?: number;
  probateProbability: number;
  relatedProperties: string[];
}

export interface ProbateFilingData {
  caseNumber: string;
  deceasedName: string;
  filingDate: Date;
  court: string;
  county: string;
  executor: ExecutorInfo;
  attorney: AttorneyInfo;
  estimatedEstate: number;
  properties: ProbateProperty[];
  heirs: HeirInfo[];
  status: 'filed' | 'active' | 'closed' | 'pending';
  nextHearingDate?: Date;
}

export interface ExecutorInfo {
  name: string;
  relationship: string;
  address?: string;
  phone?: string;
  email?: string;
  appointmentDate: Date;
}

export interface HeirInfo {
  name: string;
  relationship: string;
  inheritanceShare: number;
  address?: string;
  contactInfo?: ContactInfo[];
  motivationLevel: number;
}

export interface ProbateProperty {
  address: string;
  value: number;
  equity: number;
  condition: string;
  vacancyStatus: boolean;
  inheritanceDispute: boolean;
  saleUrgency: number;
}

// MLS & Listings Types
export interface MLSListingData {
  mlsNumber: string;
  address: string;
  listPrice: number;
  originalPrice: number;
  priceReductions: PriceReduction[];
  daysOnMarket: number;
  listingStatus: 'active' | 'pending' | 'expired' | 'withdrawn';
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  listingAgent: AgentInfo;
  sellerMotivation: MotivationIndicators;
}

export interface PriceReduction {
  date: Date;
  oldPrice: number;
  newPrice: number;
  reductionAmount: number;
  reductionPercentage: number;
}

export interface AgentInfo {
  name: string;
  phone: string;
  email: string;
  brokerage: string;
  licenseNumber?: string;
}

export interface MotivationIndicators {
  priceReductionCount: number;
  daysOnMarket: number;
  originalVsCurrentPrice: number;
  seasonalFactors: string[];
  marketConditions: string;
  sellerComments?: string;
}

// Distress & Legal Data Types
export interface ForeclosureData {
  propertyAddress: string;
  foreclosureStage: 'pre_foreclosure' | 'auction' | 'reo' | 'completed';
  noticeDate: Date;
  auctionDate?: Date;
  openingBid?: number;
  lenderName: string;
  defaultAmount: number;
  monthsBehind: number;
  equity: number;
  ownerContact: ContactInfo[];
  urgencyScore: number;
}

export interface BankruptcyRecord {
  caseNumber: string;
  filingDate: Date;
  bankruptcyType: 'chapter_7' | 'chapter_11' | 'chapter_13';
  debtor: DebtorInfo;
  assets: AssetRecord[];
  properties: BankruptcyProperty[];
  trustee: TrusteeInfo;
  status: 'active' | 'dismissed' | 'discharged';
  meetingOfCreditors?: Date;
}

export interface DebtorInfo {
  name: string;
  address: string;
  attorney: AttorneyInfo;
  occupation?: string;
  income?: number;
  expenses?: number;
}

export interface BankruptcyProperty {
  address: string;
  value: number;
  mortgageBalance: number;
  equity: number;
  exemptionClaimed: boolean;
  saleUrgency: number;
  dealPotential: number;
}

export interface TaxDelinquencyData {
  propertyAddress: string;
  ownerName: string;
  delinquentAmount: number;
  yearsDelinquent: number;
  penaltiesAndInterest: number;
  totalAmount: number;
  paymentHistory: TaxPaymentRecord[];
  foreclosureRisk: number;
  payoffTimeline: number;
  contactUrgency: number;
}

export interface TaxPaymentRecord {
  taxYear: number;
  assessedAmount: number;
  paidAmount: number;
  paymentDate?: Date;
  penalties: number;
  interest: number;
  status: 'paid' | 'partial' | 'delinquent';
}

// Skip Tracing & Contact Enhancement Types
export interface SkipTraceResult {
  personName: string;
  phones: PhoneRecord[];
  emails: EmailRecord[];
  addresses: AddressRecord[];
  relatives: RelativeRecord[];
  associates: AssociateRecord[];
  employmentHistory: EmploymentRecord[];
  socialProfiles: SocialProfile[];
  lastUpdated: Date;
  confidenceScore: number;
}

export interface PhoneRecord {
  number: string;
  type: 'mobile' | 'landline' | 'voip';
  carrier: string;
  isActive: boolean;
  lastSeen: Date;
  confidence: number;
}

export interface EmailRecord {
  email: string;
  domain: string;
  isActive: boolean;
  lastSeen: Date;
  confidence: number;
  source: string;
}

export interface AddressRecord {
  fullAddress: string;
  type: 'current' | 'previous' | 'mailing';
  residencyDuration: string;
  lastSeen: Date;
  confidence: number;
}

export interface RelativeRecord {
  name: string;
  relationship: string;
  age?: number;
  address?: string;
  phone?: string;
  email?: string;
}

export interface AssociateRecord {
  name: string;
  associationType: 'neighbor' | 'coworker' | 'business_partner';
  address?: string;
  phone?: string;
}

export interface EmploymentRecord {
  company: string;
  position: string;
  startDate?: Date;
  endDate?: Date;
  industry: string;
  address?: string;
}

export interface SocialProfile {
  platform: 'facebook' | 'linkedin' | 'twitter' | 'instagram';
  profileUrl: string;
  username: string;
  lastActive?: Date;
}

// AI Intelligence & Scoring Types
export interface AILeadScore {
  overallScore: number;
  motivationScore: number;
  contactabilityScore: number;
  dealPotentialScore: number;
  urgencyScore: number;
  scoringFactors: ScoringFactor[];
  recommendedStrategy: ContactStrategy;
  predictedDiscount: number;
  dealProbability: number;
  optimalTiming: Date;
}

export interface ScoringFactor {
  factor: string;
  weight: number;
  impact: number;
  description: string;
}

export interface ContactStrategy {
  preferredMethod: 'phone' | 'sms' | 'email' | 'mail';
  bestContactTime: string;
  messagingTone: 'professional' | 'empathetic' | 'urgent';
  keyPainPoints: string[];
  trustBuildingApproach: string;
  objectionHandling: string[];
  followUpSequence: FollowUpStep[];
}

export interface FollowUpStep {
  stepNumber: number;
  delay: number; // days
  method: string;
  message: string;
  condition?: string;
}

// Additional Real Estate Data Types
export interface RentalMarketData {
  address: string;
  averageRent: number;
  rentRange: RentRange;
  occupancyRate: number;
  monthsToLease: number;
  comparableRentals: ComparableRental[];
  marketTrends: RentalTrend[];
  investmentPotential: InvestmentAnalysis;
}

export interface RentRange {
  min: number;
  max: number;
  median: number;
}

export interface ComparableRental {
  address: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  distance: number;
}

export interface RentalTrend {
  period: string;
  averageRent: number;
  changePercentage: number;
  vacancyRate: number;
}

export interface InvestmentAnalysis {
  capRate: number;
  cashFlow: number;
  roi: number;
  appreciationForecast: number;
  riskScore: number;
}

export interface PermitData {
  permitNumber: string;
  permitType: string;
  workDescription: string;
  issuedDate: Date;
  completedDate?: Date;
  permitValue: number;
  contractor: string;
  status: 'issued' | 'in_progress' | 'completed' | 'expired';
}

// Supporting Types
export interface PropertyAddress {
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  fullAddress: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface OwnerInformation {
  names: string[];
  mailingAddress: PropertyAddress;
  ownershipType: 'individual' | 'trust' | 'llc' | 'corporation';
  ownershipPercentage: number;
  acquisitionDate: Date;
  isAbsenteeOwner: boolean;
  distanceFromProperty: number;
}

export interface PropertyValuation {
  estimatedValue: number;
  assessedValue: number;
  marketValue: number;
  lastSalePrice: number;
  lastSaleDate: Date;
  pricePerSquareFoot: number;
  valuationConfidence: number;
  valuationSource: string;
}

export interface EquityAnalysis {
  estimatedEquity: number;
  equityPercentage: number;
  loanBalance: number;
  loanToValue: number;
  equityConfidence: number;
}

export interface MortgageData {
  lender: string;
  loanAmount: number;
  interestRate: number;
  loanType: string;
  originationDate: Date;
  maturityDate: Date;
  monthlyPayment: number;
  currentBalance: number;
}

export interface DeedRecord {
  recordingDate: Date;
  deedType: string;
  grantor: string;
  grantee: string;
  salePrice: number;
  documentNumber: string;
}

export interface LienRecord {
  lienType: string;
  lienAmount: number;
  filingDate: Date;
  lienHolder: string;
  status: 'active' | 'released' | 'expired';
}

// Master Search Parameters
export interface MasterSearchParams {
  // Geographic Filters
  zipCodes?: string[];
  counties?: string[];
  states?: string[];
  cities?: string[];
  radiusFromPoint?: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
  };
  
  // Property Filters
  propertyTypes?: string[];
  minValue?: number;
  maxValue?: number;
  minEquity?: number;
  minEquityPercent?: number;
  minSquareFootage?: number;
  maxSquareFootage?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  
  // Distress Filters
  includeForeclosures?: boolean;
  includeProbate?: boolean;
  includeTaxDelinquent?: boolean;
  includeBankruptcy?: boolean;
  includeVacant?: boolean;
  includeCodeViolations?: boolean;
  includeEvictions?: boolean;
  includeDivorce?: boolean;
  
  // Motivation Filters
  minMotivationScore?: number;
  maxDaysOnMarket?: number;
  priceReductionCount?: number;
  includeExpiredListings?: boolean;
  includeAbsenteeOwners?: boolean;
  
  // Contact Filters
  requirePhoneNumber?: boolean;
  requireEmailAddress?: boolean;
  skipTraceRequired?: boolean;
  
  // Results Configuration
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface MasterSearchResponse {
  totalResults: number;
  properties: MasterPropertyRecord[];
  searchMetadata: SearchMetadata;
  costBreakdown: CostBreakdown;
  aggregations: SearchAggregations;
}

export interface MasterPropertyRecord {
  // Core Property Data
  propertyId: string;
  address: PropertyAddress;
  propertyDetails: DetailedPropertyInfo;
  
  // Ownership Data
  owner: OwnerInformation;
  ownershipHistory: OwnershipRecord[];
  
  // Valuation Data
  valuation: PropertyValuation;
  equity: EquityAnalysis;
  
  // Distress Signals
  distressSignals: ComprehensiveDistressSignals;
  
  // Contact Information
  contacts: EnrichedContactInfo[];
  
  // AI Analysis
  aiAnalysis: AILeadScore;
  
  // Legal/Financial Data
  legalData: LegalDataSummary;
  
  // Market Data
  marketData: MarketDataSummary;
  
  // Source Attribution
  dataSources: string[];
  lastUpdated: Date;
  dataQuality: number;
}

export interface ComprehensiveDistressSignals {
  foreclosure: ForeclosureData | null;
  probate: ProbateFilingData | null;
  bankruptcy: BankruptcyRecord | null;
  taxDelinquency: TaxDelinquencyData | null;
  codeViolations: CodeViolationRecord[];
  vacancy: VacancyIndicators;
  divorce: DivorceRecord | null;
  eviction: EvictionRecord[];
  listingDistress: ListingDistressSignals;
}

export interface EnrichedContactInfo {
  ownerName: string;
  phones: PhoneRecord[];
  emails: EmailRecord[];
  addresses: AddressRecord[];
  relatives: RelativeRecord[];
  skipTraceResults: SkipTraceResult;
  contactQuality: number;
  lastVerified: Date;
}

export interface LegalDataSummary {
  liens: LienRecord[];
  judgments: JudgmentRecord[];
  permits: PermitRecord[];
  codeViolations: CodeViolationRecord[];
  legalRiskScore: number;
}

export interface MarketDataSummary {
  comparableSales: ComparableSale[];
  rentalComparables: ComparableRental[];
  marketTrends: MarketTrend[];
  investmentMetrics: InvestmentAnalysis;
}

export interface SearchMetadata {
  searchId: string;
  executionTime: number;
  dataSourcesUsed: string[];
  totalApiCalls: number;
  totalCost: number;
  searchTimestamp: Date;
  filteringApplied: MasterSearchParams;
}

export interface CostBreakdown {
  totalCost: number;
  costBySource: Record<string, number>;
  callsPerSource: Record<string, number>;
  costPerLead: number;
}

export interface SearchAggregations {
  averagePropertyValue: number;
  averageEquity: number;
  distressDistribution: Record<string, number>;
  geographicDistribution: Record<string, number>;
  propertyTypeDistribution: Record<string, number>;
  motivationScoreDistribution: Record<string, number>;
}
