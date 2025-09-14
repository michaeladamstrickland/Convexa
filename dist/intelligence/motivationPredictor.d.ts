import { MotivationIntelligence, LeadProfile } from '../types/index';
export declare class MotivationPredictor {
    private openai;
    private neuralNetwork;
    constructor();
    predictMotivation(leadProfile: LeadProfile): Promise<MotivationIntelligence>;
    private aggregateDistressSignals;
    private calculateMotivationScore;
    private calculateFinancialDistress;
    private calculatePropertyDistress;
    private calculatePersonalDistress;
    private calculateMarketDistress;
    private calculateLogisticalDistress;
    private identifyContributingFactors;
    private generateMotivationInsights;
    private getDefaultInsights;
    private quantifyForeclosureStage;
    private calculateConfidenceLevel;
    private initializeNeuralNetwork;
    updateNeuralNetwork(outcomes: any[]): Promise<void>;
    private getMotivationRange;
    predictBatchMotivation(leadProfiles: LeadProfile[]): Promise<MotivationIntelligence[]>;
    getMotivationStatistics(predictions: MotivationIntelligence[]): any;
}
//# sourceMappingURL=motivationPredictor.d.ts.map