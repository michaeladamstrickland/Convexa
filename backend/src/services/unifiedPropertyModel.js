/**
 * Unified Property Data Model
 * 
 * This module provides a normalized property data model
 * that can be used across different property data providers.
 */

/**
 * Property record from any source
 * @typedef {Object} UnifiedPropertyRecord
 * @property {string} id - Internal database ID
 * @property {string} propertyId - External ID from source (e.g., ATTOM ID)
 * @property {string} source - Data source (e.g., "attom", "propstream", "zillow")
 * @property {string} sourceTimestamp - When source last updated this data
 * @property {Address} address - Property address information
 * @property {PropertyDetails} details - Core property details
 * @property {Owner} owner - Owner information
 * @property {Valuation} valuation - Value and equity information
 * @property {TaxInfo} taxInfo - Tax information
 * @property {SalesHistory[]} salesHistory - Sales history
 * @property {DistressFactors} distressFactors - Distress indicators
 * @property {Object} metadata - Additional source-specific metadata
 * @property {Object} rawData - Original raw data from source
 */

/**
 * Property address
 * @typedef {Object} Address
 * @property {string} line1 - Street address
 * @property {string} line2 - Unit, suite, etc. (optional)
 * @property {string} city - City name
 * @property {string} state - State abbreviation (2 letter)
 * @property {string} zip - 5-digit ZIP code
 * @property {string} zip4 - ZIP+4 (optional)
 * @property {string} county - County name
 * @property {string} fullAddress - Complete formatted address
 * @property {string} normalizedAddress - Standardized address for deduplication
 * @property {GeoCoordinates} coordinates - Geographic coordinates
 */

/**
 * Geographic coordinates
 * @typedef {Object} GeoCoordinates
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {number} accuracy - Accuracy level (1-10, 10 being most precise)
 */

/**
 * Core property details
 * @typedef {Object} PropertyDetails
 * @property {string} propertyType - Type (e.g., "single_family", "multi_family", "condo")
 * @property {string} propertySubType - Subtype (e.g., "townhouse", "duplex")
 * @property {number} yearBuilt - Year property was built
 * @property {number} bedrooms - Number of bedrooms
 * @property {number} bathrooms - Number of bathrooms (decimal allowed for half baths)
 * @property {number} squareFeet - Living area square footage
 * @property {number} lotSize - Lot size in square feet
 * @property {string} lotSizeUnit - Unit of lot size measurement (acres, sqft)
 * @property {number} stories - Number of stories
 * @property {boolean} pool - Whether property has a pool
 * @property {boolean} garage - Whether property has a garage
 * @property {number} garageSpaces - Number of garage spaces
 * @property {string} roofType - Type of roof
 * @property {string} foundation - Type of foundation
 * @property {string} heatSystem - Type of heating system
 * @property {string} coolSystem - Type of cooling system
 * @property {boolean} fireplace - Whether property has a fireplace
 * @property {string} exteriorWall - Type of exterior wall
 */

/**
 * Property owner information
 * @typedef {Object} Owner
 * @property {string} name - Full owner name
 * @property {string} firstName - First name (if available)
 * @property {string} lastName - Last name (if available)
 * @property {string} type - Owner type (individual, company, trust, etc.)
 * @property {boolean} ownerOccupied - Whether owner occupies property
 * @property {Address} mailingAddress - Owner's mailing address if different from property
 * @property {number} ownershipLength - Years of ownership
 */

/**
 * Valuation information
 * @typedef {Object} Valuation
 * @property {number} estimatedValue - Current estimated value
 * @property {number} estimatedValueRangeLow - Low end of value range
 * @property {number} estimatedValueRangeHigh - High end of value range
 * @property {number} confidenceScore - Confidence score of valuation (1-100)
 * @property {string} valuationSource - Source of valuation (avm, tax, appraisal)
 * @property {number} estimatedRent - Estimated monthly rent
 * @property {number} estimatedEquity - Estimated equity amount
 * @property {number} estimatedEquityPercent - Estimated equity percentage
 * @property {number} loanAmount - Current loan balance (if available)
 * @property {number} loanToValueRatio - Loan to value ratio (if available)
 */

/**
 * Tax information
 * @typedef {Object} TaxInfo
 * @property {number} assessedValue - Tax assessed value
 * @property {number} marketValue - Tax market value
 * @property {number} taxAmount - Annual tax amount
 * @property {number} taxYear - Year of tax assessment
 * @property {boolean} taxDelinquent - Whether taxes are delinquent
 * @property {number} delinquentAmount - Amount of delinquent taxes (if any)
 * @property {string} delinquentDate - Date taxes became delinquent
 */

