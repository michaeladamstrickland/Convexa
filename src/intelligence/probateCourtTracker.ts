import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { ProbateCase, PropertyLink, AttorneyInfo, ProbateHeirInfo } from '../types/index';

interface ProbateCourtSystem {
  county: string;
  system_type: 'odyssey_portal' | 'tyler_technologies' | 'justice_systems' | 'local_court_portal';
  base_url: string;
  search_endpoints: string[];
  authentication_required: boolean;
}

export class ProbateCourtTracker {
  private openai: OpenAI;
  private courtSystems: ProbateCourtSystem[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initializeCourtSystems();
  }

  async trackProbateFilings(counties: string[]): Promise<ProbateCase[]> {
    console.log(`🏛️ Tracking probate filings across ${counties.length} counties...`);
    
    const probateCases = [];
    
    for (const county of counties) {
      try {
        const courtSystem = this.identifyCourtSystem(county);
        console.log(`📋 Processing ${county} county (${courtSystem.system_type})...`);
        
        const cases = await this.scrapeProbateDocket(county, courtSystem);
        const enrichedCases = await this.enrichProbateCases(cases);
        
        probateCases.push(...enrichedCases);
        
        // Rate limiting to avoid detection
        await this.delay(2000 + Math.random() * 3000);
      } catch (error) {
        console.error(`❌ Error processing ${county}:`, (error as Error).message);
        continue;
      }
    }
    
    const prioritizedCases = this.prioritizeProbateCases(probateCases);
    console.log(`✅ Found ${prioritizedCases.length} high-priority probate opportunities`);
    
    return prioritizedCases;
  }

