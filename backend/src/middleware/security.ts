import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced security middleware for LeadFlow AI
 */

// Enhanced Helmet configuration
export const createHelmetConfig = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
};

// Enhanced rate limiting with IP tracking
export const createRateLimit = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000')) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
    keyGenerator: (req: Request) => {
      // Use IP address for rate limiting
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    onLimitReached: (req: Request, res: Response) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    }
  });
};

// Compression middleware
export const createCompression = () => {
  return compression({
    level: 6,
    threshold: 1024,
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  });
};

// Request size limiting
export const createRequestSizeLimit = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const maxSize = process.env.MAX_REQUEST_SIZE || '10mb';
    
    // Check content-length header
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeMB = parseInt(maxSize.replace('mb', ''));
      
      if (sizeMB > maxSizeMB) {
        return res.status(413).json({
          error: 'Request entity too large',
          maxSize: maxSize
        });
      }
    }
    
    next();
  };
};

// Enhanced CORS configuration
export const createCorsConfig = () => {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-client-version',
      'x-request-id'
    ],
    maxAge: 86400 // 24 hours
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add cache control for sensitive endpoints
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Request timeout middleware
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'The server took too long to respond'
        });
      }
    }, timeout);
    
    res.on('finish', () => {
      clearTimeout(timer);
    });
    
    res.on('close', () => {
      clearTimeout(timer);
    });
    
    next();
  };
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized'
      });
    }
    
    next();
  };
};

// Apply all security middleware
export const applySecurityMiddleware = (app: any) => {
  app.use(createHelmetConfig());
  app.use(securityHeaders);
  app.use(createCompression());
  app.use(createRequestSizeLimit());
  app.use(requestTimeout(30000));
};

export default {
  createHelmetConfig,
  createRateLimit,
  createCompression,
  createRequestSizeLimit,
  createCorsConfig,
  securityHeaders,
  requestTimeout,
  ipWhitelist,
  applySecurityMiddleware
};
