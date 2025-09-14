import { VacancyIntelligence } from '../types/index';
export declare class VacancyDetectionSystem {
    private openai;
    private googleMapsApiKey;
    private utilityProviders;
    constructor();
    detectVacancyIntelligence(properties: string[]): Promise<VacancyIntelligence[]>;
    private checkUSPSVacancy;
    private analyzeUtilityUsage;
    private performStreetViewAnalysis;
    private getStreetViewImages;
    private analyzePropertyCondition;
    private checkElectricUsage;
    private checkWaterUsage;
    private checkGasUsage;
    private scanSocialMediaReports;
    private checkMailboxOverflow;
    private synthesizeVacancyIntelligence;
    private calculateOverallVacancyConfidence;
    private estimateVacancyDuration;
    private generateVacancyIndicators;
    private generateNeighborReports;
    private calculateOpportunityScore;
    private calculateUtilityVacancyProbability;
    private getLatestUsageDate;
    private parseUSPSResponse;
    private initializeUtilityProviders;
    private delay;
}
//# sourceMappingURL=vacancyDetectionSystem.d.ts.map