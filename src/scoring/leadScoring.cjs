/**
 * leadScoring.cjs
 * Advanced lead scoring system for property data
 */

/**
 * Score a property based on multiple factors
 * @param {Object} property - The property data object
 * @returns {Object} The property with added scores
 */
function scoreProperty(property) {
  if (!property) return null;
  
  // Initialize scoring object
  const scoring = {
    distressScore: calculateDistressScore(property),
    equityScore: calculateEquityScore(property),
    contactScore: calculateContactScore(property),
    motivationScore: calculateMotivationScore(property),
    locationScore: property.geoData ? calculateLocationScore(property.geoData) : 0,
    totalScore: 0
  };
  
  // Calculate weighted total score
  scoring.totalScore = calculateTotalScore(scoring);
  
  // Add lead classification
  scoring.classification = classifyLead(scoring.totalScore);
  
  // Add scoring to property
  return {
    ...property,
    scoring
  };
}

/**
 * Calculate score based on distress signals
 */
function calculateDistressScore(property) {
  if (!property.distressSignals || !Array.isArray(property.distressSignals)) {
    return 0;
  }
  
  const signalWeights = {
    'pre-foreclosure': 80,
    'foreclosure': 75,
    'auction-scheduled': 90,
    'bank-owned': 60,
    'tax-lien': 85,
    'probate': 70,
    'divorce': 65,
    'bankruptcy': 80,
    'vacant': 50,
    'code-violation': 45,
    'lien': 40,
    'judgment': 35,
    'lis-pendens': 75,
    'short-sale': 60,
    'absentee-owner': 30,
    'out-of-state-owner': 25,
    'expired-listing': 20,
    'fsbo': 15,
    'fixer-upper': 30,
    'motivated-seller': 35
  };
  
  let score = 0;
  
  // Score based on signals present
  for (const signal of property.distressSignals) {
    score += signalWeights[signal.toLowerCase()] || 10; // Default 10 points for unknown signals
  }
  
  // Cap at 100
  return Math.min(100, score);
}

/**
 * Calculate score based on estimated equity
 */
function calculateEquityScore(property) {
  // Need both value and lien/mortgage information to calculate equity
  if (!property.priceHint || !property.financialData) {
    return 0;
  }
  
  const propertyValue = property.priceHint;
  const totalLiens = property.financialData.mortgageAmount || property.financialData.lienAmount || 0;
  
  // Can't calculate equity ratio without valid numbers
  if (propertyValue <= 0 || isNaN(propertyValue)) {
    return 0;
  }
  
  // Calculate equity ratio (1.0 = 100% equity, 0 = no equity, negative = underwater)
  let equityRatio = (propertyValue - totalLiens) / propertyValue;
  
  // Score based on equity percentage
  if (equityRatio >= 0.5) {
    // High equity (50% or more)
    return 100;
  } else if (equityRatio >= 0.3) {
    // Good equity (30-50%)
    return 75;
  } else if (equityRatio >= 0.15) {
    // Some equity (15-30%)
    return 50;
  } else if (equityRatio > 0) {
    // Little equity (0-15%)
    return 25;
  } else {
    // Underwater
    return 0;
  }
}

/**
 * Calculate score based on available contact information
 */
function calculateContactScore(property) {
  if (!property.contacts || !Array.isArray(property.contacts) || property.contacts.length === 0) {
    return 0;
  }
  
  const hasDirectPhone = property.contacts.some(c => 
    c.type === 'phone' && c.confidence >= 0.7
  );
  
  const hasDirectEmail = property.contacts.some(c => 
    c.type === 'email' && c.confidence >= 0.7
  );
  
  const hasOwnerPhone = property.contacts.some(c => 
    c.type === 'phone' && c.confidence >= 0.7 && c.source === 'owner'
  );
  
  const hasOwnerEmail = property.contacts.some(c => 
    c.type === 'email' && c.confidence >= 0.7 && c.source === 'owner'
  );
  
  const hasAddress = !!property.address;
  
  const hasMailingAddress = property.contacts.some(c => 
    c.type === 'mailing_address' && c.value !== property.address
  );
  
  // Calculate score based on contact availability
  let score = 0;
  
  if (hasOwnerPhone) score += 50;
  else if (hasDirectPhone) score += 30;
  
  if (hasOwnerEmail) score += 40;
  else if (hasDirectEmail) score += 25;
  
  if (hasMailingAddress) score += 35;
  else if (hasAddress) score += 15;
  
  // Cap at 100
  return Math.min(100, score);
}

