/**
 * Property Data Integration Service
 * 
 * This service handles the integration of property data from various sources,
 * normalizes it into a unified format, and handles deduplication.
 */

import db from './databaseService.js';
import { 
  convertAttomToUnified, 
  convertPropertyRecordToUnified, 
  convertLeadToUnified 
} from './unifiedPropertyModel.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Process a property record from any source and integrate it into the system
 * 
 * @param {Object} rawProperty - Raw property data from a provider
 * @param {string} source - Source of the property data (attom, zillow_fsbo, etc.)
 * @returns {Object} The processed property with unified format and database ID
 */
export async function processProperty(rawProperty, source) {
  try {
    // Convert to unified format based on source
    let unifiedProperty;
    
    if (source === 'attom') {
      unifiedProperty = convertAttomToUnified(rawProperty);
    } else {
      // For other sources, wrap in a property record structure
      const propertyRecord = {
        id: uuidv4(),
        sourceId: rawProperty.id || rawProperty.propertyId,
        source,
        address: rawProperty.address || rawProperty.line1,
        city: rawProperty.city,
        state: rawProperty.state,
        zipCode: rawProperty.zipCode || rawProperty.zip,
        createdAt: new Date().toISOString(),
        rawData: rawProperty
      };
      
      unifiedProperty = convertPropertyRecordToUnified(propertyRecord);
    }
    
    // Check for duplicates
    const existingProperty = await findPropertyByAddress(unifiedProperty.address.normalizedAddress);
    
    if (existingProperty) {
      console.log(`Found duplicate property: ${unifiedProperty.address.fullAddress}`);
      // Merge with existing property
      const mergedProperty = mergePropertyData(existingProperty, unifiedProperty);
      
      // Update in database
      await updatePropertyInDatabase(mergedProperty);
      
      return mergedProperty;
    }
    
    // Save new property to database
    const savedProperty = await savePropertyToDatabase(unifiedProperty);
    
    return savedProperty;
  } catch (error) {
    console.error('Error processing property:', error);
    throw error;
  }
}

/**
 * Process multiple properties in bulk
 * 
 * @param {Array<Object>} properties - Array of property data objects
 * @param {string} source - Source of the properties
 * @returns {Array<Object>} Array of processed unified properties
 */
