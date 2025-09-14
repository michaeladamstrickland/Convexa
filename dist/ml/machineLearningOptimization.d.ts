import { ProcessedDeal, LeadProfile, CampaignExecution } from '../types/index';
interface MLModel {
    model_id: string;
    model_type: 'motivation_prediction' | 'campaign_optimization' | 'revenue_forecasting' | 'lead_scoring';
    accuracy: number;
    training_data_size: number;
    last_trained: Date;
    version: string;
    performance_metrics: ModelPerformanceMetrics;
}
interface ModelPerformanceMetrics {
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    confusion_matrix: number[][];
    roc_auc: number;
}
interface OptimizationResult {
    optimization_type: string;
    improvement_percentage: number;
    confidence_level: number;
    implementation_strategy: string;
    expected_outcomes: OptimizationOutcome[];
    rollback_plan: string;
}
interface OptimizationOutcome {
    metric_name: string;
    current_value: number;
    projected_value: number;
    improvement_percentage: number;
    timeline_days: number;
}
interface PredictionResult {
    prediction_value: number;
    confidence_interval: [number, number];
    feature_importance: FeatureImportance[];
    prediction_explanation: string;
    risk_factors: string[];
}
interface FeatureImportance {
    feature_name: string;
    importance_score: number;
    impact_direction: 'positive' | 'negative';
    description: string;
}
interface LearningInsight {
    insight_type: string;
    discovered_pattern: string;
    confidence_level: number;
    business_impact: string;
    recommended_action: string;
    supporting_evidence: string[];
}
export declare class MachineLearningOptimization {
    private openai;
    private models;
    private trainingData;
    private learningHistory;
    constructor();
    startContinuousLearning(): Promise<void>;
    optimizeMotivationPrediction(historicalData: ProcessedDeal[]): Promise<OptimizationResult>;
    optimizeCampaignPerformance(campaignData: CampaignExecution[]): Promise<OptimizationResult>;
    predictMarketTrends(): Promise<PredictionResult>;
    optimizeLeadScoring(leadData: LeadProfile[]): Promise<OptimizationResult>;
    generateLearningInsights(): Promise<LearningInsight[]>;
    private initializeModels;
    private retrainAllModels;
    private optimizeSystemPerformance;
    private prepareMotivationTrainingData;
    private trainEnhancedMotivationModel;
    private evaluateModelImprovement;
    private generateOptimizationStrategy;
    private parseMarketPrediction;
    private getFallbackPrediction;
    private analyzeCampaignPatterns;
    private generateCampaignOptimizations;
    private calculateExpectedImprovement;
    private analyzeLeadConversionPatterns;
    private generateScoringOptimizations;
    private calculateScoringImprovement;
    getModelPerformance(modelId: string): Promise<MLModel | null>;
    getAllModels(): Promise<MLModel[]>;
    getLearningHistory(): Promise<LearningInsight[]>;
    getLatestInsights(count?: number): Promise<LearningInsight[]>;
    forceModelRetrain(modelId: string): Promise<void>;
}
export {};
//# sourceMappingURL=machineLearningOptimization.d.ts.map