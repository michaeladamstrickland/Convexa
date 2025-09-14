import { 
  CampaignExecution, 
  MotivationIntelligence, 
  ProcessedDeal, 
  SuccessMetrics,
  RevenueMetrics,
  LeadSourceType 
} from '../types/index';
import { DealExecutionEngine } from './dealExecutionEngine';
import { AutomatedLeadScoring } from './automatedLeadScoring';
import OpenAI from 'openai';

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

export class IntelligentCampaignAutomation {
  private openai: OpenAI;
  private dealEngine: DealExecutionEngine;
  private leadScoring: AutomatedLeadScoring;
  private campaignTemplates: Map<string, CampaignTemplate> = new Map();
  private automationRules: AutomationRule[] = [];
  private activeCampaigns: Map<string, CampaignExecution> = new Map();
  private performanceData: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.dealEngine = new DealExecutionEngine();
    this.leadScoring = new AutomatedLeadScoring();
    
    this.initializeDefaultTemplates();
    this.initializeAutomationRules();
  }

  async processLeadThroughAutomation(leadData: any): Promise<ProcessedDeal> {
    console.log(`🤖 Processing lead through intelligent automation: ${leadData.property_id}...`);

    // Step 1: Score and qualify the lead
    const processedDeal = await this.leadScoring.scoreAndQualifyLead(leadData);
    
    // Step 2: Apply automation rules to determine actions
    const triggeredRules = this.evaluateAutomationRules(processedDeal, leadData);
    
    // Step 3: Execute automated actions based on rules
    for (const rule of triggeredRules) {
      await this.executeAutomationActions(rule.actions, processedDeal, leadData);
    }

    // Step 4: Select optimal campaign template
    const campaignTemplate = this.selectOptimalCampaignTemplate(processedDeal, leadData);
    
    // Step 5: Generate motivation intelligence for campaign execution
    const motivationIntelligence = await this.generateMotivationIntelligence(processedDeal, leadData);
    
    // Step 6: Launch appropriate campaign
    if (processedDeal.execution_status === 'automated' && campaignTemplate) {
      await this.launchAutomatedCampaign(campaignTemplate, motivationIntelligence, processedDeal);
    } else if (processedDeal.execution_status === 'manual') {
      await this.queueForManualReview(processedDeal, motivationIntelligence);
    } else {
      await this.addToNurturePipeline(processedDeal, motivationIntelligence);
    }

    // Step 7: Track performance metrics
    this.trackCampaignInitiation(processedDeal, campaignTemplate);
    
    console.log(`✅ Lead automation complete: ${leadData.property_id} | Status: ${processedDeal.execution_status} | Campaign: ${campaignTemplate?.name || 'None'}`);
    
    return processedDeal;
  }

  private initializeDefaultTemplates(): void {
    // Ultra High Priority Campaign (90+ motivation score)
    this.campaignTemplates.set('ultra_high_priority', {
      name: 'Ultra High Priority Blitz',
      trigger_conditions: [
        { field: 'motivation_score', operator: 'gte', value: 90, weight: 1.0 },
        { field: 'profit_potential', operator: 'gte', value: 75000, weight: 0.8 }
      ],
      execution_sequence: [
        {
          step_type: 'cold_call',
          delay_hours: 0.5, // 30 minutes
          personalization_level: 'ultra',
          success_conditions: ['call_answered', 'interest_expressed'],
          failure_conditions: ['no_answer_3_attempts', 'explicit_rejection']
        },
        {
          step_type: 'sms',
          delay_hours: 2,
          personalization_level: 'high',
          success_conditions: ['response_received'],
          failure_conditions: ['opt_out', 'negative_response']
        },
        {
          step_type: 'email',
          delay_hours: 24,
          personalization_level: 'high',
          success_conditions: ['email_opened', 'link_clicked'],
          failure_conditions: ['unsubscribe', 'spam_complaint']
        },
        {
          step_type: 'cold_call',
          delay_hours: 48,
          personalization_level: 'ultra',
          success_conditions: ['appointment_scheduled'],
          failure_conditions: ['final_rejection']
        }
      ],
      expected_conversion_rate: 0.35,
      cost_per_execution: 45,
      target_roi: 800
    });

    // High Priority Campaign (75-89 motivation score)
    this.campaignTemplates.set('high_priority', {
      name: 'High Priority Multi-Channel',
      trigger_conditions: [
        { field: 'motivation_score', operator: 'gte', value: 75, weight: 1.0 },
        { field: 'motivation_score', operator: 'lt', value: 90, weight: 1.0 },
        { field: 'profit_potential', operator: 'gte', value: 40000, weight: 0.7 }
      ],
      execution_sequence: [
        {
          step_type: 'cold_call',
          delay_hours: 2,
          personalization_level: 'high',
          success_conditions: ['call_answered', 'conversation_started'],
          failure_conditions: ['no_answer_5_attempts']
        },
        {
          step_type: 'sms',
          delay_hours: 24,
          personalization_level: 'moderate',
          success_conditions: ['response_received'],
          failure_conditions: ['opt_out']
        },
        {
          step_type: 'email',
          delay_hours: 72,
          personalization_level: 'moderate',
          success_conditions: ['email_opened'],
          failure_conditions: ['unsubscribe']
        },
        {
          step_type: 'direct_mail',
          delay_hours: 168, // 1 week
          personalization_level: 'high',
          success_conditions: ['response_received'],
          failure_conditions: ['return_to_sender']
        }
      ],
      expected_conversion_rate: 0.22,
      cost_per_execution: 65,
      target_roi: 600
    });

    // Standard Priority Campaign (60-74 motivation score)
    this.campaignTemplates.set('standard_priority', {
      name: 'Standard Nurture Sequence',
      trigger_conditions: [
        { field: 'motivation_score', operator: 'gte', value: 60, weight: 1.0 },
        { field: 'motivation_score', operator: 'lt', value: 75, weight: 1.0 }
      ],
      execution_sequence: [
        {
          step_type: 'sms',
          delay_hours: 24,
          personalization_level: 'moderate',
          success_conditions: ['response_received'],
          failure_conditions: ['opt_out']
        },
        {
          step_type: 'email',
          delay_hours: 72,
          personalization_level: 'moderate',
          success_conditions: ['email_opened'],
          failure_conditions: ['unsubscribe']
        },
        {
          step_type: 'cold_call',
          delay_hours: 168, // 1 week
          personalization_level: 'moderate',
          success_conditions: ['call_answered'],
          failure_conditions: ['do_not_call_request']
        },
        {
          step_type: 'wait',
          delay_hours: 336, // 2 weeks
          personalization_level: 'basic',
          success_conditions: [],
          failure_conditions: []
        },
        {
          step_type: 'email',
          delay_hours: 0,
          personalization_level: 'moderate',
          success_conditions: ['email_opened'],
          failure_conditions: ['unsubscribe']
        }
      ],
      expected_conversion_rate: 0.15,
      cost_per_execution: 35,
      target_roi: 400
    });

    // Long-term Nurture Campaign (40-59 motivation score)
    this.campaignTemplates.set('long_term_nurture', {
      name: 'Long-term Relationship Builder',
      trigger_conditions: [
        { field: 'motivation_score', operator: 'gte', value: 40, weight: 1.0 },
        { field: 'motivation_score', operator: 'lt', value: 60, weight: 1.0 }
      ],
      execution_sequence: [
        {
          step_type: 'email',
          delay_hours: 48,
          personalization_level: 'basic',
          success_conditions: ['email_opened'],
          failure_conditions: ['unsubscribe']
        },
        {
          step_type: 'wait',
          delay_hours: 336, // 2 weeks
          personalization_level: 'basic',
          success_conditions: [],
          failure_conditions: []
        },
        {
          step_type: 'sms',
          delay_hours: 0,
          personalization_level: 'basic',
          success_conditions: ['response_received'],
          failure_conditions: ['opt_out']
        },
        {
          step_type: 'wait',
          delay_hours: 672, // 4 weeks
          personalization_level: 'basic',
          success_conditions: [],
          failure_conditions: []
        },
        {
          step_type: 'direct_mail',
          delay_hours: 0,
          personalization_level: 'moderate',
          success_conditions: ['response_received'],
          failure_conditions: ['return_to_sender']
        }
      ],
      expected_conversion_rate: 0.08,
      cost_per_execution: 25,
      target_roi: 200
    });
  }

  private initializeAutomationRules(): void {
    // Immediate action rules for critical situations
    this.automationRules.push({
      rule_name: 'foreclosure_emergency',
      conditions: [
        { field: 'foreclosure_status', operator: 'gte', value: 80, weight: 1.0 },
        { field: 'urgency_timeline', operator: 'lte', value: 7, weight: 1.0 }
      ],
      actions: [
        {
          action_type: 'launch_campaign',
          parameters: { template: 'ultra_high_priority', priority: 'immediate' }
        },
        {
          action_type: 'send_alert',
          parameters: { type: 'foreclosure_emergency', urgency: 'critical' }
        }
      ],
      priority: 100,
      active: true
    });

    // High-value opportunity rules
    this.automationRules.push({
      rule_name: 'high_profit_opportunity',
      conditions: [
        { field: 'profit_potential', operator: 'gte', value: 100000, weight: 1.0 },
        { field: 'motivation_score', operator: 'gte', value: 70, weight: 0.8 }
      ],
      actions: [
        {
          action_type: 'assign_manual',
          parameters: { specialist: 'senior_investor', priority: 'high' }
        },
        {
          action_type: 'launch_campaign',
          parameters: { template: 'high_priority' }
        }
      ],
      priority: 90,
      active: true
    });

    // Probate specialization rules
    this.automationRules.push({
      rule_name: 'probate_specialist_required',
      conditions: [
        { field: 'is_probate', operator: 'eq', value: true, weight: 1.0 },
        { field: 'profit_potential', operator: 'gte', value: 50000, weight: 0.7 }
      ],
      actions: [
        {
          action_type: 'assign_manual',
          parameters: { specialist: 'probate_expert', priority: 'medium' }
        },
        {
          action_type: 'create_task',
          parameters: { type: 'probate_research', deadline: '48_hours' }
        }
      ],
      priority: 80,
      active: true
    });

    // Volume processing rules
    this.automationRules.push({
      rule_name: 'standard_automation',
      conditions: [
        { field: 'motivation_score', operator: 'gte', value: 50, weight: 1.0 },
        { field: 'profit_potential', operator: 'gte', value: 25000, weight: 0.6 }
      ],
      actions: [
        {
          action_type: 'launch_campaign',
          parameters: { template: 'auto_select' }
        }
      ],
      priority: 50,
      active: true
    });
  }

  private evaluateAutomationRules(processedDeal: ProcessedDeal, leadData: any): AutomationRule[] {
    const triggeredRules: AutomationRule[] = [];

    for (const rule of this.automationRules) {
      if (!rule.active) continue;

      let score = 0;
      let maxScore = 0;

      for (const condition of rule.conditions) {
        maxScore += condition.weight;
        const fieldValue = this.getFieldValue(condition.field, processedDeal, leadData);
        
        if (this.evaluateCondition(fieldValue, condition)) {
          score += condition.weight;
        }
      }

      // Rule triggers if score is at least 70% of max possible score
      if (score >= maxScore * 0.7) {
        triggeredRules.push(rule);
      }
    }

    // Sort by priority (highest first)
    return triggeredRules.sort((a, b) => b.priority - a.priority);
  }

  private getFieldValue(field: string, processedDeal: ProcessedDeal, leadData: any): any {
    // Map field names to actual data values
    switch (field) {
      case 'motivation_score': return processedDeal.motivation_score;
      case 'profit_potential': return processedDeal.profit_potential;
      case 'foreclosure_status': return leadData.foreclosure_stage ? 80 : 0;
      case 'urgency_timeline': return 30; // Default value
      case 'is_probate': return leadData.is_probate;
      default: return leadData[field];
    }
  }

  private evaluateCondition(value: any, condition: TriggerCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      default: return false;
    }
  }

  private async executeAutomationActions(actions: AutomationAction[], processedDeal: ProcessedDeal, leadData: any): Promise<void> {
    for (const action of actions) {
      switch (action.action_type) {
        case 'launch_campaign':
          await this.handleLaunchCampaignAction(action.parameters, processedDeal, leadData);
          break;
        case 'assign_manual':
          await this.handleAssignManualAction(action.parameters, processedDeal);
          break;
        case 'create_task':
          await this.handleCreateTaskAction(action.parameters, processedDeal);
          break;
        case 'send_alert':
          await this.handleSendAlertAction(action.parameters, processedDeal);
          break;
        case 'update_priority':
          await this.handleUpdatePriorityAction(action.parameters, processedDeal);
          break;
      }
    }
  }

  private selectOptimalCampaignTemplate(processedDeal: ProcessedDeal, leadData: any): CampaignTemplate | null {
    const motivationScore = processedDeal.motivation_score;
    const profitPotential = processedDeal.profit_potential;

    // Select template based on motivation score and profit potential
    if (motivationScore >= 90 && profitPotential >= 75000) {
      return this.campaignTemplates.get('ultra_high_priority') || null;
    } else if (motivationScore >= 75 && profitPotential >= 40000) {
      return this.campaignTemplates.get('high_priority') || null;
    } else if (motivationScore >= 60) {
      return this.campaignTemplates.get('standard_priority') || null;
    } else if (motivationScore >= 40) {
      return this.campaignTemplates.get('long_term_nurture') || null;
    }

    return null; // No campaign for very low motivation
  }

  private async generateMotivationIntelligence(processedDeal: ProcessedDeal, leadData: any): Promise<MotivationIntelligence> {
    // This would typically come from the lead scoring system
    // For now, we'll create a simplified version
    return {
      property_id: processedDeal.lead_id,
      overall_motivation_score: processedDeal.motivation_score,
      motivation_factors: [],
      urgency_timeline: 30,
      optimal_approach_strategy: 'Professional empathetic approach',
      predicted_discount: 15,
      deal_probability: 65,
      ai_talking_points: [
        'Quick cash offer available',
        'No repair requirements',
        'Flexible closing timeline'
      ]
    };
  }

  private async launchAutomatedCampaign(
    template: CampaignTemplate, 
    motivation: MotivationIntelligence, 
    processedDeal: ProcessedDeal
  ): Promise<void> {
    console.log(`🚀 Launching automated campaign: ${template.name} for ${processedDeal.lead_id}`);

    // Use the deal execution engine to launch the campaign
    const campaign = await this.dealEngine.executeDealCampaign(motivation);
    
    // Store the active campaign
    this.activeCampaigns.set(processedDeal.lead_id, campaign);
    
    // Initialize performance tracking
    this.initializePerformanceTracking(processedDeal.lead_id, template);
  }

  private async queueForManualReview(processedDeal: ProcessedDeal, motivation: MotivationIntelligence): Promise<void> {
    console.log(`📋 Queuing for manual review: ${processedDeal.lead_id} | Score: ${processedDeal.motivation_score} | Profit: $${processedDeal.profit_potential.toLocaleString()}`);
    
    // Create manual review task
    const reviewTask = {
      lead_id: processedDeal.lead_id,
      priority: processedDeal.profit_potential > 75000 ? 'high' : 'medium',
      assigned_to: 'available_agent',
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      notes: `Motivation: ${processedDeal.motivation_score}, Profit: $${processedDeal.profit_potential.toLocaleString()}`
    };

    // Store in manual review queue
    console.log(`✅ Added to manual review queue: ${JSON.stringify(reviewTask)}`);
  }

  private async addToNurturePipeline(processedDeal: ProcessedDeal, motivation: MotivationIntelligence): Promise<void> {
    console.log(`🌱 Adding to nurture pipeline: ${processedDeal.lead_id} | Score: ${processedDeal.motivation_score}`);
    
    // Add to long-term nurture sequence
    const nurtureSequence = {
      lead_id: processedDeal.lead_id,
      sequence_type: 'long_term_value_building',
      frequency: 'monthly',
      next_contact: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      content_focus: 'market_education'
    };

    console.log(`✅ Added to nurture sequence: ${JSON.stringify(nurtureSequence)}`);
  }

  // Action handlers
  private async handleLaunchCampaignAction(params: any, processedDeal: ProcessedDeal, leadData: any): Promise<void> {
    console.log(`🎯 Executing launch campaign action: ${params.template} for ${processedDeal.lead_id}`);
    
    if (params.template === 'auto_select') {
      const template = this.selectOptimalCampaignTemplate(processedDeal, leadData);
      if (template) {
        const motivation = await this.generateMotivationIntelligence(processedDeal, leadData);
        await this.launchAutomatedCampaign(template, motivation, processedDeal);
      }
    } else {
      const template = this.campaignTemplates.get(params.template);
      if (template) {
        const motivation = await this.generateMotivationIntelligence(processedDeal, leadData);
        await this.launchAutomatedCampaign(template, motivation, processedDeal);
      }
    }
  }

  private async handleAssignManualAction(params: any, processedDeal: ProcessedDeal): Promise<void> {
    console.log(`👤 Assigning to specialist: ${params.specialist} for ${processedDeal.lead_id}`);
    
    const assignment = {
      lead_id: processedDeal.lead_id,
      specialist_type: params.specialist,
      priority: params.priority,
      assigned_at: new Date(),
      notes: `Auto-assigned based on lead characteristics`
    };

    // Store assignment (would integrate with CRM/task management system)
    console.log(`✅ Specialist assignment created: ${JSON.stringify(assignment)}`);
  }

  private async handleCreateTaskAction(params: any, processedDeal: ProcessedDeal): Promise<void> {
    console.log(`📝 Creating task: ${params.type} for ${processedDeal.lead_id}`);
    
    const task = {
      lead_id: processedDeal.lead_id,
      task_type: params.type,
      deadline: params.deadline,
      priority: 'high',
      description: `Auto-generated task for ${processedDeal.lead_id}`,
      created_at: new Date()
    };

    console.log(`✅ Task created: ${JSON.stringify(task)}`);
  }

  private async handleSendAlertAction(params: any, processedDeal: ProcessedDeal): Promise<void> {
    console.log(`🚨 Sending alert: ${params.type} for ${processedDeal.lead_id}`);
    
    const alert = {
      lead_id: processedDeal.lead_id,
      alert_type: params.type,
      urgency: params.urgency,
      message: `${params.type} detected for lead ${processedDeal.lead_id}`,
      timestamp: new Date()
    };

    // Send to notification system
    console.log(`✅ Alert sent: ${JSON.stringify(alert)}`);
  }

  private async handleUpdatePriorityAction(params: any, processedDeal: ProcessedDeal): Promise<void> {
    console.log(`⬆️ Updating priority for ${processedDeal.lead_id}`);
    
    // Update lead priority in system
    processedDeal.execution_status = params.new_status || processedDeal.execution_status;
    
    console.log(`✅ Priority updated for ${processedDeal.lead_id}`);
  }

  private trackCampaignInitiation(processedDeal: ProcessedDeal, template: CampaignTemplate | null): void {
    if (!template) return;

    const campaignId = `${processedDeal.lead_id}_${Date.now()}`;
    
    const metrics: PerformanceMetrics = {
      campaign_id: campaignId,
      leads_processed: 1,
      contacts_made: 0,
      appointments_scheduled: 0,
      offers_made: 0,
      contracts_signed: 0,
      deals_closed: 0,
      total_revenue: 0,
      total_cost: template.cost_per_execution,
      roi: 0,
      conversion_rate: 0,
      avg_days_to_close: 0
    };

    this.performanceData.set(campaignId, metrics);
  }

  private initializePerformanceTracking(leadId: string, template: CampaignTemplate): void {
    console.log(`📊 Initializing performance tracking for ${leadId} using ${template.name}`);
    
    // Set up performance monitoring
    const trackingConfig = {
      lead_id: leadId,
      template_name: template.name,
      expected_conversion: template.expected_conversion_rate,
      cost_per_execution: template.cost_per_execution,
      target_roi: template.target_roi,
      start_time: new Date()
    };

    console.log(`✅ Performance tracking initialized: ${JSON.stringify(trackingConfig)}`);
  }

  // Public methods for campaign management
  async getCampaignPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    return this.performanceData.get(campaignId) || null;
  }

  async getAllCampaignMetrics(): Promise<PerformanceMetrics[]> {
    return Array.from(this.performanceData.values());
  }

  async getActiveCampaigns(): Promise<CampaignExecution[]> {
    return Array.from(this.activeCampaigns.values());
  }

  async pauseAllCampaigns(): Promise<void> {
    console.log('⏸️ Pausing all active campaigns...');
    for (const [leadId] of this.activeCampaigns) {
      await this.dealEngine.pauseCampaign(leadId);
    }
  }

  async resumeAllCampaigns(): Promise<void> {
    console.log('▶️ Resuming all paused campaigns...');
    for (const [leadId] of this.activeCampaigns) {
      await this.dealEngine.resumeCampaign(leadId);
    }
  }

  async updateCampaignTemplate(templateName: string, template: CampaignTemplate): Promise<void> {
    this.campaignTemplates.set(templateName, template);
    console.log(`✅ Campaign template updated: ${templateName}`);
  }

  async addAutomationRule(rule: AutomationRule): Promise<void> {
    this.automationRules.push(rule);
    console.log(`✅ Automation rule added: ${rule.rule_name}`);
  }

  async removeAutomationRule(ruleName: string): Promise<void> {
    this.automationRules = this.automationRules.filter(rule => rule.rule_name !== ruleName);
    console.log(`✅ Automation rule removed: ${ruleName}`);
  }

  async toggleAutomationRule(ruleName: string, active: boolean): Promise<void> {
    const rule = this.automationRules.find(r => r.rule_name === ruleName);
    if (rule) {
      rule.active = active;
      console.log(`✅ Automation rule ${ruleName} ${active ? 'activated' : 'deactivated'}`);
    }
  }
}
