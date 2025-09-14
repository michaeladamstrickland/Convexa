import { CampaignExecution, ProcessedDeal } from '../types/index';
interface CampaignTemplate {
    name: string;
    trigger_conditions: TriggerCondition[];
    execution_sequence: CampaignStep[];
    expected_conversion_rate: number;
    cost_per_execution: number;
    target_roi: number;
}
interface TriggerCondition {
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
    value: any;
    weight: number;
}
interface CampaignStep {
    step_type: 'cold_call' | 'sms' | 'email' | 'direct_mail' | 'social_media' | 'wait';
    delay_hours: number;
    personalization_level: 'basic' | 'moderate' | 'high' | 'ultra';
    success_conditions: string[];
    failure_conditions: string[];
    next_step_on_success?: number;
    next_step_on_failure?: number;
}
interface AutomationRule {
    rule_name: string;
    conditions: TriggerCondition[];
    actions: AutomationAction[];
    priority: number;
    active: boolean;
}
interface AutomationAction {
    action_type: 'launch_campaign' | 'update_priority' | 'assign_manual' | 'create_task' | 'send_alert';
    parameters: any;
}
interface PerformanceMetrics {
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
export declare class IntelligentCampaignAutomation {
    private openai;
    private dealEngine;
    private leadScoring;
    private campaignTemplates;
    private automationRules;
    private activeCampaigns;
    private performanceData;
    constructor();
    processLeadThroughAutomation(leadData: any): Promise<ProcessedDeal>;
    private initializeDefaultTemplates;
    private initializeAutomationRules;
    private evaluateAutomationRules;
    private getFieldValue;
    private evaluateCondition;
    private executeAutomationActions;
    private selectOptimalCampaignTemplate;
    private generateMotivationIntelligence;
    private launchAutomatedCampaign;
    private queueForManualReview;
    private addToNurturePipeline;
    private handleLaunchCampaignAction;
    private handleAssignManualAction;
    private handleCreateTaskAction;
    private handleSendAlertAction;
    private handleUpdatePriorityAction;
    private trackCampaignInitiation;
    private initializePerformanceTracking;
    getCampaignPerformance(campaignId: string): Promise<PerformanceMetrics | null>;
    getAllCampaignMetrics(): Promise<PerformanceMetrics[]>;
    getActiveCampaigns(): Promise<CampaignExecution[]>;
    pauseAllCampaigns(): Promise<void>;
    resumeAllCampaigns(): Promise<void>;
    updateCampaignTemplate(templateName: string, template: CampaignTemplate): Promise<void>;
    addAutomationRule(rule: AutomationRule): Promise<void>;
    removeAutomationRule(ruleName: string): Promise<void>;
    toggleAutomationRule(ruleName: string, active: boolean): Promise<void>;
}
export {};
//# sourceMappingURL=intelligentCampaignAutomation.d.ts.map