  private async scrapeProbateDocket(county: string, courtSystem: ProbateCourtSystem): Promise<any[]> {
    const cases = [];
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Set random user agent for stealth
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Handle different court system types
      switch (courtSystem.system_type) {
        case 'odyssey_portal':
          return await this.scrapeOdysseyPortal(page, courtSystem, county);
        case 'tyler_technologies':
          return await this.scrapeTylerTech(page, courtSystem, county);
        case 'justice_systems':
          return await this.scrapeJusticeSystems(page, courtSystem, county);
        default:
          return await this.scrapeGenericPortal(page, courtSystem, county);
      }
    } catch (error) {
      console.error(`Error scraping ${county} probate court:`, error);
      return [];
    } finally {
      await browser.close();
    }
  }

  private async scrapeOdysseyPortal(page: any, courtSystem: ProbateCourtSystem, county: string): Promise<any[]> {
    const cases = [];
    
    try {
      await page.goto(courtSystem.base_url, { waitUntil: 'networkidle2' });
      
      // Navigate to probate case search
      await page.click('a[href*="probate"], a[href*="estate"]');
      await page.waitForSelector('input[name*="case"], input[name*="search"]', { timeout: 5000 });
      
      // Search for recent probate filings (last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      await page.type('input[name*="date_from"]', thirtyDaysAgo.toISOString().split('T')[0]);
      await page.type('input[name*="date_to"]', today.toISOString().split('T')[0]);
      
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForSelector('.case-result, .search-result', { timeout: 10000 });
      
      // Extract case information
      const caseElements = await page.$$('.case-result, .search-result');
      
      for (const element of caseElements) {
        try {
          const caseText = await element.textContent();
          const caseData = this.parseOdysseyCaseData(caseText);
          
          if (caseData && this.isProbateCase(caseData.case_type)) {
            cases.push({
              ...caseData,
              county: county,
              court_system: 'odyssey_portal',
              scraped_at: new Date()
            });
          }
        } catch (error) {
          continue; // Skip problematic cases
        }
      }
    } catch (error) {
      console.error(`Odyssey portal scraping error for ${county}:`, error);
    }
    
    return cases;
  }

  private async enrichProbateCases(cases: any[]): Promise<ProbateCase[]> {
    const enrichedCases = [];
    
    for (const probateCase of cases) {
      try {
        console.log(`🔍 Enriching probate case: ${probateCase.case_number}`);
        
        // Find deceased person's properties
        const properties = await this.findDeceasedProperties(
          probateCase.deceased_name,
          probateCase.case_details
        );
        
        // Identify attorney and heirs
        const attorney = this.extractAttorneyInfo(probateCase);
        const heirs = await this.identifyHeirsFromCourt(probateCase);
        
        // Calculate deal urgency
        const urgencyScore = this.calculateProbateUrgency(probateCase, properties);
        
        // AI deal brief generation
        const dealBrief = await this.generateProbateDealBrief(probateCase, properties);
        
        // Skip trace heir contact information
        const heirContacts = await this.skipTraceHeirs(heirs);
        
        const enrichedCase: ProbateCase = {
          id: `${probateCase.county}_${probateCase.case_number}`,
          case_number: probateCase.case_number,
          deceased_name: probateCase.deceased_name,
          filing_date: new Date(probateCase.filing_date),
          case_status: probateCase.case_status,
          county: probateCase.county,
          court_system: probateCase.court_system,
          properties: properties,
          attorney_info: attorney || undefined,
          identified_heirs: heirs,
          heir_contacts: heirContacts,
          urgency_score: urgencyScore,
          deal_potential_score: this.calculateDealPotential(urgencyScore, properties),
          estimated_estate_value: properties.reduce((sum, prop) => sum + (prop.estimated_value || 0), 0),
          estimated_total_value: properties.reduce((sum, prop) => sum + (prop.estimated_value || 0), 0),
          ai_deal_brief: dealBrief,
          optimal_approach_strategy: this.determineApproachStrategy(heirs, attorney, urgencyScore),
          scraped_at: new Date()
        };
        
        // Only include high-value opportunities
        if ((enrichedCase.estimated_total_value || 0) >= 100000 && (enrichedCase.deal_potential_score || 0) >= 70) {
          enrichedCases.push(enrichedCase);
        }
      } catch (error) {
        console.error(`Error enriching probate case:`, error);
        continue;
      }
    }
    
    return enrichedCases;
  }

  private async findDeceasedProperties(deceasedName: string, caseDetails: string): Promise<PropertyLink[]> {
    // This would integrate with property data sources
    // For now, simulating property discovery
    console.log(`🏠 Finding properties for ${deceasedName}...`);
    
    // Extract potential addresses from case details
    const addressMatches = caseDetails.match(/\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl)\s*,?\s*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}/gi);
    
    const properties: PropertyLink[] = [];
    
    if (addressMatches) {
      for (const address of addressMatches) {
        // Simulate property data enrichment
        const property: PropertyLink = {
          address: address.trim(),
          estimated_value: Math.floor(Math.random() * 400000) + 100000, // Simulated
          property_type: 'residential',
          bedrooms: Math.floor(Math.random() * 4) + 2,
          bathrooms: Math.floor(Math.random() * 3) + 1,
          square_feet: Math.floor(Math.random() * 2000) + 1000,
          year_built: Math.floor(Math.random() * 50) + 1970,
          last_sale_date: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000),
          equity: Math.floor(Math.random() * 200000) + 50000,
          condition: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)] as any,
          vacancy_probability: Math.floor(Math.random() * 100),
          deed_type: 'warranty_deed',
          vacancy_indicators: []
        };
        
        properties.push(property);
      }
    }
    
    return properties;
  }

  private async identifyHeirsFromCourt(probateCase: any): Promise<ProbateHeirInfo[]> {
    const prompt = `
    Analyze this probate court case filing and identify potential heirs and their relationship to the deceased:
    
    CASE DETAILS:
    - Case Number: ${probateCase.case_number}
    - Deceased: ${probateCase.deceased_name}
    - Filing Date: ${probateCase.filing_date}
    - Case Status: ${probateCase.case_status}
    - Court Details: ${probateCase.case_details}
    
    Extract and identify:
    1. All named heirs/beneficiaries
    2. Their relationship to deceased (spouse, child, sibling, etc.)
    3. Any addresses mentioned
    4. Attorney names and contact information
    5. Executor/Personal Representative details
    
    For each heir, provide:
    - Name
    - Relationship to deceased
    - Inheritance priority (1-10 scale)
    - Decision-making influence (1-10 scale)
    - Contact likelihood (1-10 scale)
    
    Return JSON array format.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const heirs = JSON.parse(response.choices[0].message.content || '[]');
      return heirs.map((heir: any) => ({
        name: heir.name,
        relationship: heir.relationship,
        inheritance_priority: heir.inheritance_priority,
        decision_making_influence: heir.decision_making_influence,
        contact_likelihood: heir.contact_likelihood,
        address: heir.address || null,
        phone: null, // To be filled by skip tracing
        email: null, // To be filled by skip tracing
        motivation_score: this.calculateHeirMotivation(heir)
      }));
    } catch (error) {
      console.error('Error identifying heirs:', error);
      return [];
    }
  }

  private async generateProbateDealBrief(probateCase: any, properties: PropertyLink[]): Promise<string> {
    const totalValue = properties.reduce((sum, prop) => sum + (prop.estimated_value || 0), 0);
    const totalEquity = properties.reduce((sum, prop) => sum + (prop.equity || 0), 0);
    
    const prompt = `
    Generate a comprehensive investment brief for this probate opportunity:
    
    CASE SUMMARY:
    - Deceased: ${probateCase.deceased_name}
    - Filed: ${probateCase.filing_date}
    - Status: ${probateCase.case_status}
    - County: ${probateCase.county}
    - Attorney: ${probateCase.attorney_name || 'Not specified'}
    
    PROPERTY PORTFOLIO:
    Total Properties: ${properties.length}
    Total Estimated Value: $${totalValue.toLocaleString()}
    Total Equity: $${totalEquity.toLocaleString()}
    
    PROPERTIES:
    ${properties.map((prop, index) => `
    ${index + 1}. ${prop.address}
       - Value: $${prop.estimated_value?.toLocaleString()}
       - Equity: $${prop.equity?.toLocaleString()}
       - ${prop.bedrooms}BR/${prop.bathrooms}BA, ${prop.square_feet} sqft
       - Condition: ${prop.condition}
    `).join('')}
    
    ANALYSIS REQUIREMENTS:
    1. Investment Strategy Recommendation (wholesale, fix-flip, buy-hold, package deal)
    2. Estimated Profit Potential (be specific with numbers)
    3. Timeline Considerations (probate process stages)
    4. Key Risks and Mitigation Strategies
    5. Heir Negotiation Approach Strategy
    6. Market Positioning and Competitive Analysis
    7. Optimal Deal Structure (cash offer, terms, timeline)
    8. Next Steps Action Plan
    
    Write a compelling, data-driven 200-word investment brief that captures the opportunity and provides actionable insights for immediate execution.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      return response.choices[0].message.content || 'Analysis unavailable';
    } catch (error) {
      console.error('Error generating deal brief:', error);
      return 'AI analysis temporarily unavailable';
    }
  }

  private calculateProbateUrgency(probateCase: any, properties: PropertyLink[]): number {
    let urgencyScore = 0;
    
    // Timeline urgency (0-30 points)
    const filingDate = new Date(probateCase.filing_date);
    const daysSinceFiling = Math.floor((Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceFiling <= 30) urgencyScore += 30; // Very fresh
    else if (daysSinceFiling <= 60) urgencyScore += 25;
    else if (daysSinceFiling <= 90) urgencyScore += 20;
    else if (daysSinceFiling <= 180) urgencyScore += 15;
    else urgencyScore += 5; // Old cases, lower urgency
    
    // Estate value urgency (0-25 points)
    const totalValue = properties.reduce((sum, prop) => sum + (prop.estimated_value || 0), 0);
    if (totalValue >= 500000) urgencyScore += 25;
    else if (totalValue >= 300000) urgencyScore += 20;
    else if (totalValue >= 200000) urgencyScore += 15;
    else if (totalValue >= 100000) urgencyScore += 10;
    
    // Property condition urgency (0-25 points)
    const poorConditionProperties = properties.filter(p => p.condition === 'poor' || p.condition === 'fair').length;
    const conditionRatio = poorConditionProperties / properties.length;
    urgencyScore += Math.floor(conditionRatio * 25);
    
    // Case status urgency (0-20 points)
    if (probateCase.case_status?.includes('pending') || probateCase.case_status?.includes('filed')) {
      urgencyScore += 20; // Early stage, high opportunity
    } else if (probateCase.case_status?.includes('active')) {
      urgencyScore += 15;
    } else if (probateCase.case_status?.includes('closing')) {
      urgencyScore += 5; // Late stage, lower opportunity
    }
    
    return Math.min(urgencyScore, 100);
  }

  private calculateDealPotential(urgencyScore: number, properties: PropertyLink[]): number {
    const totalEquity = properties.reduce((sum, prop) => sum + (prop.equity || 0), 0);
    const avgEquity = totalEquity / properties.length;
    
    let dealScore = urgencyScore * 0.4; // 40% weight on urgency
    
    // Equity potential (0-40 points)
    if (avgEquity >= 100000) dealScore += 40;
    else if (avgEquity >= 75000) dealScore += 30;
    else if (avgEquity >= 50000) dealScore += 20;
    else if (avgEquity >= 25000) dealScore += 10;
    
    // Portfolio size bonus (0-20 points)
    if (properties.length >= 3) dealScore += 20;
    else if (properties.length >= 2) dealScore += 10;
    else dealScore += 5;
    
    return Math.min(dealScore, 100);
  }

  private calculateHeirMotivation(heir: any): number {
    let motivation = 50; // Base motivation
    
    // Relationship impact
    if (heir.relationship === 'spouse') motivation += 20;
    else if (heir.relationship === 'child') motivation += 15;
    else if (heir.relationship === 'sibling') motivation += 10;
    else motivation += 5;
    
    // Decision making influence
    motivation += heir.decision_making_influence * 2;
    
    // Contact likelihood
    motivation += heir.contact_likelihood * 1.5;
    
    return Math.min(Math.max(motivation, 0), 100);
  }

  private identifyCourtSystem(county: string): ProbateCourtSystem {
    // Find matching court system or return default
    const system = this.courtSystems.find(cs => 
      cs.county.toLowerCase() === county.toLowerCase()
    );
    
    return system || {
      county: county,
      system_type: 'local_court_portal',
      base_url: `https://${county.toLowerCase()}county.gov/probate`,
      search_endpoints: ['/search', '/cases'],
      authentication_required: false
    };
  }

  private initializeCourtSystems(): void {
    // Initialize known court systems - this would be expanded with real data
    this.courtSystems = [
      {
        county: 'Maricopa',
        system_type: 'odyssey_portal',
        base_url: 'https://superiorcourt.maricopa.gov',
        search_endpoints: ['/probate/search'],
        authentication_required: false
      },
      {
        county: 'Cook',
        system_type: 'tyler_technologies',
        base_url: 'https://www.cookcountyclerkofcourt.org',
        search_endpoints: ['/case-search'],
        authentication_required: false
      }
      // Add more court systems as needed
    ];
  }

  private async skipTraceHeirs(heirs: ProbateHeirInfo[]): Promise<ProbateHeirInfo[]> {
    // Implement skip tracing for heir contact information
    // This would integrate with skip tracing services
    return heirs; // Placeholder
  }

  private extractAttorneyInfo(probateCase: any): AttorneyInfo | null {
    // Extract attorney information from case details
    const details = probateCase.case_details || '';
    
    // Simple regex patterns for attorney extraction
    const attorneyMatch = details.match(/attorney[:\s]*([^,\n]+)/i);
    const phoneMatch = details.match(/(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4})/);
    
    if (attorneyMatch) {
      return {
        name: attorneyMatch[1].trim(),
        phone: phoneMatch ? phoneMatch[0] : null,
        email: null, // Would need more sophisticated extraction
        firm: null
      };
    }
    
    return null;
  }

  private isProbateCase(caseType: string): boolean {
    const probateKeywords = ['probate', 'estate', 'will', 'inheritance', 'decedent', 'guardian'];
    return probateKeywords.some(keyword => 
      caseType.toLowerCase().includes(keyword)
    );
  }

  private parseOdysseyCaseData(caseText: string): any {
    // Parse case data from Odyssey portal format
    // This would need to be customized for each court's format
    return {
      case_number: this.extractCaseNumber(caseText),
      deceased_name: this.extractDeceasedName(caseText),
      filing_date: this.extractFilingDate(caseText),
      case_status: this.extractCaseStatus(caseText),
      case_type: this.extractCaseType(caseText),
      case_details: caseText
    };
  }

  private extractCaseNumber(text: string): string {
    const match = text.match(/(?:case|no\.?)\s*:?\s*([A-Z0-9-]+)/i);
    return match ? match[1] : '';
  }

  private extractDeceasedName(text: string): string {
    const match = text.match(/estate\s+of\s+([^,\n]+)/i) || 
                  text.match(/in\s+re:?\s+([^,\n]+)/i);
    return match ? match[1].trim() : '';
  }

  private extractFilingDate(text: string): string {
    const match = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
    return match ? match[0] : '';
  }

  private extractCaseStatus(text: string): string {
    const statusKeywords = ['pending', 'active', 'closed', 'dismissed', 'filed'];
    for (const status of statusKeywords) {
      if (text.toLowerCase().includes(status)) {
        return status;
      }
    }
    return 'unknown';
  }

  private extractCaseType(text: string): string {
    const match = text.match(/(?:type|case\s+type)[:\s]*([^,\n]+)/i);
    return match ? match[1].trim() : 'probate';
  }

  private prioritizeProbateCases(cases: ProbateCase[]): ProbateCase[] {
    return cases
      .sort((a, b) => {
        // Sort by deal potential score first, then urgency
        const aScore = a.deal_potential_score || 0;
        const bScore = b.deal_potential_score || 0;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return b.urgency_score - a.urgency_score;
      })
      .slice(0, 100); // Return top 100 opportunities
  }

  private determineApproachStrategy(heirs: ProbateHeirInfo[], attorney: AttorneyInfo | null, urgencyScore: number): string {
    if (attorney) {
      return 'attorney_first'; // Contact attorney first for represented estates
    } else if (heirs.length === 1) {
      return 'direct_heir'; // Single heir, direct approach
    } else if (urgencyScore >= 80) {
      return 'urgent_multiple'; // Multiple heirs, urgent approach
    } else {
      return 'gradual_multiple'; // Multiple heirs, gradual approach
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async scrapeTylerTech(page: any, courtSystem: ProbateCourtSystem, county: string): Promise<any[]> {
    // Implementation for Tyler Technologies court systems
    console.log(`Scraping Tyler Technologies system for ${county}...`);
    return []; // Placeholder
  }

  private async scrapeJusticeSystems(page: any, courtSystem: ProbateCourtSystem, county: string): Promise<any[]> {
    // Implementation for Justice Systems court portals
    console.log(`Scraping Justice Systems portal for ${county}...`);
    return []; // Placeholder
  }

  private async scrapeGenericPortal(page: any, courtSystem: ProbateCourtSystem, county: string): Promise<any[]> {
    // Generic implementation for unknown court systems
    console.log(`Scraping generic court portal for ${county}...`);
    return []; // Placeholder
  }
}
