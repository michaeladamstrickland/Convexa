interface SkipTraceRequest {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    firstName?: string;
    lastName?: string;
}
interface SkipTraceResult {
    success: boolean;
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
    ownerAddress?: string;
    phonesJson?: string;
    emailsJson?: string;
    dncFlag?: boolean;
    cost: number;
}
/**
 * BatchData Skip Trace Service
 *
 * This service handles communication with the BatchData API for skip tracing
 * property owners and retrieving contact information.
 */
export declare class BatchSkipTraceService {
    private client;
    private apiKey;
    private maxRetries;
    private costPerLookupCents;
    private rateLimitPerMinute;
    private requestCount;
    private lastResetTime;
    constructor();
    /**
     * Skip trace a property by address to find owner contact information
     *
     * @param request Skip trace request object
     * @returns Skip trace result with contact information
     */
    skipTraceByAddress(request: SkipTraceRequest): Promise<SkipTraceResult>;
    /**
     * Skip trace multiple properties in batch
     *
     * @param requests Array of skip trace requests
     * @returns Array of skip trace results
     */
    batchSkipTrace(requests: SkipTraceRequest[]): Promise<SkipTraceResult[]>;
    /**
     * Process the owner information from the API response
     */
    private processOwnerInfo;
    /**
     * Check if we're within rate limits, wait if necessary
     */
    private checkRateLimit;
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
}
declare const _default: BatchSkipTraceService;
export default _default;
//# sourceMappingURL=batchSkipTraceService.d.ts.map