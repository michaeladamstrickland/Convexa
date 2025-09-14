/**
 * Address Normalization Utilities
 * 
 * Standardizes addresses for consistent matching and deduplication
 */

interface AddressComponents {
  line1: string;
  city?: string;
  state?: string;
  zip?: string;
}

/**
 * Normalize an address for consistent comparison and storage
 * 
 * @param address Address components to normalize
 * @returns Normalized address string
 */
export function normalizeAddress(address: AddressComponents): string {
  if (!address) return '';
  
  let { line1, city, state, zip } = address;
  
  // Convert to uppercase
  line1 = (line1 || '').toUpperCase().trim();
  city = (city || '').toUpperCase().trim();
  state = (state || '').toUpperCase().trim();
  zip = (zip || '').trim();
  
  // Remove common prefixes and suffixes
  line1 = removeCommonPrefixes(line1);
  line1 = replaceCommonSuffixes(line1);
  
  // Remove punctuation
  line1 = line1.replace(/[.,#]/g, ' ');
  
  // Standardize directionals
  line1 = standardizeDirectionals(line1);
  
  // Replace multiple spaces with a single space
  line1 = line1.replace(/\s+/g, ' ').trim();
  
  // Only keep first 5 digits of ZIP
  zip = zip.substring(0, 5);
  
  // Combine components into normalized address
  const components = [line1];
  
  if (city) components.push(city);
  if (state) components.push(state);
  if (zip) components.push(zip);
  
  return components.join(' ');
}

/**
 * Remove common address prefixes
 * @param line1 Address line 1
 * @returns Address without common prefixes
 */
function removeCommonPrefixes(line1: string): string {
  const prefixes = [
    'APT', 'APARTMENT', 'SUITE', 'STE', 'UNIT', '#', 'BLDG', 'BUILDING',
    'FLOOR', 'FL', 'LOT', 'SPACE', 'SPC'
  ];
  
  // Regex to match prefix followed by number or letter
  const prefixRegex = new RegExp(`^(${prefixes.join('|')})\\s+[0-9A-Z]+\\s+`, 'i');
  
  return line1.replace(prefixRegex, '');
}

/**
 * Replace common street suffixes with standardized versions
 * @param line1 Address line 1
 * @returns Address with standardized suffixes
 */
function replaceCommonSuffixes(line1: string): string {
  const suffixMap: Record<string, string> = {
    'AVENUE': 'AVE',
    'BOULEVARD': 'BLVD',
    'CIRCLE': 'CIR',
    'COURT': 'CT',
    'DRIVE': 'DR',
    'HIGHWAY': 'HWY',
    'LANE': 'LN',
    'PARKWAY': 'PKWY',
    'PLACE': 'PL',
    'ROAD': 'RD',
    'SQUARE': 'SQ',
    'STREET': 'ST',
    'TERRACE': 'TER',
    'TRAIL': 'TRL',
    'WAY': 'WAY'
  };
  
  let result = line1;
  
  Object.entries(suffixMap).forEach(([full, abbr]) => {
    // Replace full word with abbreviation when it's a standalone word
    const regex = new RegExp(`\\s${full}\\s|\\s${full}$`, 'i');
    result = result.replace(regex, ` ${abbr} `);
  });
  
  return result.trim();
}

/**
 * Standardize directionals in address
 * @param line1 Address line 1
 * @returns Address with standardized directionals
 */
function standardizeDirectionals(line1: string): string {
  const dirMap: Record<string, string> = {
    'NORTH': 'N',
    'NORTHEAST': 'NE',
    'EAST': 'E',
    'SOUTHEAST': 'SE',
    'SOUTH': 'S',
    'SOUTHWEST': 'SW',
    'WEST': 'W',
    'NORTHWEST': 'NW'
  };
  
  let result = line1;
  
  Object.entries(dirMap).forEach(([full, abbr]) => {
    // Replace directional when it's a standalone word
    const regex = new RegExp(`\\s${full}\\s|\\s${full}$|^${full}\\s`, 'i');
    result = result.replace(regex, ` ${abbr} `);
  });
  
  return result.trim();
}

/**
 * Create a deduplication key from address and owner name
 * @param address Normalized address string
 * @param ownerName Owner name
 * @returns Deduplication key
 */
export function createDedupeKey(address: string, ownerName: string): string {
  const normalizedOwner = (ownerName || '').toUpperCase().trim();
  return `${address}|${normalizedOwner}`;
}

export default {
  normalizeAddress,
  createDedupeKey
};
