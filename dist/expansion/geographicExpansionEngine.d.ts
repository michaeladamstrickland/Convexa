import { GeographicMarket } from '../types/index';
interface ExpansionPlan {
    target_markets: GeographicMarket[];
    expansion_sequence: ExpansionPhase[];
    total_market_potential: number;
    implementation_timeline: number;
    resource_requirements: ResourceRequirement[];
    risk_assessment: RiskAssessment;
}
interface ExpansionPhase {
    phase_number: number;
    target_markets: string[];
    timeline_days: number;
    investment_required: number;
    expected_monthly_revenue: number;
    lead_volume_target: number;
    success_metrics: string[];
    dependencies: string[];
}
interface ResourceRequirement {
    resource_type: 'human' | 'technology' | 'capital' | 'partnerships';
    description: string;
    quantity_needed: number;
    cost_estimate: number;
    timeline_to_acquire: number;
    criticality: 'low' | 'medium' | 'high' | 'critical';
}
interface RiskAssessment {
    market_risks: MarketRisk[];
    operational_risks: OperationalRisk[];
    competitive_risks: CompetitiveRisk[];
    overall_risk_score: number;
    mitigation_strategies: string[];
}
interface MarketRisk {
    risk_type: string;
    probability: number;
    impact: number;
    risk_score: number;
    mitigation_plan: string;
}
interface OperationalRisk {
    risk_type: string;
    probability: number;
    impact: number;
    risk_score: number;
    mitigation_plan: string;
}
interface CompetitiveRisk {
    risk_type: string;
    probability: number;
    impact: number;
    risk_score: number;
    mitigation_plan: string;
}
interface MarketAnalysis {
    market_name: string;
    population: number;
    median_home_value: number;
    foreclosure_rate: number;
    investor_activity: number;
    competition_density: number;
    regulatory_environment: number;
    market_growth_rate: number;
    opportunity_score: number;
}
export declare class GeographicExpansionEngine {
    private openai;
    private activeMarkets;
    private expansionPlan;
    private marketAnalyses;
    constructor();
    generateNationalExpansionPlan(): Promise<ExpansionPlan>;
    launchPhase1Markets(): Promise<ExpansionPhase>;
    launchPhase2Markets(): Promise<ExpansionPhase>;
    launchPhase3Markets(): Promise<ExpansionPhase>;
    analyzeMarketOpportunity(marketId: string): Promise<MarketAnalysis>;
    establishMarketPresence(marketId: string): Promise<GeographicMarket>;
    optimizeMarketPerformance(marketId: string): Promise<void>;
    private analyzeNationalMarkets;
    private prioritizeMarkets;
    private createExpansionPhases;
    private calculateResourceRequirements;
    private assessExpansionRisks;
    private calculateTotalMarketPotential;
    private initializeMarket;
    private deployMarketIntelligence;
    private establishLocalPartnerships;
    private configureMarketOperations;
    private gatherMarketData;
    private analyzeCompetition;
    private assessRegulatoryEnvironment;
    private calculateOpportunityScore;
    private getRegionFromMarketId;
    private getStateFromMarketId;
    private analyzePhase1Performance;
    private applyExpansionOptimizations;
    private initializeEnhancedMarket;
    private deployAdvancedAISystems;
    private implementMLOptimizations;
    private createMarketAutomation;
    private setupLocalDataSources;
    private configureMarketIntelligence;
    private establishLocalPartners;
    private deployLeadGeneration;
    private analyzeMarketPerformance;
    private identifyOptimizations;
    private applyAIOptimizations;
    private updateMarketMetrics;
    getExpansionStatus(): Promise<any>;
    getMarketPerformance(marketId: string): Promise<GeographicMarket | undefined>;
    getAllActiveMarkets(): Promise<GeographicMarket[]>;
    getTotalLeadVolume(): Promise<number>;
    getAverageConversionRate(): Promise<number>;
}
export {};
//# sourceMappingURL=geographicExpansionEngine.d.ts.map