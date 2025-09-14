import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Enhanced validation and sanitization middleware for LeadFlow AI
 */

// Custom sanitization function
export const sanitizeInput = (value: any): any => {
  if (typeof value === 'string') {
    // Basic XSS protection - remove script tags and dangerous characters
    return value
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeInput(val);
    }
    return sanitized;
  }
  return value;
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((error: any) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Zod validation wrapper
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      // Sanitize the validated data
      req.body = sanitizeInput(validated.body || req.body);
      req.query = sanitizeInput(validated.query || req.query);
      req.params = sanitizeInput(validated.params || req.params);
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      next(error);
    }
  };
};

// Common validation rules
export const commonValidations = {
  id: param('id').isUUID().withMessage('Invalid ID format'),
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  phone: body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Must be a valid phone number'),
  pagination: {
    page: query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    limit: query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  }
};

// Lead validation schemas
export const leadSchemas = {
  create: z.object({
    body: z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      propertyAddress: z.string().min(5).max(500),
      city: z.string().min(1).max(100),
      state: z.string().length(2),
      zipCode: z.string().min(5).max(10),
      propertyType: z.enum(['single_family', 'multi_family', 'condo', 'townhouse', 'commercial']),
      leadSource: z.string().min(1).max(100),
      motivation: z.string().optional(),
      timeline: z.string().optional(),
      notes: z.string().max(2000).optional()
    })
  }),
  
  update: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      propertyAddress: z.string().min(5).max(500).optional(),
      city: z.string().min(1).max(100).optional(),
      state: z.string().length(2).optional(),
      zipCode: z.string().min(5).max(10).optional(),
      propertyType: z.enum(['single_family', 'multi_family', 'condo', 'townhouse', 'commercial']).optional(),
      leadSource: z.string().min(1).max(100).optional(),
      motivation: z.string().optional(),
      timeline: z.string().optional(),
      notes: z.string().max(2000).optional(),
      status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).optional()
    })
  }),
  
  search: z.object({
    query: z.object({
      q: z.string().max(100).optional(),
      status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).optional(),
      propertyType: z.enum(['single_family', 'multi_family', 'condo', 'townhouse', 'commercial']).optional(),
      city: z.string().max(100).optional(),
      state: z.string().length(2).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional()
    })
  })
};

// Campaign validation schemas
export const campaignSchemas = {
  create: z.object({
    body: z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      type: z.enum(['email', 'sms', 'voice', 'direct_mail']),
      template: z.string().min(1),
      leadFilters: z.object({
        status: z.array(z.string()).optional(),
        propertyType: z.array(z.string()).optional(),
        city: z.array(z.string()).optional(),
        state: z.array(z.string()).optional()
      }).optional(),
      scheduledAt: z.string().datetime().optional()
    })
  })
};

// User validation schemas
export const userSchemas = {
  register: z.object({
    body: z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      organizationName: z.string().min(1).max(200).optional(),
      role: z.enum(['admin', 'manager', 'user']).optional()
    })
  }),
  
  login: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1)
    })
  }),
  
  updateProfile: z.object({
    body: z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      phone: z.string().optional(),
      preferences: z.object({
        notifications: z.boolean().optional(),
        theme: z.enum(['light', 'dark']).optional()
      }).optional()
    })
  })
};

// Scraper validation schemas
export const scraperSchemas = {
  zillow: z.object({
    body: z.object({
      zipCodes: z.array(z.string().min(5).max(10)).min(1).max(50),
      maxListings: z.number().int().min(1).max(1000).optional(),
      filters: z.object({
        minPrice: z.number().int().min(0).optional(),
        maxPrice: z.number().int().min(0).optional(),
        propertyType: z.array(z.string()).optional(),
        daysOnMarket: z.number().int().min(0).optional()
      }).optional()
    })
  })
};

// Express validator rules for specific endpoints
export const leadValidation = {
  create: [
    body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name is required and must be less than 100 characters'),
    body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name is required and must be less than 100 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Must be a valid email'),
    body('propertyAddress').trim().isLength({ min: 5, max: 500 }).withMessage('Property address must be between 5 and 500 characters'),
    body('city').trim().isLength({ min: 1, max: 100 }).withMessage('City is required'),
    body('state').trim().isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters'),
    body('zipCode').trim().isLength({ min: 5, max: 10 }).withMessage('Zip code must be between 5 and 10 characters'),
    handleValidationErrors
  ],
  
  update: [
    param('id').isUUID().withMessage('Invalid lead ID'),
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('status').optional().isIn(['new', 'contacted', 'qualified', 'converted', 'dead']),
    handleValidationErrors
  ]
};

export default {
  sanitizeInput,
  handleValidationErrors,
  validateSchema,
  commonValidations,
  leadSchemas,
  campaignSchemas,
  userSchemas,
  scraperSchemas,
  leadValidation
};
