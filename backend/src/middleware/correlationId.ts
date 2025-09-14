import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { trackRequest } from '../config/featureFlags';
import { logger } from '../utils/logger';

// Add correlation ID to request and log it
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add startTime to request
  req.startTime = Date.now();
  
  // Generate a correlation ID if not provided
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  // Set the correlation ID on the request object for later use
  req.correlationId = correlationId;
  
  // Add it to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Track this request
  trackRequest(correlationId, req.path);
  
  // Log the request with correlation ID
  logger.info(`Request ${req.method} ${req.path}`, {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });
  
  // Add correlation ID to each log entry for this request
  res.on('finish', () => {
    logger.info(`Response ${res.statusCode} for ${req.method} ${req.path}`, {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime,
    });
  });
  
  next();
}

// Extend Express Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}
