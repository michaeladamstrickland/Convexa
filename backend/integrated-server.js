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
import { initGuardrails } from '../infra/guardrails.js';
import createAdminGuardrailsRouter from './routes/adminGuardrails.js';
import { generateRunReport } from './services/reportService.js';
// Additive imports for validation
import { z } from 'zod';
// DTOs compiled under src/ (ESM); use dynamic imports to avoid resolution issues if needed
let DialRequestSchema = null;
let RecordingWebhookSchema = null;
let AsrCompleteSchema = null;
let LeadCreateSchema = null;
try {
  const d = await import('../src/dto/v1/dialer.js').catch(() => import('../src/dto/v1/dialer.ts'));
  DialRequestSchema = d.DialRequest;
  RecordingWebhookSchema = d.RecordingWebhook;
  AsrCompleteSchema = d.AsrComplete;
} catch {}
try {
  const l = await import('../src/dto/v1/leads.js').catch(() => import('../src/dto/v1/leads.ts'));
  LeadCreateSchema = l.LeadCreate;
} catch {}
let promClientOptional = null;

// Import routes
// Note: External route modules are optional and can have CJS/ESM interop issues.
// We'll rely on the integrated endpoints defined in this file to avoid missing deps.
// import savedSearchesRoutes from './routes/savedSearchesRoutes.js';

