"use strict";
/**
 * Vendor API Client Utility
 *
 * Provides utilities to create consistent API clients for
 * third-party vendor integrations with cost tracking.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeClient = makeClient;
exports.logApiCall = logApiCall;
exports.retryWithBackoff = retryWithBackoff;
const axios_1 = __importDefault(require("axios"));
/**
 * Create a configured API client for a vendor
 *
 * @param baseURL - Base URL of the vendor API
 * @param headers - Headers to include with all requests
 * @param timeout - Request timeout in ms (default: 10000)
 * @returns Configured Axios instance
 */
function makeClient(baseURL, headers, timeout = 10000) {
    return axios_1.default.create({
        baseURL,
        headers,
        timeout
    });
}
/**
 * Log an API call with timing and status information
 *
 * @param vendor - Name of the API vendor (ATTOM, BatchData, etc)
 * @param endpoint - API endpoint called
 * @param status - HTTP status code
 * @param startTime - Start time in milliseconds
 * @param error - Optional error object
 */
function logApiCall(vendor, endpoint, status, startTime, error) {
    const duration = Date.now() - startTime;
    const success = status >= 200 && status < 300;
    if (success) {
        console.log(`API Call: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
    }
    else {
        console.error(`API Error: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
        if (error) {
            const axiosError = error;
            if (axiosError.response) {
                console.error(`Response: ${JSON.stringify(axiosError.response.data)}`);
            }
            else if (axiosError.request) {
                console.error(`No response received: ${axiosError.message}`);
            }
            else {
                console.error(`Error: ${error.message}`);
            }
        }
    }
    // Here you could also persist API call logs to the database
    // or call a cost tracking service
}
/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in ms
 * @param isRetryable - Function to check if error is retryable
 * @returns Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 250, isRetryable = (error) => true) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt >= maxRetries || !isRetryable(error)) {
                throw error;
            }
            // Calculate backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} in ${delay.toFixed(0)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
//# sourceMappingURL=vendorClient.js.map