/**
 * Sales history entry
 * @typedef {Object} SalesHistory
 * @property {string} saleDate - Date of sale
 * @property {number} salePrice - Sale price
 * @property {string} saleType - Sale type (e.g., "normal", "foreclosure", "short_sale")
 * @property {string} deedType - Type of deed (e.g., "warranty", "quitclaim", "trustee")
 * @property {string} buyer - Buyer name
 * @property {string} seller - Seller name
 * @property {number} pricePerSquareFoot - Price per square foot
 */

/**
 * Distress factors
 * @typedef {Object} DistressFactors
 * @property {boolean} inForeclosure - Whether property is in foreclosure
 * @property {string} foreclosureStage - Stage of foreclosure (if applicable)
 * @property {string} foreclosureFilingDate - Date foreclosure was filed (if applicable)
 * @property {boolean} hasLiens - Whether property has liens
 * @property {number} lienAmount - Total amount of liens (if available)
 * @property {boolean} bankruptcy - Whether owner is in bankruptcy
 * @property {boolean} preForeclosure - Whether property is in pre-foreclosure
 * @property {boolean} taxDelinquent - Whether property has delinquent taxes
 * @property {boolean} vacant - Whether property is vacant
 * @property {boolean} codeViolations - Whether property has code violations
 * @property {number} daysOnMarket - Days on market (if listed)
 * @property {boolean} absenteeOwner - Whether owner is absentee
 * @property {string} distressScore - Composite distress score (0-100)
 * @property {string[]} distressFactors - List of distress factors detected
 */

/**
 * Convert ATTOM property data to unified format
 * @param {Object} attomData - Raw ATTOM property data
 * @returns {UnifiedPropertyRecord} Unified property record
 */
