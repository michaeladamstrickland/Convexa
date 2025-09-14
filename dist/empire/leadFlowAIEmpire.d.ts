import { LeadProfile, ProcessedDeal, LeadSourceType } from '../types/index';
interface EmpireConfig {
    daily_lead_target: number;
    monthly_revenue_goal: number;
    max_concurrent_campaigns: number;
    intelligence_sources: LeadSourceType[];
    automation_enabled: boolean;
    ai_analysis_depth: 'basic' | 'standard' | 'advanced' | 'ultra';
}
interface EmpireMetrics {
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
export declare class LeadFlowAIEmpire {
    private openai;
    private config;
    private metrics;
    private deathMiner;
    private probateTracker;
    private violationExtractor;
    private vacancyDetector;
    private taxIntelligence;
    private motivationPredictor;
    private leadScoring;
    private dealEngine;
    private campaignAutomation;
    private leadDatabase;
    private processedDeals;
    private activeIntelligenceOperations;
    constructor(config?: Partial<EmpireConfig>);
    startEmpireOperations(): Promise<void>;
    private launchIntelligenceSource;
    private executeDeathIntelligence;
    private executeProbateIntelligence;
    private executeViolationIntelligence;
    private executeVacancyIntelligence;
    private executeTaxIntelligence;
    private processIntelligenceThroughAutomation;
    private convertDeathDataToLead;
    private convertProbateToLead;
    private convertViolationToLead;
    private convertVacancyToLead;
    private convertTaxDataToLead;
    private mapConditionToScore;
    private generateEmpireReport;
    private generateIntelligenceReport;
    private getTopDeals;
    private getAutomationPerformance;
    private calculateRevenueProjection;
    private generateAIRecommendations;
    getEmpireMetrics(): Promise<EmpireMetrics>;
    getAllLeads(): Promise<LeadProfile[]>;
    getQualifiedLeads(): Promise<ProcessedDeal[]>;
    getHighPriorityDeals(): Promise<ProcessedDeal[]>;
    pauseAllOperations(): Promise<void>;
    resumeAllOperations(): Promise<void>;
    updateConfig(newConfig: Partial<EmpireConfig>): Promise<void>;
    exportLeadDatabase(): Promise<any>;
}
export {};
//# sourceMappingURL=leadFlowAIEmpire.d.ts.map