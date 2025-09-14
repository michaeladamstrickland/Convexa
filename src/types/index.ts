// Core types for the LeadFlow AI Empire system

export interface DeathIntelligence {
  deceased_name: string;
  death_date: Date;
  family_members: FamilyMember[];
  property_links: PropertyLink[];
  estate_value_estimate: number;
  probate_filing_probability: number;
  heir_contact_data: ContactInfo[];
  vacancy_indicators: VacancySignal[];
  last_known_address?: string;
  obituary_text?: string;
  funeral_home?: string;
  cemetery?: string;
  age_at_death?: number;
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

export interface PropertyLink {
  address: string;
  estimated_value: number;
  equity: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'severe_distress';
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  lot_size?: number;
  year_built: number;
  last_sale_date?: Date;
  property_type: string;
  vacancy_probability: number;
  vacancy_indicators?: VacancySignal[];
  deed_type: string;
  mortgage_balance?: number;
}

export interface ContactInfo {
  type: 'phone' | 'email' | 'address' | 'social_media';
  value: string;
  confidence_score: number; // 0-100
  last_verified?: Date;
  source: string;
}

export interface VacancySignal {
  indicator_type: 'utility_disconnect' | 'mail_hold' | 'visual_neglect' | 'neighbor_report';
  confidence_score: number;
  detected_date: Date;
  description: string;
}

export interface ProbateCase {
  id?: string;
  case_number: string;
  deceased_name: string;
  filing_date: Date;
  case_status: 'filed' | 'active' | 'closed' | 'pending';
  county: string;
  court_system: string;
  court_name?: string;
  attorney_name?: string;
  attorney_contact?: ContactInfo[];
  attorney_info?: AttorneyInfo;
  estimated_estate_value: number;
  estimated_total_value?: number;
  properties: PropertyLink[];
  identified_heirs: FamilyMember[] | ProbateHeirInfo[];
  heir_contacts?: ProbateHeirInfo[];
  urgency_score: number;
  deal_potential_score?: number;
  optimal_approach_strategy?: string;
  ai_deal_brief: string;
  next_hearing_date?: Date;
  scraped_at?: Date;
}

export interface PropertyViolation {
  property_address: string;
  violation_type: string;
  severity_score: number;
  repeat_offender: boolean;
  financial_burden: number;
  compliance_deadline: Date;
  enforcement_stage: 'notice' | 'citation' | 'court_order' | 'foreclosure_threat';
  distress_indicators: string[];
  classification: ViolationClassification;
  deal_potential: number;
}

export interface ViolationClassification {
  type: 'structural' | 'cosmetic' | 'health_safety' | 'environmental' | 'zoning';
  severity: 'minor' | 'moderate' | 'major' | 'severe';
  cost_to_fix: number;
  urgency: 'immediate' | '30_days' | '90_days' | 'non_urgent';
  owner_stress_level: 'low' | 'medium' | 'high' | 'extreme';
  deal_opportunity: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface VacancyIntelligence {
  property_address: string;
  vacancy_confidence: number;
  vacancy_duration_months: number;
  vacancy_indicators: VacancyIndicator[];
  utility_status: UtilityStatus;
  mail_delivery_status: MailStatus;
  visual_condition_score: number;
  neighbor_reports: NeighborReport[];
  opportunity_score: number;
}

export interface VacancyIndicator {
  type: 'utility_disconnect' | 'mail_accumulation' | 'visual_neglect' | 'security_issues';
  detected_date: Date;
  confidence: number;
  description: string;
}

export interface UtilityStatus {
  electric_active: boolean;
  water_active: boolean;
  gas_active: boolean;
  last_usage_date?: Date;
  estimated_monthly_cost: number;
}

export interface MailStatus {
  delivery_suspended: boolean;
  mail_accumulating: boolean;
  forwarding_address?: string;
  suspension_date?: Date;
}

export interface NeighborReport {
  reporter_contact?: string;
  report_date: Date;
  report_type: 'vacancy' | 'neglect' | 'distress' | 'for_sale';
  description: string;
  reliability_score: number;
}

export interface TaxIntelligence {
  property_address: string;
  total_debt: number;
  years_delinquent: number;
  foreclosure_risk_score: number;
  foreclosure_timeline_days: number;
  payment_history: PaymentRecord[];
  equity_to_debt_ratio: number;
  owner_contact_urgency: number;
  deal_urgency_score: number;
  recommended_strategy: string;
}

export interface PaymentRecord {
  year: number;
  amount_due: number;
  amount_paid: number;
  payment_date?: Date;
  penalties: number;
  interest: number;
}

export interface MotivationIntelligence {
  property_id: string;
  overall_motivation_score: number;
  motivation_factors: MotivationFactor[];
  urgency_timeline: number; // days until motivation peaks
  optimal_approach_strategy: string;
  predicted_discount: number; // expected discount percentage
  deal_probability: number; // likelihood of successful negotiation
  ai_talking_points: string[];
}

export interface MotivationFactor {
  type: 'financial_distress' | 'property_distress' | 'personal_distress' | 'market_distress';
  impact: number; // 0-100
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface DistressSignals {
  tax_delinquency: number;
  foreclosure_status: number;
  code_violations: number;
  vacancy_duration: number;
  condition_score: number;
  probate_status: number;
  divorce_proceedings: number;
  eviction_filings: number;
  days_on_market: number;
  price_reductions: number;
  absentee_owner: number;
  out_of_state_distance: number;
}

export interface LeadProfile {
  property_id: string;
  address: string;
  owner_name: string;
  estimated_value: number;
  condition_score: number;
  vacancy_months?: number;
  tax_debt: number;
  foreclosure_stage?: string;
  violations: PropertyViolation[];
  is_probate: boolean;
  is_divorce: boolean;
  eviction_count: number;
  days_on_market?: number;
  price_reduction_count?: number;
  is_absentee: boolean;
  owner_distance_miles?: number;
}

export interface CampaignExecution {
  lead_id: string;
  campaign_type: 'cold_call' | 'sms_sequence' | 'direct_mail' | 'email_drip';
  execution_schedule: ExecutionStep[];
  personalization_data: PersonalizationProfile;
  success_metrics: SuccessMetrics;
}

export interface ExecutionStep {
  step_number: number;
  action_type: string;
  scheduled_time: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
}

export interface PersonalizationProfile {
  communication_tone: 'professional' | 'empathetic' | 'urgent';
  key_pain_points: string[];
  solution_positioning: string;
  trust_building_approach: string;
  urgency_messaging: string;
  objection_prevention: string[];
}

export interface SuccessMetrics {
  contact_attempts: number;
  successful_contacts: number;
  appointments_scheduled: number;
  offers_made: number;
  contracts_signed: number;
  deals_closed: number;
  total_revenue: number;
}

export interface ProcessedDeal {
  lead_id: string;
  profit_potential: number;
  motivation_score: number;
  execution_status: 'automated' | 'manual' | 'queued';
  next_action: string;
  timeline: string;
}

export interface RevenueStream {
  stream_type: 'lead_sales' | 'subscription' | 'transaction_fees' | 'white_label' | 'consulting';
  monthly_revenue: number;
  growth_rate: number;
  profit_margin: number;
  scaling_potential: number;
}

export interface ContactAttempt {
  attempt_date: Date;
  method: 'phone' | 'sms' | 'email' | 'mail';
  status: 'successful' | 'no_answer' | 'voicemail' | 'invalid';
  notes?: string;
  follow_up_scheduled?: Date;
}

export interface SkipTraceResult {
  data_type: 'phone' | 'email' | 'address' | 'employment' | 'social';
  value: string;
  confidence: number;
  source: string;
  date_found: Date;
}

export type LeadSourceType = 
  | 'obituary_death_mining'
  | 'probate_intelligence'
  | 'code_violation_tracking'
  | 'tax_delinquency'
  | 'vacancy_detection'
  | 'divorce_records'
  | 'bankruptcy_filings'
  | 'pre_foreclosure'
  | 'notice_of_default'
  | 'absentee_owner'
  | 'expired_listings'
  | 'fsbo_tracking'
  | 'high_equity'
  | 'wholesale_leads';

export interface RevenueMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  contactedLeads: number;
  dealsInProgress: number;
  closedDeals: number;
  totalRevenue: number;
  avgDealSize: number;
  conversionRate: number;
  costPerLead: number;
  roi: number;
  leadsBySource: Record<LeadSourceType, number>;
  revenueBySource: Record<LeadSourceType, number>;
}

export interface AttorneyInfo {
  name: string;
  phone: string | null;
  email: string | null;
  firm: string | null;
  bar_number?: string;
  address?: string;
}

export interface ProbateHeirInfo {
  name: string;
  relationship: string;
  inheritance_priority: number;
  decision_making_influence: number;
  contact_likelihood: number;
  address: string | null;
  phone: string | null;
  email: string | null;
  motivation_score: number;
}

export interface EmpireMetrics {
  total_leads_generated: number;
  qualified_leads: number;
  active_campaigns: number;
  deals_in_progress: number;
  closed_deals: number;
  monthly_revenue: number;
  roi_percentage: number;
  lead_cost_average: number;
  conversion_rate: number;
  time_to_close_average: number;
}

export interface PerformanceMetrics {
  campaign_id: string;
  leads_processed: number;
  contacts_made: number;
  appointments_scheduled: number;
  offers_made: number;
  contracts_signed: number;
  deals_closed: number;
  total_revenue: number;
  total_cost: number;
  roi: number;
  conversion_rate: number;
  avg_days_to_close: number;
}

export interface GeographicMarket {
  market_id: string;
  region: string;
  state: string;
  active_leads: number;
  monthly_volume: number;
  conversion_rate: number;
  average_deal_size: number;
  market_penetration: number;
  competition_level: number;
  opportunity_score: number;
}

export interface MarketMetrics {
  total_markets: number;
  active_markets: number;
  total_lead_volume: number;
  average_conversion_rate: number;
  total_revenue: number;
  market_penetration: number;
  expansion_rate: number;
  top_performing_markets: string[];
}

// Master Real Estate API Integration Types
export interface ComprehensiveLeadSources {
  // Property Ownership & Public Records
  attom_data: boolean;
  prop_mix: boolean;
  estated: boolean;
  data_tree: boolean;
  core_logic_trestle: boolean;
  regrid: boolean;
  
