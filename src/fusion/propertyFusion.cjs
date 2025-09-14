/**
 * propertyFusion.cjs
 * Utilities for merging property records from different sources
 */

/**
 * Source reliability rankings (higher is more trusted)
 */
const SOURCE_RELIABILITY = {
  'attom': 10,
  'county-records': 8,
  'tax-records': 7,
  'mls': 6,
  'zillow': 5,
  'redfin': 5,
  'realtor': 5,
  'auction-com': 4,
  'hubzu': 4,
  'foreclosure': 3,
  'classifieds': 2,
  'default': 1
};

/**
 * Get reliability score for a source
 * @param {string} source - Source key
 * @returns {number} Reliability score
 */
function getSourceReliability(source) {
  if (!source) return SOURCE_RELIABILITY.default;
  
  // Try exact match
  if (SOURCE_RELIABILITY[source]) {
    return SOURCE_RELIABILITY[source];
  }
  
  // Try partial match
  for (const [key, score] of Object.entries(SOURCE_RELIABILITY)) {
    if (source.includes(key)) {
      return score;
    }
  }
  
  return SOURCE_RELIABILITY.default;
}

/**
 * Fuse multiple property records with ATTOM data
 * @param {Object|null} attom - ATTOM API data 
 * @param {Array} items - Array of scraped property items with same addressHash
 * @returns {Object} Fused property record
 */
function fuseProperties(attom, items) {
  // Select base record with most complete information
  const base = pickMostComplete(items);
  
  // Create fused lead record
  const lead = {
    address: base.address,
    addressHash: base.addressHash || '',
    ownerName: base.ownerName ?? attom?.owner?.owner1?.name ?? null,
    parcelId: attom?.identifier?.obPropId ?? base.parcelId ?? null,
    apn: attom?.identifier?.apn ?? null,
    avm: attom?.avm?.amount?.value ?? null,
    lastEventDate: attom?.sale?.salesearchdate ?? base.lastEventDate ?? null,
    attributes: { ...base.attributes },
    
    // Combine all distress signals
    distressSignals: Array.from(
      new Set(items.flatMap(i => i.distressSignals || []))
    ),
    
    // Track all sources
    sources: items.map(i => ({
      key: i.sourceKey || 'unknown',
      url: i.sourceUrl || null,
      capturedAt: i.capturedAt || null,
      reliability: getSourceReliability(i.sourceKey)
    })),
    
    // Track conflicts for auditing
    conflicts: {}
  };
  
  // Merge numeric attributes with source preference
  mergeNumericAttributes(lead, attom, items);
  
  // Merge contacts with highest confidence
  mergeContacts(lead, items);
  
  return lead;
}

/**
 * Select most complete property record
 * @param {Array} items - Array of property items 
 * @returns {Object} Most complete item
 */
function pickMostComplete(items) {
  if (!items || !items.length) return {};
  if (items.length === 1) return items[0];
  
  return items
    .map(i => ({ item: i, score: completenessScore(i) }))
    .sort((a, b) => b.score - a.score)[0].item;
}

/**
 * Calculate completeness score for a property
 * @param {Object} item - Property item
 * @returns {number} Completeness score
 */
function completenessScore(item) {
  if (!item) return 0;
  let score = 0;
  
  // Core property data
  if (item.ownerName) score += 2;
  if (item.parcelId || item.apn) score += 2;
  
  // Property attributes
  const attrs = item.attributes || {};
  if (attrs.bedrooms) score += 1;
  if (attrs.bathrooms) score += 1;
  if (attrs.squareFeet) score += 1;
  if (attrs.yearBuilt) score += 1;
  if (attrs.lotSize) score += 1;
  
  // Financial data
  if (item.priceHint) score += 1;
  if (item.lastEventDate) score += 1;
  
  // Contact info
  if (item.contacts && item.contacts.length) {
    score += item.contacts.length * 2;
  }
  
  return score;
}

/**
 * Merge numeric attributes with source preference
 * @param {Object} lead - Target lead object
 * @param {Object|null} attom - ATTOM data
 * @param {Array} items - Property items
 */
function mergeNumericAttributes(lead, attom, items) {
  // ATTOM is most trusted source for property characteristics
  if (attom?.building?.size?.universalsize) {
    lead.attributes.squareFeet = attom.building.size.universalsize;
    lead.conflicts.squareFeet = { 
      value: attom.building.size.universalsize,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.building?.rooms?.beds) {
    lead.attributes.bedrooms = attom.building.rooms.beds;
    lead.conflicts.bedrooms = { 
      value: attom.building.rooms.beds,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.building?.rooms?.bathstotal) {
    lead.attributes.bathrooms = attom.building.rooms.bathstotal;
    lead.conflicts.bathrooms = { 
      value: attom.building.rooms.bathstotal,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.lot?.lotsize1) {
    lead.attributes.lotSize = attom.lot.lotsize1;
    lead.conflicts.lotSize = { 
      value: attom.lot.lotsize1,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  // For each attribute not covered by ATTOM, use the most reliable source
  const attributes = ['bedrooms', 'bathrooms', 'squareFeet', 'yearBuilt', 'lotSize'];
  
  for (const attr of attributes) {
    if (lead.attributes[attr]) continue; // Already set by ATTOM
    
    // Get all values for this attribute with source reliability
    const values = [];
    
    for (const item of items) {
      if (item.attributes && item.attributes[attr] != null) {
        values.push({
          value: item.attributes[attr],
          source: item.sourceKey || 'unknown',
          reliability: getSourceReliability(item.sourceKey)
        });
      }
    }
    
    if (values.length === 0) continue;
    
    // Use value from most reliable source
    const bestValue = values.sort((a, b) => b.reliability - a.reliability)[0];
    
    lead.attributes[attr] = bestValue.value;
    lead.conflicts[attr] = {
      value: bestValue.value,
      source: bestValue.source,
      reliability: bestValue.reliability
    };
  }
}

/**
 * Merge contact information with confidence scoring
 * @param {Object} lead - Target lead object
 * @param {Array} items - Property items
 */
function mergeContacts(lead, items) {
  // Collect all contacts
  const contacts = items
    .filter(i => i.contacts && i.contacts.length)
    .flatMap(i => i.contacts);
  
  if (contacts.length === 0) return;
  
  // Group by type and value
  const contactMap = {};
  
  for (const contact of contacts) {
    if (!contact.value) continue;
    
    const key = `${contact.type}:${contact.value}`;
    
    if (!contactMap[key]) {
      contactMap[key] = {
        type: contact.type,
        value: contact.value,
        sources: [],
        confidence: contact.confidence || 0.5
      };
    }
    
    // Track sources
    contactMap[key].sources.push(contact.source || 'unknown');
    
    // Improve confidence if found in multiple sources
    if (contactMap[key].sources.length > 1) {
      contactMap[key].confidence = Math.min(
        0.95,
        contactMap[key].confidence + 0.15
      );
    }
  }
  
  // Sort by confidence
  lead.contacts = Object.values(contactMap)
    .sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  fuseProperties,
  pickMostComplete,
  completenessScore,
  getSourceReliability
};
