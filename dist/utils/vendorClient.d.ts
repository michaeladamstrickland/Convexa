/**
 * Vendor API Client Utility
 *
 * Provides utilities to create consistent API clients for
 * third-party vendor integrations with cost tracking.
 */
import { AxiosInstance, AxiosError } from 'axios';
/**
 * Create a configured API client for a vendor
 *
 * @param baseURL - Base URL of the vendor API
 * @param headers - Headers to include with all requests
 * @param timeout - Request timeout in ms (default: 10000)
 * @returns Configured Axios instance
 */
export declare function makeClient(baseURL: string, headers: Record<string, string>, timeout?: number): AxiosInstance;
/**
 * Log an API call with timing and status information
 *
 * @param vendor - Name of the API vendor (ATTOM, BatchData, etc)
 * @param endpoint - API endpoint called
 * @param status - HTTP status code
 * @param startTime - Start time in milliseconds
 * @param error - Optional error object
 */
export declare function logApiCall(vendor: string, endpoint: string, status: number, startTime: number, error?: Error | AxiosError): void;
/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in ms
 * @param isRetryable - Function to check if error is retryable
 * @returns Result of the function
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number, isRetryable?: (error: any) => boolean): Promise<T>;
//# sourceMappingURL=vendorClient.d.ts.map