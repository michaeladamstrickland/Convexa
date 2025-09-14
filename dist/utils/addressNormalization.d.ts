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
export declare function normalizeAddress(address: string): string;
/**
 * Compare two addresses and return a similarity score from 0 to 1
 *
 * @param address1 - First address
 * @param address2 - Second address
 * @returns Similarity score (0-1)
 */
export declare function calculateAddressSimilarity(address1: string, address2: string): number;
/**
 * Determine if two addresses are likely the same property
 *
 * @param address1 - First address
 * @param address2 - Second address
 * @param threshold - Similarity threshold (default: 0.8)
 * @returns Whether addresses likely refer to the same property
 */
export declare function isSameProperty(address1: string, address2: string, threshold?: number): boolean;
//# sourceMappingURL=addressNormalization.d.ts.map