export function convertAttomToUnified(attomData) {
  const property = attomData.property[0] || {};
  
  // Extract address
  const address = {
    line1: property.address?.line1 || '',
    line2: property.address?.line2 || '',
    city: property.address?.locality || '',
    state: property.address?.countrySubd || '',
    zip: property.address?.postal1 || '',
    zip4: property.address?.postal2 || '',
    county: property.area?.countrySecSubd || '',
    fullAddress: [
      property.address?.line1,
      property.address?.line2,
      property.address?.locality,
      property.address?.countrySubd,
      property.address?.postal1
    ].filter(Boolean).join(', '),
    normalizedAddress: normalizeAddress(
      property.address?.line1, 
      property.address?.locality,
      property.address?.countrySubd,
      property.address?.postal1
    ),
    coordinates: {
      latitude: parseFloat(property.location?.latitude) || null,
      longitude: parseFloat(property.location?.longitude) || null,
      accuracy: property.location?.accuracy || null
    }
  };
  
  // Extract property details
  const details = {
    propertyType: property.summary?.proptype || property.summary?.propsubtype || '',
    propertySubType: property.summary?.propsubtype || '',
    yearBuilt: property.summary?.yearbuilt || null,
    bedrooms: property.building?.rooms?.beds || null,
    bathrooms: property.building?.rooms?.bathstotal || null,
    squareFeet: property.building?.size?.universalsize || null,
    lotSize: property.lot?.lotsize1 || null,
    lotSizeUnit: property.lot?.lotsize1unit || 'sqft',
    stories: property.building?.summary?.storycount || null,
    pool: property.building?.interior?.haspool === 'Y',
    garage: Boolean(property.building?.parking?.prkgSize),
    garageSpaces: property.building?.parking?.prkgSize || null,
    roofType: property.building?.construction?.roofcover || '',
    foundation: property.building?.construction?.foundation || '',
    heatSystem: property.building?.utilities?.heatsystem || '',
    coolSystem: property.building?.utilities?.coolsystem || '',
    fireplace: property.building?.interior?.fplccount > 0,
    exteriorWall: property.building?.construction?.wallType || ''
  };
  
  // Extract owner information
  const owner = {
    name: property.owner?.owner1?.name || '',
    firstName: property.owner?.owner1?.firstNameandMI || '',
    lastName: property.owner?.owner1?.lastName || '',
    type: property.owner?.owner1?.corpind || 'individual',
    ownerOccupied: property.summary?.ownerOccupied === 'Y',
    mailingAddress: {
      line1: property.owner?.owner1?.mailingAddress || '',
      city: property.owner?.owner1?.mailingCity || '',
      state: property.owner?.owner1?.mailingState || '',
      zip: property.owner?.owner1?.mailingZip || '',
      fullAddress: [
        property.owner?.owner1?.mailingAddress,
        property.owner?.owner1?.mailingCity,
        property.owner?.owner1?.mailingState,
        property.owner?.owner1?.mailingZip
      ].filter(Boolean).join(', ')
    },
    ownershipLength: calculateOwnershipLength(property.sale?.saledate)
  };
  
  // Extract valuation
  const valuation = {
    estimatedValue: property.avm?.amount?.value || null,
    estimatedValueRangeLow: property.avm?.amount?.low || null,
    estimatedValueRangeHigh: property.avm?.amount?.high || null,
    confidenceScore: property.avm?.amount?.confidence || null,
    valuationSource: 'avm',
    estimatedRent: property.avm?.rent?.estimate || null,
    estimatedEquity: calculateEquity(
      property.avm?.amount?.value,
      property.sale?.amount?.saleamt
    ),
    estimatedEquityPercent: calculateEquityPercent(
      property.avm?.amount?.value,
      property.sale?.amount?.saleamt
    ),
    loanAmount: null, // Not available in ATTOM direct API
    loanToValueRatio: null // Not available in ATTOM direct API
  };
  
  // Extract tax information
  const taxInfo = {
    assessedValue: property.assessment?.assessed?.assdttlvalue || null,
    marketValue: property.assessment?.market?.mktttlvalue || null,
    taxAmount: property.assessment?.tax?.taxamt || null,
    taxYear: property.assessment?.tax?.taxyear || null,
    taxDelinquent: property.assessment?.tax?.delinquentdate ? true : false,
    delinquentAmount: null, // Not typically in ATTOM data
    delinquentDate: property.assessment?.tax?.delinquentdate || null
  };
  
  // Extract sales history
  const salesHistory = [];
  if (property.sale) {
    salesHistory.push({
      saleDate: property.sale?.saledate || null,
      salePrice: property.sale?.amount?.saleamt || null,
      saleType: getSaleType(property.sale),
      deedType: property.sale?.instrument || '',
      buyer: property.sale?.buyername || '',
      seller: property.sale?.sellername || '',
      pricePerSquareFoot: calculatePricePerSqFt(
        property.sale?.amount?.saleamt,
        property.building?.size?.universalsize
      )
    });
  }
  
  // Additional sale history if available
  if (property.salehistory && Array.isArray(property.salehistory)) {
    property.salehistory.forEach(sale => {
      salesHistory.push({
        saleDate: sale.saledate || null,
        salePrice: sale.amount?.saleamt || null,
        saleType: getSaleType(sale),
        deedType: sale.instrument || '',
        buyer: sale.buyername || '',
        seller: sale.sellername || '',
        pricePerSquareFoot: calculatePricePerSqFt(
          sale.amount?.saleamt, 
          property.building?.size?.universalsize
        )
      });
    });
  }
  
  // Extract distress factors
  const distressFactors = {
    inForeclosure: property.foreclosure?.auction || property.foreclosure?.filing ? true : false,
    foreclosureStage: property.foreclosure?.filing ? 'filing' : 
                      property.foreclosure?.auction ? 'auction' : null,
    foreclosureFilingDate: property.foreclosure?.filingdate || null,
    hasLiens: false, // Not available in direct ATTOM API
    lienAmount: null, // Not available in direct ATTOM API
    bankruptcy: false, // Not available in direct ATTOM API
    preForeclosure: property.foreclosure?.filing && !property.foreclosure?.auction ? true : false,
    taxDelinquent: property.assessment?.tax?.delinquentdate ? true : false,
    vacant: property.summary?.propIndicator === 'vacant' || false,
    codeViolations: false, // Not available in direct ATTOM API
    daysOnMarket: null, // Not available in direct ATTOM API
    absenteeOwner: property.summary?.ownerOccupied === 'N',
    distressScore: calculateDistressScore(property),
    distressFactors: extractDistressFactors(property)
  };
  
  // Create unified record
  return {
    id: '', // To be filled by database
    propertyId: property.identifier?.attomId || '',
    source: 'attom',
    sourceTimestamp: new Date().toISOString(),
    address,
    details,
    owner,
    valuation,
    taxInfo,
    salesHistory,
    distressFactors,
    metadata: {
      attomId: property.identifier?.attomId || '',
      fips: property.area?.fips || '',
      apn: property.identifier?.apn || ''
    },
    rawData: attomData
  };
}

