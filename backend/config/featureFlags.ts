import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define available feature flags
type FeatureFlag = 
  | 'FEATURE_ATTOM_COMPS'
  | 'FEATURE_ROI_MODEL_SIMPLE'
  | 'FEATURE_REAL_LEADS'
  | 'FEATURE_MOCK_DATA_FALLBACK';

// Map of feature flags and their default values
const featureDefaults: Record<FeatureFlag, boolean> = {
  FEATURE_ATTOM_COMPS: false,
  FEATURE_ROI_MODEL_SIMPLE: true,
  FEATURE_REAL_LEADS: false,
  FEATURE_MOCK_DATA_FALLBACK: true
};

/**
 * Check if a feature is enabled
 * @param feature The feature flag to check
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  // Get from environment variable
  const envValue = process.env[feature];
  
  // If explicitly set in env, use that value
  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true';
  }
  
  // Otherwise use default
  return featureDefaults[feature];
}

/**
 * Get all feature flags and their current state
 * @returns Record of all feature flags and their state
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const result: Partial<Record<FeatureFlag, boolean>> = {};
  
  // For each feature in defaults
  (Object.keys(featureDefaults) as FeatureFlag[]).forEach(feature => {
    result[feature] = isFeatureEnabled(feature);
  });
  
  return result as Record<FeatureFlag, boolean>;
}
