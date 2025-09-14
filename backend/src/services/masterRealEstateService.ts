import { AttomDataService } from './attomDataService';
import { DataTreeService } from './dataTreeService';
import { AIAnalysisService } from './aiAnalysisService';
import { AddressValidationService } from './addressValidationService';

const ATTOM_API_KEY = process.env.ATTOM_DATA_API_KEY || '';
const ATTOM_BASE_URL = process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const DATATREE_API_KEY = process.env.DATATREE_API_KEY || '';
const DATATREE_BASE_URL = process.env.DATATREE_BASE_URL || 'https://api.datatree.com/api';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export class MasterRealEstateService {
  private attom: AttomDataService;
  private dataTree: DataTreeService;
  private ai: AIAnalysisService;
  private addressValidator: AddressValidationService;

  constructor() {
    this.attom = new AttomDataService(ATTOM_API_KEY, ATTOM_BASE_URL);
    this.dataTree = new DataTreeService(DATATREE_API_KEY, DATATREE_BASE_URL);
    this.ai = new AIAnalysisService(OPENAI_API_KEY);
    this.addressValidator = new AddressValidationService(GOOGLE_MAPS_API_KEY);
  }

  async generateLead(address: string, county: string, probateStart: string, probateEnd: string) {
    // 1. Get property details from ATTOM
    const propertyDetails = await this.attom.getPropertyDetails(address);

    // 2. Validate address with Google Maps
    const validatedAddress = await this.addressValidator.validateAddress(address);

    // 3. Get probate cases from DataTree
    const probateCases = await this.dataTree.searchProbateCases(county, probateStart, probateEnd);

    // 4. AI analysis for lead motivation
    const aiScore = await this.ai.scoreLeadMotivation(propertyDetails);

    // 5. Combine and return lead data
    return {
      property: propertyDetails,
      validatedAddress,
      probateCases,
      aiScore
    };
  }
}
// Master Real Estate Data Service
// Comprehensive integration with all premium APIs for maximum lead intelligence

import axios, { AxiosInstance } from 'axios';
import { 
  MasterAPIConfig, 
  MasterSearchParams, 
  MasterSearchResponse,
  MasterPropertyRecord,
  AttomPropertyData,
  ObituaryRecord,
  ProbateFilingData,
  MLSListingData,
  ForeclosureData,
  SkipTraceResult,
  AILeadScore,
  RentalMarketData
} from '../types/masterDataTypes';

export class MasterRealEstateDataService {
  private clients: Record<string, AxiosInstance> = {};
  private config: MasterAPIConfig;
  private totalCosts: number = 0;
  private requestCount: number = 0;
  private dailyBudgetLimit: number;

  constructor(config: MasterAPIConfig) {
    this.config = config;
    this.dailyBudgetLimit = parseFloat(process.env.DAILY_BUDGET_LIMIT || '100');
    this.initializeClients();
  }

  private initializeClients() {
    // Property Ownership & Public Records
    this.clients.attomData = this.createClient(this.config.attomData, {
      'apikey': this.config.attomData.apiKey
    });

    this.clients.propMix = this.createClient(this.config.propMix, {
      'Authorization': `Bearer ${this.config.propMix.apiKey}`
    });

    this.clients.estated = this.createClient(this.config.estated, {
      'Authorization': `Bearer ${this.config.estated.apiKey}`
    });

    this.clients.dataTree = this.createClient(this.config.dataTree, {
      'Authorization': `Bearer ${this.config.dataTree.apiKey}`
    });

    // Deceased Owner & Probate Data
    this.clients.usObituaryAPI = this.createClient(this.config.usObituaryAPI, {
      'X-API-Key': this.config.usObituaryAPI.apiKey
    });

    this.clients.peopleDataLabs = this.createClient(this.config.peopleDataLabs, {
      'X-Api-Key': this.config.peopleDataLabs.apiKey
    });

    // MLS & Listings
    this.clients.mlsGrid = this.createClient(this.config.mlsGrid, {
      'Authorization': `Bearer ${this.config.mlsGrid.apiKey}`
    });

    this.clients.realtorRapidAPI = this.createClient(this.config.realtorRapidAPI, {
      'X-RapidAPI-Key': this.config.realtorRapidAPI.apiKey,
      'X-RapidAPI-Host': 'realtor.p.rapidapi.com'
    });

    // Distress & Legal Data
    this.clients.propertyRadar = this.createClient(this.config.propertyRadar, {
      'Authorization': `Bearer ${this.config.propertyRadar.apiKey}`
    });

    // Skip Tracing & Contact Enrichment
    this.clients.batchSkipTracing = this.createClient(this.config.batchSkipTracing, {
      'Authorization': `Bearer ${this.config.batchSkipTracing.apiKey}`
    });

    this.clients.idiDataLexisNexis = this.createClient(this.config.idiDataLexisNexis, {
      'Authorization': `Bearer ${this.config.idiDataLexisNexis.apiKey}`
    });

    this.clients.clearbit = this.createClient(this.config.clearbit, {
      'Authorization': `Bearer ${this.config.clearbit.apiKey}`
    });

    // AI & Intelligence
    this.clients.openAI = this.createClient(this.config.openAI, {
      'Authorization': `Bearer ${this.config.openAI.apiKey}`,
      'Content-Type': 'application/json'
    });

    this.clients.googleMaps = this.createClient(this.config.googleMaps, {});

    // Additional Real Estate Data
    this.clients.rentometer = this.createClient(this.config.rentometer, {
      'X-API-Key': this.config.rentometer.apiKey
    });

    console.log('🔌 Master Real Estate Data Service initialized with all premium APIs');
  }