/**
 * Convert PropertyRecord to unified format
 * @param {Object} propertyRecord - Database property record
 * @returns {UnifiedPropertyRecord} Unified property record
 */
export function convertPropertyRecordToUnified(propertyRecord) {
  // Parse raw data if stored as JSON string
  const rawData = typeof propertyRecord.rawData === 'string' 
    ? JSON.parse(propertyRecord.rawData) 
    : propertyRecord.rawData || {};
  
  // Start with basic address and ID
  const unified = {
    id: propertyRecord.id || '',
    propertyId: propertyRecord.sourceId || propertyRecord.id || '',
    source: propertyRecord.source || 'unknown',
    sourceTimestamp: propertyRecord.createdAt || new Date().toISOString(),
    address: {
      line1: propertyRecord.address || '',
      city: propertyRecord.city || '',
      state: propertyRecord.state || '',
      zip: propertyRecord.zipCode || '',
      fullAddress: [
        propertyRecord.address,
        propertyRecord.city,
        propertyRecord.state,
        propertyRecord.zipCode
      ].filter(Boolean).join(', '),
      normalizedAddress: propertyRecord.propertyHash || normalizeAddress(
        propertyRecord.address,
        propertyRecord.city,
        propertyRecord.state,
        propertyRecord.zipCode
      )
    },
    rawData
  };
  
  // Convert based on source
  if (propertyRecord.source === 'attom' && rawData.property) {
    return convertAttomToUnified(rawData);
  } else if (propertyRecord.source === 'zillow_fsbo') {
    return convertZillowToUnified(propertyRecord);
  } else if (propertyRecord.source === 'realtor_com') {
    return convertRealtorToUnified(propertyRecord);
  }
  
  // Generic conversion for unknown sources
  return {
    ...unified,
    details: {
      propertyType: rawData.propertyType || '',
      yearBuilt: rawData.yearBuilt || null,
      bedrooms: rawData.bedrooms || null,
      bathrooms: rawData.bathrooms || null,
      squareFeet: rawData.squareFeet || null
    },
    owner: {
      name: rawData.ownerName || '',
      ownerOccupied: rawData.ownerOccupied || false
    },
    valuation: {
      estimatedValue: rawData.estimatedValue || rawData.listPrice || null
    },
    salesHistory: [],
    distressFactors: {
      absenteeOwner: rawData.absenteeOwner || false
    },
    metadata: {}
  };
}

/**
 * Convert Lead to unified format
 * @param {Object} lead - Lead object from database
 * @returns {UnifiedPropertyRecord} Unified property record
 */
export function convertLeadToUnified(lead) {
  // Parse JSON fields if they're strings
  const phones = typeof lead.phones === 'string' ? JSON.parse(lead.phones) : (lead.phones || []);
  const emails = typeof lead.emails === 'string' ? JSON.parse(lead.emails) : (lead.emails || []);
  const rawData = typeof lead.raw_data === 'string' ? JSON.parse(lead.raw_data || '{}') : (lead.raw_data || {});
  
  return {
    id: lead.id || '',
    propertyId: lead.id || '',
    source: lead.source || 'manual',
    sourceTimestamp: lead.created_at || lead.createdAt || new Date().toISOString(),
    address: {
      line1: lead.address || lead.propertyAddress || '',
      city: lead.city || '',
      state: lead.state || '',
      zip: lead.zipCode || '',
      fullAddress: [
        lead.address || lead.propertyAddress,
        lead.city,
        lead.state,
        lead.zipCode
      ].filter(Boolean).join(', '),
      normalizedAddress: lead.normalizedAddress || normalizeAddress(
        lead.address || lead.propertyAddress,
        lead.city,
        lead.state,
        lead.zipCode
      )
    },
    details: {
      propertyType: lead.propertyType || '',
      yearBuilt: lead.yearBuilt || null,
      bedrooms: lead.bedrooms || null,
      bathrooms: lead.bathrooms || null,
      squareFeet: lead.squareFeet || lead.squareFootage || null
    },
    owner: {
      name: lead.ownerName || lead.owner_name || '',
      ownerOccupied: lead.isAbsenteeOwner === false
    },
    valuation: {
      estimatedValue: lead.estimatedValue || lead.estimated_value || null,
      estimatedEquity: lead.equity || null,
      estimatedEquityPercent: lead.equityPercent || null
    },
    taxInfo: {
      taxDelinquent: lead.tax_debt > 0,
      delinquentAmount: lead.tax_debt || null
    },
    salesHistory: [],
    distressFactors: {
      inForeclosure: false, // Not available directly in lead
      vacant: lead.is_vacant || false,
      absenteeOwner: lead.isAbsenteeOwner || false,
      distressScore: lead.aiScore || lead.lead_score || 0,
      distressFactors: []
    },
    metadata: {
      aiScore: lead.aiScore || lead.lead_score || 0,
      motivationScore: lead.motivation_score || 0,
      temperatureTag: lead.temperature_tag || 'WARM',
      status: lead.status || 'NEW',
      phones,
      emails,
      skipTracedAt: lead.skip_traced_at || null,
      skipTraceProvider: lead.skip_trace_provider || null
    },
    rawData
  };
}