export async function processPropertiesBulk(properties, source) {
  // Create a batch of properties to process
  const results = [];
  const errors = [];
  
  // Process in smaller chunks to avoid memory issues
  const chunkSize = 50;
  
  for (let i = 0; i < properties.length; i += chunkSize) {
    const chunk = properties.slice(i, i + chunkSize);
    
    // Process each property in the chunk
    const chunkPromises = chunk.map(async (property) => {
      try {
        const processed = await processProperty(property, source);
        return { success: true, property: processed };
      } catch (error) {
        console.error(`Error processing property ${i}:`, error);
        return { success: false, error, property };
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    
    // Separate successes and failures
    chunkResults.forEach(result => {
      if (result.success) {
        results.push(result.property);
      } else {
        errors.push({
          property: result.property,
          error: result.error.message
        });
      }
    });
    
    // Log progress
    console.log(`Processed ${i + chunk.length} of ${properties.length} properties (${results.length} successes, ${errors.length} errors)`);
  }
  
  return {
    processed: results,
    errors,
    summary: {
      total: properties.length,
      success: results.length,
      error: errors.length
    }
  };
}

/**
 * Find a property by its normalized address
 * 
 * @param {string} normalizedAddress - Normalized address for deduplication
 * @returns {Object|null} The property if found, null otherwise
 */
async function findPropertyByAddress(normalizedAddress) {
  if (!normalizedAddress) return null;
  
  try {
    // First check PropertyRecord table in Prisma DB
    const propertyRecordSql = `
      SELECT * FROM property_records
      WHERE property_hash = ?
      LIMIT 1
    `;
    
    const propertyRecord = db.prisma.executeGet(propertyRecordSql, [normalizedAddress]);
    
    if (propertyRecord) {
      return convertPropertyRecordToUnified(propertyRecord);
    }
    
    // Then check Leads table for the address
    const leadSql = `
      SELECT * FROM leads
      WHERE normalized_address = ? OR address LIKE ?
      LIMIT 1
    `;
    
    const lead = db.leadflow.executeGet(leadSql, [
      normalizedAddress,
      `%${normalizedAddress.substring(0, 20)}%` // Partial match as fallback
    ]);
    
    if (lead) {
      return convertLeadToUnified(lead);
    }
    
    return null;
  } catch (error) {
    console.error('Error finding property by address:', error);
    return null;
  }
}

/**
 * Merge two property records, keeping the most complete and recent data
 * 
 * @param {Object} existingProperty - Existing property record
 * @param {Object} newProperty - New property data to merge
 * @returns {Object} Merged property data
 */
function mergePropertyData(existingProperty, newProperty) {
  // Start with the existing property
  const merged = { ...existingProperty };
  
  // Always keep the existing ID
  merged.id = existingProperty.id;
  
  // Add source to the metadata if different
  if (newProperty.source !== existingProperty.source) {
    merged.metadata = {
      ...merged.metadata,
      additionalSources: [
        ...(merged.metadata.additionalSources || []),
        newProperty.source
      ]
    };
  }
  
  // Add new raw data
  merged.rawData = {
    ...merged.rawData,
    [newProperty.source]: newProperty.rawData
  };
  
  // Merge details - prefer non-null values from newer data
  merged.details = mergeObjects(existingProperty.details, newProperty.details);
  
  // Merge owner information - prefer newer data if it has more detail
  merged.owner = mergeObjects(existingProperty.owner, newProperty.owner);
  
  // Merge valuation - prefer newer values, track history
  if (newProperty.valuation.estimatedValue) {
    if (!merged.metadata.valuationHistory) {
      merged.metadata.valuationHistory = [];
    }
    
    // Add existing value to history if different
    if (
      existingProperty.valuation.estimatedValue &&
      existingProperty.valuation.estimatedValue !== newProperty.valuation.estimatedValue
    ) {
      merged.metadata.valuationHistory.push({
        value: existingProperty.valuation.estimatedValue,
        source: existingProperty.source,
        date: existingProperty.sourceTimestamp
      });
    }
    
    // Use new value
    merged.valuation = { ...newProperty.valuation };
  }
  
  // Merge sales history - combine and sort
  merged.salesHistory = [
    ...existingProperty.salesHistory,
    ...newProperty.salesHistory.filter(sale => 
      !existingProperty.salesHistory.some(existing => 
        existing.saleDate === sale.saleDate && 
        existing.salePrice === sale.salePrice
      )
    )
  ].sort((a, b) => {
    if (!a.saleDate) return 1;
    if (!b.saleDate) return -1;
    return new Date(b.saleDate) - new Date(a.saleDate);
  });
  
  // Merge distress factors - use the most severe
  merged.distressFactors = {
    inForeclosure: existingProperty.distressFactors.inForeclosure || newProperty.distressFactors.inForeclosure,
    foreclosureStage: newProperty.distressFactors.foreclosureStage || existingProperty.distressFactors.foreclosureStage,
    foreclosureFilingDate: newProperty.distressFactors.foreclosureFilingDate || existingProperty.distressFactors.foreclosureFilingDate,
    hasLiens: existingProperty.distressFactors.hasLiens || newProperty.distressFactors.hasLiens,
    lienAmount: newProperty.distressFactors.lienAmount || existingProperty.distressFactors.lienAmount,
    bankruptcy: existingProperty.distressFactors.bankruptcy || newProperty.distressFactors.bankruptcy,
    preForeclosure: existingProperty.distressFactors.preForeclosure || newProperty.distressFactors.preForeclosure,
    taxDelinquent: existingProperty.distressFactors.taxDelinquent || newProperty.distressFactors.taxDelinquent,
    vacant: existingProperty.distressFactors.vacant || newProperty.distressFactors.vacant,
    codeViolations: existingProperty.distressFactors.codeViolations || newProperty.distressFactors.codeViolations,
    daysOnMarket: newProperty.distressFactors.daysOnMarket || existingProperty.distressFactors.daysOnMarket,
    absenteeOwner: existingProperty.distressFactors.absenteeOwner || newProperty.distressFactors.absenteeOwner,
    
    // Combine distress factors
    distressFactors: [
      ...new Set([
        ...(existingProperty.distressFactors.distressFactors || []),
        ...(newProperty.distressFactors.distressFactors || [])
      ])
    ]
  };
  
  // Recalculate distress score
  merged.distressFactors.distressScore = calculateCombinedDistressScore(merged);
  
  // Update source timestamp
  merged.sourceTimestamp = new Date().toISOString();
  
  return merged;
}

/**
 * Helper to merge objects, preferring non-null/undefined values
 * 
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object (takes precedence for non-null values)
 * @returns {Object} Merged object
 */
function mergeObjects(obj1, obj2) {
  const result = { ...obj1 };
  
  // Iterate through second object properties
  for (const [key, val2] of Object.entries(obj2)) {
    // Skip null or undefined values
    if (val2 === null || val2 === undefined) {
      continue;
    }
    
    // Skip empty strings if we already have a value
    if (val2 === '' && result[key]) {
      continue;
    }
    
    // Use the second object's value
    result[key] = val2;
  }
  
  return result;
}

/**
 * Calculate a combined distress score from multiple factors
 * 
 * @param {Object} property - Property with distress factors
 * @returns {number} Calculated distress score (0-100)
 */
function calculateCombinedDistressScore(property) {
  let score = 0;
  const factors = property.distressFactors;
  
  // Major distress factors
  if (factors.inForeclosure) score += 40;
  if (factors.preForeclosure) score += 30;
  if (factors.bankruptcy) score += 35;
  if (factors.taxDelinquent) score += 25;
  
  // Moderate distress factors
  if (factors.hasLiens) score += 15;
  if (factors.codeViolations) score += 15;
  if (factors.vacant) score += 20;
  
  // Minor distress factors
  if (factors.absenteeOwner) score += 10;
  if (factors.daysOnMarket > 180) score += 15;
  else if (factors.daysOnMarket > 90) score += 10;
  else if (factors.daysOnMarket > 60) score += 5;
  
  // Cap at 100
  return Math.min(100, score);
}

/**
 * Save a new property to the database
 * 
 * @param {Object} property - Unified property object
 * @returns {Object} Property with database ID
 */
async function savePropertyToDatabase(property) {
  try {
    // Generate a unique ID if not present
    if (!property.id) {
      property.id = uuidv4();
    }
    
    // Create a hash for deduplication
    const propertyHash = property.address.normalizedAddress || 
                         crypto.createHash('md5')
                               .update(property.address.fullAddress)
                               .digest('hex');
    
    // Store in PropertyRecord table
    const sql = `
      INSERT INTO property_records (
        id, source, source_id, address, city, state, zip_code,
        property_hash, processed, raw_data, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.prisma.execute(sql, [
      property.id,
      property.source,
      property.propertyId,
      property.address.line1,
      property.address.city,
      property.address.state,
      property.address.zip,
      propertyHash,
      0, // not processed
      JSON.stringify(property.rawData),
      new Date().toISOString()
    ]);
    
    // Return the property with the generated ID
    return property;
  } catch (error) {
    console.error('Error saving property to database:', error);
    throw error;
  }
}

/**
 * Update an existing property in the database
 * 
 * @param {Object} property - Unified property object
 * @returns {Object} Updated property
 */
async function updatePropertyInDatabase(property) {
  try {
    // Update PropertyRecord table
    const sql = `
      UPDATE property_records
      SET 
        raw_data = ?,
        processed = 1,
        updated_at = ?
      WHERE id = ?
    `;
    
    db.prisma.execute(sql, [
      JSON.stringify(property.rawData),
      new Date().toISOString(),
      property.id
    ]);
    
    return property;
  } catch (error) {
    console.error('Error updating property in database:', error);
    throw error;
  }
}

/**
 * Convert a property to a lead
 * 
 * @param {Object} property - Unified property object
 * @returns {Object} Lead object ready for database insert
 */
export function convertPropertyToLead(property) {
  const now = new Date().toISOString();
  
  const lead = {
    id: uuidv4(),
    address: property.address.line1,
    city: property.address.city,
    state: property.address.state,
    zipCode: property.address.zip,
    owner_name: property.owner.name,
    source_type: 'property',
    source: property.source,
    estimated_value: property.valuation.estimatedValue,
    equity: property.valuation.estimatedEquity,
    is_probate: false, // Default, would need specific data
    is_vacant: property.distressFactors.vacant,
    motivation_score: Math.min(100, property.distressFactors.distressScore),
    lead_score: Math.min(100, property.distressFactors.distressScore),
    raw_data: JSON.stringify(property),
    normalized_address: property.address.normalizedAddress,
    temperature_tag: getTemperatureTag(property.distressFactors.distressScore),
    status: 'NEW',
    created_at: now,
    updated_at: now
  };
  
  return lead;
}

/**
 * Get a temperature tag based on motivation score
 * 
 * @param {number} score - Motivation/distress score (0-100)
 * @returns {string} Temperature tag
 */
function getTemperatureTag(score) {
  if (score >= 80) return 'ON_FIRE';
  if (score >= 60) return 'HOT';
  if (score >= 40) return 'WARM';
  if (score >= 20) return 'COLD';
  return 'DEAD';
}

/**
 * Save a property as a lead
 * 
 * @param {Object} property - Unified property object
 * @returns {Object} Created lead
 */
export async function savePropertyAsLead(property) {
  try {
    const lead = convertPropertyToLead(property);
    
    // Check if lead already exists
    const existingLeadSql = `
      SELECT id FROM leads
      WHERE normalized_address = ? OR address = ?
      LIMIT 1
    `;
    
    const existingLead = db.leadflow.executeGet(existingLeadSql, [
      property.address.normalizedAddress,
      property.address.line1
    ]);
    
    if (existingLead) {
      console.log(`Lead already exists for property: ${property.address.fullAddress}`);
      return null;
    }
    
    // Insert the lead
    const sql = `
      INSERT INTO leads (
        id, address, city, state, zipCode, owner_name,
        source_type, source, estimated_value, equity,
        is_probate, is_vacant, motivation_score, lead_score,
        raw_data, normalized_address, temperature_tag,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.leadflow.execute(sql, [
      lead.id,
      lead.address,
      lead.city,
      lead.state,
      lead.zipCode,
      lead.owner_name,
      lead.source_type,
      lead.source,
      lead.estimated_value,
      lead.equity,
      lead.is_probate ? 1 : 0,
      lead.is_vacant ? 1 : 0,
      lead.motivation_score,
      lead.lead_score,
      lead.raw_data,
      lead.normalized_address,
      lead.temperature_tag,
      lead.status,
      lead.created_at,
      lead.updated_at
    ]);
    
    return lead;
  } catch (error) {
    console.error('Error saving property as lead:', error);
    throw error;
  }
}

/**
 * Convert multiple properties to leads
 * 
 * @param {Array<Object>} properties - Array of unified property objects
 * @returns {Object} Results with leads and errors
 */
export async function convertPropertiesToLeads(properties) {
  const results = [];
  const errors = [];
  
  for (let i = 0; i < properties.length; i++) {
    try {
      const lead = await savePropertyAsLead(properties[i]);
      if (lead) {
        results.push(lead);
      }
    } catch (error) {
      console.error(`Error converting property to lead:`, error);
      errors.push({
        property: properties[i],
        error: error.message
      });
    }
  }
  
  return {
    leads: results,
    errors,
    summary: {
      total: properties.length,
      success: results.length,
      error: errors.length
    }
  };
}
