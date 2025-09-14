// Master Configuration Service
// Validates and organizes all API configurations for the master real estate system

import dotenv from 'dotenv';
import { MasterAPIConfig } from '../types/masterDataTypes';

// Load environment variables
dotenv.config();

export interface TierConfig {
  name: string;
  dailyBudgetLimit: number;
  maxMonthlySearches: number;
  features: string[];
  costPerMonth: { min: number; max: number };
}

export class MasterConfigService {
  private static instance: MasterConfigService;
  private config: MasterAPIConfig;
  private tierConfig: TierConfig;

  private constructor() {
    this.validateEnvironment();
    this.tierConfig = this.getTierConfiguration();
    this.config = this.buildMasterConfig();
  }

  public static getInstance(): MasterConfigService {
    if (!MasterConfigService.instance) {
      MasterConfigService.instance = new MasterConfigService();
    }
    return MasterConfigService.instance;
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'LEADFLOW_TIER',
      'DAILY_BUDGET_LIMIT',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_NAME',
      'JWT_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      // In production, require these variables. In development, inject sane defaults so dev servers can run.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }

      console.warn(`MasterConfigService: Missing environment variables (dev mode) - will apply defaults: ${missing.join(', ')}`);

      // Apply safe defaults for development convenience
      missing.forEach(varName => {
        switch (varName) {
          case 'LEADFLOW_TIER':
            process.env.LEADFLOW_TIER = process.env.LEADFLOW_TIER || 'starter';
            break;
          case 'DAILY_BUDGET_LIMIT':
            process.env.DAILY_BUDGET_LIMIT = process.env.DAILY_BUDGET_LIMIT || '25';
            break;
          case 'DB_HOST':
            process.env.DB_HOST = process.env.DB_HOST || 'localhost';
            break;
          case 'DB_PORT':
            process.env.DB_PORT = process.env.DB_PORT || '5432';
            break;
          case 'DB_USER':
            process.env.DB_USER = process.env.DB_USER || 'devuser';
            break;
          case 'DB_NAME':
            process.env.DB_NAME = process.env.DB_NAME || 'leadflow_dev';
            break;
          case 'JWT_SECRET':
            process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
            break;
          default:
            break;
        }
      });
    }

    // Validate tier
    const validTiers = ['starter', 'professional', 'enterprise'];
    if (!validTiers.includes(process.env.LEADFLOW_TIER!)) {
      throw new Error(`Invalid LEADFLOW_TIER. Must be one of: ${validTiers.join(', ')}`);
    }

