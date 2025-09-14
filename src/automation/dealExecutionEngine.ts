import OpenAI from 'openai';
import { MotivationIntelligence, CampaignExecution, PersonalizationProfile, ExecutionStep, SuccessMetrics } from '../types/index';

interface CampaignStrategy {
  primary_channel: 'cold_call' | 'sms_sequence' | 'direct_mail' | 'email_drip';
  secondary_channels: string[];
  contact_frequency: number; // contacts per week
  campaign_duration_days: number;
  expected_conversion_rate: number;
}

interface CallScript {
  opener: string;
  pain_point_discovery: string[];
  solution_presentation: string;
  objection_handling: { [objection: string]: string };
  closing_statements: string[];
  follow_up_strategy: string;
}

interface SMSSequence {
  messages: {
    delay_hours: number;
    message_template: string;
    personalization_variables: string[];
    expected_response_rate: number;
  }[];
}

interface EmailSequence {
  emails: {
    delay_hours: number;
    subject_template: string;
    body_template: string;
    personalization_variables: string[];
    call_to_action: string;
  }[];
}

export class DealExecutionEngine {
  private openai: OpenAI;
  private activeExecutions: Map<string, CampaignExecution> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async executeDealCampaign(motivation: MotivationIntelligence): Promise<CampaignExecution> {
    console.log(`🎯 Executing deal campaign for property ${motivation.property_id}...`);
    
    // Determine optimal campaign strategy
    const campaignStrategy = this.determineCampaignStrategy(motivation);
    
    // Generate personalized content and approach
    const personalizationProfile = await this.createPersonalizationProfile(motivation);
    
    // Create detailed execution schedule
    const executionSchedule = this.createExecutionSchedule(campaignStrategy, motivation);
    
    // Initialize success metrics tracking
    const successMetrics = this.initializeMetricsTracking(motivation.property_id);
    
    const campaign: CampaignExecution = {
      lead_id: motivation.property_id,
      campaign_type: campaignStrategy.primary_channel,
      execution_schedule: executionSchedule,
      personalization_data: personalizationProfile,
      success_metrics: successMetrics
    };

    // Launch campaigns immediately for high-motivation leads
    if (motivation.overall_motivation_score >= 80) {
      await this.launchImmediateCampaign(campaign, motivation);
    } else {
      await this.scheduleDelayedCampaign(campaign, motivation);
    }

    // Store active execution for tracking
    this.activeExecutions.set(motivation.property_id, campaign);
    
    console.log(`✅ Campaign launched for ${motivation.property_id} using ${campaignStrategy.primary_channel} strategy`);
    return campaign;
  }

  private determineCampaignStrategy(motivation: MotivationIntelligence): CampaignStrategy {
    const score = motivation.overall_motivation_score;
    const urgency = motivation.urgency_timeline;
    const dealProbability = motivation.deal_probability;

    // High motivation + urgent timeline = aggressive multi-channel approach
    if (score >= 85 && urgency <= 7) {
      return {
        primary_channel: 'cold_call',
        secondary_channels: ['sms_sequence', 'email_drip'],
        contact_frequency: 5, // 5 touches per week
        campaign_duration_days: 14,
        expected_conversion_rate: 0.25
      };
    }
    
    // High motivation + moderate urgency = phone-first approach
    else if (score >= 70 && urgency <= 30) {
      return {
        primary_channel: 'cold_call',
        secondary_channels: ['sms_sequence'],
        contact_frequency: 3, // 3 touches per week
        campaign_duration_days: 21,
        expected_conversion_rate: 0.18
      };
    }
    
    // Moderate motivation = SMS-first nurture approach
    else if (score >= 50) {
      return {
        primary_channel: 'sms_sequence',
        secondary_channels: ['email_drip', 'direct_mail'],
        contact_frequency: 2, // 2 touches per week
        campaign_duration_days: 45,
        expected_conversion_rate: 0.12
      };
    }
    
    // Lower motivation = long-term nurture campaign
    else {
      return {
        primary_channel: 'email_drip',
        secondary_channels: ['direct_mail'],
        contact_frequency: 1, // 1 touch per week
        campaign_duration_days: 90,
        expected_conversion_rate: 0.08
      };
    }
  }

