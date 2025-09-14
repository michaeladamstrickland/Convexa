import { MotivationIntelligence, CampaignExecution } from '../types/index';
export declare class DealExecutionEngine {
    private openai;
    private activeExecutions;
    constructor();
    executeDealCampaign(motivation: MotivationIntelligence): Promise<CampaignExecution>;
    private determineCampaignStrategy;
    private createPersonalizationProfile;
    private createExecutionSchedule;
    private launchImmediateCampaign;
    private scheduleDelayedCampaign;
    private executeColdCall;
    private generateCallScript;
    private executeSMSSequence;
    private generateSMSSequence;
    private executeEmailSequence;
    private executeDirectMail;
    private calculateOptimalCallTime;
    private makeIntelligentCall;
    private sendSMS;
    private sendEmail;
    private submitDirectMail;
    private scheduleExecutionStep;
    private scheduleRemainingSteps;
    private scheduleSMS;
    private scheduleEmail;
    private updateCampaignMetrics;
    private initializeMetricsTracking;
    private getDefaultPersonalizationProfile;
    private getDefaultCallScript;
    private getDefaultSMSSequence;
    private generateEmailSequence;
    private generateDirectMailPiece;
    getCampaignStatus(leadId: string): Promise<CampaignExecution | null>;
    updateCampaignResult(leadId: string, stepNumber: number, result: any): Promise<void>;
    pauseCampaign(leadId: string): Promise<void>;
    resumeCampaign(leadId: string): Promise<void>;
}
//# sourceMappingURL=dealExecutionEngine.d.ts.map