// Helper Functions

/**
 * Normalize an address for deduplication
 * @param {string} line1 - Street address
 * @param {string} city - City
 * @param {string} state - State
 * @param {string} zip - ZIP code
 * @returns {string} Normalized address
 */
function normalizeAddress(line1, city, state, zip) {
  if (!line1) return '';
  
  // Convert to uppercase
  let normalized = line1.toUpperCase();
  
  // Remove apartment/unit numbers
  normalized = normalized.replace(/\s*(APT|UNIT|#)\.?\s*[0-9A-Z-]+/i, '');
  
  // Remove special characters
  normalized = normalized.replace(/[^\w\s]/gi, '');
  
  // Remove common words
  normalized = normalized.replace(/\b(STREET|ST|ROAD|RD|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|BOULEVARD|BLVD|HIGHWAY|HWY)\b/gi, '');
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, '');
  
  // Add ZIP and state for uniqueness
  if (zip) {
    normalized += zip;
  } else if (state && city) {
    normalized += state.toUpperCase() + city.toUpperCase();
  }
  
  return normalized;
}

/**
 * Calculate ownership length in years
 * @param {string} saleDate - Date of sale
 * @returns {number|null} Ownership length in years or null
 */
function calculateOwnershipLength(saleDate) {
  if (!saleDate) return null;
  
  try {
    const saleTime = new Date(saleDate).getTime();
    const now = new Date().getTime();
    const diffYears = (now - saleTime) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, parseFloat(diffYears.toFixed(1)));
  } catch (e) {
    return null;
  }
}

/**
 * Calculate equity amount
 * @param {number} currentValue - Current property value
 * @param {number} purchasePrice - Purchase price
 * @returns {number|null} Equity amount or null
 */
function calculateEquity(currentValue, purchasePrice) {
  if (!currentValue) return null;
  if (!purchasePrice) return null;
  
  // Very rough estimation without loan data
  const estimatedLoanBalance = purchasePrice * 0.8; // Assumes 20% down payment
  return Math.max(0, currentValue - estimatedLoanBalance);
}

/**
 * Calculate equity percentage
 * @param {number} currentValue - Current property value
 * @param {number} purchasePrice - Purchase price
 * @returns {number|null} Equity percentage or null
 */
function calculateEquityPercent(currentValue, purchasePrice) {
  if (!currentValue) return null;
  if (!purchasePrice) return null;
  
  const equity = calculateEquity(currentValue, purchasePrice);
  if (equity === null) return null;
  
  return Math.min(100, Math.round((equity / currentValue) * 100));
}

/**
 * Calculate price per square foot
 * @param {number} price - Sale price
 * @param {number} squareFeet - Square footage
 * @returns {number|null} Price per square foot or null
 */
function calculatePricePerSqFt(price, squareFeet) {
  if (!price || !squareFeet || squareFeet <= 0) return null;
  return Math.round(price / squareFeet);
}

/**
 * Get sale type from ATTOM sale object
 * @param {Object} sale - ATTOM sale object
 * @returns {string} Sale type
 */
function getSaleType(sale) {
  if (!sale) return '';
  
  if (sale.distressedSale === 'Y') {
    return 'distressed';
  } else if (sale.foreclosure) {
    return 'foreclosure';
  } else if (sale.shortsale === 'Y') {
    return 'short_sale';
  } else {
    return 'normal';
  }
}

/**
 * Calculate distress score from ATTOM property data
 * @param {Object} property - ATTOM property object
 * @returns {number} Distress score from 0-100
 */