// Load environment variables (root .env then backend/.env)
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
  // Load backend-local .env (in addition to root). This ensures provider keys load when starting from repo root.
  try {
    dotenv.config({ path: path.resolve(__dirname, '.env') });
  } catch (e) {
    console.warn('Could not load backend/.env:', e?.message || e);
  }
  
  // Setup Express
  const app = express();
  const PORT = parseInt(process.env.PORT || '5001', 10);
  // Log the DB path env for visibility at startup
  console.log('[SQLite] Using DB at:', process.env.SQLITE_DB_PATH);
  console.log('[SkipTrace] DEMO_MODE =', String(process.env.SKIP_TRACE_DEMO_MODE));
  console.log('[SkipTrace] PRIMARY_PROVIDER =', String(process.env.SKIP_TRACE_PRIMARY_PROVIDER));
  console.log('[SkipTrace] FALLBACK_ENABLED =', String(process.env.SKIP_TRACE_FALLBACK_ENABLED));
  console.log('[Server] Port =', PORT);
  // Print effective BatchData URL and auth style (sanitized)
  try {
    const BD_BASE = (process.env.BATCHDATA_BASE_URL || process.env.BATCHDATA_API_URL || '').replace(/\/$/, '');
    const BD_PATH = (process.env.BATCHDATA_SKIPTRACE_PATH || '').startsWith('/')
      ? (process.env.BATCHDATA_SKIPTRACE_PATH || '')
      : ((process.env.BATCHDATA_SKIPTRACE_PATH ? '/' + process.env.BATCHDATA_SKIPTRACE_PATH : ''));
    const BD_URL = `${BD_BASE}${BD_PATH}`;
    const AUTH_STYLE = String(process.env.BATCHDATA_AUTH_STYLE || '').toLowerCase() === 'x-api-key' ? 'x-api-key' : 'bearer';
    console.log(`Using BatchData URL: ${BD_URL || '(not configured)'}`);
    if (AUTH_STYLE === 'bearer') {
      console.log('Auth: Authorization: Bearer <REDACTED>');
    } else if (AUTH_STYLE === 'x-api-key') {
      console.log('Auth: X-API-KEY: <REDACTED>');
    } else {
      console.log('Auth: (unknown style)');
    }
  } catch (e) {
    console.warn('Could not print BatchData startup info:', e?.message || e);
  }
  
  // Resolve database file
  const envDbPath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : null;
  const defaultDbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
  const dbPath = envDbPath || defaultDbPath;
  console.log('Looking for SQLite database file at:', dbPath);

  // If using env path, ensure directory exists; allow creating a new file automatically
  if (envDbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } else {
    // If relying on default path, it must exist to proceed (legacy behavior)
    if (!fs.existsSync(defaultDbPath)) {
      console.error('❌ Database file not found at', defaultDbPath);
      process.exit(1);
    }
  }

  if (!fs.existsSync(dbPath)) {
    console.warn('⚠️ Database file does not exist yet, it will be created:', dbPath);
  } else {
    console.log(`✓ Database found at: ${dbPath}`);
  }

  // Connect to SQLite database
  const db = new BetterSqlite3(dbPath, { readonly: false });
  // Apply SQLite runtime PRAGMAs per Sprint 1 plan
  try {
    const busyMs = parseInt(process.env.SQLITE_BUSY_TIMEOUT_MS || '5000', 10);
    const jm = db.pragma('journal_mode = WAL', { simple: true });
    db.pragma(`busy_timeout = ${busyMs}`);
    db.pragma('synchronous = NORMAL');
    console.log(`[SQLite] PRAGMA journal_mode=${Array.isArray(jm) ? jm[0].journal_mode : 'wal'} busy_timeout=${busyMs} synchronous=NORMAL`);
  } catch (e) {
    console.warn('[SQLite] Failed to set PRAGMAs:', e?.message || e);
  }
  // Skip leads table creation and attom_id column addition if the database file already exists,
  // assuming scripts/seedBudgetSpend.cjs has already set up the schema.
  if (!fs.existsSync(dbPath) || db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get() === undefined) {
    // Ensure leads table exists (fresh DBs)
    let leadsTableInfo = [];
    try {
      leadsTableInfo = db.prepare("PRAGMA table_info(leads)").all();
    } catch (_) {
      leadsTableInfo = [];
    }

    if (!Array.isArray(leadsTableInfo) || leadsTableInfo.length === 0) {
      try {
        console.warn('⚠️  leads table not found — creating minimal schema...');
        db.exec(`
          CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            address TEXT NOT NULL,
            owner_name TEXT,
            phone TEXT,
            email TEXT,
            estimated_value REAL,
            equity REAL,
            motivation_score INTEGER DEFAULT 0,
            temperature_tag TEXT DEFAULT 'DEAD',
            source_type TEXT NOT NULL,
            is_probate BOOLEAN DEFAULT 0,
            is_vacant BOOLEAN DEFAULT 0,
            condition_score INTEGER DEFAULT 0,
            notes TEXT,
            status TEXT DEFAULT 'NEW',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            skip_trace_verified_at DATETIME,
            skip_trace_cache_until DATETIME,
            force_refresh_needed BOOLEAN DEFAULT 0,
            phones_count INTEGER DEFAULT 0,
            emails_count INTEGER DEFAULT 0,
            has_dnc BOOLEAN DEFAULT 0,
            primary_phone TEXT,
            primary_email TEXT,
            attom_id TEXT
          );
        `);
        console.log('✅ Created leads table');
        leadsTableInfo = db.prepare("PRAGMA table_info(leads)").all();
      } catch (e) {
        console.error('❌ Failed to create leads table:', e.message);
      }
    }

    // Ensure attom_id column exists
    const hasAttomIdColumn = Array.isArray(leadsTableInfo) && leadsTableInfo.some(c => c.name === 'attom_id');
    if (!hasAttomIdColumn) {
      try {
        db.exec("ALTER TABLE leads ADD COLUMN attom_id TEXT");
        console.log('✅ Auto-added attom_id column to leads table');
      } catch (e) {
        console.warn('⚠️ Could not add attom_id column (may already exist or DB locked):', e.message);
      }
    }
  } else {
    console.log('✅ Skipping leads table schema creation as database already exists and has leads table.');
  }
  
  // Initialize services
  const skipTraceService = new SkipTraceService(db);
  // Initialize guardrails with DB for budget bootstrap
  try { initGuardrails(db); } catch (e) { console.warn('Guardrails init failed:', e?.message || e); }
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  // Needed for Twilio form-encoded webhooks
  app.use(express.urlencoded({ extended: true }));

  // --- Lightweight Problem+JSON helpers and validation wrappers (local, additive) ---
  function sendProblem(res, code, message, field, status = 400) {
    res.status(status).json({ code, message, ...(field ? { field } : {}) });
  }
  function validateBody(schema) {
    return (req, res, next) => {
      try {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
          return sendProblem(res, 'validation_error', issue?.message || 'Invalid request body', field, 400);
        }
        req.body = parsed.data;
        next();
      } catch (e) {
        return sendProblem(res, 'validation_error', String(e?.message || e), undefined, 400);
      }
    };
  }
  
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

  // Mount admin routes
  app.use('/admin', createAdminGuardrailsRouter(db));

  // Debug: effective config (sanitized) and providers
  app.get('/api/debug/config', (_req, res) => {
    try {
      const providerKeys = ['batchdata', 'whitepages'];
      res.json({
        success: true,
        data: {
          SKIP_TRACE_DEMO_MODE: process.env.SKIP_TRACE_DEMO_MODE || 'false',
          SKIP_TRACE_PRIMARY_PROVIDER: process.env.SKIP_TRACE_PRIMARY_PROVIDER || 'batchdata',
          SKIP_TRACE_FALLBACK_ENABLED: process.env.SKIP_TRACE_FALLBACK_ENABLED || 'false',
          SQLITE_DB_PATH: dbPath,
          port: PORT,
          providers: providerKeys
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  
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
    // Use only integrated endpoints in this file; external route modules are omitted.
  
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
  // Minimal schema aligned with LeadCreate
  const LeadCreateZ = z.object({
    address: z.string().min(1),
    owner_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    estimated_value: z.number().optional(),
    equity: z.number().optional(),
    motivation_score: z.number().int().min(0).max(100).optional(),
    temperature_tag: z.string().optional(),
    source_type: z.string().optional(),
    is_probate: z.boolean().optional(),
    is_vacant: z.boolean().optional(),
    condition_score: z.number().int().min(0).max(100).optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    attom_id: z.string().optional(),
  });
  app.post('/api/zip-search-new/add-lead', validateBody(LeadCreateZ), (req, res) => {
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
      
      // address presence already validated by zod
      
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
      
      // Build insert dynamically to support DBs with varying schemas
      // Determine existing columns at runtime
      let tableCols = [];
      try {
        tableCols = db.prepare('PRAGMA table_info(leads)').all();
      } catch (_) {
        tableCols = [];
      }
      const colSet = new Set(Array.isArray(tableCols) ? tableCols.map(c => c.name) : []);

      // Provide safe defaults for NOT NULL constrained columns
      const safeMotivation = (typeof motivation_score === 'number' && !Number.isNaN(motivation_score)) ? motivation_score : 50;
  const safeTemperature = temperature_tag || getTemperatureTag(safeMotivation);
  const safeCondition = (typeof condition_score === 'number' && !Number.isNaN(condition_score)) ? condition_score : 50;

      // Candidate field map
      const fieldMap = {
        id: uuid,
        address,
        owner_name: owner_name || null,
        phone: phone || null,
        email: email || null,
        estimated_value: (typeof estimated_value === 'number' && !Number.isNaN(estimated_value)) ? estimated_value : null,
        equity: (typeof equity === 'number' && !Number.isNaN(equity)) ? equity : null,
        motivation_score: safeMotivation,
  // Only include temperature_tag if the column exists in this DB
  temperature_tag: safeTemperature,
        source_type: source_type || 'attom',
        is_probate: is_probate ? 1 : 0,
        is_vacant: is_vacant ? 1 : 0,
        condition_score: safeCondition,
        notes: notes || null,
  status: status || 'new',
        created_at: now,
        updated_at: now,
        attom_id: attom_id || null
      };

      // If temperature_tag is not present in schema, remove it from fieldMap to avoid confusion
      if (!colSet.has('temperature_tag')) delete fieldMap.temperature_tag;

      // Filter to columns that actually exist in the table
      const columns = [];
      const values = [];
      for (const [col, val] of Object.entries(fieldMap)) {
        if (colSet.has(col)) {
          columns.push(col);
          values.push(val);
        }
      }

      if (columns.length === 0) {
        return res.status(500).json({ success: false, message: 'Leads table has no recognized columns' });
      }

      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO leads (${columns.join(', ')}) VALUES (${placeholders})`;
      db.prepare(insertSql).run(...values);
      
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
      const tableCounts = {};
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
        tableCounts[table.name] = count;
      }
      
      res.json({
        dbPath: dbPath,
        tables: tables.map(t => t.name),
        tableInfo,
        tableCounts
      });
    } catch (error) {
      console.error('Error getting database info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin auth middleware for debug routes
  function requireAdmin(req, res, next) {
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!isProd) return next();
    const supplied = req.headers['x-admin-token'] || req.query.admin_token;
    const expected = process.env.ADMIN_TOKEN || '';
    if (expected && supplied === expected) return next();
    return res.status(403).json({ success: false, error: 'Forbidden: admin token required' });
  }

  // Debug: provider_calls summary for today
  app.get('/api/debug/provider-calls-today', requireAdmin, (req, res) => {
    try {
      const dstr = new Date().toISOString().split('T')[0];
      const start = `${dstr}T00:00:00.000Z`;
      const end = `${dstr}T23:59:59.999Z`;
      const rows = db.prepare(`
        SELECT provider, COUNT(*) as count
        FROM provider_calls
        WHERE created_at BETWEEN ? AND ?
        GROUP BY provider
      `).all(start, end);
      res.json({ success: true, data: rows });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Debug: errors breakdown from skip_trace_logs (today, top 10)
  app.get('/api/debug/errors-today', requireAdmin, (req, res) => {
    try {
      const dstr = new Date().toISOString().split('T')[0];
      const start = `${dstr}T00:00:00.000Z`;
      const end = `${dstr}T23:59:59.999Z`;
      const rows = db.prepare(`
        SELECT COALESCE(error, 'NONE') as error, COUNT(*) as count
        FROM skip_trace_logs
        WHERE created_at BETWEEN ? AND ?
        GROUP BY COALESCE(error, 'NONE')
        ORDER BY count DESC
        LIMIT 10
      `).all(start, end);
      res.json({ success: true, data: rows });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Debug: latest skip trace logs with payloads
  app.get('/api/debug/skiptrace-latest', requireAdmin, (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
      const rows = db.prepare(`
        SELECT id, lead_id, provider, success, cost, phones_found, emails_found, cached,
               error, request_payload, response_data, created_at, 
               (CASE WHEN zip_hint_used IS NULL THEN 0 ELSE zip_hint_used END) AS zip_hint_used
        FROM skip_trace_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).all(limit);
      res.json({ success: true, data: rows });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Debug: attempt reasons summary for today
  app.get('/api/debug/attempt-reasons-today', requireAdmin, (req, res) => {
    try {
      const dstr = new Date().toISOString().split('T')[0];
      const start = `${dstr}T00:00:00.000Z`;
      const end = `${dstr}T23:59:59.999Z`;
      const addrSanHits = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM skip_trace_logs
        WHERE created_at BETWEEN ? AND ?
          AND success = 1
          AND request_payload IS NOT NULL
          AND request_payload LIKE '%"attempt_reason":"address_sanitized"%'
      `).get(start, end)?.cnt || 0;
      const totalSuccess = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM skip_trace_logs
        WHERE created_at BETWEEN ? AND ?
          AND success = 1
      `).get(start, end)?.cnt || 0;
      res.json({ success: true, data: { address_sanitized_hits: addrSanHits, total_success: totalSuccess } });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Debug: count of zip hints used today
  app.get('/api/debug/zip-hints-today', requireAdmin, (req, res) => {
    try {
      const dstr = new Date().toISOString().split('T')[0];
      const start = `${dstr}T00:00:00.000Z`;
      const end = `${dstr}T23:59:59.999Z`;
      const row = db.prepare(`
        SELECT SUM(CASE WHEN zip_hint_used = 1 THEN 1 ELSE 0 END) as zip_hints
        FROM skip_trace_logs
        WHERE created_at BETWEEN ? AND ?
      `).get(start, end);
      res.json({ success: true, data: { zip_hints: row?.zip_hints || 0 } });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  
  // === SEARCH API ENDPOINTS ===
  
  // Direct implementation of search routes to avoid module issues
  const searchRouter = express.Router();
  
  // In-memory cache for search results
  let searchCache = {};

  // NOTE: Use the existing getTemperatureTag defined earlier in this file.
  // Avoid redefining here to keep a single, consistent implementation.
  
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
        // leads table does not have a dedicated city column; match within address
        whereClauses.push('address LIKE ?');
        params.push(`%${city}%`);
      }
  
      if (state) {
        // leads table does not have a dedicated state column; match within address
        whereClauses.push('address LIKE ?');
        params.push(`%${state}%`);
      }
  
      if (zipCode) {
        // leads table does not have a dedicated zip_code column; match within address
        whereClauses.push('address LIKE ?');
        params.push(`%${zipCode}%`);
      }
  
      if (propertyType) {
        // Map propertyType to source_type for now (schema has no property_type)
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

  // === Operator UI M1 Aliases (read-only) ===
  app.get('/leads', (req, res) => {
    try {
      // Delegate to existing search query params
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
      const page = Math.max(1, Number(req.query.page) || 1);
      const qp = { ...req.query, limit, page };
      // Reuse logic by invoking the existing handler indirectly
      // Build SQL matching /api/zip-search-new/search behavior
      let sql = 'SELECT * FROM leads';
      const params = [];
      const whereClauses = [];
      if (qp.query) { whereClauses.push('(address LIKE ? OR owner_name LIKE ?)'); params.push(`%${qp.query}%`, `%${qp.query}%`); }
      if (qp.city) { whereClauses.push('address LIKE ?'); params.push(`%${qp.city}%`); }
      if (qp.state) { whereClauses.push('address LIKE ?'); params.push(`%${qp.state}%`); }
      if (qp.zipCode) { whereClauses.push('address LIKE ?'); params.push(`%${qp.zipCode}%`); }
      if (qp.source) { whereClauses.push('source_type = ?'); params.push(qp.source); }
      if (qp.temperature) { whereClauses.push('temperature_tag = ?'); params.push(qp.temperature); }
      if (qp.status) { whereClauses.push('status = ?'); params.push(qp.status); }
      if (whereClauses.length > 0) sql += ' WHERE ' + whereClauses.join(' AND ');
      let countSql = 'SELECT COUNT(*) as total FROM leads';
      if (whereClauses.length > 0) countSql += ' WHERE ' + whereClauses.join(' AND ');
      const totalCount = db.prepare(countSql).get(...params).total;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * limit; params.push(limit, offset);
      const leads = db.prepare(sql).all(...params);
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
        updatedAt: new Date(lead.updated_at).toISOString(),
      }));
      res.json({
        leads: formattedLeads,
        pagination: { total: totalCount, page, limit, pages: Math.ceil(totalCount / limit) }
      });
    } catch (e) {
      return sendProblem(res, 'list_error', String(e?.message || e), undefined, 500);
    }
  });

  app.get('/leads/:id', (req, res) => {
    try {
      const { id } = req.params;
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) return sendProblem(res, 'not_found', 'Lead not found', 'id', 404);
      const out = {
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
        updatedAt: new Date(lead.updated_at).toISOString(),
      };
      res.json(out);
    } catch (e) {
      return sendProblem(res, 'detail_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // === SKIP TRACE API ENDPOINTS ===
  // Shared schema used by bulk route
  const BulkSkiptraceZ = z.object({ leadIds: z.array(z.string()).min(1) });

  // Get a lead by ID (lightweight shape with parsed address fields)
  app.get('/api/leads/:id', (req, res) => {
    try {
      const { id } = req.params;
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      // Attempt to parse city, state, zip from the address string: "street, City, ST 12345"
      let city = null, state = null, zip = null;
      if (lead.address) {
        const parts = String(lead.address).split(',').map(s => s.trim());
        if (parts.length >= 2) {
          city = parts[1] || null;
        }
        if (parts.length >= 3) {
          const m = parts[2].match(/([A-Z]{2})\s*(\d{5})/i);
          if (m) { state = m[1].toUpperCase(); zip = m[2]; }
          else { state = parts[2].toUpperCase(); }
        }
      }

      res.json({
        lead: {
          id: lead.id,
          address: lead.address,
          owner_name: lead.owner_name,
          city,
          state,
          zip,
          created_at: lead.created_at,
          updated_at: lead.updated_at
        }
      });
    } catch (error) {
      console.error('Error getting lead:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Bulk skip trace multiple leads (place BEFORE /api/leads/:id/skiptrace so it doesn't get shadowed)
  app.post('/api/leads/bulk/skiptrace', validateBody(BulkSkiptraceZ), async (req, res) => {
    try {
      const { leadIds } = req.body;
      
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

  // Skip trace a lead by ID
  app.post('/api/leads/:id/skiptrace', async (req, res) => {
    try {
      const { id } = req.params;
      // Allow callers to control behavior: force refresh, pick provider, toggle fallback, retries
      const qp = req.query || {};
      const body = req.body || {};
      const forceParam = qp.force ?? body.force;
      const providerParam = qp.provider ?? body.provider;
      const fallbackParam = qp.fallback ?? body.fallback;
      const retriesParam = qp.maxRetries ?? body.maxRetries;
      const options = {
        forceRefresh: forceParam === true || String(forceParam).toLowerCase() === 'true' ? true : false,
        provider: providerParam ? String(providerParam) : undefined,
        useFallback: fallbackParam == null ? undefined : !(String(fallbackParam).toLowerCase() === 'false'),
        maxRetries: retriesParam != null && !Number.isNaN(Number(retriesParam)) ? Number(retriesParam) : undefined,
        runId: (qp.runId || body.runId) ? String(qp.runId || body.runId) : undefined,
      };
      
      // Check if the lead exists
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }
      
      // Perform skip tracing
  const result = await skipTraceService.skipTraceLeadById(id, options);
      
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
  app.post('/api/leads/bulk/skiptrace', validateBody(BulkSkiptraceZ), async (req, res) => {
    try {
      const { leadIds } = req.body;
      
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

  // === Dialer v1 — Vertical slice (minimal, stub-friendly) ===
  // Metrics (will be initialized if prom-client is present)
  let dialAttemptsCounter = null;
  let asrLatencyHist = null;
  let webhookErrorsCounter = null;

  // POST /dial — queue a dial attempt (stub provider OK)
  const DialRequestZ = z.object({
    leadId: z.string(),
    toNumber: z.string().min(10),
    fromNumber: z.string().min(10),
    record: z.boolean().optional().default(true),
    metadata: z.record(z.string()).optional(),
  });
  app.post('/dial', validateBody(DialRequestZ), (req, res) => {
    try {
      const { leadId, toNumber, fromNumber, record = true } = req.body;
      // Ensure lead exists
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId);
      if (!lead) return sendProblem(res, 'not_found', 'Lead not found', 'leadId', 404);
      const dialId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      // Emit metric
      try { dialAttemptsCounter && dialAttemptsCounter.inc({ provider: 'twilio', status: 'queued' }); } catch {}
      // Persist a tiny dial stub record on disk for later hooks
      const baseDir = path.resolve(__dirname, '..', 'artifacts', 'dialer');
      fs.mkdirSync(baseDir, { recursive: true });
      const dialRec = { dialId, leadId, toNumber, fromNumber, record, createdAt: new Date().toISOString() };
      fs.writeFileSync(path.join(baseDir, `${dialId}.json`), JSON.stringify(dialRec, null, 2));
      return res.json({ dialId, status: 'queued', provider: 'twilio', createdAt: dialRec.createdAt });
    } catch (e) {
      return sendProblem(res, 'dial_error', String(e?.message || e), undefined, 500);
    }
  });

  // POST /twilio/recording-complete — form-encoded webhook
  const RecordingWebhookZ = z.object({
    CallSid: z.string(),
    RecordingUrl: z.string(),
    RecordingDuration: z.string().optional(),
  });
  app.post('/twilio/recording-complete', (req, res) => {
    try {
      // Verify Twilio signature (if token present)
      try {
        const token = process.env.TWILIO_AUTH_TOKEN;
        const sig = req.headers['x-twilio-signature'];
        if (token && sig) {
          const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          // Twilio validation: base64(HMAC-SHA1(token, url + sortedParams))
          const params = Object.keys(req.body || {}).sort().reduce((acc, k) => acc + k + req.body[k], '');
          const toSign = url + params;
          const computed = Buffer.from(require('crypto').createHmac('sha1', token).update(toSign).digest('base64'));
          const provided = Buffer.from(String(sig));
          const ok = computed.length === provided.length && require('crypto').timingSafeEqual(computed, provided);
          if (!ok) {
            try { webhookErrorsCounter && webhookErrorsCounter.inc({ type: 'signature' }); } catch {}
            return sendProblem(res, 'unauthorized', 'invalid Twilio signature', undefined, 401);
          }
        }
      } catch (ve) {
        try { webhookErrorsCounter && webhookErrorsCounter.inc({ type: 'signature_error' }); } catch {}
        return sendProblem(res, 'unauthorized', 'signature verification error', undefined, 401);
      }
      const parsed = RecordingWebhookZ.safeParse(req.body || {});
      if (!parsed.success) {
        try { webhookErrorsCounter && webhookErrorsCounter.inc({ type: 'validation' }); } catch {}
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid webhook', field, 400);
      }
      const { CallSid, RecordingUrl, RecordingDuration } = parsed.data;
      const baseDir = path.resolve(__dirname, '..', 'artifacts', 'dialer', 'recordings');
      fs.mkdirSync(baseDir, { recursive: true });
      fs.writeFileSync(path.join(baseDir, `${CallSid}.json`), JSON.stringify({ CallSid, RecordingUrl, RecordingDuration, at: new Date().toISOString() }, null, 2));
      // In a future step: enqueue ASR job here
      return res.json({ success: true });
    } catch (e) {
      try { webhookErrorsCounter && webhookErrorsCounter.inc({ type: 'internal' }); } catch {}
      return sendProblem(res, 'webhook_error', String(e?.message || e), undefined, 500);
    }
  });

  // POST /dial/:dialId/asr-complete — persist transcript and attach minimal summary
  const AsrCompleteZ = z.object({
    dialId: z.string(),
    transcriptUrl: z.string().url(),
    words: z.number().int().nonnegative().optional(),
    latencyMs: z.number().int().nonnegative().optional(),
  });
  app.post('/dial/:dialId/asr-complete', (req, res) => {
    try {
      const parsed = AsrCompleteZ.safeParse({ ...req.body, dialId: req.params.dialId });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid payload', field, 400);
      }
      const { dialId, transcriptUrl, words, latencyMs } = parsed.data;
      // Store transcript reference
      const baseDir = path.resolve(__dirname, '..', 'artifacts', 'dialer', 'transcripts');
      fs.mkdirSync(baseDir, { recursive: true });
      fs.writeFileSync(path.join(baseDir, `${dialId}.json`), JSON.stringify({ dialId, transcriptUrl, words, latencyMs, at: new Date().toISOString() }, null, 2));
      // Observe latency metric (seconds)
      try { if (asrLatencyHist && typeof latencyMs === 'number') asrLatencyHist.observe(latencyMs / 1000); } catch {}
      return res.json({ success: true });
    } catch (e) {
      return sendProblem(res, 'asr_store_error', String(e?.message || e), undefined, 500);
    }
  });

  // === Artifacts listing & signed download ===
  const ARTIFACT_ROOT = path.resolve(__dirname, '..', 'run_reports');
  // Robustly load artifact signer with safe JS fallback (never import TS at runtime)
  let signUtil, verifyUtil;
  try {
    ({ signPath: signUtil, verifyPath: verifyUtil } = await import('../src/lib/signedUrl.js'));
  } catch (e) {
    const cryptoMod = await import('crypto');
    signUtil = (pathRel, expEpochSec, secret) =>
      cryptoMod.createHmac('sha256', String(secret)).update(`${String(pathRel)}|${Number(expEpochSec)}`).digest('hex');
    verifyUtil = (pathRel, expEpochSec, sig, secret) => {
      const now = Math.floor(Date.now() / 1000);
      if (!expEpochSec || Number(expEpochSec) < now) return false;
      const expected = signUtil(pathRel, expEpochSec, secret);
      try { return cryptoMod.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig))); } catch { return false; }
    };
    console.warn('signedUrl.js import failed, using crypto fallback:', e?.message || e);
  }
  const defaultTtl = parseInt(process.env.ARTIFACT_URL_TTL_SECONDS || '86400', 10);
  app.get('/admin/artifacts', (req, res) => {
    try {
      if (!fs.existsSync(ARTIFACT_ROOT)) return res.json({ artifacts: [] });
      const runs = fs.readdirSync(ARTIFACT_ROOT).filter(name => fs.statSync(path.join(ARTIFACT_ROOT, name)).isDirectory());
      const items = runs.map(runId => {
        const dir = path.join(ARTIFACT_ROOT, runId);
        // compute size
        let size = 0; let createdAt = null;
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          const st = fs.statSync(fp);
          size += st.size;
          if (!createdAt || st.ctimeMs < createdAt) createdAt = st.ctimeMs;
        }
        const rel = `${runId}/report.json`;
        const exp = Math.floor(Date.now() / 1000) + defaultTtl;
        const sig = signUtil(rel, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret');
        const signedUrl = `/admin/artifact-download?path=${encodeURIComponent(rel)}&exp=${exp}&sig=${sig}`;
        return { runId, createdAt: createdAt ? new Date(createdAt).toISOString() : null, size, signedUrl };
      });
      res.json(items);
    } catch (e) {
      return sendProblem(res, 'artifact_list_error', String(e?.message || e), undefined, 500);
    }
  });
  app.get('/admin/artifact-download', (req, res) => {
    try {
      const rel = String(req.query.path || '');
      const exp = Number(req.query.exp || 0);
      const sig = String(req.query.sig || '');
      if (!rel) return sendProblem(res, 'bad_request', 'path required', 'path', 400);
      const secret = process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret';
      const now = Math.floor(Date.now() / 1000);
      if (!exp || exp < now) return sendProblem(res, 'expired_signature', 'signature expired', undefined, 401);
      if (!verifyUtil(rel, exp, sig, secret)) return sendProblem(res, 'invalid_signature', 'invalid signature', undefined, 401);
      const abs = path.resolve(ARTIFACT_ROOT, rel);
      if (!abs.startsWith(ARTIFACT_ROOT)) return sendProblem(res, 'forbidden', 'path traversal', undefined, 403);
      if (!fs.existsSync(abs)) return sendProblem(res, 'not_found', 'file not found', undefined, 404);
      res.sendFile(abs);
    } catch (e) {
      return sendProblem(res, 'artifact_download_error', String(e?.message || e), undefined, 500);
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
      
  // Get skip trace result (await the async call)
  const result = await skipTraceService.getSkipTraceResult(id);
      
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

  // === RUN REPORT ENDPOINT (skeleton) ===
  app.get('/api/skiptrace-runs/:runId/report', (req, res) => {
    try {
      const runId = req.params.runId;
      const report = generateRunReport(db, runId);
      res.json(report);
    } catch (e) {
      if (e && e.code === 'NOT_FOUND') return res.status(404).json({ error: String(e.message || e) });
      console.error('Report generation error:', e?.message || e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // === RUN STATUS ENDPOINT (QA support) ===
  app.get('/api/skiptrace-runs/:runId/status', (req, res) => {
    try {
      const runId = String(req.params.runId);
      // Schema-tolerant: detect availability of soft_paused
      let hasSoftPaused = false;
      try {
        const cols = db.prepare(`PRAGMA table_info(skiptrace_runs)`).all();
        hasSoftPaused = Array.isArray(cols) && cols.some(c => c.name === 'soft_paused');
      } catch (_) { hasSoftPaused = false; }
      let run = null;
      if (hasSoftPaused) {
        run = db.prepare(`SELECT run_id, started_at, finished_at, soft_paused FROM skiptrace_runs WHERE run_id = ?`).get(runId);
      } else {
        run = db.prepare(`SELECT run_id, started_at, finished_at FROM skiptrace_runs WHERE run_id = ?`).get(runId);
        if (run) run.soft_paused = 0;
      }
      if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

      // Schema-tolerant counts from skiptrace_run_items
      const hasSri = (() => {
        try { db.prepare(`SELECT 1 FROM skiptrace_run_items LIMIT 1`).get(); return true; } catch (_) { return false; }
      })();
      let totals = { total: 0, done: 0, failed: 0, queued: 0, in_flight: 0 };
      if (hasSri) {
        const row = db.prepare(`SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
            SUM(CASE WHEN status='in_flight' THEN 1 ELSE 0 END) AS in_flight
          FROM skiptrace_run_items WHERE run_id = ?`).get(runId) || {};
        totals = {
          total: row.total || 0,
          done: row.done || 0,
          failed: row.failed || 0,
          queued: row.queued || 0,
          in_flight: row.in_flight || 0
        };
      }
      res.json({ success: true, run_id: run.run_id, soft_paused: !!run.soft_paused, started_at: run.started_at, finished_at: run.finished_at, totals });
    } catch (e) {
      console.error('Status endpoint error:', e?.message || e);
      res.status(500).json({ success: false, error: String(e?.message || e) });
    }
  });

  // Resume endpoint is now mounted at POST /admin/skiptrace-runs/:runId/resume
  
  // === ATTOM API ENDPOINTS ===
  
  // Proxy: Get ATTOM detail by ID (raw pass-through)
  app.get('/api/attom/property/:id/detail', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Missing required parameter: id' });
      }
      const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?id=${encodeURIComponent(id)}`;
      const r = await axios.get(url, {
        headers: { apikey: process.env.ATTOM_API_KEY },
      });
      res.json(r.data);
    } catch (err) {
      console.error('ATTOM detail error', err?.message || err);
      res.status(500).json({ error: err?.message || 'Unknown error' });
    }
  });
  
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
  
  // Metrics: Prometheus
  let promClient;
  try {
    promClient = (await import('prom-client')).default;
  } catch (_) {
    promClient = null;
  }
  let requestCounter = null;
  if (promClient) {
    promClient.collectDefaultMetrics();
    requestCounter = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status']
    });
    // Feature metrics
    try {
      dialAttemptsCounter = new promClient.Counter({ name: 'dial_attempts_total', help: 'Dial attempts', labelNames: ['provider', 'status'] });
      asrLatencyHist = new promClient.Histogram({ name: 'asr_latency_seconds', help: 'ASR latency seconds', buckets: [0.1,0.25,0.5,1,2,5,10] });
      webhookErrorsCounter = new promClient.Counter({ name: 'webhook_errors_total', help: 'Webhook errors', labelNames: ['type'] });
    } catch (e) {
      console.warn('Metrics init error:', e?.message || e);
    }
    app.use((req, res, next) => {
      if (!requestCounter) return next();
      const end = res.end;
      res.end = function (...args) {
        try {
          requestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
        } catch (_) {}
        return end.apply(this, args);
      };
      next();
    });
    app.get('/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
      } catch (e) {
        res.status(500).send(String(e?.message || e));
      }
    });
  } else {
    console.warn('prom-client not available; /metrics disabled');
  }
  
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
  // Global error handler (final)
  app.use((err, _req, res, _next) => {
    const msg = err?.message || 'Internal server error';
    const status = typeof err?.status === 'number' ? err.status : 500;
    res.status(status).json({ code: 'internal_error', message: msg });
  });
};

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
