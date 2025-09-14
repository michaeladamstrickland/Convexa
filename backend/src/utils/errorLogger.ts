/**
 * Enhanced Error Logger
 * 
 * Provides detailed error logging functionality with context capture
 */

import { logger } from './logger';

interface ErrorContext {
  [key: string]: any;
}

/**
 * Log an error with detailed context
 */
export function logDetailedError(error: any, context: ErrorContext = {}, source: string = 'unknown'): void {
  // Extract useful error properties
  const errorMessage = error.message || 'Unknown error';
  const errorName = error.name || 'Error';
  const errorStack = error.stack || '';
  const errorCode = error.code || '';
  
  // Create a structured error object
  const structuredError = {
    message: errorMessage,
    name: errorName,
    code: errorCode,
    source,
    timestamp: new Date().toISOString(),
    context
  };
  
  // Log the structured error
  logger.error(`[${source}] ${errorName}: ${errorMessage}`, structuredError);
  
  // Log stack trace separately to keep it clean
  if (errorStack) {
    logger.debug(`Stack trace for ${errorName} in ${source}:\n${errorStack}`);
  }
  
  // Special handling for specific error types
  if (error.cause) {
    logger.error(`Caused by: ${error.cause}`);
  }
  
  if (error.response && error.response.data) {
    logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
  }
}

/**
 * Create a clean error object for client response
 */
export function createClientErrorResponse(error: any, requestId: string): object {
  return {
    success: false,
    message: error.message || 'An unexpected error occurred',
    errorCode: error.code || 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Handle and log API errors consistently
 */
export function handleApiError(error: any, source: string, context: ErrorContext = {}): object {
  const requestId = context.requestId || 'unknown';
  
  // Log the error with full details
  logDetailedError(error, context, source);
  
  // Return a clean error response for the client
  return createClientErrorResponse(error, requestId);
}

/**
 * Create a wrapped error handler for routes
 */
export function createErrorHandler(source: string) {
  return (error: any, context: ErrorContext = {}) => {
    return handleApiError(error, source, context);
  };
}