  // Deceased Owner & Probate Data
  us_obituary_api: boolean;
  obit_api: boolean;
  tributes_api: boolean;
  people_data_labs: boolean;
  
  // MLS & Listings
  mls_grid: boolean;
  trestle: boolean;
  zillow_unofficial: boolean;
  realtor_rapid_api: boolean;
  redfin_scraper: boolean;
  
  // Distress & Legal Data
  foreclosure_com: boolean;
  property_radar: boolean;
  pacer_bankruptcy: boolean;
  local_county_sites: boolean;
  
  // Skip Tracing & Contact Enrichment
  batch_skip_tracing: boolean;
  idi_data_lexis_nexis: boolean;
  true_people_search: boolean;
  clearbit: boolean;
  full_contact: boolean;
  
  // AI & Intelligence
  openai: boolean;
  twilio_voice: boolean;
  twilio_sms: boolean;
  google_maps: boolean;
  melissa_data: boolean;
  
  // Additional Real Estate Data
  rentometer: boolean;
  zillow_rent_estimate: boolean;
  air_dna: boolean;
  build_zoom: boolean;
}

export interface UltimatePropertyLead {
  // Core identification
  property_id: string;
  master_lead_score: number; // 0-100 AI-calculated
  data_quality_score: number; // Completeness of information
  
