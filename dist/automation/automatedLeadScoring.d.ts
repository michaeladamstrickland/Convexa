import { LeadProfile, ProcessedDeal } from '../types/index';
interface QualificationCriteria {
    min_motivation_score: number;
    min_deal_probability: number;
    max_competition_level: number;
    required_equity_amount: number;
    preferred_property_types: string[];
    max_repair_cost_percentage: number;
}
interface LeadScoringModel {
    distress_weight: number;
    motivation_weight: number;
    equity_weight: number;
    urgency_weight: number;
    competition_weight: number;
    location_weight: number;
}
export declare class AutomatedLeadScoring {
    private openai;
    private qualificationCriteria;
    private scoringModel;
    private processedDeals;
    constructor();
    scoreAndQualifyLead(leadProfile: LeadProfile): Promise<ProcessedDeal>;
    private calculateDistressSignals;
    private generateMotivationAnalysis;
    private calculateDealMetrics;
    private calculateRiskScore;
    private estimateTimeToClose;
    private calculateCompetitionLevel;
    private determineExecutionStatus;
    private generateActionPlan;
    private calculateFallbackMotivationScore;
    private getDefaultMotivationFactors;
    private calculateUrgencyTimeline;
    private calculatePredictedDiscount;
    private calculateDealProbability;
    private getDefaultTalkingPoints;
    private generateFallbackMotivationAnalysis;
    updateQualificationCriteria(criteria: Partial<QualificationCriteria>): Promise<void>;
    updateScoringModel(model: Partial<LeadScoringModel>): Promise<void>;
    getProcessedDeal(leadId: string): Promise<ProcessedDeal | null>;
    getAllProcessedDeals(): Promise<ProcessedDeal[]>;
    getHighPriorityDeals(): Promise<ProcessedDeal[]>;
}
export {};
//# sourceMappingURL=automatedLeadScoring.d.ts.map