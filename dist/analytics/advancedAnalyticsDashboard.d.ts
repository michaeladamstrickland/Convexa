import { LeadSourceType } from '../types/index';
import { LeadFlowAIEmpire } from '../empire/leadFlowAIEmpire';
interface DashboardMetrics {
    real_time_stats: RealTimeStats;
    performance_analytics: PerformanceAnalytics;
    revenue_breakdown: RevenueBreakdown;
    predictive_insights: PredictiveInsights;
    competitive_analysis: CompetitiveAnalysis;
    optimization_recommendations: OptimizationRecommendation[];
}
interface RealTimeStats {
    leads_generated_today: number;
    leads_generated_this_week: number;
    leads_generated_this_month: number;
    active_campaigns: number;
    deals_in_progress: number;
    revenue_today: number;
    revenue_this_week: number;
    revenue_this_month: number;
    conversion_rate_24h: number;
    ai_systems_status: SystemStatus[];
}
interface SystemStatus {
    system_name: string;
    status: 'operational' | 'degraded' | 'offline';
    performance_score: number;
    last_updated: Date;
    issues: string[];
}
interface PerformanceAnalytics {
    lead_source_performance: LeadSourcePerformance[];
    campaign_effectiveness: CampaignEffectiveness[];
    geographic_performance: GeographicPerformance[];
    time_based_analytics: TimeBasedAnalytics;
    conversion_funnel: ConversionFunnel;
}
interface LeadSourcePerformance {
    source: LeadSourceType;
    leads_generated: number;
    qualification_rate: number;
    conversion_rate: number;
    avg_deal_size: number;
    roi: number;
    cost_per_lead: number;
    trend_direction: 'up' | 'down' | 'stable';
    performance_score: number;
}
interface CampaignEffectiveness {
    campaign_type: string;
    total_campaigns: number;
    success_rate: number;
    avg_time_to_close: number;
    cost_effectiveness: number;
    optimization_score: number;
}
interface GeographicPerformance {
    region: string;
    leads_generated: number;
    market_penetration: number;
    competition_level: number;
    avg_property_value: number;
    profit_margin: number;
    expansion_potential: number;
}
interface TimeBasedAnalytics {
    hourly_performance: HourlyMetrics[];
    daily_trends: DailyTrend[];
    weekly_patterns: WeeklyPattern[];
    seasonal_insights: SeasonalInsight[];
}
interface HourlyMetrics {
    hour: number;
    leads_generated: number;
    contact_success_rate: number;
    conversion_rate: number;
    optimal_for_contact: boolean;
}
interface DailyTrend {
    date: Date;
    leads: number;
    conversions: number;
    revenue: number;
    efficiency_score: number;
}
interface WeeklyPattern {
    day_of_week: string;
    avg_leads: number;
    avg_conversions: number;
    best_contact_times: number[];
    performance_rating: number;
}
interface SeasonalInsight {
    period: string;
    lead_volume_multiplier: number;
    conversion_rate_modifier: number;
    recommended_strategy: string;
    market_conditions: string;
}
interface ConversionFunnel {
    raw_leads: number;
    qualified_leads: number;
    contacted_leads: number;
    interested_leads: number;
    appointments_scheduled: number;
    offers_made: number;
    contracts_signed: number;
    deals_closed: number;
    funnel_efficiency: number;
}
interface RevenueBreakdown {
    primary_revenue: PrimaryRevenue;
    secondary_streams: SecondaryStream[];
    recurring_revenue: RecurringRevenue;
    projected_growth: ProjectedGrowth;
    profitability_analysis: ProfitabilityAnalysis;
}
interface PrimaryRevenue {
    real_estate_deals: number;
    avg_deal_profit: number;
    deals_this_month: number;
    pipeline_value: number;
    closing_timeline: number;
}
interface SecondaryStream {
    stream_name: string;
    monthly_revenue: number;
    growth_rate: number;
    profit_margin: number;
    scalability_score: number;
}
interface RecurringRevenue {
    subscription_services: number;
    lead_licensing: number;
    technology_licensing: number;
    monthly_recurring_total: number;
    annual_recurring_revenue: number;
}
interface ProjectedGrowth {
    next_30_days: number;
    next_90_days: number;
    next_12_months: number;
    growth_confidence: number;
    key_growth_drivers: string[];
}
interface ProfitabilityAnalysis {
    gross_profit_margin: number;
    operating_profit_margin: number;
    net_profit_margin: number;
    cost_breakdown: CostBreakdown;
    efficiency_metrics: EfficiencyMetrics;
}
interface CostBreakdown {
    lead_acquisition: number;
    technology_costs: number;
    personnel_costs: number;
    marketing_costs: number;
    operational_overhead: number;
    total_costs: number;
}
interface EfficiencyMetrics {
    cost_per_lead: number;
    cost_per_acquisition: number;
    customer_lifetime_value: number;
    payback_period: number;
    roi_percentage: number;
}
interface PredictiveInsights {
    ai_predictions: AIPrediction[];
    market_forecasts: MarketForecast[];
    opportunity_alerts: OpportunityAlert[];
    risk_assessments: RiskAssessment[];
    strategic_recommendations: StrategicRecommendation[];
}
interface AIPrediction {
    prediction_type: string;
    confidence_level: number;
    predicted_outcome: string;
    timeline: string;
    impact_assessment: string;
    recommended_actions: string[];
}
interface MarketForecast {
    market_segment: string;
    forecast_period: string;
    predicted_trend: 'bullish' | 'bearish' | 'neutral';
    opportunity_score: number;
    key_indicators: string[];
}
interface OpportunityAlert {
    alert_type: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    opportunity_value: number;
    time_sensitivity: string;
    action_required: string;
    success_probability: number;
}
interface RiskAssessment {
    risk_category: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    potential_impact: number;
    mitigation_strategies: string[];
    monitoring_requirements: string;
}
interface StrategicRecommendation {
    category: string;
    priority: number;
    recommendation: string;
    expected_impact: string;
    implementation_timeline: string;
    resource_requirements: string;
}
interface CompetitiveAnalysis {
    market_position: MarketPosition;
    competitive_advantages: CompetitiveAdvantage[];
    threat_analysis: ThreatAnalysis[];
    market_share_analysis: MarketShareAnalysis;
    differentiation_factors: DifferentiationFactor[];
}
interface MarketPosition {
    current_ranking: number;
    market_share_percentage: number;
    competitive_strength: number;
    growth_trajectory: string;
    unique_value_proposition: string;
}
interface CompetitiveAdvantage {
    advantage_type: string;
    strength_score: number;
    sustainability: number;
    market_impact: string;
    competitive_moat: string;
}
interface ThreatAnalysis {
    threat_source: string;
    threat_level: number;
    likelihood: number;
    potential_impact: string;
    mitigation_strategy: string;
}
interface MarketShareAnalysis {
    total_addressable_market: number;
    serviceable_addressable_market: number;
    current_market_share: number;
    target_market_share: number;
    expansion_opportunities: string[];
}
interface DifferentiationFactor {
    factor_name: string;
    uniqueness_score: number;
    customer_value: number;
    competitive_barrier: number;
    scalability: number;
}
interface OptimizationRecommendation {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
    expected_improvement: string;
    implementation_effort: string;
    timeline: string;
    success_metrics: string[];
}
export declare class AdvancedAnalyticsDashboard {
    private openai;
    private empire;
    private dashboardData;
    private updateInterval;
    constructor(empire: LeadFlowAIEmpire);
    startRealTimeMonitoring(): Promise<void>;
    stopRealTimeMonitoring(): Promise<void>;
    updateDashboardData(): Promise<void>;
    private gatherRealTimeStats;
    private analyzePerformance;
    private generateTimeBasedAnalytics;
    private calculateRevenueBreakdown;
    private analyzeProfitability;
    private generatePredictiveInsights;
    private performCompetitiveAnalysis;
    private generateOptimizationRecommendations;
    private initializeDashboardData;
    getDashboardData(): Promise<DashboardMetrics>;
    getRealTimeStats(): Promise<RealTimeStats>;
    getPerformanceAnalytics(): Promise<PerformanceAnalytics>;
    getRevenueBreakdown(): Promise<RevenueBreakdown>;
    getPredictiveInsights(): Promise<PredictiveInsights>;
    getOptimizationRecommendations(): Promise<OptimizationRecommendation[]>;
    generateComprehensiveReport(): Promise<any>;
    private generateKeyInsights;
    private generateExecutiveSummary;
    private generateStrategicRoadmap;
}
export {};
//# sourceMappingURL=advancedAnalyticsDashboard.d.ts.map