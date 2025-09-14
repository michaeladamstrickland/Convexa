import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import FormData from 'form-data';
import fs from 'fs';
import { PropertyViolation, ViolationClassification } from '../types/index';

interface MunicipalSource {
  municipality: string;
  state: string;
  portal_url: string;
  api_endpoint?: string;
  data_format: 'csv' | 'json' | 'xml' | 'pdf' | 'html_scrape';
  requires_foia: boolean;
  update_frequency: 'daily' | 'weekly' | 'monthly';
}

export class CodeViolationExtractor {
  private openai: OpenAI;
  private municipalSources: MunicipalSource[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initializeMunicipalSources();
  }

  async extractViolationIntelligence(markets: string[]): Promise<PropertyViolation[]> {
    console.log(`🏛️ Extracting code violation intelligence for ${markets.length} markets...`);
    
    const violations = await Promise.all([
      this.scrapeMunicipalPortals(markets),
      this.extractFromPDFDockets(markets),
      this.processCSVFeeds(markets),
      this.submitFOIARequests(markets)
    ]);

    const consolidatedViolations = this.consolidateViolations(violations.flat());
    const enrichedViolations = await this.enrichViolationIntelligence(consolidatedViolations);
    
    console.log(`✅ Found ${enrichedViolations.length} high-opportunity violation leads`);
    return enrichedViolations;
  }

  private async scrapeMunicipalPortals(markets: string[]): Promise<any[]> {
    console.log('🕷️ Scraping municipal code enforcement portals...');
    const violations = [];
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      for (const market of markets) {
        const sources = this.municipalSources.filter(source => 
          market.toLowerCase().includes(source.municipality.toLowerCase()) ||
          market.toLowerCase().includes(source.state.toLowerCase())
        );

        for (const source of sources) {
          try {
            console.log(`📋 Scraping ${source.municipality} code violations...`);
            const marketViolations = await this.scrapeSpecificPortal(browser, source);
            violations.push(...marketViolations);
            
            // Rate limiting
            await this.delay(3000 + Math.random() * 2000);
          } catch (error) {
            console.error(`Error scraping ${source.municipality}:`, (error as Error).message);
            continue;
          }
        }
      }
    } finally {
      await browser.close();
    }

