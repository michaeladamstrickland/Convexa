import { 
  MotivationIntelligence, 
  LeadProfile, 
  ProcessedDeal, 
  DistressSignals,
  PropertyViolation,
  TaxIntelligence,
  VacancyIntelligence 
} from '../types/index';
import OpenAI from 'openai';

interface QualificationCriteria {
  min_motivation_score: number;
  min_deal_probability: number;
  max_competition_level: number;
  required_equity_amount: number;
  preferred_property_types: string[];
  max_repair_cost_percentage: number;
}

interface DealMetrics {
  profit_potential: number;
  risk_score: number;
  time_to_close: number;
  competition_level: number;
  marketing_cost: number;
  total_roi: number;
}

interface LeadScoringModel {
  distress_weight: number;
  motivation_weight: number;
  equity_weight: number;
  urgency_weight: number;
  competition_weight: number;
  location_weight: number;
}

export class AutomatedLeadScoring {
  private openai: OpenAI;
  private qualificationCriteria: QualificationCriteria;
  private scoringModel: LeadScoringModel;
  private processedDeals: Map<string, ProcessedDeal> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Default qualification criteria - can be customized
    this.qualificationCriteria = {
      min_motivation_score: 60,
      min_deal_probability: 15,
      max_competition_level: 7,
      required_equity_amount: 50000,
      preferred_property_types: ['single_family', 'townhouse', 'duplex'],
      max_repair_cost_percentage: 25
    };