function calculateDistressScore(property) {
  let score = 0;
  
  // Foreclosure is major distress
  if (property.foreclosure?.filing || property.foreclosure?.auction) {
    score += 60;
  }
  
  // Tax delinquency
  if (property.assessment?.tax?.delinquentdate) {
    score += 30;
  }
  
  // Non-owner occupied
  if (property.summary?.ownerOccupied === 'N') {
    score += 10;
  }
  
  // Vacant property
  if (property.summary?.propIndicator === 'vacant') {
    score += 20;
  }
  
  // Cap score at 100
  return Math.min(100, score);
}

/**
 * Extract distress factors from ATTOM property data
 * @param {Object} property - ATTOM property object
 * @returns {string[]} Array of distress factors
 */
function extractDistressFactors(property) {
  const factors = [];
  
  if (property.foreclosure?.filing) {
    factors.push('foreclosure_filing');
  }
  
  if (property.foreclosure?.auction) {
    factors.push('foreclosure_auction');
  }
  
  if (property.assessment?.tax?.delinquentdate) {
    factors.push('tax_delinquent');
  }
  
  if (property.summary?.ownerOccupied === 'N') {
    factors.push('absentee_owner');
  }
  
  if (property.summary?.propIndicator === 'vacant') {
    factors.push('vacant');
  }
  
  return factors;
}

/**
 * Convert Zillow FSBO to unified format
 * @param {Object} propertyRecord - Property record with Zillow data
 * @returns {UnifiedPropertyRecord} Unified property record
 */
function convertZillowToUnified(propertyRecord) {
  // This would be implemented to handle Zillow data format
  // For now we'll return a placeholder
  return {
    id: propertyRecord.id || '',
    propertyId: propertyRecord.sourceId || propertyRecord.id || '',
    source: 'zillow_fsbo',
    sourceTimestamp: propertyRecord.createdAt || new Date().toISOString(),
    address: {
      line1: propertyRecord.address || '',
      city: propertyRecord.city || '',
      state: propertyRecord.state || '',
      zip: propertyRecord.zipCode || '',
      fullAddress: [
        propertyRecord.address,
        propertyRecord.city,
        propertyRecord.state,
        propertyRecord.zipCode
      ].filter(Boolean).join(', '),
      normalizedAddress: propertyRecord.propertyHash || ''
    },
    details: {
      propertyType: '',
      yearBuilt: null,
      bedrooms: null,
      bathrooms: null,
      squareFeet: null
    },
    owner: {
      name: '',
      ownerOccupied: true
    },
    valuation: {
      estimatedValue: null
    },
    taxInfo: {
      assessedValue: null,
      taxAmount: null
    },
    salesHistory: [],
    distressFactors: {
      inForeclosure: false,
      distressScore: 0,
      distressFactors: []
    },
    metadata: {},
    rawData: propertyRecord.rawData || {}
  };
}

/**
 * Convert Realtor.com data to unified format
 * @param {Object} propertyRecord - Property record with Realtor.com data
 * @returns {UnifiedPropertyRecord} Unified property record
 */
function convertRealtorToUnified(propertyRecord) {
  // This would be implemented to handle Realtor.com data format
  // For now we'll return a placeholder
  return {
    id: propertyRecord.id || '',
    propertyId: propertyRecord.sourceId || propertyRecord.id || '',
    source: 'realtor_com',
    sourceTimestamp: propertyRecord.createdAt || new Date().toISOString(),
    address: {
      line1: propertyRecord.address || '',
      city: propertyRecord.city || '',
      state: propertyRecord.state || '',
      zip: propertyRecord.zipCode || '',
      fullAddress: [
        propertyRecord.address,
        propertyRecord.city,
        propertyRecord.state,
        propertyRecord.zipCode
      ].filter(Boolean).join(', '),
      normalizedAddress: propertyRecord.propertyHash || ''
    },
    details: {
      propertyType: '',
      yearBuilt: null,
      bedrooms: null,
      bathrooms: null,
      squareFeet: null
    },
    owner: {
      name: '',
      ownerOccupied: false
    },
    valuation: {
      estimatedValue: null
    },
    taxInfo: {
      assessedValue: null,
      taxAmount: null
    },
    salesHistory: [],
    distressFactors: {
      inForeclosure: false,
      distressScore: 0,
      distressFactors: []
    },
    metadata: {},
    rawData: propertyRecord.rawData || {}
  };
}
