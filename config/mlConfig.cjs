/**
 * mlConfig.cjs
 * Configuration for machine learning integration in the scraping pipeline
 */

const config = {
  // API key for ML service
  apiKey: "ml-api-leadflow-key-2025",
  
  // Model endpoints
  modelEndpoints: {
    baseUrl: process.env.ML_SERVICE_URL || "http://localhost:5000",
    propertyValuation: "/api/models/property-valuation",
    distressPredictor: "/api/models/distress-predictor",
    leadScoring: "/api/models/lead-scoring",
    contactRecommendation: "/api/models/contact-recommendation",
    actionRecommendation: "/api/models/action-recommendation",
    training: "/api/training",
    trainingStatus: "/api/training/status",
    feedback: "/api/feedback"
  },
  
  // Request configuration
  useRateLimiting: true,
  rateLimitMs: 200,
  requestTimeoutMs: 30000,
  
  // Model caching
  useModelCache: true,
  modelCachePath: "./data/model-cache.json",
  cacheTtlMs: 86400000, // 24 hours
  
  // Logging configuration
  logging: {
    enabled: true,
    console: true,
    path: "./logs/ml-client.log"
  },
  
  // Model configuration
  models: {
    propertyValuation: {
      version: "1.0.0",
      minConfidence: 0.7,
      useLocalFallback: true
    },
    distressPredictor: {
      version: "1.0.0",
      minConfidence: 0.6,
      useLocalFallback: true
    },
    leadScoring: {
      version: "1.0.0",
      minConfidence: 0.65,
      useLocalFallback: true
    },
    contactRecommendation: {
      version: "1.0.0",
      minConfidence: 0.75,
      useLocalFallback: true
    }
  },
  
  // Fallback configuration (used when ML service is unavailable)
  fallback: {
    enabled: true,
    propertyValuation: {
      defaultMargin: 0.2, // 20% margin of error
      defaultConfidence: 0.6
    },
    distressSignals: {
      taxLienWeight: 0.7,
      foreclosureWeight: 0.9,
      bankruptcyWeight: 0.8,
      divorceWeight: 0.4
    },
    leadScoring: {
      hotThreshold: 80,
      warmThreshold: 60,
      lukewarmThreshold: 40
    }
  }
};

module.exports = config;
