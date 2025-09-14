/**
 * Skip trace a property owner by address
 *
 * @param address - Property street address
 * @param city - City name
 * @param state - State code
 * @param zipCode - ZIP code
 * @param firstName - Optional owner first name for better matching
 * @param lastName - Optional owner last name for better matching
 * @returns Skip trace results or empty object if feature disabled
 */
export declare function skipTraceByAddress(address: string, city: string, state: string, zipCode: string, firstName?: string, lastName?: string): Promise<{
    result: null;
    status: string;
    cost?: undefined;
    message?: undefined;
} | {
    result: any;
    status: string;
    cost: number;
    message?: undefined;
} | {
    result: null;
    status: string;
    message: any;
    cost?: undefined;
}>;
/**
 * Process skip trace results to extract contact information
 *
 * @param skipTraceResult - Raw skip trace API result
 * @returns Formatted contact data
 */
export declare function processSkipTraceResults(skipTraceResult: any): {
    phones: {
        number: any;
        type: any;
        status: any;
        isConnected: boolean;
        isMobile: boolean;
        isPrimary: boolean;
    }[];
    emails: {
        address: any;
        type: any;
        status: any;
        isDeliverable: boolean;
        isPrimary: boolean;
    }[];
    confidence: number;
};
/**
 * Check if BatchData API is available and working
 *
 * @returns Status of the BatchData API
 */
export declare function checkHealth(): Promise<{
    service: string;
    enabled: boolean;
    status: string;
    message: string;
    latency?: undefined;
    statusCode?: undefined;
} | {
    service: string;
    enabled: boolean;
    status: string;
    latency: number;
    message?: undefined;
    statusCode?: undefined;
} | {
    service: string;
    enabled: boolean;
    status: string;
    message: any;
    statusCode: any;
    latency: number;
}>;
declare const _default: {
    skipTraceByAddress: typeof skipTraceByAddress;
    processSkipTraceResults: typeof processSkipTraceResults;
    checkHealth: typeof checkHealth;
};
export default _default;
//# sourceMappingURL=batchService.d.ts.map