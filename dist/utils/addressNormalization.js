/**
 * Address Normalization Utility
 *
 * Provides functions to standardize and normalize property addresses
 * for consistent matching and deduplication.
 */
/**
 * Normalize an address string by removing punctuation, extra spaces,
 * and converting to lowercase.
 *
 * @param address - Raw address string
 * @returns Normalized address string
 */
export function normalizeAddress(address) {
    if (!address)
        return '';
    // Convert to lowercase
    let normalized = address.toLowerCase();
    // Remove apartment / unit trailing segments like ", apt 4b" or "apt 4b" anywhere
    normalized = normalized.replace(/\b(apt|apartment|unit|ste|suite)\s+[\w#-]+/g, '').replace(/,#/g, '');
    // Replace common abbreviations
    const replacements = {
        'avenue': 'ave',
        'boulevard': 'blvd',
        'circle': 'cir',
        'court': 'ct',
        'drive': 'dr',
        'lane': 'ln',
        'parkway': 'pkwy',
        'place': 'pl',
        'road': 'rd',
        'square': 'sq',
        'street': 'st',
        'terrace': 'ter',
        'apartment': 'apt',
        'suite': 'ste',
        'unit': '#',
        'north': 'n',
        'south': 's',
        'east': 'e',
        'west': 'w',
        'northeast': 'ne',
        'northwest': 'nw',
        'southeast': 'se',
        'southwest': 'sw'
    };
    // Apply replacements
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        normalized = normalized.replace(regex, replacements[key]);
    });
    // Remove punctuation except for # sign
    normalized = normalized.replace(/[^\w\s#]/g, '');
    // Replace multiple spaces with a single space
    normalized = normalized.replace(/\s+/g, ' ');
    // Trim leading and trailing spaces
    normalized = normalized.trim();
    return normalized;
}
/**
 * Compare two addresses and return a similarity score from 0 to 1
 *
 * @param address1 - First address
 * @param address2 - Second address
 * @returns Similarity score (0-1)
 */
export function calculateAddressSimilarity(address1, address2) {
    const normalized1 = normalizeAddress(address1);
    const normalized2 = normalizeAddress(address2);
    if (!normalized1 || !normalized2)
        return 0;
    if (normalized1 === normalized2)
        return 1;
    // Split into components
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    // Count matching words
    let matchCount = 0;
    for (const word of words1) {
        if (words2.includes(word)) {
            matchCount++;
        }
    }
    // Calculate similarity score
    const totalWords = Math.max(words1.length, words2.length);
    return matchCount / totalWords;
}
/**
 * Determine if two addresses are likely the same property
 *
 * @param address1 - First address
 * @param address2 - Second address
 * @param threshold - Similarity threshold (default: 0.8)
 * @returns Whether addresses likely refer to the same property
 */
export function isSameProperty(address1, address2, threshold = 0.8) {
    const similarity = calculateAddressSimilarity(address1, address2);
    return similarity >= threshold;
}
//# sourceMappingURL=addressNormalization.js.map