  private async createPersonalizationProfile(motivation: MotivationIntelligence): Promise<PersonalizationProfile> {
    const prompt = `
    Create a comprehensive personalized communication profile for this motivated seller:
    
    MOTIVATION ANALYSIS:
    - Overall Motivation Score: ${motivation.overall_motivation_score}/100
    - Deal Probability: ${motivation.deal_probability}%
    - Predicted Discount: ${motivation.predicted_discount}%
    - Urgency Timeline: ${motivation.urgency_timeline} days
    - Optimal Strategy: ${motivation.optimal_approach_strategy}
    
    KEY MOTIVATION FACTORS:
    ${motivation.motivation_factors.map((factor, index) => 
      `${index + 1}. ${factor.description} (Impact: ${factor.impact}/100, Urgency: ${factor.urgency})`
    ).join('\\n')}
    
    AI TALKING POINTS:
    ${motivation.ai_talking_points.join('\\n- ')}
    
    PERSONALIZATION REQUIREMENTS:
    
    1. **Communication Tone**: Choose the most effective tone
       - professional: For business-oriented, educated sellers
       - empathetic: For distressed, emotional situations  
       - urgent: For time-sensitive, high-pressure scenarios
    
    2. **Key Pain Points**: Identify the 3-5 most pressing problems to address
       - Financial pressures and cash needs
       - Property maintenance burdens
       - Time constraints and urgency
       - Emotional stress factors
       - Market timing concerns
    
    3. **Solution Positioning**: How to position our offer
       - Fast cash solution provider
       - Problem solver and burden reliever
       - Professional investor partnership
       - Market timing expert
    
    4. **Trust Building Approach**: How to establish credibility quickly
       - Professional credentials and track record
       - Local market expertise demonstration
       - References and testimonials
       - Transparent process explanation
    
    5. **Urgency Messaging**: How to communicate time sensitivity
       - Market timing advantages
       - Limited availability messaging
       - Deadline-driven decision making
       - Cost of delay implications
    
    6. **Objection Prevention**: Address likely concerns proactively
       - Price concerns and market value
       - Process and timeline questions
       - Trust and legitimacy doubts
       - Alternative option considerations
    
    Create messaging that resonates with their specific situation and maximizes deal probability.
    
    Return JSON format:
    {
      "communication_tone": "professional|empathetic|urgent",
      "key_pain_points": ["array of specific pain points"],
      "solution_positioning": "detailed positioning statement",
      "trust_building_approach": "trust establishment strategy",
      "urgency_messaging": "urgency communication approach",
      "objection_prevention": ["array of objection prevention tactics"]
    }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      });

      const profile = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        communication_tone: profile.communication_tone || 'professional',
        key_pain_points: profile.key_pain_points || ['Financial pressure', 'Property burden'],
        solution_positioning: profile.solution_positioning || 'Fast cash solution provider',
        trust_building_approach: profile.trust_building_approach || 'Professional credentials',
        urgency_messaging: profile.urgency_messaging || 'Limited time opportunity',
        objection_prevention: profile.objection_prevention || ['Transparent process', 'Fair pricing']
      };
    } catch (error) {
      console.error('Error creating personalization profile:', error);
      return this.getDefaultPersonalizationProfile(motivation);
    }
  }

  private createExecutionSchedule(strategy: CampaignStrategy, motivation: MotivationIntelligence): ExecutionStep[] {
    const schedule: ExecutionStep[] = [];
    const startTime = new Date();
    let stepNumber = 1;

    // Immediate first contact for high motivation
    if (motivation.overall_motivation_score >= 80) {
      schedule.push({
        step_number: stepNumber++,
        action_type: `${strategy.primary_channel}_initial_contact`,
        scheduled_time: new Date(startTime.getTime() + 30 * 60 * 1000), // 30 minutes from now
        status: 'pending'
      });
    } else {
      // Delayed first contact for lower motivation
      const delayHours = motivation.urgency_timeline <= 7 ? 2 : 24;
      schedule.push({
        step_number: stepNumber++,
        action_type: `${strategy.primary_channel}_initial_contact`,
        scheduled_time: new Date(startTime.getTime() + delayHours * 60 * 60 * 1000),
        status: 'pending'
      });
    }

    // Create follow-up sequence based on strategy
    const touchesPerWeek = strategy.contact_frequency;
    const totalWeeks = Math.ceil(strategy.campaign_duration_days / 7);
    const daysBetweenTouches = Math.floor(7 / touchesPerWeek);

    for (let week = 0; week < totalWeeks; week++) {
      for (let touch = 0; touch < touchesPerWeek; touch++) {
        if (stepNumber === 1) continue; // Skip first contact already added
        
        const daysFromStart = (week * 7) + (touch * daysBetweenTouches);
        const scheduledTime = new Date(startTime.getTime() + daysFromStart * 24 * 60 * 60 * 1000);
        
        // Alternate between primary and secondary channels
        const channel = touch % 2 === 0 ? 
          strategy.primary_channel : 
          strategy.secondary_channels[0] || strategy.primary_channel;
        
        schedule.push({
          step_number: stepNumber++,
          action_type: `${channel}_follow_up_${stepNumber}`,
          scheduled_time: scheduledTime,
          status: 'pending'
        });
      }
    }

    return schedule.slice(0, 15); // Limit to 15 total touches
  }

  private async launchImmediateCampaign(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`🚀 Launching immediate campaign for high-motivation lead ${campaign.lead_id}...`);

    // Execute first contact based on campaign type
    switch (campaign.campaign_type) {
      case 'cold_call':
        await this.executeColdCall(campaign, motivation);
        break;
      case 'sms_sequence':
        await this.executeSMSSequence(campaign, motivation);
        break;
      case 'email_drip':
        await this.executeEmailSequence(campaign, motivation);
        break;
      case 'direct_mail':
        await this.executeDirectMail(campaign, motivation);
        break;
    }

    // Schedule remaining execution steps
    this.scheduleRemainingSteps(campaign);
  }

  private async scheduleDelayedCampaign(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`📅 Scheduling delayed campaign for lead ${campaign.lead_id}...`);
    
    // Schedule all execution steps for future execution
    for (const step of campaign.execution_schedule) {
      this.scheduleExecutionStep(step, campaign, motivation);
    }
  }

  private async executeColdCall(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`📞 Executing cold call for ${campaign.lead_id}...`);
    
    // Generate dynamic call script
    const callScript = await this.generateCallScript(campaign, motivation);
    
    // Find optimal call time
    const optimalTime = this.calculateOptimalCallTime(motivation.property_id);
    
    // Execute call (this would integrate with calling service)
    const callResult = await this.makeIntelligentCall({
      lead_id: campaign.lead_id,
      script: callScript,
      personalization: campaign.personalization_data,
      optimal_time: optimalTime
    });
    
    // Update campaign metrics
    this.updateCampaignMetrics(campaign, 'call_attempt', callResult);
  }

  private async generateCallScript(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<CallScript> {
    const personalization = campaign.personalization_data;
    
    const prompt = `
    Generate a compelling cold call script for this motivated seller:
    
    LEAD CONTEXT:
    - Motivation Score: ${motivation.overall_motivation_score}/100
    - Key Pain Points: ${personalization.key_pain_points.join(', ')}
    - Communication Tone: ${personalization.communication_tone}
    - Solution Positioning: ${personalization.solution_positioning}
    
    SCRIPT REQUIREMENTS:
    
    1. **Opener** (15-20 seconds):
       - Professional introduction
       - Reason for calling
       - Permission to continue
       - Tone: ${personalization.communication_tone}
    
    2. **Pain Point Discovery** (3-5 questions):
       - Questions to uncover specific motivations
       - Focus on: ${personalization.key_pain_points.join(', ')}
       - Listen for urgency indicators
    
    3. **Solution Presentation** (30-45 seconds):
       - Position as: ${personalization.solution_positioning}
       - Address main pain points
       - Emphasize unique value proposition
    
    4. **Objection Handling** (key objections + responses):
       - Price/market value concerns
       - Timeline and process questions
       - Trust and credibility doubts
       - Alternative option considerations
    
    5. **Closing Statements** (multiple options):
       - Appointment setting close
       - Information gathering close
       - Follow-up permission close
    
    6. **Follow-up Strategy**:
       - Next steps if interested
       - Re-engagement approach if not ready
       - Long-term nurture plan
    
    Make the script conversational, natural, and highly personalized to their specific situation.
    
    Return JSON format with all script components.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2000
      });

      const script = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        opener: script.opener || 'Hi, this is [Name] calling about your property...',
        pain_point_discovery: script.pain_point_discovery || ['How long have you owned the property?'],
        solution_presentation: script.solution_presentation || 'I can provide a fast cash solution...',
        objection_handling: script.objection_handling || {},
        closing_statements: script.closing_statements || ['Can we schedule a brief meeting?'],
        follow_up_strategy: script.follow_up_strategy || 'Follow up in 3 days if no response'
      };
    } catch (error) {
      console.error('Error generating call script:', error);
      return this.getDefaultCallScript(personalization);
    }
  }

  private async executeSMSSequence(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`💬 Executing SMS sequence for ${campaign.lead_id}...`);
    
    const smsSequence = await this.generateSMSSequence(campaign, motivation);
    
    // Send first SMS immediately
    await this.sendSMS(campaign.lead_id, smsSequence.messages[0].message_template);
    
    // Schedule remaining SMS messages
    for (let i = 1; i < smsSequence.messages.length; i++) {
      const message = smsSequence.messages[i];
      const sendTime = new Date(Date.now() + message.delay_hours * 60 * 60 * 1000);
      this.scheduleSMS(campaign.lead_id, message.message_template, sendTime);
    }
    
    this.updateCampaignMetrics(campaign, 'sms_sent', { count: 1 });
  }

  private async generateSMSSequence(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<SMSSequence> {
    const personalization = campaign.personalization_data;
    
    const prompt = `
    Generate a compelling SMS sequence for this motivated seller:
    
    LEAD CONTEXT:
    - Motivation Score: ${motivation.overall_motivation_score}/100
    - Urgency Timeline: ${motivation.urgency_timeline} days
    - Key Pain Points: ${personalization.key_pain_points.join(', ')}
    - Communication Tone: ${personalization.communication_tone}
    
    Create a 5-message SMS sequence with:
    
    Message 1 (Immediate): Introduction and value proposition
    Message 2 (48 hours): Problem-focused follow-up
    Message 3 (1 week): Social proof and credibility
    Message 4 (2 weeks): Urgency and scarcity
    Message 5 (1 month): Final value-focused attempt
    
    Each message should be:
    - Under 160 characters
    - Personalized to their situation
    - Include clear call-to-action
    - Tone: ${personalization.communication_tone}
    
    Return JSON format with message templates and timing.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error generating SMS sequence:', error);
      return this.getDefaultSMSSequence(personalization);
    }
  }

  private async executeEmailSequence(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`📧 Executing email sequence for ${campaign.lead_id}...`);
    
    const emailSequence = await this.generateEmailSequence(campaign, motivation);
    
    // Send first email immediately
    await this.sendEmail(campaign.lead_id, emailSequence.emails[0]);
    
    // Schedule remaining emails
    for (let i = 1; i < emailSequence.emails.length; i++) {
      const email = emailSequence.emails[i];
      const sendTime = new Date(Date.now() + email.delay_hours * 60 * 60 * 1000);
      this.scheduleEmail(campaign.lead_id, email, sendTime);
    }
    
    this.updateCampaignMetrics(campaign, 'email_sent', { count: 1 });
  }

  private async executeDirectMail(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<void> {
    console.log(`📮 Executing direct mail for ${campaign.lead_id}...`);
    
    // Generate personalized direct mail piece
    const mailPiece = await this.generateDirectMailPiece(campaign, motivation);
    
    // Submit to direct mail service
    await this.submitDirectMail(campaign.lead_id, mailPiece);
    
    this.updateCampaignMetrics(campaign, 'mail_sent', { count: 1 });
  }

  // Helper methods
  private calculateOptimalCallTime(leadId: string): Date {
    // Calculate optimal call time based on lead demographics and behavior
    const now = new Date();
    const optimalHour = 14; // 2 PM typically good for real estate calls
    
    const optimalTime = new Date(now);
    optimalTime.setHours(optimalHour, 0, 0, 0);
    
    // If it's past optimal time today, schedule for tomorrow
    if (now.getHours() >= optimalHour) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }
    
    return optimalTime;
  }

  private async makeIntelligentCall(callData: any): Promise<any> {
    // This would integrate with AI calling service (like Bland AI or similar)
    console.log(`📞 Making intelligent call to ${callData.lead_id}...`);
    
    // Simulated call result
    return {
      call_made: true,
      contact_status: 'answered',
      conversation_summary: 'Initial contact established, showed interest',
      next_action: 'schedule_property_visit',
      sentiment: 'positive'
    };
  }

  private async sendSMS(leadId: string, message: string): Promise<void> {
    // This would integrate with SMS service (Twilio, etc.)
    console.log(`💬 Sending SMS to ${leadId}: ${message.substring(0, 50)}...`);
  }

  private async sendEmail(leadId: string, email: any): Promise<void> {
    // This would integrate with email service
    console.log(`📧 Sending email to ${leadId}: ${email.subject_template}...`);
  }

  private async submitDirectMail(leadId: string, mailPiece: any): Promise<void> {
    // This would integrate with direct mail service
    console.log(`📮 Submitting direct mail for ${leadId}...`);
  }

  private scheduleExecutionStep(step: ExecutionStep, campaign: CampaignExecution, motivation: MotivationIntelligence): void {
    // Schedule execution step for future execution
    console.log(`📅 Scheduling ${step.action_type} for ${step.scheduled_time}`);
  }

  private scheduleRemainingSteps(campaign: CampaignExecution): void {
    // Schedule all remaining execution steps
    const remainingSteps = campaign.execution_schedule.filter(step => step.status === 'pending');
    console.log(`📅 Scheduling ${remainingSteps.length} remaining execution steps...`);
  }

  private scheduleSMS(leadId: string, message: string, sendTime: Date): void {
    console.log(`📅 Scheduling SMS for ${leadId} at ${sendTime}`);
  }

  private scheduleEmail(leadId: string, email: any, sendTime: Date): void {
    console.log(`📅 Scheduling email for ${leadId} at ${sendTime}`);
  }

  private updateCampaignMetrics(campaign: CampaignExecution, action: string, result: any): void {
    // Update campaign success metrics
    switch (action) {
      case 'call_attempt':
        campaign.success_metrics.contact_attempts++;
        if (result.contact_status === 'answered') {
          campaign.success_metrics.successful_contacts++;
        }
        break;
      case 'sms_sent':
        campaign.success_metrics.contact_attempts++;
        break;
      case 'email_sent':
        campaign.success_metrics.contact_attempts++;
        break;
    }
  }

  private initializeMetricsTracking(leadId: string): SuccessMetrics {
    return {
      contact_attempts: 0,
      successful_contacts: 0,
      appointments_scheduled: 0,
      offers_made: 0,
      contracts_signed: 0,
      deals_closed: 0,
      total_revenue: 0
    };
  }

  private getDefaultPersonalizationProfile(motivation: MotivationIntelligence): PersonalizationProfile {
    return {
      communication_tone: motivation.overall_motivation_score >= 70 ? 'empathetic' : 'professional',
      key_pain_points: ['Property maintenance burden', 'Financial pressure'],
      solution_positioning: 'Professional real estate investor offering quick cash solutions',
      trust_building_approach: 'Local market expertise and transparent process',
      urgency_messaging: 'Limited time opportunity with current market conditions',
      objection_prevention: ['Fair market pricing', 'No hidden fees', 'Quick closing process']
    };
  }

  private getDefaultCallScript(personalization: PersonalizationProfile): CallScript {
    return {
      opener: `Hi, this is [Name] calling about your property. I work with local investors who help homeowners sell quickly for cash. Do you have a quick minute to chat?`,
      pain_point_discovery: [
        'How long have you owned the property?',
        'Are you dealing with any maintenance issues?',
        'What\'s your timeline for selling?'
      ],
      solution_presentation: 'I can provide a fast cash offer with a flexible closing timeline that works for you. No repairs needed, no realtor fees.',
      objection_handling: {
        'price_concern': 'I understand price is important. Let me explain how we determine our offers...',
        'trust_concern': 'I completely understand your caution. Here are references from recent clients...'
      },
      closing_statements: ['Can we schedule a brief 15-minute meeting to discuss your options?'],
      follow_up_strategy: 'Follow up in 3-5 days with additional value and social proof'
    };
  }

  private getDefaultSMSSequence(personalization: PersonalizationProfile): SMSSequence {
    return {
      messages: [
        {
          delay_hours: 0,
          message_template: 'Hi! I help homeowners sell houses fast for cash. Interested in a no-obligation offer? Text YES for info.',
          personalization_variables: ['first_name'],
          expected_response_rate: 0.15
        },
        {
          delay_hours: 48,
          message_template: 'Still thinking about selling? We close in 7 days, no repairs needed. Quick question?',
          personalization_variables: ['first_name'],
          expected_response_rate: 0.08
        }
      ]
    };
  }

  private async generateEmailSequence(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<EmailSequence> {
    // Generate email sequence (simplified implementation)
    return {
      emails: [
        {
          delay_hours: 0,
          subject_template: 'Fast Cash Offer for Your Property',
          body_template: 'We can provide a quick cash offer for your property...',
          personalization_variables: ['first_name', 'property_address'],
          call_to_action: 'Reply for a free consultation'
        }
      ]
    };
  }

  private async generateDirectMailPiece(campaign: CampaignExecution, motivation: MotivationIntelligence): Promise<any> {
    // Generate direct mail piece (simplified implementation)
    return {
      template_type: 'postcard',
      headline: 'We Buy Houses Fast',
      message: 'Get a cash offer in 24 hours',
      call_to_action: 'Call now for your free offer'
    };
  }

  // Public methods for campaign management
  async getCampaignStatus(leadId: string): Promise<CampaignExecution | null> {
    return this.activeExecutions.get(leadId) || null;
  }

  async updateCampaignResult(leadId: string, stepNumber: number, result: any): Promise<void> {
    const campaign = this.activeExecutions.get(leadId);
    if (campaign) {
      const step = campaign.execution_schedule.find(s => s.step_number === stepNumber);
      if (step) {
        step.status = 'completed';
        step.result = result;
        this.updateCampaignMetrics(campaign, 'step_completed', result);
      }
    }
  }

  async pauseCampaign(leadId: string): Promise<void> {
    const campaign = this.activeExecutions.get(leadId);
    if (campaign) {
      console.log(`⏸️ Pausing campaign for ${leadId}`);
      // Pause all pending execution steps
    }
  }

  async resumeCampaign(leadId: string): Promise<void> {
    const campaign = this.activeExecutions.get(leadId);
    if (campaign) {
      console.log(`▶️ Resuming campaign for ${leadId}`);
      // Resume all paused execution steps
    }
  }
}
