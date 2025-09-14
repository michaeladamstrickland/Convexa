/**
 * normalize.cjs
 * Utilities for normalizing addresses and owner names
 */

const crypto = require('crypto');

/**
 * Normalizes an address and creates a hash for deduplication
 * @param {string} input - Raw address string
 * @returns {Object} Normalized address info and hash
 */
async function normalizeAddress(input) {
  if (!input) {
    return {
      input: '',
      normalized: '',
      hash: '',
      parts: {}
    };
  }
  
  // Simple normalization for now - in production this would use libpostal or similar
  // This is a simplified version that:
  // 1. Converts to uppercase
  // 2. Removes punctuation
  // 3. Normalizes whitespace
  // 4. Standardizes common abbreviations
  
  let normalized = input.toUpperCase();
  
  // Standardize directional abbreviations
  normalized = normalized
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W');
    
  // Standardize street suffix abbreviations
  normalized = normalized
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bCIRCLE\b/g, 'CIR');
    
  // Standardize apartment/unit designators
  normalized = normalized
    .replace(/\bAPARTMENT\b/g, 'APT')
    .replace(/\bUNIT\b/g, 'UNIT')
    .replace(/\bBUILDING\b/g, 'BLDG')
    .replace(/\bFLOOR\b/g, 'FL')
    .replace(/\bSUITE\b/g, 'STE');
    
  // Standardize state names (partial list)
  normalized = normalized
    .replace(/\bCALIFORNIA\b/g, 'CA')
    .replace(/\bNEW YORK\b/g, 'NY')
    .replace(/\bFLORIDA\b/g, 'FL')
    .replace(/\bTEXAS\b/g, 'TX')
    .replace(/\bILLINOIS\b/g, 'IL')
    .replace(/\bPENNSYLVANIA\b/g, 'PA');
  
  // Remove punctuation and normalize whitespace
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  // Generate an address hash for deduplication
  // Create a simplified version of the address for hashing
  // We extract a hash key that has street number, name and zip code for matching
  // e.g., "123-MAIN-ST-90210"
  
  // Extract street number and name
  const streetMatch = normalized.match(/^(\d+)\s+([A-Z0-9\s]+?)(?:\s+(?:APT|UNIT|STE|#).*)?(?:,|$)/);
  const streetNumber = streetMatch?.[1] || '';
  const streetName = streetMatch?.[2]?.trim() || '';
  
  // Extract ZIP code
  const zipMatch = normalized.match(/\b(\d{5})\b/);
  const zipCode = zipMatch?.[1] || '';
  
  // Create hash key
  const hashKey = [streetNumber, streetName.replace(/\s+/g, '-'), zipCode].filter(Boolean).join('-').toLowerCase();
  
  const hash = crypto
    .createHash("sha256")
    .update(hashKey)
    .digest("hex")
    .substring(0, 16); // Use only first 16 chars for brevity
  
  return {
    input,
    normalized,
    hash,
    parts: {
      streetNumber,
      streetName,
      zipCode
    }
  };
}

/**
 * Normalizes owner names for consistent matching
 * @param {string} name - Raw owner name
 * @returns {string} Normalized owner name
 */
function normalizeOwnerName(name) {
  if (!name) return null;
  
  // Convert to uppercase
  let normalized = name.toUpperCase();
  
  // Remove common suffixes for individuals
  normalized = normalized
    .replace(/\s+(?:JR|SR|I{1,3}|IV|V)\.?$/g, '')
    .replace(/\s+(?:ESQ|ESQUIRE)\.?$/g, '');
  
  // Handle "ET AL" variations
  normalized = normalized
    .replace(/\s+(?:ET\s+AL|ET\s+UX)\.?$/g, '')
    .replace(/\s+AND\s+OTHERS$/g, '');
  
  // Handle trust wording
  normalized = normalized
    .replace(/\s+(?:TRUST|TRUSTEE|LIVING TRUST|FAMILY TRUST)$/g, '')
    .replace(/\s+(?:REVOCABLE|IRREVOCABLE)$/g, '');
  
  // Handle LLC/Corp/Inc variations
  normalized = normalized
    .replace(/\s+(?:LLC|LC|LLP|LP|INC|INCORPORATED|CORPORATION|CORP)\.?$/g, '')
    .replace(/\s+(?:LIMITED|COMPANY|PARTNERS|PARTNERSHIP)$/g, '');
  
  // Normalize whitespace and punctuation
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  return normalized;
}

module.exports = { normalizeAddress, normalizeOwnerName };