    // AI-optimized scoring weights
    this.scoringModel = {
      distress_weight: 0.30,    // 30% - Primary driver
      motivation_weight: 0.25,  // 25% - Seller psychology
      equity_weight: 0.20,      // 20% - Profit potential
      urgency_weight: 0.15,     // 15% - Timeline pressure
      competition_weight: 0.05, // 5% - Market competition
      location_weight: 0.05     // 5% - Area desirability
    };
  }

  async scoreAndQualifyLead(leadProfile: LeadProfile): Promise<ProcessedDeal> {
    console.log(`🎯 Scoring and qualifying lead: ${leadProfile.address}...`);

    // Calculate comprehensive distress signals
    const distressSignals = this.calculateDistressSignals(leadProfile);
    
    // Generate AI motivation analysis
    const motivationIntelligence = await this.generateMotivationAnalysis(leadProfile, distressSignals);
    
    // Calculate deal metrics and profit potential
    const dealMetrics = this.calculateDealMetrics(leadProfile, motivationIntelligence);
    
    // Determine execution priority
    const executionStatus = this.determineExecutionStatus(motivationIntelligence, dealMetrics);
    
    // Generate next action and timeline
    const { nextAction, timeline } = await this.generateActionPlan(leadProfile, motivationIntelligence, dealMetrics);

    const processedDeal: ProcessedDeal = {
      lead_id: leadProfile.property_id,
      profit_potential: dealMetrics.profit_potential,
      motivation_score: motivationIntelligence.overall_motivation_score,
      execution_status: executionStatus,
      next_action: nextAction,
      timeline: timeline
    };

    // Store processed deal for tracking
    this.processedDeals.set(leadProfile.property_id, processedDeal);
    
    console.log(`✅ Lead qualified: ${leadProfile.address} | Score: ${motivationIntelligence.overall_motivation_score} | Profit: $${dealMetrics.profit_potential.toLocaleString()}`);
    
    return processedDeal;
  }

  private calculateDistressSignals(leadProfile: LeadProfile): DistressSignals {
    const signals: DistressSignals = {
      tax_delinquency: 0,
      foreclosure_status: 0,
      code_violations: 0,
      vacancy_duration: 0,
      condition_score: 0,
      probate_status: 0,
      divorce_proceedings: 0,
      eviction_filings: 0,
      days_on_market: 0,
      price_reductions: 0,
      absentee_owner: 0,
      out_of_state_distance: 0
    };

    // Tax delinquency scoring (0-100)
    if (leadProfile.tax_debt > 0) {
      if (leadProfile.tax_debt > 25000) signals.tax_delinquency = 100;
      else if (leadProfile.tax_debt > 15000) signals.tax_delinquency = 80;
      else if (leadProfile.tax_debt > 10000) signals.tax_delinquency = 60;
      else if (leadProfile.tax_debt > 5000) signals.tax_delinquency = 40;
      else signals.tax_delinquency = 20;
    }

    // Foreclosure status
    if (leadProfile.foreclosure_stage) {
      switch (leadProfile.foreclosure_stage.toLowerCase()) {
        case 'auction_scheduled': signals.foreclosure_status = 100; break;
        case 'notice_of_default': signals.foreclosure_status = 80; break;
        case 'lis_pendens': signals.foreclosure_status = 60; break;
        case 'pre_foreclosure': signals.foreclosure_status = 40; break;
        default: signals.foreclosure_status = 20;
      }
    }

    // Code violations impact
    const totalViolations = leadProfile.violations.length;
    const severityScore = leadProfile.violations.reduce((sum, v) => sum + v.severity_score, 0);
    signals.code_violations = Math.min(100, (totalViolations * 20) + (severityScore / totalViolations * 10));

    // Vacancy duration impact
    if (leadProfile.vacancy_months) {
      if (leadProfile.vacancy_months >= 12) signals.vacancy_duration = 100;
      else if (leadProfile.vacancy_months >= 6) signals.vacancy_duration = 80;
      else if (leadProfile.vacancy_months >= 3) signals.vacancy_duration = 60;
      else signals.vacancy_duration = 40;
    }

    // Property condition scoring (inverted - lower condition = higher distress)
    signals.condition_score = Math.max(0, 100 - leadProfile.condition_score);

    // Probate status
    signals.probate_status = leadProfile.is_probate ? 75 : 0;

    // Divorce proceedings
    signals.divorce_proceedings = leadProfile.is_divorce ? 85 : 0;

    // Eviction history
    signals.eviction_filings = Math.min(100, leadProfile.eviction_count * 25);

    // Days on market pressure
    if (leadProfile.days_on_market) {
      if (leadProfile.days_on_market > 180) signals.days_on_market = 90;
      else if (leadProfile.days_on_market > 120) signals.days_on_market = 70;
      else if (leadProfile.days_on_market > 90) signals.days_on_market = 50;
      else if (leadProfile.days_on_market > 60) signals.days_on_market = 30;
    }

    // Price reduction desperation
    if (leadProfile.price_reduction_count) {
      signals.price_reductions = Math.min(100, leadProfile.price_reduction_count * 30);
    }

    // Absentee owner stress
    signals.absentee_owner = leadProfile.is_absentee ? 60 : 0;

    // Distance creates motivation
    if (leadProfile.owner_distance_miles) {
      if (leadProfile.owner_distance_miles > 1000) signals.out_of_state_distance = 80;
      else if (leadProfile.owner_distance_miles > 500) signals.out_of_state_distance = 60;
      else if (leadProfile.owner_distance_miles > 200) signals.out_of_state_distance = 40;
      else signals.out_of_state_distance = 20;
    }

    return signals;
  }

  private async generateMotivationAnalysis(leadProfile: LeadProfile, distressSignals: DistressSignals): Promise<MotivationIntelligence> {
    const prompt = `
    Analyze this lead's seller motivation using advanced psychological profiling:

    PROPERTY PROFILE:
    - Address: ${leadProfile.address}
    - Owner: ${leadProfile.owner_name}
    - Estimated Value: $${leadProfile.estimated_value.toLocaleString()}
    - Condition Score: ${leadProfile.condition_score}/100
    - Tax Debt: $${leadProfile.tax_debt.toLocaleString()}
    
    DISTRESS INDICATORS:
    - Tax Delinquency: ${distressSignals.tax_delinquency}/100
    - Foreclosure Risk: ${distressSignals.foreclosure_status}/100
    - Code Violations: ${distressSignals.code_violations}/100
    - Vacancy Duration: ${distressSignals.vacancy_duration}/100
    - Property Condition: ${distressSignals.condition_score}/100
    - Probate Status: ${distressSignals.probate_status}/100
    - Divorce Proceedings: ${distressSignals.divorce_proceedings}/100
    - Eviction History: ${distressSignals.eviction_filings}/100
    - Market Pressure: ${distressSignals.days_on_market}/100
    - Price Reductions: ${distressSignals.price_reductions}/100
    - Absentee Owner: ${distressSignals.absentee_owner}/100
    - Distance Factor: ${distressSignals.out_of_state_distance}/100

    SPECIFIC CONTEXT:
    - Is Probate Case: ${leadProfile.is_probate}
    - Is Divorce Case: ${leadProfile.is_divorce}
    - Foreclosure Stage: ${leadProfile.foreclosure_stage || 'None'}
    - Violation Count: ${leadProfile.violations.length}
    - Vacancy Months: ${leadProfile.vacancy_months || 0}
    - Evictions Filed: ${leadProfile.eviction_count}
    - Days on Market: ${leadProfile.days_on_market || 0}
    - Price Reductions: ${leadProfile.price_reduction_count || 0}
    - Owner Distance: ${leadProfile.owner_distance_miles || 0} miles

    ANALYSIS REQUIREMENTS:

    1. **Overall Motivation Score** (0-100):
       - Weight multiple distress factors
       - Consider psychological pressure points
       - Factor in timeline urgency
       - Account for financial stress

    2. **Motivation Factors** (identify 3-5 key factors):
       - Type: financial_distress | property_distress | personal_distress | market_distress
       - Impact: 0-100 (influence on decision making)
       - Description: specific motivation driver
       - Urgency: low | medium | high | critical

    3. **Urgency Timeline** (days until motivation peaks):
       - Consider foreclosure timelines
       - Factor in legal proceedings
       - Account for financial deadlines
       - Include seasonal market factors

    4. **Deal Probability** (0-100):
       - Likelihood of accepting reasonable offer
       - Based on desperation level
       - Considering alternative options
       - Factoring in decision-making capacity

    5. **Predicted Discount** (percentage below market):
       - Expected negotiation range
       - Based on distress level
       - Considering time pressure
       - Accounting for condition issues

    6. **Optimal Approach Strategy**:
       - Primary communication approach
       - Key benefits to emphasize
       - Timing recommendations
       - Trust-building tactics

    7. **AI Talking Points** (5-7 key points):
       - Specific pain points to address
       - Solutions to emphasize
       - Trust builders to mention
       - Urgency factors to leverage

    Use advanced behavioral psychology and real estate market dynamics to create highly accurate motivation assessment.

    Return detailed JSON analysis with all components.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        property_id: leadProfile.property_id,
        overall_motivation_score: analysis.overall_motivation_score || this.calculateFallbackMotivationScore(distressSignals),
        motivation_factors: analysis.motivation_factors || this.getDefaultMotivationFactors(distressSignals),
        urgency_timeline: analysis.urgency_timeline || this.calculateUrgencyTimeline(distressSignals),
        optimal_approach_strategy: analysis.optimal_approach_strategy || 'Professional empathetic approach',
        predicted_discount: analysis.predicted_discount || this.calculatePredictedDiscount(distressSignals),
        deal_probability: analysis.deal_probability || this.calculateDealProbability(distressSignals),
        ai_talking_points: analysis.ai_talking_points || this.getDefaultTalkingPoints(leadProfile)
      };

    } catch (error) {
      console.error('Error generating motivation analysis:', error);
      return this.generateFallbackMotivationAnalysis(leadProfile, distressSignals);
    }
  }

  private calculateDealMetrics(leadProfile: LeadProfile, motivation: MotivationIntelligence): DealMetrics {
    const estimatedValue = leadProfile.estimated_value;
    const expectedDiscount = motivation.predicted_discount / 100;
    const purchasePrice = estimatedValue * (1 - expectedDiscount);
    
    // Estimate repair costs based on condition
    let repairCosts = 0;
    if (leadProfile.condition_score < 30) repairCosts = estimatedValue * 0.25;
    else if (leadProfile.condition_score < 50) repairCosts = estimatedValue * 0.15;
    else if (leadProfile.condition_score < 70) repairCosts = estimatedValue * 0.08;
    else repairCosts = estimatedValue * 0.03;

    // Add violation-related costs
    const violationCosts = leadProfile.violations.reduce((sum, v) => sum + v.financial_burden, 0);
    repairCosts += violationCosts;

    // Calculate holding costs
    const holdingCosts = estimatedValue * 0.02; // 2% for holding, taxes, insurance
    
    // Estimate marketing and closing costs
    const marketingCost = estimatedValue * 0.03; // 3% marketing/staging
    const closingCosts = estimatedValue * 0.02; // 2% closing costs
    
    // Calculate total investment and profit
    const totalInvestment = purchasePrice + repairCosts + holdingCosts + marketingCost + closingCosts;
    const afterRepairValue = estimatedValue * 1.1; // 10% boost after repairs
    const profitPotential = afterRepairValue - totalInvestment;
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(leadProfile, motivation);
    
    // Estimate time to close based on motivation and process
    const timeToClose = this.estimateTimeToClose(motivation);
    
    // Calculate competition level
    const competitionLevel = this.calculateCompetitionLevel(leadProfile);
    
    // Calculate total ROI
    const totalROI = (profitPotential / totalInvestment) * 100;

    return {
      profit_potential: Math.max(0, profitPotential),
      risk_score: riskScore,
      time_to_close: timeToClose,
      competition_level: competitionLevel,
      marketing_cost: marketingCost,
      total_roi: totalROI
    };
  }

  private calculateRiskScore(leadProfile: LeadProfile, motivation: MotivationIntelligence): number {
    let riskScore = 0;

    // Title/legal risks
    if (leadProfile.is_probate) riskScore += 20;
    if (leadProfile.is_divorce) riskScore += 15;
    if (leadProfile.foreclosure_stage) riskScore += 25;

    // Property condition risks
    if (leadProfile.condition_score < 40) riskScore += 30;
    else if (leadProfile.condition_score < 60) riskScore += 20;
    else if (leadProfile.condition_score < 80) riskScore += 10;

    // Code violation risks
    const severeViolations = leadProfile.violations.filter(v => v.severity_score > 80).length;
    riskScore += severeViolations * 10;

    // Market timing risks
    if (leadProfile.days_on_market && leadProfile.days_on_market > 120) riskScore += 15;

    // Motivation volatility
    if (motivation.overall_motivation_score < 50) riskScore += 20;

    return Math.min(100, riskScore);
  }

  private estimateTimeToClose(motivation: MotivationIntelligence): number {
    // Base timeline of 30 days
    let timeToClose = 30;

    // Adjust based on motivation and urgency
    if (motivation.overall_motivation_score >= 90) timeToClose = 7;  // Highly motivated
    else if (motivation.overall_motivation_score >= 80) timeToClose = 14; // Very motivated
    else if (motivation.overall_motivation_score >= 70) timeToClose = 21; // Motivated
    else if (motivation.overall_motivation_score >= 60) timeToClose = 30; // Somewhat motivated
    else timeToClose = 45; // Lower motivation needs more time

    // Adjust for urgency timeline
    if (motivation.urgency_timeline <= 7) timeToClose = Math.min(timeToClose, 10);
    else if (motivation.urgency_timeline <= 30) timeToClose = Math.min(timeToClose, 21);

    return timeToClose;
  }

  private calculateCompetitionLevel(leadProfile: LeadProfile): number {
    let competitionLevel = 5; // Base level

    // Attractive properties get more competition
    if (leadProfile.condition_score > 80) competitionLevel += 3;
    if (leadProfile.estimated_value > 300000) competitionLevel += 2;
    
    // Distressed properties have less competition
    if (leadProfile.violations.length > 3) competitionLevel -= 2;
    if (leadProfile.condition_score < 50) competitionLevel -= 3;
    if (leadProfile.tax_debt > 15000) competitionLevel -= 2;

    // Market factors
    if (leadProfile.days_on_market && leadProfile.days_on_market > 90) competitionLevel -= 1;
    if (leadProfile.price_reduction_count && leadProfile.price_reduction_count > 1) competitionLevel -= 1;

    return Math.max(1, Math.min(10, competitionLevel));
  }

  private determineExecutionStatus(motivation: MotivationIntelligence, dealMetrics: DealMetrics): 'automated' | 'manual' | 'queued' {
    // High-value, high-motivation deals get automated execution
    if (motivation.overall_motivation_score >= 80 && 
        dealMetrics.profit_potential >= 50000 && 
        dealMetrics.risk_score <= 40) {
      return 'automated';
    }
    
    // Medium deals need manual review
    if (motivation.overall_motivation_score >= 60 && 
        dealMetrics.profit_potential >= 25000 && 
        dealMetrics.risk_score <= 60) {
      return 'manual';
    }
    
    // Lower priority deals get queued
    return 'queued';
  }

  private async generateActionPlan(
    leadProfile: LeadProfile, 
    motivation: MotivationIntelligence, 
    dealMetrics: DealMetrics
  ): Promise<{ nextAction: string; timeline: string }> {
    
    const urgencyScore = motivation.overall_motivation_score;
    const profitPotential = dealMetrics.profit_potential;
    
    let nextAction = '';
    let timeline = '';

    if (urgencyScore >= 85 && profitPotential >= 75000) {
      nextAction = 'immediate_high_priority_outreach';
      timeline = 'Execute within 2 hours';
    } else if (urgencyScore >= 70 && profitPotential >= 40000) {
      nextAction = 'priority_multi_channel_campaign';
      timeline = 'Launch within 24 hours';
    } else if (urgencyScore >= 60 && profitPotential >= 25000) {
      nextAction = 'standard_nurture_sequence';
      timeline = 'Begin within 3 days';
    } else if (urgencyScore >= 50) {
      nextAction = 'long_term_nurture_campaign';
      timeline = 'Queue for next week';
    } else {
      nextAction = 'database_nurture_only';
      timeline = 'Monthly touch base';
    }

    return { nextAction, timeline };
  }

  // Fallback methods for when AI analysis fails
  private calculateFallbackMotivationScore(distressSignals: DistressSignals): number {
    const weights = {
      tax_delinquency: 0.25,
      foreclosure_status: 0.20,
      condition_score: 0.15,
      vacancy_duration: 0.12,
      probate_status: 0.10,
      divorce_proceedings: 0.08,
      eviction_filings: 0.05,
      code_violations: 0.05
    };

    let score = 0;
    score += distressSignals.tax_delinquency * weights.tax_delinquency;
    score += distressSignals.foreclosure_status * weights.foreclosure_status;
    score += distressSignals.condition_score * weights.condition_score;
    score += distressSignals.vacancy_duration * weights.vacancy_duration;
    score += distressSignals.probate_status * weights.probate_status;
    score += distressSignals.divorce_proceedings * weights.divorce_proceedings;
    score += distressSignals.eviction_filings * weights.eviction_filings;
    score += distressSignals.code_violations * weights.code_violations;

    return Math.round(score);
  }

  private getDefaultMotivationFactors(distressSignals: DistressSignals): any[] {
    const factors = [];
    
    if (distressSignals.tax_delinquency > 60) {
      factors.push({
        type: 'financial_distress',
        impact: distressSignals.tax_delinquency,
        description: 'Significant tax debt creating financial pressure',
        urgency: distressSignals.tax_delinquency > 80 ? 'critical' : 'high'
      });
    }

    if (distressSignals.foreclosure_status > 40) {
      factors.push({
        type: 'financial_distress',
        impact: distressSignals.foreclosure_status,
        description: 'Foreclosure proceedings creating immediate urgency',
        urgency: 'critical'
      });
    }

    if (distressSignals.condition_score > 50) {
      factors.push({
        type: 'property_distress',
        impact: distressSignals.condition_score,
        description: 'Property condition issues requiring expensive repairs',
        urgency: 'medium'
      });
    }

    return factors;
  }

  private calculateUrgencyTimeline(distressSignals: DistressSignals): number {
    if (distressSignals.foreclosure_status > 80) return 7;  // Immediate
    if (distressSignals.foreclosure_status > 60) return 30; // 1 month
    if (distressSignals.tax_delinquency > 80) return 60;    // 2 months
    if (distressSignals.divorce_proceedings > 0) return 90;  // 3 months
    return 180; // Default 6 months
  }

  private calculatePredictedDiscount(distressSignals: DistressSignals): number {
    let discount = 5; // Base 5% discount

    if (distressSignals.foreclosure_status > 80) discount += 20;
    else if (distressSignals.foreclosure_status > 60) discount += 15;
    else if (distressSignals.foreclosure_status > 40) discount += 10;

    if (distressSignals.tax_delinquency > 60) discount += 8;
    if (distressSignals.condition_score > 70) discount += 12;
    if (distressSignals.vacancy_duration > 60) discount += 10;

    return Math.min(35, discount); // Cap at 35% discount
  }

  private calculateDealProbability(distressSignals: DistressSignals): number {
    let probability = 15; // Base 15%

    if (distressSignals.foreclosure_status > 60) probability += 30;
    if (distressSignals.tax_delinquency > 70) probability += 25;
    if (distressSignals.probate_status > 0) probability += 20;
    if (distressSignals.divorce_proceedings > 0) probability += 20;
    if (distressSignals.vacancy_duration > 60) probability += 15;

    return Math.min(85, probability); // Cap at 85%
  }

  private getDefaultTalkingPoints(leadProfile: LeadProfile): string[] {
    const points = [
      'Quick cash offer with flexible closing timeline',
      'No repair requirements or realtor fees',
      'Professional local investor with proven track record'
    ];

    if (leadProfile.tax_debt > 10000) {
      points.push('Can help resolve outstanding tax obligations');
    }

    if (leadProfile.violations.length > 0) {
      points.push('Purchase property as-is regardless of code violations');
    }

    if (leadProfile.is_probate) {
      points.push('Experience with probate sales and estate resolution');
    }

    return points;
  }

  private generateFallbackMotivationAnalysis(leadProfile: LeadProfile, distressSignals: DistressSignals): MotivationIntelligence {
    return {
      property_id: leadProfile.property_id,
      overall_motivation_score: this.calculateFallbackMotivationScore(distressSignals),
      motivation_factors: this.getDefaultMotivationFactors(distressSignals),
      urgency_timeline: this.calculateUrgencyTimeline(distressSignals),
      optimal_approach_strategy: 'Professional empathetic approach focusing on quick resolution',
      predicted_discount: this.calculatePredictedDiscount(distressSignals),
      deal_probability: this.calculateDealProbability(distressSignals),
      ai_talking_points: this.getDefaultTalkingPoints(leadProfile)
    };
  }

  // Public methods for lead management
  async updateQualificationCriteria(criteria: Partial<QualificationCriteria>): Promise<void> {
    this.qualificationCriteria = { ...this.qualificationCriteria, ...criteria };
    console.log('✅ Qualification criteria updated');
  }

  async updateScoringModel(model: Partial<LeadScoringModel>): Promise<void> {
    this.scoringModel = { ...this.scoringModel, ...model };
    console.log('✅ Lead scoring model updated');
  }

  async getProcessedDeal(leadId: string): Promise<ProcessedDeal | null> {
    return this.processedDeals.get(leadId) || null;
  }

  async getAllProcessedDeals(): Promise<ProcessedDeal[]> {
    return Array.from(this.processedDeals.values());
  }

  async getHighPriorityDeals(): Promise<ProcessedDeal[]> {
    return Array.from(this.processedDeals.values())
      .filter(deal => deal.motivation_score >= 80 && deal.profit_potential >= 50000)
      .sort((a, b) => b.motivation_score - a.motivation_score);
  }
}
