/**
 * Vendor API Client Utility
 * 
 * Provides utilities to create consistent API clients for
 * third-party vendor integrations with cost tracking.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

/**
 * Create a configured API client for a vendor
 * 
 * @param baseURL - Base URL of the vendor API
 * @param headers - Headers to include with all requests
 * @param timeout - Request timeout in ms (default: 10000)
 * @returns Configured Axios instance
 */
export function makeClient(
  baseURL: string, 
  headers: Record<string, string>,
  timeout = 10000
): AxiosInstance {
  return axios.create({
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
export function logApiCall(
  vendor: string,
  endpoint: string,
  status: number,
  startTime: number,
  error?: Error | AxiosError
): void {
  const duration = Date.now() - startTime;
  const success = status >= 200 && status < 300;
  
  if (success) {
    console.log(`API Call: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
  } else {
    console.error(`API Error: ${vendor} - ${endpoint} - ${status} - ${duration}ms`);
    
    if (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(`Response: ${JSON.stringify(axiosError.response.data)}`);
      } else if (axiosError.request) {
        console.error(`No response received: ${axiosError.message}`);
      } else {
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
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 250,
  isRetryable = (error: any) => true
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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