  // Property basics
  address: string;
  estimated_value: number;
  equity: number;
  equity_percentage: number;
  
  // Owner intelligence
  owner_name: string;
  owner_type: 'individual' | 'trust' | 'llc' | 'corporation';
  is_absentee_owner: boolean;
  owner_distance_miles: number;
  
  // Contact intelligence (skip traced)
  primary_phone: string | null;
  secondary_phone: string | null;
  email_address: string | null;
  mailing_address: string | null;
  relatives: FamilyMember[];
  contact_confidence: number;
  
  // Distress indicators
  foreclosure_status: 'none' | 'pre_foreclosure' | 'auction' | 'reo';
  foreclosure_date: Date | null;
  probate_status: 'none' | 'potential' | 'filed' | 'active';
  bankruptcy_status: 'none' | 'chapter_7' | 'chapter_11' | 'chapter_13';
  tax_delinquent_amount: number;
  tax_years_delinquent: number;
  code_violations_count: number;
  eviction_history_count: number;
  divorce_proceedings: boolean;
  
  // Property condition
  vacancy_status: 'occupied' | 'vacant' | 'likely_vacant';
  vacancy_duration_months: number;
  property_condition: 'excellent' | 'good' | 'fair' | 'poor' | 'distressed';
  repair_estimate: number;
  
  // Market intelligence
  days_on_market: number;
  price_reduction_count: number;
  original_list_price: number | null;
  current_list_price: number | null;
  comparable_sales_avg: number;
  rental_estimate: number;
  cap_rate: number;
  
  // AI motivation analysis
  seller_motivation_score: number; // 0-100
  deal_urgency_score: number; // 0-100
  contact_priority_score: number; // 0-100
  predicted_discount_percentage: number;
  optimal_offer_amount: number;
  deal_probability_percentage: number;
  