/**
 * Calculate score based on signals of seller motivation
 */
function calculateMotivationScore(property) {
  let score = 0;
  
  // Check distress signals
  if (property.distressSignals && Array.isArray(property.distressSignals)) {
    if (property.distressSignals.includes('pre-foreclosure')) score += 30;
    if (property.distressSignals.includes('tax-lien')) score += 25;
    if (property.distressSignals.includes('divorce')) score += 25;
    if (property.distressSignals.includes('bankruptcy')) score += 30;
    if (property.distressSignals.includes('probate')) score += 25;
    if (property.distressSignals.includes('motivated-seller')) score += 20;
    if (property.distressSignals.includes('vacant')) score += 15;
  }
  
  // Check financial data for signs of distress
  if (property.financialData) {
    // Long time on market
    if (property.financialData.daysOnMarket > 90) score += 15;
    
    // Multiple price reductions
    if (property.financialData.priceReductions > 1) {
      score += Math.min(5 * property.financialData.priceReductions, 25);
    }
    
    // Significant price drop
    if (property.financialData.priceDropPercentage > 5) {
      score += Math.min(property.financialData.priceDropPercentage * 2, 30);
    }
  }
  
  // Check property condition
  if (property.attributes && property.attributes.condition) {
    const condition = property.attributes.condition.toLowerCase();
    if (condition.includes('poor') || condition.includes('fixer') || condition.includes('needs')) {
      score += 20;
    }
  }
  
  // Cap at 100
  return Math.min(100, score);
}

/**
 * Calculate score based on property location data
 */
function calculateLocationScore(geoData) {
  if (!geoData) return 0;
  
  let score = 50; // Default middle score
  
  // Adjust based on median home value in the area
  if (geoData.medianHomeValue) {
    if (geoData.medianHomeValue > 500000) score += 20;
    else if (geoData.medianHomeValue > 300000) score += 10;
    else if (geoData.medianHomeValue < 100000) score -= 10;
  }
  
  // Adjust based on median income
  if (geoData.medianIncome) {
    if (geoData.medianIncome > 80000) score += 15;
    else if (geoData.medianIncome > 50000) score += 5;
    else if (geoData.medianIncome < 30000) score -= 10;
  }
  
  // Adjust based on area vacancy rate
  if (geoData.vacancyRate !== undefined) {
    if (geoData.vacancyRate > 15) score -= 15;
    else if (geoData.vacancyRate > 10) score -= 10;
    else if (geoData.vacancyRate < 5) score += 10;
  }
  
  // Adjust based on crime rate
  if (geoData.crimeIndex !== undefined) {
    if (geoData.crimeIndex > 80) score -= 20;
    else if (geoData.crimeIndex > 60) score -= 10;
    else if (geoData.crimeIndex < 30) score += 15;
  }
  
  // Cap score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate total weighted score
 */
function calculateTotalScore(scoring) {
  const weights = {
    distressScore: 0.35,    // 35% weight for distress
    equityScore: 0.25,      // 25% weight for equity
    contactScore: 0.15,     // 15% weight for contact info
    motivationScore: 0.15,  // 15% weight for motivation
    locationScore: 0.1      // 10% weight for location
  };
  
  // Calculate weighted score
  const totalScore = Object.keys(weights).reduce((sum, key) => {
    return sum + (scoring[key] * weights[key]);
  }, 0);
  
  return Math.round(totalScore);
}

/**
 * Classify lead based on total score
 */
function classifyLead(totalScore) {
  if (totalScore >= 80) {
    return 'HOT';
  } else if (totalScore >= 60) {
    return 'WARM';
  } else if (totalScore >= 40) {
    return 'LUKEWARM';
  } else {
    return 'COLD';
  }
}

/**
 * Score a batch of properties
 * @param {Array} properties - Array of property objects to score
 * @returns {Array} Array of properties with scores added
 */
function scorePropertyBatch(properties) {
  if (!Array.isArray(properties)) return [];
  
  return properties.map(property => scoreProperty(property));
}

module.exports = {
  scoreProperty,
  scorePropertyBatch,
  calculateDistressScore,
  calculateEquityScore,
  calculateContactScore,
  calculateMotivationScore,
  calculateLocationScore
};
