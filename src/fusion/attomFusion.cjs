/**
 * attomFusion.cjs
 * Specialized utilities for merging ATTOM API data with scraped properties
 */

const { fuseProperties } = require('./propertyFusion.cjs');

/**
 * ATTOM field mapping to standardized property fields
 */
const ATTOM_FIELD_MAP = {
  // Property identifiers
  'identifier.obPropId': 'parcelId',
  'identifier.apn': 'apn',
  'identifier.fips': 'fipsCode',
  
  // Address components
  'address.line1': 'address.line1',
  'address.line2': 'address.line2',
  'address.locality': 'address.city',
  'address.countrySubd': 'address.state',
  'address.postal1': 'address.zip',
  
  // Building details
  'building.size.universalsize': 'attributes.squareFeet',
  'building.rooms.beds': 'attributes.bedrooms',
  'building.rooms.bathstotal': 'attributes.bathrooms',
  'building.yearbuilt': 'attributes.yearBuilt',
  'lot.lotsize1': 'attributes.lotSize',
  
  // Valuation
  'avm.amount.value': 'avm',
  
  // Owner information
  'owner.owner1.name': 'ownerName',
  
  // Last sale
  'sale.salesearchdate': 'lastEventDate',
  'sale.amount.saleamt': 'lastSaleAmount'
};

/**
 * Convert raw ATTOM property data to standardized format
 * @param {Object} attomData - Raw ATTOM API response
 * @returns {Object} Standardized property record
 */
function convertAttomToStandard(attomData) {
  if (!attomData) return null;
  
  const property = {
    address: {},
    attributes: {},
    sourceKey: 'attom-api',
    capturedAt: new Date().toISOString()
  };
  
  // Extract fields using mapping
  for (const [attomPath, standardPath] of Object.entries(ATTOM_FIELD_MAP)) {
    const value = getNestedValue(attomData, attomPath);
    if (value === undefined) continue;
    
    setNestedValue(property, standardPath, value);
  }
  
  // Construct full address string
  if (property.address) {
    const addr = property.address;
    property.address = [
      addr.line1,
      addr.line2,
      [addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
    ].filter(Boolean).join(' ');
  }
  
  return property;
}

/**
 * Merge property with ATTOM data
 * @param {Object} attomData - Raw ATTOM API response
 * @param {Object} property - Property record to enhance
 * @returns {Object} Enhanced property record
 */
function enhanceWithAttom(attomData, property) {
  if (!attomData || !property) return property;
  
  return fuseProperties(attomData, [property]);
}

/**
 * Batch enhance multiple properties with ATTOM data
 * @param {Object} attomBatchResults - Map of attom results keyed by address hash
 * @param {Array} properties - Array of property records
 * @returns {Array} Enhanced property records
 */
function batchEnhanceWithAttom(attomBatchResults, properties) {
  if (!attomBatchResults || !properties?.length) return properties;
  
  return properties.map(property => {
    const attomData = property.addressHash ? 
      attomBatchResults[property.addressHash] : null;
    
    return attomData ? 
      enhanceWithAttom(attomData, property) : 
      property;
  });
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Dot notation path
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Set nested value in object using dot notation
 * @param {Object} obj - Target object
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 */
function setNestedValue(obj, path, value) {
  if (!obj || !path) return;
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    if (!(part in current)) {
      current[part] = {};
    }
    
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
}

module.exports = {
  convertAttomToStandard,
  enhanceWithAttom,
  batchEnhanceWithAttom,
  ATTOM_FIELD_MAP
};