    return violations;
  }

  private async scrapeSpecificPortal(browser: any, source: MunicipalSource): Promise<any[]> {
    const violations = [];
    const page = await browser.newPage();

    try {
      // Set stealth headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(source.portal_url, { waitUntil: 'networkidle2' });

      // Handle different portal types
      switch (source.data_format) {
        case 'html_scrape':
          return await this.scrapeHTMLViolations(page, source);
        case 'csv':
          return await this.downloadCSVViolations(page, source);
        case 'json':
          return await this.fetchJSONViolations(source);
        default:
          return await this.scrapeGenericPortal(page, source);
      }
    } catch (error) {
      console.error(`Error with ${source.municipality} portal:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  private async scrapeHTMLViolations(page: any, source: MunicipalSource): Promise<any[]> {
    const violations = [];

    try {
      // Look for violation search or listing pages
      const searchSelectors = [
        'a[href*=\"violation\"]',
        'a[href*=\"code\"]',
        'a[href*=\"enforcement\"]',
        'a[href*=\"compliance\"]'
      ];

      let found = false;
      for (const selector of searchSelectors) {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await page.waitForSelector('table, .violation-list, .case-list', { timeout: 10000 });
          found = true;
          break;
        }
      }

      if (!found) {
        // Try direct table scraping
        await page.waitForSelector('table', { timeout: 5000 });
      }

      // Extract violation data from tables using page content
      const violationData = await page.$$eval('table tr', (rows: any[]) => {
        return rows.slice(1).map((row: any) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            return Array.from(cells).map((cell: any) => cell.textContent?.trim() || '');
          }
          return null;
        }).filter((row: any) => row !== null);
      });

      // Process extracted data
      for (const row of violationData) {
        const violation = this.parseViolationRow(row, source);
        if (violation && this.isValidViolation(violation)) {
          violations.push(violation);
        }
      }
    } catch (error) {
      console.error(`HTML scraping error for ${source.municipality}:`, error);
    }

    return violations;
  }

  private parseViolationRow(row: string[], source: MunicipalSource): any {
    // This would need to be customized for each municipality's data format
    // General pattern: [Case#, Address, Violation Type, Date, Status, ...]
    
    if (row.length < 3) return null;

    // Extract address (usually contains numbers and street indicators)
    const addressIndex = row.findIndex(cell => 
      /\\d+\\s+[\\w\\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct)/i.test(cell)
    );

    if (addressIndex === -1) return null;

    return {
      case_number: row[0] || '',
      property_address: row[addressIndex] || '',
      violation_type: row[addressIndex + 1] || '',
      violation_date: row[addressIndex + 2] || '',
      status: row[addressIndex + 3] || '',
      municipality: source.municipality,
      state: source.state,
      raw_data: row.join(' | '),
      source_url: source.portal_url,
      scraped_at: new Date()
    };
  }

  private async enrichViolationIntelligence(violations: any[]): Promise<PropertyViolation[]> {
    console.log(`🧠 AI-enriching ${violations.length} violations...`);
    const enrichedViolations = [];

    for (const violation of violations) {
      try {
        // AI violation classification
        const classification = await this.classifyViolation(violation.violation_type, violation.raw_data);
        
        // Severity and financial impact scoring
        const severityScore = this.calculateSeverityScore(classification, violation);
        const financialBurden = this.estimateComplianceCost(classification, violation);
        
        // Property condition inference
        const conditionScore = this.inferPropertyCondition(violation, classification);
        
        // Owner stress level assessment
        const stressLevel = this.assessOwnerStress(violation, severityScore);
        
        // Deal potential calculation
        const dealPotential = this.calculateDealPotential(severityScore, financialBurden, conditionScore);

        const enrichedViolation: PropertyViolation = {
          property_address: violation.property_address,
          violation_type: violation.violation_type,
          severity_score: severityScore,
          repeat_offender: await this.checkRepeatOffender(violation.property_address),
          financial_burden: financialBurden,
          compliance_deadline: this.extractComplianceDeadline(violation),
          enforcement_stage: this.determineEnforcementStage(violation.status),
          distress_indicators: this.extractDistressIndicators(classification, violation),
          classification: classification,
          deal_potential: dealPotential
        };

        // Only include high-potential deals
        if (dealPotential >= 70) {
          enrichedViolations.push(enrichedViolation);
        }
      } catch (error) {
        console.error('Error enriching violation:', error);
        continue;
      }
    }

    return enrichedViolations;
  }

  private async classifyViolation(violationType: string, description: string): Promise<ViolationClassification> {
    const prompt = `
    Classify this code violation and assess its impact on property value and owner motivation to sell:
    
    VIOLATION TYPE: \"${violationType}\"
    DESCRIPTION: \"${description}\"
    
    Analyze and classify by:
    
    1. PRIMARY TYPE:
    - structural: Foundation, roof, electrical, plumbing major issues
    - cosmetic: Paint, landscaping, minor repairs
    - health_safety: Hazardous conditions, unsafe structures
    - environmental: Contamination, hazardous materials
    - zoning: Land use violations, illegal additions
    
    2. SEVERITY LEVEL:
    - minor: Under $1,000 to fix, minimal impact
    - moderate: $1,000-$5,000 to fix, moderate impact  
    - major: $5,000-$25,000 to fix, significant impact
    - severe: Over $25,000 to fix, major impact
    
    3. ESTIMATED COST TO FIX: Dollar amount
    
    4. URGENCY TIMELINE:
    - immediate: Must fix within 30 days
    - 30_days: 30-60 day deadline
    - 90_days: 60-120 day deadline  
    - non_urgent: No immediate deadline
    
    5. OWNER STRESS LEVEL:
    - low: Minor inconvenience
    - medium: Moderate pressure
    - high: Significant stress and financial pressure
    - extreme: Overwhelming, likely to motivate quick sale
    
    6. DEAL OPPORTUNITY:
    - poor: Little motivation to sell below market
    - fair: Some discount potential
    - good: Strong discount potential  
    - excellent: Extreme motivation, significant discount likely
    
    Provide detailed reasoning for each classification.
    
    Return JSON format:
    {
      \"type\": \"structural|cosmetic|health_safety|environmental|zoning\",
      \"severity\": \"minor|moderate|major|severe\",
      \"cost_to_fix\": number,
      \"urgency\": \"immediate|30_days|90_days|non_urgent\",
      \"owner_stress_level\": \"low|medium|high|extreme\",
      \"deal_opportunity\": \"poor|fair|good|excellent\",
      \"reasoning\": \"Detailed explanation\"
    }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        type: result.type || 'cosmetic',
        severity: result.severity || 'minor',
        cost_to_fix: result.cost_to_fix || 1000,
        urgency: result.urgency || 'non_urgent',
        owner_stress_level: result.owner_stress_level || 'low',
        deal_opportunity: result.deal_opportunity || 'poor'
      };
    } catch (error) {
      console.error('Error classifying violation:', error);
      return {
        type: 'cosmetic',
        severity: 'minor', 
        cost_to_fix: 1000,
        urgency: 'non_urgent',
        owner_stress_level: 'low',
        deal_opportunity: 'poor'
      };
    }
  }

  private calculateSeverityScore(classification: ViolationClassification, violation: any): number {
    let score = 0;

    // Base severity score
    switch (classification.severity) {
      case 'severe': score += 90; break;
      case 'major': score += 70; break;
      case 'moderate': score += 50; break;
      case 'minor': score += 20; break;
    }

    // Type modifier
    switch (classification.type) {
      case 'health_safety': score += 10; break;
      case 'structural': score += 8; break;
      case 'environmental': score += 6; break;
      case 'zoning': score += 4; break;
      case 'cosmetic': score += 0; break;
    }

    // Urgency modifier
    switch (classification.urgency) {
      case 'immediate': score += 10; break;
      case '30_days': score += 7; break;
      case '90_days': score += 4; break;
      case 'non_urgent': score += 0; break;
    }

    return Math.min(score, 100);
  }

  private estimateComplianceCost(classification: ViolationClassification, violation: any): number {
    // Base cost from classification
    let cost = classification.cost_to_fix;

    // Add potential penalties and fees
    const penaltyMultiplier = this.getPenaltyMultiplier(violation.status);
    cost += cost * penaltyMultiplier;

    // Add permit and inspection fees
    const permitFees = this.estimatePermitFees(classification.type);
    cost += permitFees;

    return Math.round(cost);
  }

  private inferPropertyCondition(violation: any, classification: ViolationClassification): number {
    let conditionScore = 70; // Assume average condition

    // Decrease score based on violation severity
    switch (classification.severity) {
      case 'severe': conditionScore -= 40; break;
      case 'major': conditionScore -= 25; break;
      case 'moderate': conditionScore -= 15; break;
      case 'minor': conditionScore -= 5; break;
    }

    // Further decrease for structural issues
    if (classification.type === 'structural') {
      conditionScore -= 15;
    }

    // Health/safety issues indicate poor maintenance
    if (classification.type === 'health_safety') {
      conditionScore -= 20;
    }

    return Math.max(conditionScore, 0);
  }

  private assessOwnerStress(violation: any, severityScore: number): number {
    let stressScore = severityScore * 0.6; // Base on severity

    // Add stress from timeline pressure
    const daysSinceViolation = this.calculateDaysSinceViolation(violation.violation_date);
    if (daysSinceViolation > 90) stressScore += 20; // Prolonged violation
    if (daysSinceViolation > 180) stressScore += 10; // Escalating pressure

    // Add stress from enforcement stage
    const enforcementStress = this.getEnforcementStress(violation.status);
    stressScore += enforcementStress;

    return Math.min(stressScore, 100);
  }

  private calculateDealPotential(severityScore: number, financialBurden: number, conditionScore: number): number {
    let dealScore = 0;
    
    // Severity impact (0-40 points) - Higher severity = better deal potential
    if (severityScore >= 80) dealScore += 40;
    else if (severityScore >= 60) dealScore += 30;
    else if (severityScore >= 40) dealScore += 20;
    else dealScore += 10;
    
    // Financial burden impact (0-35 points) - Higher cost = more motivation
    if (financialBurden >= 25000) dealScore += 35;
    else if (financialBurden >= 15000) dealScore += 25;
    else if (financialBurden >= 10000) dealScore += 15;
    else if (financialBurden >= 5000) dealScore += 10;
    
    // Property condition impact (0-25 points) - Poor condition = good deal
    if (conditionScore <= 30) dealScore += 25;
    else if (conditionScore <= 50) dealScore += 15;
    else if (conditionScore <= 70) dealScore += 10;
    
    return Math.min(dealScore, 100);
  }

  private async checkRepeatOffender(address: string): Promise<boolean> {
    // This would check historical violation records for the property
    // For now, simulating based on random probability
    return Math.random() < 0.3; // 30% chance of repeat offender
  }

  private extractComplianceDeadline(violation: any): Date {
    // Extract deadline from violation data or estimate based on type
    const defaultDays = 30;
    const violationDate = new Date(violation.violation_date || Date.now());
    return new Date(violationDate.getTime() + defaultDays * 24 * 60 * 60 * 1000);
  }

  private determineEnforcementStage(status: string): PropertyViolation['enforcement_stage'] {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('foreclosure') || statusLower.includes('lien')) {
      return 'foreclosure_threat';
    } else if (statusLower.includes('court') || statusLower.includes('hearing')) {
      return 'court_order';
    } else if (statusLower.includes('citation') || statusLower.includes('fine')) {
      return 'citation';
    } else {
      return 'notice';
    }
  }

  private extractDistressIndicators(classification: ViolationClassification, violation: any): string[] {
    const indicators = [];

    if (classification.severity === 'severe' || classification.severity === 'major') {
      indicators.push('High-cost compliance required');
    }

    if (classification.urgency === 'immediate') {
      indicators.push('Immediate action deadline');
    }

    if (classification.type === 'health_safety') {
      indicators.push('Health/safety risks present');
    }

    if (violation.status?.toLowerCase().includes('repeat')) {
      indicators.push('Repeat violation offender');
    }

    return indicators;
  }

  private consolidateViolations(violations: any[]): any[] {
    // Remove duplicates and consolidate violations by address
    const consolidated = new Map();
    
    for (const violation of violations) {
      const key = violation.property_address?.toLowerCase().trim();
      if (!key) continue;
      
      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        // Combine violations for same property
        existing.violation_type += '; ' + violation.violation_type;
        existing.raw_data += ' | ' + violation.raw_data;
      } else {
        consolidated.set(key, violation);
      }
    }
    
    return Array.from(consolidated.values());
  }

  private isValidViolation(violation: any): boolean {
    return violation.property_address && 
           violation.violation_type && 
           violation.property_address.length > 10;
  }

  private calculateDaysSinceViolation(violationDate: string): number {
    if (!violationDate) return 0;
    const date = new Date(violationDate);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getPenaltyMultiplier(status: string): number {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('court') || statusLower.includes('lien')) return 0.5;
    if (statusLower.includes('citation') || statusLower.includes('fine')) return 0.2;
    return 0.1;
  }

  private estimatePermitFees(violationType: ViolationClassification['type']): number {
    switch (violationType) {
      case 'structural': return 2000;
      case 'health_safety': return 1500;
      case 'environmental': return 3000;
      case 'zoning': return 1000;
      case 'cosmetic': return 200;
      default: return 500;
    }
  }

  private getEnforcementStress(status: string): number {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('foreclosure')) return 30;
    if (statusLower.includes('court')) return 25;
    if (statusLower.includes('citation')) return 15;
    if (statusLower.includes('notice')) return 5;
    return 0;
  }

  private initializeMunicipalSources(): void {
    // Initialize known municipal data sources
    this.municipalSources = [
      {
        municipality: 'Phoenix',
        state: 'AZ',
        portal_url: 'https://www.phoenix.gov/nsd/programs/code-enforcement',
        data_format: 'html_scrape',
        requires_foia: false,
        update_frequency: 'weekly'
      },
      {
        municipality: 'Chicago',
        state: 'IL',
        portal_url: 'https://data.cityofchicago.org/api/views/violations',
        data_format: 'json',
        requires_foia: false,
        update_frequency: 'daily'
      },
      {
        municipality: 'Miami',
        state: 'FL',
        portal_url: 'https://www.miamigov.com/Government/Code-Enforcement',
        data_format: 'html_scrape',
        requires_foia: false,
        update_frequency: 'weekly'
      }
      // Add more municipal sources
    ];
  }

  private async extractFromPDFDockets(markets: string[]): Promise<any[]> {
    console.log('📄 Processing PDF violation dockets...');
    // Implementation for PDF processing
    return [];
  }

  private async processCSVFeeds(markets: string[]): Promise<any[]> {
    console.log('📊 Processing CSV data feeds...');
    // Implementation for CSV processing
    return [];
  }

  private async submitFOIARequests(markets: string[]): Promise<any[]> {
    console.log('📜 Submitting FOIA requests...');
    // Implementation for FOIA automation
    return [];
  }

  private async downloadCSVViolations(page: any, source: MunicipalSource): Promise<any[]> {
    // Implementation for CSV download
    return [];
  }

  private async fetchJSONViolations(source: MunicipalSource): Promise<any[]> {
    // Implementation for JSON API fetching
    return [];
  }

  private async scrapeGenericPortal(page: any, source: MunicipalSource): Promise<any[]> {
    // Generic portal scraping implementation
    return [];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
