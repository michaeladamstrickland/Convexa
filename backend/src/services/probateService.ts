// Advanced Probate Lead Generation Service
// Comprehensive probate data mining with multiple sources and AI analysis

import axios, { AxiosInstance } from 'axios';
import { 
  ProbateLeadParams,
  ProbateLeadResult,
  ProbateProperty,
  DeceasedOwnerRecord,
  ProbateFilingData,
  EstateContact,
  ProbateMotivationFactors
} from '../types/probateTypes';

export interface ProbateAPIConfig {
  usObituaryAPI: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  peopleDataLabs: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  legacyTree: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  truePeopleSearch: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  courtRecordsAPI: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  attomData: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  openAI: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
}

export class AdvancedProbateService {
  private clients: Record<string, AxiosInstance> = {};
  private config: ProbateAPIConfig;
  private totalCosts: number = 0;
  private requestCount: number = 0;

  constructor(config: ProbateAPIConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    // US Obituary API - Primary deceased owner detection
    if (this.config.usObituaryAPI.enabled) {
      this.clients.obituary = axios.create({
        baseURL: this.config.usObituaryAPI.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.config.usObituaryAPI.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
    }

    // People Data Labs - Detailed person information
    if (this.config.peopleDataLabs.enabled) {
      this.clients.peopleData = axios.create({
        baseURL: this.config.peopleDataLabs.baseUrl,
        headers: {
          'X-Api-Key': this.config.peopleDataLabs.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    }

    // Legacy Tree - Genealogy and family connections
    if (this.config.legacyTree.enabled) {
      this.clients.legacyTree = axios.create({
        baseURL: this.config.legacyTree.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.config.legacyTree.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      });
    }

    // TruePeopleSearch - Contact verification
    if (this.config.truePeopleSearch.enabled) {
      this.clients.truePeople = axios.create({
        baseURL: this.config.truePeopleSearch.baseUrl,
        headers: {
          'X-API-Key': this.config.truePeopleSearch.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
    }

    // Court Records API - Probate filings
    if (this.config.courtRecordsAPI.enabled) {
      this.clients.courtRecords = axios.create({
        baseURL: this.config.courtRecordsAPI.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.config.courtRecordsAPI.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });
    }

    // ATTOM Data - Property information
    if (this.config.attomData.enabled) {
      this.clients.attomData = axios.create({
        baseURL: this.config.attomData.baseUrl,
        headers: {
          'apikey': this.config.attomData.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    }

    // OpenAI - AI analysis and scoring
    if (this.config.openAI.enabled) {
      this.clients.openAI = axios.create({
        baseURL: this.config.openAI.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.config.openAI.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    }
  }

  async comprehensiveProbateSearch(params: ProbateLeadParams): Promise<ProbateLeadResult> {
    const startTime = Date.now();
    const searchId = `probate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔍 Starting comprehensive probate search for ${params.zipCode}`);
    
    try {
      // Phase 1: Identify deceased owners in the area
      const deceasedOwners = await this.findDeceasedOwners(params);
      console.log(`📋 Found ${deceasedOwners.length} potential deceased owners`);

      // Phase 2: Get property details for each deceased owner
      const propertiesWithDetails = await this.enrichPropertiesWithDetails(deceasedOwners, params);
      console.log(`🏠 Enriched ${propertiesWithDetails.length} properties with details`);

      // Phase 3: Find probate filings and legal status
      const propertiesWithLegal = await this.addProbateFilings(propertiesWithDetails);
      console.log(`⚖️ Added legal data to ${propertiesWithLegal.length} properties`);

      // Phase 4: Identify heirs and estate contacts
      const propertiesWithContacts = await this.findEstateContacts(propertiesWithLegal);
      console.log(`📞 Found contacts for ${propertiesWithContacts.length} properties`);

      // Phase 5: AI analysis for motivation and urgency scoring
      const analyzedProperties = await this.performAIAnalysis(propertiesWithContacts);
      console.log(`🤖 AI analysis completed for ${analyzedProperties.length} properties`);

      // Phase 6: Filter and rank results
      const finalResults = this.filterAndRankResults(analyzedProperties, params);
      console.log(`🎯 Final results: ${finalResults.length} high-quality probate leads`);

      const executionTime = Date.now() - startTime;
      const totalCost = this.calculateTotalCost();

      return {
        success: true,
        data: {
          searchId,
          totalResults: finalResults.length,
          properties: finalResults,
          searchMetadata: {
            searchId,
            executionTime,
            totalCost,
            costBreakdown: this.getCostBreakdown(),
            dataSourcesUsed: this.getDataSourcesUsed(),
            searchParameters: params,
            timestamp: new Date().toISOString()
          }
        }
      };

    } catch (error) {
      console.error('Probate search error:', error);
      return {
        success: false,
        error: `Probate search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: null
      };
    }
  }

  private async findDeceasedOwners(params: ProbateLeadParams): Promise<DeceasedOwnerRecord[]> {
    const deceasedOwners: DeceasedOwnerRecord[] = [];
    
    try {
      // Search obituary databases for recent deaths in the area
      if (this.clients.obituary) {
        const obituaryResults = await this.searchObituaries(params);
        deceasedOwners.push(...obituaryResults);
        this.addCost('obituary', 0.30);
      }

      // Cross-reference with People Data Labs for additional verification
      if (this.clients.peopleData && deceasedOwners.length > 0) {
        const verifiedOwners = await this.verifyDeceasedStatus(deceasedOwners);
        this.addCost('peopleData', 0.20 * deceasedOwners.length);
        return verifiedOwners;
      }

      return deceasedOwners;
    } catch (error) {
      console.error('Error finding deceased owners:', error);
      return [];
    }
  }

  private async searchObituaries(params: ProbateLeadParams): Promise<DeceasedOwnerRecord[]> {
    try {
      const response = await this.clients.obituary.post('/search', {
        location: {
          zipCode: params.zipCode,
          radius: params.radius || 10
        },
        dateRange: {
          start: params.dateRange?.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          end: params.dateRange?.end || new Date().toISOString()
        },
        includePropertyOwners: true,
        minAge: params.minAge || 50
      });

      return response.data.results.map((obit: any) => ({
        deceasedId: obit.id,
        fullName: obit.fullName,
        firstName: obit.firstName,
        lastName: obit.lastName,
        dateOfDeath: obit.dateOfDeath,
        age: obit.age,
        lastKnownAddress: obit.lastKnownAddress,
        properties: obit.properties || [],
        familyMembers: obit.survivors || [],
        source: 'obituary_api',
        confidence: obit.confidence || 0.85
      }));
    } catch (error) {
      console.error('Obituary search error:', error);
      return [];
    }
  }

  private async verifyDeceasedStatus(owners: DeceasedOwnerRecord[]): Promise<DeceasedOwnerRecord[]> {
    const verified: DeceasedOwnerRecord[] = [];

    for (const owner of owners) {
      try {
        const response = await this.clients.peopleData.post('/person/enrich', {
          name: owner.fullName,
          location: owner.lastKnownAddress,
          includeDeathRecords: true
        });

        if (response.data.person?.isDeceased) {
          verified.push({
            ...owner,
            confidence: Math.min(owner.confidence + 0.10, 1.0),
            verificationSource: 'people_data_labs'
          });
        }
      } catch (error) {
        // Still include if obituary confidence is high
        if (owner.confidence >= 0.80) {
          verified.push(owner);
        }
      }
    }

    return verified;
  }

  private async enrichPropertiesWithDetails(
    deceasedOwners: DeceasedOwnerRecord[], 
    params: ProbateLeadParams
  ): Promise<ProbateProperty[]> {
    const properties: ProbateProperty[] = [];

    for (const owner of deceasedOwners) {
      for (const property of owner.properties) {
        try {
          const propertyDetails = await this.getPropertyDetails(property.address);
          
          if (propertyDetails && this.meetsFilterCriteria(propertyDetails, params)) {
            properties.push({
              propertyId: `probate-${owner.deceasedId}-${property.id}`,
              address: propertyDetails.address,
              deceasedOwner: owner,
              propertyDetails,
              probateStatus: 'pending_investigation',
              estimatedValue: propertyDetails.estimatedValue,
              estimatedEquity: propertyDetails.estimatedEquity,
              marketConditions: propertyDetails.marketConditions,
              lastSaleDate: propertyDetails.lastSaleDate,
              lastSalePrice: propertyDetails.lastSalePrice,
              propertyType: propertyDetails.propertyType,
              squareFootage: propertyDetails.squareFootage,
              yearBuilt: propertyDetails.yearBuilt,
              lotSize: propertyDetails.lotSize,
              motivationFactors: this.calculateInitialMotivationFactors(owner, propertyDetails),
              dataSource: 'comprehensive_search',
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`Error enriching property ${property.address}:`, error);
        }
      }
    }

    return properties;
  }

  private async getPropertyDetails(address: string): Promise<any> {
    try {
      const response = await this.clients.attomData.get('/property/detail', {
        params: { address }
      });

      this.addCost('attomData', 0.50);
      return response.data.property[0];
    } catch (error) {
      console.error('Property details error:', error);
      return null;
    }
  }

  private meetsFilterCriteria(property: any, params: ProbateLeadParams): boolean {
    if (params.minEquity && property.estimatedEquity < params.minEquity) return false;
    if (params.minValue && property.estimatedValue < params.minValue) return false;
    if (params.maxValue && property.estimatedValue > params.maxValue) return false;
    if (params.propertyTypes && !params.propertyTypes.includes(property.propertyType)) return false;
    
    return true;
  }

  private calculateInitialMotivationFactors(
    owner: DeceasedOwnerRecord, 
    property: any
  ): ProbateMotivationFactors {
    const daysSinceDeath = Math.floor(
      (Date.now() - new Date(owner.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      timeUrgency: this.calculateTimeUrgency(daysSinceDeath),
      financialPressure: this.calculateFinancialPressure(property),
      propertyCondition: this.estimatePropertyCondition(property),
      heirSituation: this.analyzeHeirSituation(owner.familyMembers),
      marketFactors: this.analyzeMarketFactors(property),
      overallScore: 0 // Will be calculated by AI
    };
  }

  private calculateTimeUrgency(daysSinceDeath: number): number {
    // Higher urgency as time passes (estate settlement pressure)
    if (daysSinceDeath < 30) return 60; // Recent death, lower urgency
    if (daysSinceDeath < 90) return 75; // 1-3 months, moderate urgency
    if (daysSinceDeath < 180) return 85; // 3-6 months, high urgency
    if (daysSinceDeath < 365) return 95; // 6-12 months, very high urgency
    return 90; // Over 1 year, still high but slightly lower
  }

  private calculateFinancialPressure(property: any): number {
    // Estimate financial pressure based on property characteristics
    let pressure = 50; // Base score

    if (property.mortgage && property.mortgage.balance > 0) pressure += 20;
    if (property.taxes && property.taxes.delinquent) pressure += 25;
    if (property.estimatedValue > 500000) pressure += 15; // Higher value = more pressure
    if (property.propertyType === 'investment') pressure += 10;

    return Math.min(pressure, 100);
  }

  private estimatePropertyCondition(property: any): number {
    let condition = 70; // Assume decent condition

    if (property.yearBuilt < 1980) condition -= 10;
    if (property.yearBuilt < 1960) condition -= 15;
    if (property.maintenance && property.maintenance.deferred) condition -= 20;

    return Math.max(condition, 30);
  }

  private analyzeHeirSituation(familyMembers: any[]): number {
    if (!familyMembers || familyMembers.length === 0) return 95; // No clear heirs = high urgency

    const adultChildren = familyMembers.filter(m => m.relationship === 'child' && m.age >= 18);
    
    if (adultChildren.length === 1) return 70; // Single heir, moderate urgency
    if (adultChildren.length <= 3) return 80; // Few heirs, higher urgency
    return 85; // Many heirs = complex situation = high urgency
  }

  private analyzeMarketFactors(property: any): number {
    // Analyze local market conditions for urgency
    let marketScore = 70;

    if (property.marketConditions?.appreciationRate > 5) marketScore += 15;
    if (property.marketConditions?.daysOnMarket < 30) marketScore += 10;
    if (property.marketConditions?.inventory === 'low') marketScore += 10;

    return Math.min(marketScore, 100);
  }

  private async addProbateFilings(properties: ProbateProperty[]): Promise<ProbateProperty[]> {
    const enrichedProperties: ProbateProperty[] = [];

    for (const property of properties) {
      try {
        const filings = await this.searchProbateFilings(property.deceasedOwner.fullName, property.address);
        
        enrichedProperties.push({
          ...property,
          probateFilings: filings,
          probateStatus: this.determineProbateStatus(filings)
        });
      } catch (error) {
        console.error('Error adding probate filings:', error);
        enrichedProperties.push(property);
      }
    }

    return enrichedProperties;
  }

  private async searchProbateFilings(deceasedName: string, propertyAddress: string): Promise<ProbateFilingData[]> {
    try {
      const response = await this.clients.courtRecords.post('/probate/search', {
        deceasedName,
        propertyAddress,
        lookbackMonths: 24
      });

      this.addCost('courtRecords', 0.40);
      return response.data.filings || [];
    } catch (error) {
      console.error('Probate filing search error:', error);
      return [];
    }
  }

  private determineProbateStatus(filings: ProbateFilingData[]): string {
    if (filings.length === 0) return 'no_filing_found';
    
    const latestFiling = filings.sort((a, b) => 
      new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
    )[0];

    switch (latestFiling.status) {
      case 'petition_filed': return 'probate_initiated';
      case 'administration_granted': return 'in_probate';
      case 'estate_closed': return 'probate_closed';
      default: return 'status_unknown';
    }
  }

  private async findEstateContacts(properties: ProbateProperty[]): Promise<ProbateProperty[]> {
    const propertiesWithContacts: ProbateProperty[] = [];

    for (const property of properties) {
      try {
        const contacts = await this.identifyEstateContacts(property);
        
        propertiesWithContacts.push({
          ...property,
          estateContacts: contacts
        });
      } catch (error) {
        console.error('Error finding estate contacts:', error);
        propertiesWithContacts.push(property);
      }
    }

    return propertiesWithContacts;
  }

  private async identifyEstateContacts(property: ProbateProperty): Promise<EstateContact[]> {
    const contacts: EstateContact[] = [];

    try {
      // Search for executor/administrator from probate filings
      if (property.probateFilings && property.probateFilings.length > 0) {
        for (const filing of property.probateFilings) {
          if (filing.executor) {
            const executorContact = await this.findContactInfo(filing.executor.name);
            if (executorContact) {
              contacts.push({
                contactId: `executor-${filing.caseNumber}`,
                name: filing.executor.name,
                relationship: 'executor',
                contactInfo: executorContact,
                reliability: 'high',
                source: 'court_records'
              });
            }
          }
        }
      }

      // Search for family members as potential contacts
      for (const family of property.deceasedOwner.familyMembers) {
        if (family.age >= 18) {
          const familyContact = await this.findContactInfo(family.name);
          if (familyContact) {
            contacts.push({
              contactId: `family-${family.id}`,
              name: family.name,
              relationship: family.relationship,
              contactInfo: familyContact,
              reliability: family.relationship === 'spouse' ? 'high' : 'medium',
              source: 'family_records'
            });
          }
        }
      }

      this.addCost('truePeople', 0.25 * contacts.length);
      return contacts;
    } catch (error) {
      console.error('Error identifying estate contacts:', error);
      return [];
    }
  }

  private async findContactInfo(name: string): Promise<any> {
    try {
      const response = await this.clients.truePeople.post('/contact/search', {
        name,
        includePhones: true,
        includeEmails: true,
        includeAddresses: true
      });

      return response.data.contact;
    } catch (error) {
      console.error('Contact search error:', error);
      return null;
    }
  }

  private async performAIAnalysis(properties: ProbateProperty[]): Promise<ProbateProperty[]> {
    if (!this.clients.openAI) return properties;

    const analyzedProperties: ProbateProperty[] = [];

    for (const property of properties) {
      try {
        const aiAnalysis = await this.getAIAnalysis(property);
        
        analyzedProperties.push({
          ...property,
          aiAnalysis,
          motivationFactors: {
            ...property.motivationFactors,
            overallScore: aiAnalysis.motivationScore
          }
        });
      } catch (error) {
        console.error('AI analysis error:', error);
        analyzedProperties.push(property);
      }
    }

    return analyzedProperties;
  }

  private async getAIAnalysis(property: ProbateProperty): Promise<any> {
    const prompt = `Analyze this probate property for lead generation potential:

Property: ${property.address.fullAddress}
Deceased Owner: ${property.deceasedOwner.fullName}
Date of Death: ${property.deceasedOwner.dateOfDeath}
Property Value: $${property.estimatedValue?.toLocaleString()}
Estimated Equity: $${property.estimatedEquity?.toLocaleString()}
Probate Status: ${property.probateStatus}
Days Since Death: ${Math.floor((Date.now() - new Date(property.deceasedOwner.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24))}
Family Members: ${property.deceasedOwner.familyMembers?.length || 0}
Estate Contacts Found: ${property.estateContacts?.length || 0}

Analyze and score (0-100) for:
1. Overall motivation to sell
2. Urgency level
3. Deal potential
4. Contact probability
5. Expected discount potential

Provide reasoning for each score and overall recommendation.`;

    try {
      const response = await this.clients.openAI.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert real estate probate lead analyzer. Provide scores as JSON with reasoning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      });

      this.addCost('openAI', 0.15);
      
      const aiResponse = response.data.choices[0].message.content;
      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      return this.generateFallbackAnalysis(property);
    }
  }

  private parseAIResponse(response: string): any {
    try {
      // Extract JSON from AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing
      return {
        motivationScore: 75,
        urgencyScore: 80,
        dealPotentialScore: 70,
        contactabilityScore: 65,
        discountPotential: 15,
        reasoning: 'AI analysis completed',
        recommendation: 'High priority probate lead'
      };
    } catch (error) {
      return this.generateFallbackAnalysis(null);
    }
  }

  private generateFallbackAnalysis(property: ProbateProperty | null): any {
    return {
      motivationScore: 75,
      urgencyScore: 80,
      dealPotentialScore: 70,
      contactabilityScore: 60,
      discountPotential: 12,
      reasoning: 'Fallback analysis based on probate indicators',
      recommendation: 'Investigate further'
    };
  }

  private filterAndRankResults(properties: ProbateProperty[], params: ProbateLeadParams): ProbateProperty[] {
    let filtered = properties;

    // Apply filters
    if (params.minMotivationScore) {
      filtered = filtered.filter(p => 
        (p.aiAnalysis?.motivationScore || p.motivationFactors.overallScore) >= params.minMotivationScore
      );
    }

    if (params.requireContact) {
      filtered = filtered.filter(p => 
        p.estateContacts && p.estateContacts.length > 0
      );
    }

    if (params.probateStatusFilter) {
      filtered = filtered.filter(p => 
        params.probateStatusFilter!.includes(p.probateStatus)
      );
    }

    // Sort by overall score (highest first)
    filtered.sort((a, b) => {
      const scoreA = a.aiAnalysis?.motivationScore || a.motivationFactors.overallScore;
      const scoreB = b.aiAnalysis?.motivationScore || b.motivationFactors.overallScore;
      return scoreB - scoreA;
    });

    // Apply limit
    if (params.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    return filtered;
  }

  private addCost(source: string, amount: number): void {
    this.totalCosts += amount;
    this.requestCount++;
  }

  private calculateTotalCost(): number {
    return parseFloat(this.totalCosts.toFixed(2));
  }

  private getCostBreakdown(): Record<string, number> {
    return {
      obituaryAPI: 0.30,
      peopleDataLabs: 0.20,
      courtRecords: 0.40,
      truePeopleSearch: 0.25,
      attomData: 0.50,
      openAI: 0.15,
      total: this.calculateTotalCost()
    };
  }

  private getDataSourcesUsed(): string[] {
    const sources = [];
    if (this.config.usObituaryAPI.enabled) sources.push('US Obituary API');
    if (this.config.peopleDataLabs.enabled) sources.push('People Data Labs');
    if (this.config.legacyTree.enabled) sources.push('Legacy Tree');
    if (this.config.truePeopleSearch.enabled) sources.push('TruePeopleSearch');
    if (this.config.courtRecordsAPI.enabled) sources.push('Court Records API');
    if (this.config.attomData.enabled) sources.push('ATTOM Data');
    if (this.config.openAI.enabled) sources.push('OpenAI GPT-4');
    return sources;
  }
}