  // Strategy recommendations
  recommended_approach: 'phone_first' | 'mail_first' | 'text_first' | 'door_knock';
  best_contact_time: string;
  messaging_tone: 'professional' | 'empathetic' | 'urgent' | 'casual';
  key_pain_points: string[];
  suggested_opening_line: string;
  objection_handling_notes: string[];
  
  // Legal considerations
  title_issues: boolean;
  lien_amount: number;
  hoa_violations: boolean;
  permit_issues: boolean;
  
  // Investment analysis
  arv_estimate: number; // After repair value
  wholesale_spread: number;
  fix_and_flip_profit: number;
  rental_cash_flow: number;
  deal_type_recommendation: 'wholesale' | 'fix_flip' | 'rental' | 'owner_occupy';
  
  // Data sources used
  data_sources: ComprehensiveLeadSources;
  last_updated: Date;
  data_freshness_days: number;
}

export interface MasterLeadGeneration {
  // Search configuration
  search_type: 'ultimate' | 'probate_focus' | 'foreclosure_focus' | 'high_equity' | 'custom';
  geographic_scope: string[];
  property_filters: PropertyFilterCriteria;
  distress_filters: DistressFilterCriteria;
  motivation_thresholds: MotivationThresholds;
  
  // Results
  total_properties_analyzed: number;
  qualified_leads_found: number;
  leads: UltimatePropertyLead[];
  
  // Cost analysis
  total_api_cost: number;
  cost_per_lead: number;
  estimated_monthly_cost: number;
  api_calls_made: number;
  
  // Performance metrics
  data_quality_average: number;
  contact_rate_estimate: number;
  expected_conversion_rate: number;
  projected_deal_count: number;
  projected_revenue: number;
  roi_estimate: number;
}

export interface PropertyFilterCriteria {
  min_value: number;
  max_value: number;
  min_equity: number;
  min_equity_percentage: number;
  property_types: string[];
  min_bedrooms: number;
  max_year_built: number;
  min_square_footage: number;
}

export interface DistressFilterCriteria {
  include_foreclosures: boolean;
  include_probate: boolean;
  include_tax_delinquent: boolean;
  include_bankruptcy: boolean;
  include_code_violations: boolean;
  include_vacant_properties: boolean;
  include_absentee_owners: boolean;
  include_expired_listings: boolean;
  include_divorce_cases: boolean;
  include_eviction_history: boolean;
}

export interface MotivationThresholds {
  min_motivation_score: number;
  min_urgency_score: number;
  max_days_on_market: number;
  require_price_reductions: boolean;
  min_contact_confidence: number;
}

export interface APISourceStatus {
  source_name: string;
  is_active: boolean;
  monthly_cost: number;
  calls_this_month: number;
  success_rate: number;
  data_quality: number;
  last_successful_call: Date;
  requires_license: boolean;
  subscription_tier: string;
}

export interface LeadFlowEmpireMetrics {
  // Ultimate system metrics
  total_data_sources: number;
  active_data_sources: number;
  master_leads_generated: number;
  qualified_leads: number;
  ultra_high_quality_leads: number;
  
  // Contact success
  skip_trace_success_rate: number;
  phone_contact_rate: number;
  email_contact_rate: number;
  total_contacts_discovered: number;
  
  // Deal pipeline
  leads_contacted: number;
  appointments_scheduled: number;
  offers_made: number;
  contracts_signed: number;
  deals_closed: number;
  
  // Financial performance
  total_revenue: number;
  average_deal_size: number;
  cost_per_qualified_lead: number;
  cost_per_closed_deal: number;
  empire_roi: number;
  monthly_profit: number;
  
  // Market dominance
  markets_covered: number;
  total_properties_analyzed: number;
  market_penetration_rate: number;
  competitive_advantage_score: number;
  
  // AI performance
  ai_accuracy_rate: number;
  prediction_success_rate: number;
  automation_percentage: number;
  time_saved_hours: number;
}

export interface CompetitorComparison {
  leadflow_ai: CompetitorMetrics;
  propstream: CompetitorMetrics;
  batch_leads: CompetitorMetrics;
  re_simpli: CompetitorMetrics;
  driving_for_dollars: CompetitorMetrics;
}

export interface CompetitorMetrics {
  platform_name: string;
  data_sources_count: number;
  contact_discovery_rate: number;
  ai_capabilities: boolean;
  automation_level: number;
  monthly_cost: number;
  lead_quality_score: number;
  user_satisfaction: number;
  market_coverage: string[];
}
