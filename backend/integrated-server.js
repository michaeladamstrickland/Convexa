// Integrated Server - Combines ZIP Search API, ATTOM Property Data API, and Search API
// This server provides both your existing functionality and the ATTOM API integration

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import SkipTraceService from './services/skipTraceService.js';

// Import routes
import leadRoutes from './routes/leadRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import skipTraceRoutes from './routes/skipTraceRoutes.js';
import savedSearchesRoutes from './routes/savedSearchesRoutes.js';

// Load environment variables
dotenv.config();

// Main function to create and start the server
const startServer = async () => {
  // Use ES modules imports
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  const path = await import('path');
  const fs = await import('fs');
  
  // Get current file path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Setup Express
  const app = express();
  const PORT = 5001;
  
  // Find the database file
  console.log('Looking for SQLite database file...');
  const rootDbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
  
  if (!fs.existsSync(rootDbPath)) {
    console.error('❌ Database file not found at', rootDbPath);
    process.exit(1);
  }
  
  console.log(`✓ Database found at: ${rootDbPath}`);
  
  // Connect to SQLite database
  const db = new BetterSqlite3(rootDbPath, { readonly: false });
  
  // Initialize services
  const skipTraceService = new SkipTraceService(db);
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  
  // Logger middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
  
  // Helper function to get temperature tag based on motivation score
  function getTemperatureTag(motivationScore) {
    if (motivationScore <= 25) return 'dead';
    if (motivationScore <= 50) return 'warm';
    if (motivationScore <= 75) return 'hot';
    return 'on_fire';
  }
  
  // === API ENDPOINTS ===
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      database: 'sqlite',
      services: ['zip-search', 'attom-api', 'search-api'],
      timestamp: new Date().toISOString()
    });
  });
  
  // Use imported routes
  app.use('/api/leads', leadRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/skiptrace', skipTraceRoutes);
  app.use('/api/saved-searches', savedSearchesRoutes);
  
  // System status
  app.get('/api/status', (req, res) => {
    try {
      const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      const attomApiConfigured = Boolean(process.env.ATTOM_API_KEY);
      
      res.json({
        status: 'online',
        database: 'connected',
        leadCount: leadCount.count,
        services: {
          zipSearch: 'active',
          attomApi: attomApiConfigured ? 'active' : 'not configured'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // === ZIP SEARCH API ENDPOINTS ===
  
  // Main search endpoint
  app.get('/api/zip-search-new/search', (req, res) => {
    try {
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
      
      let sql = 'SELECT * FROM leads';
      const params = [];
      const whereClauses = [];
      
      // Add filters
      if (query) {
        whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
        params.push(`%${query}%`, `%${query}%`);
      }
      
      if (city) {
        whereClauses.push('address LIKE ?');
        params.push(`%${city}%`);
      }
      
      if (state) {
        whereClauses.push('address LIKE ?');
        params.push(`%${state}%`);
      }
      
      if (zipCode) {
        whereClauses.push('address LIKE ?');
        params.push(`%${zipCode}%`);
      }
      
      if (propertyType) {
        whereClauses.push('source_type = ?');
        params.push(propertyType);
      }
      
      if (source) {
        whereClauses.push('source_type = ?');
        params.push(source);
      }
      
      if (temperature) {
        whereClauses.push('temperature_tag = ?');
        params.push(temperature);
      }
      
      if (minValue || maxValue) {
        if (minValue) {
          whereClauses.push('estimated_value >= ?');
          params.push(parseFloat(minValue));
        }
        
        if (maxValue) {
          whereClauses.push('estimated_value <= ?');
          params.push(parseFloat(maxValue));
        }
      }
      
      // Add WHERE clause if needed
      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
      
      // Get total count for pagination
      let countSql = 'SELECT COUNT(*) as total FROM leads';
      if (whereClauses.length > 0) {
        countSql += ' WHERE ' + whereClauses.join(' AND ');
      }
      
      const totalCount = db.prepare(countSql).get(...params).total;
      
      // Add ORDER BY and pagination
      sql += ' ORDER BY created_at DESC';
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), skip);
      
      // Execute query
      const leads = db.prepare(sql).all(...params);
      
      // Process the results
      const formattedLeads = leads.map(lead => ({
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        phone: lead.phone,
        email: lead.email,
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score,
        temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
        status: lead.status,
        source: lead.source_type,
        isProbate: Boolean(lead.is_probate),
        isVacant: Boolean(lead.is_vacant),
        conditionScore: lead.condition_score,
        leadScore: lead.lead_score,
        createdAt: new Date(lead.created_at).toISOString(),
        updatedAt: new Date(lead.updated_at).toISOString()
      }));
      
      // Return the results
      res.json({
        leads: formattedLeads,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error in search endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // ZIP code search endpoint
  app.post('/api/zip-search-new/search-zip', (req, res) => {
    try {
      const { zipCode } = req.body;
      
      if (!zipCode) {
        return res.status(400).json({ error: 'Zip code is required' });
      }
      
      // Execute query
      const leads = db.prepare('SELECT * FROM leads WHERE address LIKE ?')
        .all(`%${zipCode}%`);
      
      // Format response
      res.json({
        leadCount: leads.length,
        zipCode,
        leads: leads.map(lead => ({
          id: lead.id,
          propertyAddress: lead.address,
          ownerName: lead.owner_name,
          estimatedValue: lead.estimated_value,
          equity: lead.equity,
          motivationScore: lead.motivation_score
        }))
      });
    } catch (error) {
      console.error('Error in ZIP search endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Add new lead endpoint
  app.post('/api/zip-search-new/add-lead', (req, res) => {
    try {
      const {
        address,
        owner_name,
        phone,
        email,
        estimated_value,
        equity,
        motivation_score,
        temperature_tag,
        source_type,
        is_probate,
        is_vacant,
        condition_score,
        notes,
        status,
        attom_id
      } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }
      
      // Generate a UUID for the lead
      const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const now = new Date().toISOString();
      
      // Check if a lead with this address already exists
      const existingLead = db.prepare('SELECT id FROM leads WHERE address = ?').get(address);
      
      if (existingLead) {
        return res.status(400).json({ 
          success: false, 
          message: 'A lead with this address already exists',
          existingId: existingLead.id 
        });
      }
      
      // Insert the new lead
      const insertStmt = db.prepare(`
        INSERT INTO leads (
          id, address, owner_name, phone, email, estimated_value, equity, 
          motivation_score, temperature_tag, source_type, is_probate, is_vacant,
          condition_score, notes, status, created_at, updated_at, attom_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        uuid,
        address,
        owner_name || null,
        phone || null,
        email || null,
        estimated_value || null,
        equity || null,
        motivation_score || 50,
        temperature_tag || getTemperatureTag(motivation_score || 50),
        source_type || 'attom',
        is_probate ? 1 : 0,
        is_vacant ? 1 : 0,
        condition_score || null,
        notes || null,
        status || 'NEW',
        now,
        now,
        attom_id || null
      );
      
      // Return success response
      res.json({
        success: true,
        message: 'Lead created successfully',
        leadId: uuid
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to create lead',
        error: error.message 
      });
    }
  });
  
  // Revenue analytics endpoint
  app.get('/api/zip-search-new/revenue-analytics', (req, res) => {
    try {
      // Calculate total estimated value
      const totalValueResult = db.prepare('SELECT SUM(estimated_value) as totalValue FROM leads')
        .get();
      
      // Get lead counts by source
      const leadsBySource = db.prepare('SELECT source_type as source, COUNT(*) as count FROM leads GROUP BY source_type')
        .all();
      
      // Get temperature distribution
      const temperatureDistribution = db.prepare(
        'SELECT temperature_tag as tag, COUNT(*) as count FROM leads GROUP BY temperature_tag'
      ).all();
      
      // Prepare response
      res.json({
        analytics: {
          totalLeads: db.prepare('SELECT COUNT(*) as count FROM leads').get().count,
          totalEstimatedValue: totalValueResult.totalValue || 0,
          avgMotivationScore: db.prepare('SELECT AVG(motivation_score) as avg FROM leads').get().avg || 0,
          leadsBySource,
          temperatureDistribution,
          potentialRevenue: totalValueResult.totalValue * 0.05 // Example: 5% of total value
        }
      });
    } catch (error) {
      console.error('Error in revenue analytics endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Database info endpoint
  app.get('/api/db-info', (req, res) => {
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      
      const tableInfo = {};
      for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
        
        tableInfo[table.name] = {
          columns: columns.map(col => ({
            name: col.name,
            type: col.type,
            notNull: col.notnull === 1,
            defaultValue: col.dflt_value,
            isPrimaryKey: col.pk === 1
          })),
          rowCount: count
        };
      }
      
      res.json({
        tables: tables.map(t => t.name),
        tableInfo
      });
    } catch (error) {
      console.error('Error getting database info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // === SEARCH API ENDPOINTS ===
  
  // Direct implementation of search routes to avoid module issues
  const searchRouter = express.Router();
  
  // In-memory cache for search results
  let searchCache = {};
  
  // Function to get temperature tag based on motivation score
  function getTemperatureTag(motivationScore) {
    if (motivationScore <= 25) return 'COLD';
    if (motivationScore <= 50) return 'WARM';
    if (motivationScore <= 75) return 'HOT';
    return 'ON_FIRE';
  }
  
  // Search leads with filters
  searchRouter.post('/', async (req, res) => {
    try {
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
        status,
        limit = 10,
        page = 1,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.body;
  
      // Generate a cache key based on the search parameters
      const cacheKey = JSON.stringify({
        query,
        minValue,
        maxValue,
        city,
        state,
        zipCode,
        propertyType,
        source,
        temperature,
        status,
        limit,
        page,
        sortBy,
        sortOrder
      });
  
      // Check if we have cached results for this query
      if (searchCache[cacheKey]) {
        return res.json(searchCache[cacheKey]);
      }
  
      // Build the SQL query
      let sql = 'SELECT * FROM leads';
      const params = [];
      const whereClauses = [];
  
      // Add filters
      if (query) {
        whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
        params.push(`%${query}%`, `%${query}%`);
      }
  
      if (city) {
        whereClauses.push('city LIKE ?');
        params.push(`%${city}%`);
      }
  
      if (state) {
        whereClauses.push('state LIKE ?');
        params.push(`%${state}%`);
      }
  
      if (zipCode) {
        whereClauses.push('zip_code LIKE ?');
        params.push(`%${zipCode}%`);
      }
  
      if (propertyType) {
        whereClauses.push('property_type = ?');
        params.push(propertyType);
      }
  
      if (source) {
        whereClauses.push('source_type = ?');
        params.push(source);
      }
  
      if (temperature) {
        whereClauses.push('temperature_tag = ?');
        params.push(temperature);
      }
  
      if (status) {
        whereClauses.push('status = ?');
        params.push(status);
      }
  
      if (minValue) {
        whereClauses.push('estimated_value >= ?');
        params.push(parseFloat(minValue));
      }
  
      if (maxValue) {
        whereClauses.push('estimated_value <= ?');
        params.push(parseFloat(maxValue));
      }
  
      // Add WHERE clause if needed
      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
  
      // Count total records for pagination
      let countSql = 'SELECT COUNT(*) as total FROM leads';
      if (whereClauses.length > 0) {
        countSql += ' WHERE ' + whereClauses.join(' AND ');
      }
  
      const totalCount = db.prepare(countSql).get(...params);
  
      // Add ORDER BY and pagination
      sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
  
      // Execute query
      const leads = db.prepare(sql).all(...params);
  
      // Format the results
      const formattedLeads = leads.map(lead => ({
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        phone: lead.phone || lead.owner_phone,
        email: lead.email || lead.owner_email,
        phones: lead.phones ? JSON.parse(lead.phones) : [],
        emails: lead.emails ? JSON.parse(lead.emails) : [],
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score || 0,
        aiScore: lead.ai_score || 0,
        temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
        status: lead.status || 'NEW',
        source: lead.source || lead.source_type,
        sourceType: lead.source_type,
        isProbate: Boolean(lead.is_probate),
        isVacant: Boolean(lead.is_vacant),
        conditionScore: lead.condition_score,
        leadScore: lead.lead_score,
        notes: lead.notes,
        rawData: lead.raw_data ? JSON.parse(lead.raw_data) : {},
        createdAt: lead.created_at,
        updatedAt: lead.updated_at
      }));
  
      // Calculate total pages
      const totalPages = Math.ceil(totalCount.total / parseInt(limit));
  
      // Create response
      const response = {
        leads: formattedLeads,
        pagination: {
          total: totalCount.total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: totalPages
        }
      };
  
      // Cache the results
      searchCache[cacheKey] = response;
  
      // Return the results
      res.json(response);
    } catch (error) {
      console.error(`Error in search endpoint: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get analytics
  searchRouter.get('/analytics', async (req, res) => {
    try {
      // Total leads
      const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get();
  
      // Total estimated value
      const totalValueResult = db.prepare('SELECT SUM(estimated_value) as totalValue FROM leads').get();
  
      // Average motivation score
      const avgMotivation = db.prepare('SELECT AVG(motivation_score) as avg FROM leads').get();
  
      // Temperature distribution
      const temperatureDistribution = db.prepare(
        'SELECT temperature_tag as tag, COUNT(*) as count FROM leads GROUP BY temperature_tag'
      ).all();
  
      // Leads by source
      const leadsBySource = db.prepare(
        'SELECT source_type as source, COUNT(*) as count FROM leads GROUP BY source_type'
      ).all();
  
      // Leads by status
      const leadsByStatus = db.prepare(
        'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
      ).all();
  
      // Prepare response
      const analytics = {
        totalLeads: totalLeads.count,
        totalEstimatedValue: totalValueResult.totalValue || 0,
        avgMotivationScore: avgMotivation.avg || 0,
        temperatureDistribution,
        leadsBySource,
        leadsByStatus,
        potentialRevenue: (totalValueResult.totalValue || 0) * 0.05 // Example: 5% of total value
      };
  
      res.json({ analytics });
    } catch (error) {
      console.error(`Error in analytics endpoint: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Clear search cache
  searchRouter.post('/clear-cache', (req, res) => {
    try {
      searchCache = {};
      res.json({
        success: true,
        message: 'Search cache cleared successfully'
      });
    } catch (error) {
      console.error(`Error clearing cache: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Mount search router
  app.use('/api/search', searchRouter);
  
  // === SKIP TRACE API ENDPOINTS ===
  
  // Skip trace a lead by ID
  app.post('/api/leads/:id/skiptrace', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if the lead exists
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }
      
      // Perform skip tracing
      const result = await skipTraceService.skipTraceLeadById(id);
      
      // Return the result
      res.json({
        success: result.success,
        message: result.success ? 'Skip trace completed successfully' : 'Skip trace failed',
        data: {
          leadId: id,
          phones: result.phones,
          emails: result.emails,
          cached: result.cached || false,
          cost: result.cost,
          provider: result.provider
        },
        error: result.error
      });
    } catch (error) {
      console.error('Error in skip trace endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing skip trace',
        error: error.message
      });
    }
  });
  
  // Bulk skip trace multiple leads
  app.post('/api/leads/bulk/skiptrace', async (req, res) => {
    try {
      const { leadIds } = req.body;
      
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or empty leadIds array'
        });
      }
      
      // Check quota first
      const quota = skipTraceService.getRemainingQuota();
      
      if (quota.remaining < leadIds.length) {
        return res.status(429).json({
          success: false,
          message: `Insufficient daily quota. Requested: ${leadIds.length}, Remaining: ${quota.remaining}`,
          quota
        });
      }
      
      // Perform bulk skip tracing
      const results = await skipTraceService.bulkSkipTraceLeads(leadIds);
      
      // Count successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.length - successes;
      
      // Return the results
      res.json({
        success: successes > 0,
        message: `Skip trace completed with ${successes} successes and ${failures} failures`,
        data: results.map(result => ({
          leadId: result.leadId,
          success: result.success,
          phones: result.phones,
          emails: result.emails,
          cached: result.cached || false,
          cost: result.cost,
          provider: result.provider,
          error: result.error
        })),
        totalCost: results.reduce((sum, r) => sum + r.cost, 0),
        quota: skipTraceService.getRemainingQuota()
      });
    } catch (error) {
      console.error('Error in bulk skip trace endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing bulk skip trace',
        error: error.message
      });
    }
  });
  
  // Get skip trace result for a lead
  app.get('/api/leads/:id/skiptrace', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if the lead exists
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }
      
      // Get skip trace result
      const result = skipTraceService.getSkipTraceResult(id);
      
      if (result) {
        res.json({
          success: true,
          message: 'Skip trace data retrieved',
          data: {
            leadId: id,
            phones: result.phones,
            emails: result.emails,
            cost: result.cost,
            provider: result.provider,
            cached: true
          }
        });
      } else {
        res.json({
          success: false,
          message: 'No skip trace data found for this lead',
          data: {
            leadId: id,
            phones: [],
            emails: []
          }
        });
      }
    } catch (error) {
      console.error('Error getting skip trace result:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving skip trace data',
        error: error.message
      });
    }
  });
  
  // Get skip trace quota info
  app.get('/api/skiptrace/quota', (req, res) => {
    try {
      const quota = skipTraceService.getRemainingQuota();
      
      res.json({
        success: true,
        data: quota
      });
    } catch (error) {
      console.error('Error getting skip trace quota:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving quota information',
        error: error.message
      });
    }
  });
  
  // Get skip trace cost analytics
  app.get('/api/skiptrace/analytics', (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days if not specified
      const end = endDate || new Date().toISOString().split('T')[0];
      
      let start;
      if (startDate) {
        start = startDate;
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split('T')[0];
      }
      
      // Get cost data
      const totalCost = skipTraceService.getSkipTraceCost(start, end);
      const dailyCosts = skipTraceService.getSkipTraceCostByDay(start, end);
      
      res.json({
        success: true,
        data: {
          totalCost: totalCost.cost,
          totalCount: totalCost.count,
          averageCost: totalCost.count > 0 ? totalCost.cost / totalCost.count : 0,
          dailyCosts,
          dateRange: {
            start,
            end
          }
        }
      });
    } catch (error) {
      console.error('Error getting skip trace analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving skip trace analytics',
        error: error.message
      });
    }
  });
  
  // === ATTOM API ENDPOINTS ===
  
  // Helper function for ATTOM API requests
  async function attomRequest(endpoint, params) {
    const apiKey = process.env.ATTOM_API_KEY;
    const baseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
    
    try {
      const response = await axios({
        method: 'GET',
        url: `${baseUrl}/${endpoint}`,
        headers: {
          'apikey': apiKey,
          'Accept': 'application/json'
        },
        params
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error in ATTOM API request to ${endpoint}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }
  
  // ATTOM API status endpoint
  app.get('/api/attom/status', (req, res) => {
    const apiKey = process.env.ATTOM_API_KEY;
    const apiEndpoint = process.env.ATTOM_API_ENDPOINT;
    
    res.json({
      status: 'online',
      apiConfigured: Boolean(apiKey),
      apiEndpoint: apiEndpoint || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0',
      timestamp: new Date().toISOString()
    });
  });
  
  // Get property by address
  app.get('/api/attom/property/address', async (req, res) => {
    try {
      const { address, city, state, zip } = req.query;
      
      if (!address || !city || !state) {
        return res.status(400).json({ 
          error: 'Missing required parameters. Please provide address, city, and state.' 
        });
      }
      
      const addressStr = `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}`;
      
      const response = await attomRequest('property/address', {
        address1: address,
        address2: `${city}, ${state}${zip ? ' ' + zip : ''}`
      });
      
      if (response.property && response.property.length > 0) {
        // Format property data for frontend
        const properties = response.property.map(prop => ({
          attomId: prop.identifier?.attomId,
          address: prop.address?.line1,
          city: prop.address?.locality,
          state: prop.address?.countrySubd,
          zipCode: prop.address?.postal1,
          latitude: prop.location?.latitude,
          longitude: prop.location?.longitude,
          propertyType: prop.summary?.proptype,
          yearBuilt: prop.summary?.yearBuilt,
          bedrooms: prop.building?.rooms?.beds,
          bathrooms: prop.building?.rooms?.bathsFull,
          squareFeet: prop.building?.size?.universalsize,
          lotSize: prop.lot?.lotsize1,
          lastSaleDate: prop.sale?.salesearchdate,
          lastSalePrice: prop.sale?.amount?.saleamt,
          ownerName: prop.owner?.owner1?.name,
          ownerOccupied: prop.summary?.ownerOccupied === 'Y',
          estimatedValue: prop.avm?.amount?.value || null
        }));
        
        res.json({
          status: 'success',
          message: `Found ${properties.length} properties for "${addressStr}"`,
          properties
        });
      } else {
        res.json({
          status: 'success',
          message: `No properties found for "${addressStr}"`,
          properties: []
        });
      }
    } catch (error) {
      console.error('Error in property address lookup:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Error looking up property by address',
        error: error.message
      });
    }
  });
  
  // Get properties by ZIP code
  app.get('/api/attom/property/zip', async (req, res) => {
    try {
      const { zip, page = 1, pageSize = 10 } = req.query;
      
      if (!zip) {
        return res.status(400).json({ 
          error: 'Missing required parameter: zip' 
        });
      }
      
      const response = await attomRequest('property/basicprofile', {
        postalcode: zip,
        page,
        pagesize: pageSize
      });
      
      if (response.property && response.property.length > 0) {
        // Format property data for frontend
        const properties = response.property.map(prop => ({
          attomId: prop.identifier?.attomId,
          address: prop.address?.line1,
          city: prop.address?.locality,
          state: prop.address?.countrySubd,
          zipCode: prop.address?.postal1,
          latitude: prop.location?.latitude,
          longitude: prop.location?.longitude,
          propertyType: prop.summary?.proptype,
          yearBuilt: prop.summary?.yearBuilt,
          bedrooms: prop.building?.rooms?.beds,
          bathrooms: prop.building?.rooms?.bathsFull,
          squareFeet: prop.building?.size?.universalsize,
          lotSize: prop.lot?.lotsize1,
          lastSaleDate: prop.sale?.salesearchdate,
          lastSalePrice: prop.sale?.amount?.saleamt,
          ownerName: prop.owner?.owner1?.name,
          ownerOccupied: prop.summary?.ownerOccupied === 'Y',
          estimatedValue: prop.avm?.amount?.value || null
        }));
        
        res.json({
          status: 'success',
          message: `Found ${properties.length} properties in ZIP code ${zip}`,
          total: response.status?.total || properties.length,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          properties
        });
      } else {
        res.json({
          status: 'success',
          message: `No properties found in ZIP code ${zip}`,
          properties: []
        });
      }
    } catch (error) {
      console.error('Error in ZIP code search:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Error looking up properties by ZIP code',
        error: error.message
      });
    }
  });
  
  // Get property details by ATTOM ID
  app.get('/api/attom/property/:attomId', async (req, res) => {
    try {
      const { attomId } = req.params;
      
      if (!attomId) {
        return res.status(400).json({ 
          error: 'Missing required parameter: attomId' 
        });
      }
      
      const response = await attomRequest('property/detail', {
        attomid: attomId
      });
      
      if (response.property && response.property.length > 0) {
        // Get the property
        const prop = response.property[0];
        
        // Format the property data for frontend
        const property = {
          attomId: prop.identifier?.attomId,
          address: prop.address?.line1,
          city: prop.address?.locality,
          state: prop.address?.countrySubd,
          zipCode: prop.address?.postal1,
          latitude: prop.location?.latitude,
          longitude: prop.location?.longitude,
          
          // Property details
          propertyType: prop.summary?.proptype,
          propertyUse: prop.summary?.propsubtype,
          yearBuilt: prop.summary?.yearBuilt,
          bedrooms: prop.building?.rooms?.beds,
          bathrooms: prop.building?.rooms?.bathsFull,
          squareFeet: prop.building?.size?.universalsize,
          lotSize: prop.lot?.lotsize1,
          lotSizeUnit: prop.lot?.lotsize1unit,
          
          // Owner information
          ownerName: prop.owner?.owner1?.name,
          ownerOccupied: prop.summary?.ownerOccupied === 'Y',
          
          // Sale information
          lastSaleDate: prop.sale?.salesearchdate,
          lastSalePrice: prop.sale?.amount?.saleamt,
          
          // Tax information
          taxAssessedValue: prop.assessment?.assessed?.assdttlvalue,
          taxMarketValue: prop.assessment?.market?.mktttlvalue,
          
          // Valuation
          estimatedValue: prop.avm?.amount?.value || null,
          estimatedValueHigh: prop.avm?.amount?.high || null,
          estimatedValueLow: prop.avm?.amount?.low || null,
          
          // Additional details
          stories: prop.building?.summary?.storycount,
          garage: prop.building?.parking?.prkgSize,
          pool: prop.building?.interior?.haspool === 'Y',
          fireplaces: prop.building?.interior?.fplccount,
          constructionType: prop.building?.construction?.constructiontype,
          roofType: prop.building?.construction?.roofcover
        };
        
        res.json({
          status: 'success',
          message: `Property found with ID ${attomId}`,
          property
        });
      } else {
        res.status(404).json({
          status: 'error',
          message: `No property found with ID ${attomId}`
        });
      }
    } catch (error) {
      console.error(`Error in property detail lookup for ID ${req.params.attomId}:`, error);
      res.status(500).json({ 
        status: 'error',
        message: 'Error looking up property details',
        error: error.message
      });
    }
  });
  
  // Get property valuation by ATTOM ID
  app.get('/api/attom/property/:attomId/valuation', async (req, res) => {
    try {
      const { attomId } = req.params;
      
      if (!attomId) {
        return res.status(400).json({ 
          error: 'Missing required parameter: attomId' 
        });
      }
      
      const response = await attomRequest('property/expandedprofile', {
        attomid: attomId
      });
      
      if (response.property && response.property.length > 0) {
        // Get the property
        const prop = response.property[0];
        
        // Format the valuation data for frontend
        const valuation = {
          attomId: prop.identifier?.attomId,
          address: prop.address?.line1,
          city: prop.address?.locality,
          state: prop.address?.countrySubd,
          zipCode: prop.address?.postal1,
          
          // Valuation data
          estimatedValue: prop.avm?.amount?.value || null,
          estimatedValueHigh: prop.avm?.amount?.high || null,
          estimatedValueLow: prop.avm?.amount?.low || null,
          estimatedValueRange: prop.avm?.amount?.high && prop.avm?.amount?.low ? 
            prop.avm.amount.high - prop.avm.amount.low : null,
          confidenceScore: prop.avm?.amount?.confidence || null,
          
          // Tax information
          taxAssessedValue: prop.assessment?.assessed?.assdttlvalue,
          taxMarketValue: prop.assessment?.market?.mktttlvalue,
          taxYear: prop.assessment?.tax?.taxyear,
          
          // Sale history
          lastSaleDate: prop.sale?.salesearchdate,
          lastSalePrice: prop.sale?.amount?.saleamt,
          
          // Equity estimate (if sale price available)
          estimatedEquity: prop.avm?.amount?.value && prop.sale?.amount?.saleamt ?
            prop.avm.amount.value - prop.sale.amount.saleamt : null
        };
        
        res.json({
          status: 'success',
          message: `Valuation found for property ID ${attomId}`,
          valuation
        });
      } else {
        res.status(404).json({
          status: 'error',
          message: `No valuation found for property ID ${attomId}`
        });
      }
    } catch (error) {
      console.error(`Error in property valuation lookup for ID ${req.params.attomId}:`, error);
      res.status(500).json({ 
        status: 'error',
        message: 'Error looking up property valuation',
        error: error.message
      });
    }
  });
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 FlipTracker Integrated API Server running on port ${PORT}`);
    console.log(`💾 Connected to database with ${db.prepare('SELECT COUNT(*) as count FROM leads').get().count} leads`);
    console.log(`🏠 ATTOM Property Data API ${process.env.ATTOM_API_KEY ? 'enabled' : 'not configured'}`);
    console.log(`✅ API endpoints ready for use:`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
    console.log(`  - Search: http://localhost:${PORT}/api/zip-search-new/search?limit=5`);
    console.log(`  - Analytics: http://localhost:${PORT}/api/zip-search-new/revenue-analytics`);
    console.log(`  - ATTOM Property Lookup: http://localhost:${PORT}/api/attom/property/address?address=123+Main+St&city=Beverly+Hills&state=CA&zip=90210`);
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Closing database connection...');
      db.close();
      process.exit();
    });
  });
};

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