  private createClient(endpoint: any, headers: Record<string, string>): AxiosInstance {
    return axios.create({
      baseURL: endpoint.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'LeadFlow-AI/1.0',
        ...headers
      }
    });
  }

  // MASTER SEARCH - Combines all data sources
  async masterPropertySearch(params: MasterSearchParams): Promise<MasterSearchResponse> {
    const searchStartTime = Date.now();
    const searchId = `master-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔍 Master Property Search initiated - ID: ${searchId}`);
    console.log(`📊 Search Parameters:`, JSON.stringify(params, null, 2));

    try {
      // Phase 1: Get basic property list from primary sources
      const basicProperties = await this.getBasicPropertyList(params);
      console.log(`📋 Phase 1: Found ${basicProperties.length} basic properties`);

      // Phase 2: Enrich each property with comprehensive data
      const enrichedProperties = await this.enrichProperties(basicProperties, params);
      console.log(`🎯 Phase 2: Enriched ${enrichedProperties.length} properties`);

      // Phase 3: AI analysis and lead scoring
      const scoredProperties = await this.scoreLeads(enrichedProperties);
      console.log(`🧠 Phase 3: AI scored ${scoredProperties.length} properties`);

      // Phase 4: Filter and sort by criteria
      const filteredProperties = this.applyFinalFilters(scoredProperties, params);
      console.log(`✅ Phase 4: Final ${filteredProperties.length} qualified properties`);

      const searchDuration = Date.now() - searchStartTime;

      return {
        totalResults: filteredProperties.length,
        properties: filteredProperties,
        searchMetadata: {
          searchId,
          executionTime: searchDuration,
          dataSourcesUsed: this.getDataSourcesUsed(),
          totalApiCalls: this.requestCount,
          totalCost: this.totalCosts,
          searchTimestamp: new Date(),
          filteringApplied: params
        },
        costBreakdown: this.getCostBreakdown(),
        aggregations: this.calculateAggregations(filteredProperties)
      };

    } catch (error: any) {
      console.error('❌ Master search failed:', error);
      throw new Error(`Master property search failed: ${error.message}`);
    }
  }

  // Phase 1: Get basic property list from multiple sources
  private async getBasicPropertyList(params: MasterSearchParams): Promise<any[]> {
    const properties: any[] = [];

    // Get properties from ATTOM Data
    if (params.zipCodes?.length) {
      for (const zipCode of params.zipCodes) {
        try {
          const attomProperties = await this.getAttomPropertiesByZip(zipCode);
          properties.push(...attomProperties);
        } catch (error) {
          console.warn(`⚠️ ATTOM data failed for zip ${zipCode}:`, error);
        }
      }
    }

    // Get properties from Estated
    try {
      const estatedProperties = await this.getEstatedProperties(params);
      properties.push(...estatedProperties);
    } catch (error) {
      console.warn('⚠️ Estated data failed:', error);
    }

    // Get MLS listings
    try {
      const mlsProperties = await this.getMLSListings(params);
      properties.push(...mlsProperties);
    } catch (error) {
      console.warn('⚠️ MLS data failed:', error);
    }

    // Deduplicate by address
    const uniqueProperties = this.deduplicateProperties(properties);
    return uniqueProperties;
  }

  // Phase 2: Enrich properties with comprehensive data
  private async enrichProperties(properties: any[], params: MasterSearchParams): Promise<MasterPropertyRecord[]> {
    const enrichedProperties: MasterPropertyRecord[] = [];

    for (const property of properties) {
      try {
        const enriched = await this.enrichSingleProperty(property, params);
        if (enriched) {
          enrichedProperties.push(enriched);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to enrich property ${property.address}:`, error);
      }
    }

    return enrichedProperties;
  }

  private async enrichSingleProperty(property: any, params: MasterSearchParams): Promise<MasterPropertyRecord | null> {
    const address = property.address;
    console.log(`🔍 Enriching property: ${address}`);

    try {
      // Get comprehensive property data
      const [
        distressData,
        contactData,
        marketData,
        legalData
      ] = await Promise.allSettled([
        this.getDistressSignals(address),
        this.getContactInformation(property.owner),
        this.getMarketData(address),
        this.getLegalData(address)
      ]);

      return {
        propertyId: property.id || `prop-${Date.now()}-${Math.random()}`,
        address: this.standardizeAddress(address),
        propertyDetails: property.details,
        owner: property.owner,
        ownershipHistory: property.ownershipHistory || [],
        valuation: property.valuation,
        equity: property.equity,
        distressSignals: distressData.status === 'fulfilled' ? distressData.value : {},
        contacts: contactData.status === 'fulfilled' ? contactData.value : [],
        aiAnalysis: {} as AILeadScore, // Will be filled in Phase 3
        legalData: legalData.status === 'fulfilled' ? legalData.value : {},
        marketData: marketData.status === 'fulfilled' ? marketData.value : {},
        dataSources: ['attom', 'estated', 'skip_trace'],
        lastUpdated: new Date(),
        dataQuality: this.calculateDataQuality(property)
      };
    } catch (error) {
      console.error(`❌ Failed to enrich property ${address}:`, error);
      return null;
    }
  }

  // Phase 3: AI analysis and lead scoring
  private async scoreLeads(properties: MasterPropertyRecord[]): Promise<MasterPropertyRecord[]> {
    const scoredProperties: MasterPropertyRecord[] = [];

    for (const property of properties) {
      try {
        const aiScore = await this.generateAILeadScore(property);
        property.aiAnalysis = aiScore;
        scoredProperties.push(property);
      } catch (error) {
        console.warn(`⚠️ AI scoring failed for ${property.address.fullAddress}:`, error);
        // Include property with default score
        property.aiAnalysis = this.getDefaultScore();
        scoredProperties.push(property);
      }
    }

    return scoredProperties;
  }

  // Individual API Methods

  private async getAttomPropertiesByZip(zipCode: string): Promise<any[]> {
    try {
      this.trackCost('attom', 0.50);
      
      const response = await this.clients.attomData.get('/property/search', {
        params: {
          zipcode: zipCode,
          pagesize: 100,
          page: 1
        }
      });

      return response.data.property || [];
    } catch (error) {
      console.error(`ATTOM API error for zip ${zipCode}:`, error);
      return [];
    }
  }

  private async getEstatedProperties(params: MasterSearchParams): Promise<any[]> {
    try {
      this.trackCost('estated', 0.25);
      
      const response = await this.clients.estated.get('/properties', {
        params: {
          zip_codes: params.zipCodes?.join(','),
          limit: 200
        }
      });

      return response.data.properties || [];
    } catch (error) {
      console.error('Estated API error:', error);
      return [];
    }
  }

  private async getMLSListings(params: MasterSearchParams): Promise<any[]> {
    try {
      this.trackCost('mls', 1.00);
      
      const response = await this.clients.mlsGrid.get('/listings/search', {
        params: {
          zip_codes: params.zipCodes?.join(','),
          status: 'expired,active,pending',
          limit: 100
        }
      });

      return response.data.listings || [];
    } catch (error) {
      console.error('MLS API error:', error);
      return [];
    }
  }

  private async getDistressSignals(address: string): Promise<any> {
    const distressData: any = {};

    try {
      // Get foreclosure data
      const foreclosureData = await this.getForeclosureData(address);
      distressData.foreclosure = foreclosureData;

      // Get probate data
      const probateData = await this.getProbateData(address);
      distressData.probate = probateData;

      // Get tax delinquency
      const taxData = await this.getTaxDelinquencyData(address);
      distressData.taxDelinquency = taxData;

      // Get bankruptcy data
      const bankruptcyData = await this.getBankruptcyData(address);
      distressData.bankruptcy = bankruptcyData;

      return distressData;
    } catch (error) {
      console.error(`Distress signals error for ${address}:`, error);
      return {};
    }
  }

  private async getForeclosureData(address: string): Promise<any> {
    try {
      this.trackCost('property_radar', 0.75);
      
      const response = await this.clients.propertyRadar.get('/foreclosures/search', {
        params: { address }
      });

      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async getProbateData(address: string): Promise<any> {
    try {
      // Search obituaries for potential probate cases
      const obituaryData = await this.searchObituaries(address);
      
      if (obituaryData.length > 0) {
        // Check for actual probate filings
        return await this.searchProbateFilings(obituaryData[0].deceasedName);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async searchObituaries(address: string): Promise<ObituaryRecord[]> {
    try {
      this.trackCost('obituary_api', 0.30);
      
      const response = await this.clients.usObituaryAPI.get('/search', {
        params: {
          address: address,
          date_range: '365' // Last year
        }
      });

      return response.data.obituaries || [];
    } catch (error) {
      return [];
    }
  }

  private async getContactInformation(ownerName: string): Promise<any[]> {
    try {
      // Primary skip tracing
      const skipTraceData = await this.performSkipTrace(ownerName);
      
      // Enrich with additional sources
      const enrichedData = await this.enrichContactData(skipTraceData);
      
      return enrichedData;
    } catch (error) {
      console.error(`Contact lookup failed for ${ownerName}:`, error);
      return [];
    }
  }

  private async performSkipTrace(ownerName: string): Promise<SkipTraceResult> {
    try {
      this.trackCost('batch_skip_tracing', 0.25);
      
      const response = await this.clients.batchSkipTracing.post('/skip-trace', {
        name: ownerName,
        include_relatives: true,
        include_associates: true
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  private async generateAILeadScore(property: MasterPropertyRecord): Promise<AILeadScore> {
    try {
      this.trackCost('openai', 0.02);
      
      const prompt = this.buildScoringPrompt(property);
      
      const response = await this.clients.openAI.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert real estate lead analyst. Analyze the property data and provide detailed scoring and strategy recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      });

      const analysis = JSON.parse(response.data.choices[0].message.content);
      
      return {
        overallScore: analysis.overallScore || 50,
        motivationScore: analysis.motivationScore || 50,
        contactabilityScore: analysis.contactabilityScore || 50,
        dealPotentialScore: analysis.dealPotentialScore || 50,
        urgencyScore: analysis.urgencyScore || 50,
        scoringFactors: analysis.scoringFactors || [],
        recommendedStrategy: analysis.recommendedStrategy || {},
        predictedDiscount: analysis.predictedDiscount || 10,
        dealProbability: analysis.dealProbability || 25,
        optimalTiming: new Date(Date.now() + (analysis.optimalTimingDays || 7) * 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('AI scoring failed:', error);
      return this.getDefaultScore();
    }
  }

  // Utility Methods

  private buildScoringPrompt(property: MasterPropertyRecord): string {
    return `
    Analyze this real estate lead and provide JSON scoring:
    
    Property: ${property.address.fullAddress}
    Value: $${property.valuation?.estimatedValue || 0}
    Equity: $${property.equity?.estimatedEquity || 0}
    Owner: ${property.owner?.names?.join(', ') || 'Unknown'}
    
    Distress Signals:
    - Foreclosure: ${property.distressSignals?.foreclosure ? 'Yes' : 'No'}
    - Probate: ${property.distressSignals?.probate ? 'Yes' : 'No'}
    - Tax Delinquent: ${property.distressSignals?.taxDelinquency ? 'Yes' : 'No'}
    - Vacant: ${property.distressSignals?.vacancy?.isVacant ? 'Yes' : 'No'}
    
    Contact Info Available: ${property.contacts?.length > 0 ? 'Yes' : 'No'}
    
    Provide scoring (0-100) for:
    - overallScore
    - motivationScore  
    - contactabilityScore
    - dealPotentialScore
    - urgencyScore
    - predictedDiscount (percentage)
    - dealProbability (percentage)
    - optimalTimingDays (days from now)
    
    Include scoringFactors array and recommendedStrategy object.
    `;
  }

  private deduplicateProperties(properties: any[]): any[] {
    const seen = new Set();
    return properties.filter(prop => {
      const key = this.normalizeAddress(prop.address);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private normalizeAddress(address: string): string {
    return address.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private standardizeAddress(address: string): any {
    // Implement address standardization
    return {
      fullAddress: address,
      streetNumber: '',
      streetName: '',
      city: '',
      state: '',
      zipCode: '',
      county: '',
      coordinates: { latitude: 0, longitude: 0 }
    };
  }

  private trackCost(source: string, cost: number): void {
    this.totalCosts += cost;
    this.requestCount += 1;
    
    if (this.totalCosts > this.dailyBudgetLimit) {
      throw new Error(`Daily budget limit of $${this.dailyBudgetLimit} exceeded. Current cost: $${this.totalCosts.toFixed(2)}`);
    }
  }

  private getCostBreakdown(): any {
    return {
      totalCost: this.totalCosts,
      costBySource: {},
      callsPerSource: {},
      costPerLead: this.totalCosts / Math.max(this.requestCount, 1)
    };
  }

  private calculateAggregations(properties: MasterPropertyRecord[]): any {
    const totalValue = properties.reduce((sum, p) => sum + (p.valuation?.estimatedValue || 0), 0);
    const totalEquity = properties.reduce((sum, p) => sum + (p.equity?.estimatedEquity || 0), 0);
    
    return {
      averagePropertyValue: totalValue / properties.length,
      averageEquity: totalEquity / properties.length,
      distressDistribution: {},
      geographicDistribution: {},
      propertyTypeDistribution: {},
      motivationScoreDistribution: {}
    };
  }

  private getDefaultScore(): AILeadScore {
    return {
      overallScore: 50,
      motivationScore: 50,
      contactabilityScore: 50,
      dealPotentialScore: 50,
      urgencyScore: 50,
      scoringFactors: [],
      recommendedStrategy: {} as any,
      predictedDiscount: 10,
      dealProbability: 25,
      optimalTiming: new Date()
    };
  }

  private getDataSourcesUsed(): string[] {
    return ['attom', 'estated', 'mls', 'skip_trace', 'probate', 'foreclosure', 'ai_analysis'];
  }

  private applyFinalFilters(properties: MasterPropertyRecord[], params: MasterSearchParams): MasterPropertyRecord[] {
    let filtered = properties;

    // Apply filters
    if (params.minMotivationScore) {
      filtered = filtered.filter(p => p.aiAnalysis.motivationScore >= params.minMotivationScore!);
    }

    if (params.requirePhoneNumber) {
      filtered = filtered.filter(p => p.contacts.some(c => c.phones?.length > 0));
    }

    if (params.minEquity) {
      filtered = filtered.filter(p => (p.equity?.estimatedEquity || 0) >= params.minEquity!);
    }

    // Sort results
    filtered.sort((a, b) => b.aiAnalysis.overallScore - a.aiAnalysis.overallScore);

    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    
    return filtered.slice(offset, offset + limit);
  }

  private calculateDataQuality(property: any): number {
    let score = 0;
    if (property.owner) score += 20;
    if (property.valuation) score += 20;
    if (property.contacts?.length > 0) score += 30;
    if (property.distressSignals) score += 30;
    return score;
  }

  // Additional stub methods for missing implementations
  private async getTaxDelinquencyData(address: string): Promise<any> {
    return null;
  }

  private async getBankruptcyData(address: string): Promise<any> {
    return null;
  }

  private async searchProbateFilings(deceasedName: string): Promise<any> {
    return null;
  }

  private async enrichContactData(skipTraceData: any): Promise<any[]> {
    return [];
  }

  private async getMarketData(address: string): Promise<any> {
    return {};
  }

  private async getLegalData(address: string): Promise<any> {
    return {};
  }

  // Public utility methods
  public getTotalCosts(): number {
    return this.totalCosts;
  }

  public getRequestCount(): number {
    return this.requestCount;
  }

  public resetCounters(): void {
    this.totalCosts = 0;
    this.requestCount = 0;
  }
}
