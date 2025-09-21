import express from 'express';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';

const router = express.Router();

// Simple logger implementation to avoid dependency issues
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Prisma client (best-effort). In dev without a valid DB, disable Prisma cleanly.
let prisma = null;
let prismaEnabled = true;
try {
  // Prefer DATABASE_URL if provided; otherwise fall back to a local sqlite file
  const dbUrl = process.env.DATABASE_URL || 'file:../prisma/dev.db';
  prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    }
  });
} catch (e) {
  prismaEnabled = false;
}

// Verify database connection on startup
if (prisma) {
  (async () => {
    try {
      const leadCount = await prisma.lead.count();
      logger.info(`Database connection successful. Found ${leadCount} leads.`);
    } catch (error) {
      prismaEnabled = false;
      logger.error(`Database connection error:`, error);
    }
  })();
} else {
  logger.warn('Prisma is disabled (no valid DATABASE_URL). Zip search will return empty results in dev.');
}

// Helper function to normalize addresses for comparison
const normalizeAddress = (address) => {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
};

// Get temperature tag based on motivation score
const getTemperatureTag = (motivationScore) => {
  if (motivationScore <= 25) return 'dead';
  if (motivationScore <= 50) return 'warm';
  if (motivationScore <= 75) return 'hot';
  return 'on_fire';
};

// Unified search endpoint
router.get('/search', async (req, res) => {
  try {
    // If Prisma is not available (dev without DB), return a safe empty payload
    if (!prismaEnabled || !prisma) {
      return res.json({
        leads: [],
        pagination: { total: 0, page: 1, limit: Number(req.query.limit || 50), pages: 0 }
      });
    }

    const {
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      propertyType,
      source,
      temperature,
      limit = 50,
      page = 1
    } = req.query;
    
    const where = {};
    
    // Add filters based on query parameters
    if (query) {
      where.OR = [
        { address: { contains: query } },
        { owner_name: { contains: query } }
      ];
    }
    
    if (city) where.address = { contains: city };
    if (state) {
      if (where.address) {
        where.address = { ...where.address, contains: state };
      } else {
        where.address = { contains: state };
      }
    }
    
    if (zipCode) {
      if (where.address) {
        where.address = { ...where.address, contains: zipCode };
      } else {
        where.address = { contains: zipCode };
      }
    }
    
    if (propertyType) where.source_type = { equals: propertyType };
    if (source) where.source_type = { equals: source };
    if (temperature) where.temperature_tag = { equals: temperature };
    
    if (minValue || maxValue) {
      where.estimated_value = {};
      if (minValue) where.estimated_value.gte = parseFloat(minValue);
      if (maxValue) where.estimated_value.lte = parseFloat(maxValue);
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get leads with pagination
    const leads = await prisma.lead.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' }
    });
    
    // Count total leads for pagination
    const totalLeads = await prisma.lead.count({ where });
    
    // Process leads for deduplication
    const seenAddresses = new Set();
    const deduplicatedLeads = leads.filter(lead => {
      const propertyAddress = lead.address || '';
      const normalized = normalizeAddress(propertyAddress);
      
      if (normalized && seenAddresses.has(normalized)) {
        return false;
      }
      
      if (normalized) {
        seenAddresses.add(normalized);
      }
      
      return true;
    });
    
    // Format response with temperature tags
    const formattedLeads = deduplicatedLeads.map(lead => {
      return {
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score,
        temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
        status: lead.status,
        source: lead.source_type,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at
      };
    });
    
    // Return results
    res.json({
      leads: formattedLeads,
      pagination: {
        total: totalLeads,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalLeads / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update our main server.js to use our Prisma-based search routes
export default router;
