/**
 * ATTOM API Property Data Client
 *
 * This service handles communication with the ATTOM API for property data lookups
 * and integrates with our Lead model for data storage.
 */
export declare class AttomClient {
    private client;
    private apiKey;
    private maxRetries;
    private costPerLookupCents;
    private dailyCap;
    private cache;
    private cacheTtlSeconds;
    private dailySpendCents;
    private lastResetDay;
    constructor();
    /**
     * Search for properties by address
     *
     * @param address Street address
     * @param city City name
     * @param state State code (2 letter)
     * @param zip ZIP code
     * @returns Property details or null if not found
     */
    getPropertyByAddress(address: string, city: string, state: string, zip: string): Promise<any>;
    /**
     * Search for properties by ZIP code
     *
     * @param zipCode ZIP code to search
     * @param limit Maximum number of results to return
     * @returns Array of property details
     */
    getPropertiesByZipCode(zipCode: string, limit?: number): Promise<any>;
    /**
     * Get property details by ATTOM ID
     *
     * @param attomId ATTOM Property ID
     * @returns Property details or null if not found
     */
    getPropertyById(attomId: string): Promise<any>;
    /**
     * Convert ATTOM property data to our Lead model
     */
    private mapPropertyToLead;
    /**
     * Track API usage for cost reporting
     */
    private trackApiUsage;
    /**
     * Make API request with automatic retry logic
     */
    private makeRequestWithRetry;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Handle API errors
     */
    private handleError;
    /**
     * Check and reset daily counter if necessary
     */
    private checkDailyReset;
    /**
     * Add item to cache
     */
    private addToCache;
    /**
     * Get item from cache, return null if expired
     */
    private getFromCache;
    /**
     * Check API health
     */
    checkHealth(): Promise<{
        healthy: boolean;
        latency: number;
        status: number;
        error?: undefined;
    } | {
        healthy: boolean;
        error: any;
        status: any;
        latency?: undefined;
    }>;
}
declare const _default: AttomClient;
export default _default;
//# sourceMappingURL=attomClient.d.ts.map