    console.log(`🎯 LeadFlow AI initialized with ${process.env.LEADFLOW_TIER} tier`);
  }

  private buildMasterConfig(): MasterAPIConfig {
    return {
      // Property Ownership & Public Records
      attomData: {
        apiKey: process.env.ATTOM_DATA_API_KEY || '',
        baseUrl: process.env.ATTOM_DATA_BASE_URL || 'https://api.gateway.attomdata.com',
        costPerCall: 0.50,
        enabled: !!process.env.ATTOM_DATA_API_KEY
      },
      propMix: {
        apiKey: process.env.PROPMIX_API_KEY || '',
        baseUrl: process.env.PROPMIX_BASE_URL || 'https://api.propmix.io/v1',
        costPerCall: 0.40,
        enabled: !!process.env.PROPMIX_API_KEY
      },
      estated: {
        apiKey: process.env.ESTATED_API_KEY || '',
        baseUrl: process.env.ESTATED_BASE_URL || 'https://apis.estated.com/v4',
        costPerCall: 0.25,
        enabled: !!process.env.ESTATED_API_KEY
      },
      dataTree: {
        apiKey: process.env.DATATREE_API_KEY || '',
        baseUrl: process.env.DATATREE_BASE_URL || 'https://api.datatree.com/v1',
        costPerCall: 0.35,
        enabled: !!process.env.DATATREE_API_KEY
      },

      // Deceased Owner & Probate Data
      usObituaryAPI: {
        apiKey: process.env.US_OBITUARY_API_KEY || '',
        baseUrl: process.env.US_OBITUARY_BASE_URL || 'https://api.usobituaryapi.com/v1',
        costPerCall: 0.30,
        enabled: !!process.env.US_OBITUARY_API_KEY
      },
      peopleDataLabs: {
        apiKey: process.env.PEOPLE_DATA_LABS_API_KEY || '',
        baseUrl: process.env.PEOPLE_DATA_LABS_BASE_URL || 'https://api.peopledatalabs.com/v5',
        costPerCall: 0.20,
        enabled: !!process.env.PEOPLE_DATA_LABS_API_KEY
      },
      legacyTree: {
        apiKey: process.env.LEGACY_TREE_API_KEY || '',
        baseUrl: process.env.LEGACY_TREE_BASE_URL || 'https://api.legacytree.com/v1',
        costPerCall: 1.50,
        enabled: !!process.env.LEGACY_TREE_API_KEY
      },
      truePeopleSearch: {
        apiKey: process.env.TRUE_PEOPLE_SEARCH_API_KEY || '',
        baseUrl: process.env.TRUE_PEOPLE_SEARCH_BASE_URL || 'https://api.truepeoplesearch.com/v1',
        costPerCall: 0.15,
        enabled: !!process.env.TRUE_PEOPLE_SEARCH_API_KEY
      },

      // MLS & Listings
      mlsGrid: {
        apiKey: process.env.MLS_GRID_API_KEY || '',
        baseUrl: process.env.MLS_GRID_BASE_URL || 'https://api.mlsgrid.com/v2',
        costPerCall: 1.00,
        enabled: !!process.env.MLS_GRID_API_KEY && this.isFeatureEnabled('mls_access')
      },
      realtorRapidAPI: {
        apiKey: process.env.REALTOR_RAPIDAPI_KEY || '',
        baseUrl: process.env.REALTOR_RAPIDAPI_BASE_URL || 'https://realtor.p.rapidapi.com',
        costPerCall: 0.75,
        enabled: !!process.env.REALTOR_RAPIDAPI_KEY
      },
      zillowRapidAPI: {
        apiKey: process.env.ZILLOW_RAPIDAPI_KEY || '',
        baseUrl: process.env.ZILLOW_RAPIDAPI_BASE_URL || 'https://zillow56.p.rapidapi.com',
        costPerCall: 0.50,
        enabled: !!process.env.ZILLOW_RAPIDAPI_KEY
      },
      rentals: {
        apiKey: process.env.RENTALS_API_KEY || '',
        baseUrl: process.env.RENTALS_BASE_URL || 'https://api.rentals.com/v1',
        costPerCall: 0.40,
        enabled: !!process.env.RENTALS_API_KEY
      },

      // Distress & Legal Data
      propertyRadar: {
        apiKey: process.env.PROPERTY_RADAR_API_KEY || '',
        baseUrl: process.env.PROPERTY_RADAR_BASE_URL || 'https://api.propertyradar.com/v1',
        costPerCall: 0.75,
        enabled: !!process.env.PROPERTY_RADAR_API_KEY
      },
      realtyTrac: {
        apiKey: process.env.REALTY_TRAC_API_KEY || '',
        baseUrl: process.env.REALTY_TRAC_BASE_URL || 'https://api.realtytrac.com/v1',
        costPerCall: 0.65,
        enabled: !!process.env.REALTY_TRAC_API_KEY
      },
      biggerPockets: {
        apiKey: process.env.BIGGER_POCKETS_API_KEY || '',
        baseUrl: process.env.BIGGER_POCKETS_BASE_URL || 'https://api.biggerpockets.com/v1',
        costPerCall: 0.45,
        enabled: !!process.env.BIGGER_POCKETS_API_KEY
      },

      // Skip Tracing & Contact Enrichment
      batchSkipTracing: {
        apiKey: process.env.BATCH_SKIP_TRACING_API_KEY || '',
        baseUrl: process.env.BATCH_SKIP_TRACING_BASE_URL || 'https://api.batchskiptracing.com/v1',
        costPerCall: 0.25,
        enabled: !!process.env.BATCH_SKIP_TRACING_API_KEY
      },
      idiDataLexisNexis: {
        apiKey: process.env.IDI_DATA_LEXISNEXIS_API_KEY || '',
        baseUrl: process.env.IDI_DATA_LEXISNEXIS_BASE_URL || 'https://api.ididata.com/v1',
        costPerCall: 0.50,
        enabled: !!process.env.IDI_DATA_LEXISNEXIS_API_KEY
      },
      tloTransUnion: {
        apiKey: process.env.TLO_TRANSUNION_API_KEY || '',
        baseUrl: process.env.TLO_TRANSUNION_BASE_URL || 'https://api.tlo.com/v1',
        costPerCall: 0.35,
        enabled: !!process.env.TLO_TRANSUNION_API_KEY
      },
      clearbit: {
        apiKey: process.env.CLEARBIT_API_KEY || '',
        baseUrl: process.env.CLEARBIT_BASE_URL || 'https://person.clearbit.com/v1',
        costPerCall: 0.20,
        enabled: !!process.env.CLEARBIT_API_KEY
      },
      beenVerified: {
        apiKey: process.env.BEEN_VERIFIED_API_KEY || '',
        baseUrl: process.env.BEEN_VERIFIED_BASE_URL || 'https://api.beenverified.com/v1',
        costPerCall: 0.30,
        enabled: !!process.env.BEEN_VERIFIED_API_KEY
      },

      // AI & Intelligence
      openAI: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        costPerCall: 0.02,
        enabled: !!process.env.OPENAI_API_KEY && this.isFeatureEnabled('ai_scoring')
      },
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        baseUrl: process.env.GOOGLE_MAPS_BASE_URL || 'https://maps.googleapis.com/maps/api',
        costPerCall: 0.005,
        enabled: !!process.env.GOOGLE_MAPS_API_KEY
      },

      // Additional Real Estate Data
      rentometer: {
        apiKey: process.env.RENTOMETER_API_KEY || '',
        baseUrl: process.env.RENTOMETER_BASE_URL || 'https://api.rentometer.com/v1',
        costPerCall: 0.25,
        enabled: !!process.env.RENTOMETER_API_KEY
      },
      walkScore: {
        apiKey: process.env.WALK_SCORE_API_KEY || '',
        baseUrl: process.env.WALK_SCORE_BASE_URL || 'https://api.walkscore.com',
        costPerCall: 0.10,
        enabled: !!process.env.WALK_SCORE_API_KEY
      },
      crimeData: {
        apiKey: process.env.CRIME_DATA_API_KEY || '',
        baseUrl: process.env.CRIME_DATA_BASE_URL || 'https://api.crimeometer.com/v1',
        costPerCall: 0.15,
        enabled: !!process.env.CRIME_DATA_API_KEY
      },
      schoolAPI: {
        apiKey: process.env.SCHOOL_API_KEY || '',
        baseUrl: process.env.SCHOOL_BASE_URL || 'https://api.schooldigger.com/v1.2',
        costPerCall: 0.05,
        enabled: !!process.env.SCHOOL_API_KEY
      }
    };
  }

  private getTierConfiguration(): TierConfig {
    const tier = process.env.LEADFLOW_TIER!;
    
    const tierConfigs: Record<string, TierConfig> = {
      starter: {
        name: 'Starter',
        dailyBudgetLimit: 25,
        maxMonthlySearches: 500,
        costPerMonth: { min: 500, max: 800 },
        features: [
          'basic_search',
          'contact_lookup',
          'distress_signals',
          'standard_support'
        ]
      },
      professional: {
        name: 'Professional',
        dailyBudgetLimit: 75,
        maxMonthlySearches: 2000,
        costPerMonth: { min: 1500, max: 2500 },
        features: [
          'basic_search',
          'contact_lookup',
          'distress_signals',
          'ai_scoring',
          'probate_mining',
          'mls_access',
          'bulk_export',
          'priority_support'
        ]
      },
      enterprise: {
        name: 'Enterprise',
        dailyBudgetLimit: 150,
        maxMonthlySearches: 10000,
        costPerMonth: { min: 3000, max: 5000 },
        features: [
          'basic_search',
          'contact_lookup',
          'distress_signals',
          'ai_scoring',
          'probate_mining',
          'mls_access',
          'bulk_export',
          'custom_webhooks',
          'white_label',
          'priority_support',
          'custom_integrations',
          'advanced_analytics'
        ]
      }
    };

    return tierConfigs[tier];
  }

  private isFeatureEnabled(feature: string): boolean {
    return this.tierConfig.features.includes(feature);
  }

  // Public getters
  public getMasterConfig(): MasterAPIConfig {
    return this.config;
  }

  public getTierInfo(): TierConfig {
    return this.tierConfig;
  }

  public getDailyBudgetLimit(): number {
    return parseFloat(process.env.DAILY_BUDGET_LIMIT || '100');
  }

  public getEnabledAPIs(): string[] {
    const enabled: string[] = [];
    
    Object.entries(this.config).forEach(([key, config]) => {
      if (config.enabled) {
        enabled.push(key);
      }
    });

    return enabled;
  }

  public getEstimatedCostPerSearch(): number {
    let totalCost = 0;
    let apiCount = 0;

    Object.values(this.config).forEach(api => {
      if (api.enabled) {
        totalCost += api.costPerCall;
        apiCount++;
      }
    });

    return totalCost;
  }

  public validateAPIAvailability(): { available: string[]; missing: string[] } {
    const available: string[] = [];
    const missing: string[] = [];

    Object.entries(this.config).forEach(([key, config]) => {
      if (config.enabled && config.apiKey) {
        available.push(key);
      } else {
        missing.push(key);
      }
    });

    return { available, missing };
  }

  public getSystemStatus(): {
    tier: string;
    totalAPIs: number;
    enabledAPIs: number;
    estimatedCostPerSearch: number;
    dailyBudgetLimit: number;
    maxMonthlySearches: number;
    features: string[];
  } {
    const apiStatus = this.validateAPIAvailability();
    
    return {
      tier: this.tierConfig.name,
      totalAPIs: Object.keys(this.config).length,
      enabledAPIs: apiStatus.available.length,
      estimatedCostPerSearch: this.getEstimatedCostPerSearch(),
      dailyBudgetLimit: this.getDailyBudgetLimit(),
      maxMonthlySearches: this.tierConfig.maxMonthlySearches,
      features: this.tierConfig.features
    };
  }

  // Database configuration
  public getDatabaseConfig() {
    return {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME!,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    };
  }

  // Security configuration
  public getSecurityConfig() {
    return {
      jwtSecret: process.env.JWT_SECRET!,
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
    };
  }

  // Rate limiting configuration
  public getRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    };
  }

  // Logging configuration
  public getLoggingConfig() {
    return {
      level: process.env.LOG_LEVEL || 'info',
      filePath: process.env.LOG_FILE_PATH || './logs/leadflow.log'
    };
  }

  // Cost monitoring configuration
  public getCostMonitoringConfig() {
    return {
      alertThreshold: parseFloat(process.env.COST_ALERT_THRESHOLD || '80'),
      alertEmail: process.env.COST_ALERT_EMAIL || '',
      alertWebhook: process.env.COST_ALERT_WEBHOOK || '',
      maxDailyCost: parseFloat(process.env.MAX_DAILY_COST || '150'),
      maxWeeklyCost: parseFloat(process.env.MAX_WEEKLY_COST || '750'),
      maxMonthlyCost: parseFloat(process.env.MAX_MONTHLY_COST || '3000')
    };
  }
}

// Export singleton instance
export const masterConfig = MasterConfigService.getInstance();
