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
import { recordImportResults } from './services/importMetrics.js';
import multer from 'multer';
import csvParse from 'csv-parser';
import { Readable } from 'stream';
// Resilient guardrails import (ESM + top-level await)
let initGuardrails = null;
try {
  const gm = await import(new URL('../infra/guardrails.js', import.meta.url));
  // Support both default and named exports
  initGuardrails = gm.initGuardrails || gm.default?.initGuardrails || null;
  if (!initGuardrails && (gm.default && typeof gm.default === 'function')) {
    // Back-compat if module exported a function directly
    initGuardrails = gm.default;
  }
} catch (e) {
  console.warn('[Guardrails] Not found; using no-op guardrails for staging.');
  initGuardrails = () => ({ shouldAllow: () => true, quotas: {}, demoMode: true });
}
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

    // Ensure grade columns exist for Lead Grading v1
    const currentColumns = db.prepare("PRAGMA table_info(leads)").all().map(c => c.name);
    const gradeColumns = [
      { name: 'grade_score', type: 'INTEGER DEFAULT NULL' },
      { name: 'grade_label', type: 'TEXT DEFAULT NULL' },
      { name: 'grade_reason', type: 'TEXT DEFAULT NULL' },
      { name: 'grade_computed_at', type: 'DATETIME DEFAULT NULL' }
    ];

    for (const col of gradeColumns) {
      if (!currentColumns.includes(col.name)) {
        try {
          db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Auto-added ${col.name} column to leads table`);
        } catch (e) {
          console.warn(`⚠️ Could not add ${col.name} column:`, e.message);
        }
      }
    }
    
    // Ensure PI2 CRM-Lite stage column exists
    const pi2Columns = [
      { name: 'stage', type: 'TEXT DEFAULT "new"' }
    ];

    for (const col of pi2Columns) {
      if (!currentColumns.includes(col.name)) {
        try {
          db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Auto-added ${col.name} column to leads table`);
        } catch (e) {
          console.warn(`⚠️ Could not add ${col.name} column:`, e.message);
        }
      }
    }

  } else {
    console.log('✅ Skipping leads table schema creation as database already exists and has leads table.');
  }
  
  // Create dialer outcomes and follow-ups tables for PI1-APP-2 (always run)
  try {
    // Create dial_outcomes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS dial_outcomes (
        id TEXT PRIMARY KEY,
        dial_id TEXT,
        lead_id TEXT,
        type TEXT CHECK (type IN ('no_answer', 'voicemail', 'bad_number', 'interested', 'not_interested', 'follow_up')),
        notes TEXT,
        grade_label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for dial_outcomes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dial_outcomes_lead_id ON dial_outcomes(lead_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dial_outcomes_dial_id ON dial_outcomes(dial_id)`);  
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dial_outcomes_type_created ON dial_outcomes(type, created_at)`);
    
    // Create follow_ups table
    db.exec(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        lead_id TEXT,
        due_at DATETIME,
        status TEXT CHECK (status IN ('open', 'done', 'snoozed', 'canceled')) DEFAULT 'open',
        channel TEXT CHECK (channel IN ('call', 'sms', 'email', 'task')),
        priority TEXT CHECK (priority IN ('low', 'med', 'high')) DEFAULT 'med',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for follow_ups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_followups_lead_id ON follow_ups(lead_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_followups_status_due ON follow_ups(status, due_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_followups_due_at ON follow_ups(due_at)`);
    
    // Create timeline_events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        lead_id TEXT,
        kind TEXT CHECK (kind IN ('created', 'skiptrace', 'dial', 'disposition', 'followup_created', 'followup_done', 'note')),
        payload_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for timeline_events
    db.exec(`CREATE INDEX IF NOT EXISTS idx_timeline_events_lead_created ON timeline_events(lead_id, created_at)`);
    
    // Create index for PI2 stage column
    db.exec(`CREATE INDEX IF NOT EXISTS idx_leads_stage_updated ON leads(stage, updated_at)`);
    
    console.log('✅ Created dialer outcomes and follow-ups schema');
  } catch (e) {
    console.warn('⚠️ Could not create dialer schema:', e.message);
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
  // Multer for CSV uploads (memory storage, 10MB limit)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      try {
        console.log('[ImportCSV] fileFilter:', { mimetype: file?.mimetype, name: file?.originalname });
      } catch {}
      const ok = file.mimetype === 'text/csv' || (file.originalname || '').toLowerCase().endsWith('.csv');
      if (!ok) return cb(new Error('unsupported_content_type'));
      cb(null, true);
    }
  });

  // Optional basic auth for /metrics and /admin, gated by env
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASS;
  function basicAuth(req, res, next) {
    if (!basicAuthUser || !basicAuthPass) return next();
    const hdr = req.headers['authorization'] || '';
    const ok = hdr.startsWith('Basic ')
      && Buffer.from(hdr.slice(6), 'base64').toString() === `${basicAuthUser}:${basicAuthPass}`;
    if (!ok) {
      res.set('WWW-Authenticate', 'Basic realm="convexa"');
      return res.status(401).send('Unauthorized');
    }
    next();
  }
  // Gate only if creds provided
  app.use('/metrics', basicAuth);
  app.use('/admin', basicAuth);

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

  // Compatibility alias: GET /api/search (same behavior as /api/zip-search-new/search)
  app.get('/api/search', (req, res) => {
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

      if (query) {
        whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
        params.push(`%${query}%`, `%${query}%`);
      }
      if (city) { whereClauses.push('address LIKE ?'); params.push(`%${city}%`); }
      if (state) { whereClauses.push('address LIKE ?'); params.push(`%${state}%`); }
      if (zipCode) { whereClauses.push('address LIKE ?'); params.push(`%${zipCode}%`); }
      if (propertyType) { whereClauses.push('source_type = ?'); params.push(propertyType); }
      if (source) { whereClauses.push('source_type = ?'); params.push(source); }
      if (temperature) { whereClauses.push('temperature_tag = ?'); params.push(temperature); }
      if (minValue || maxValue) {
        if (minValue) { whereClauses.push('estimated_value >= ?'); params.push(parseFloat(minValue)); }
        if (maxValue) { whereClauses.push('estimated_value <= ?'); params.push(parseFloat(maxValue)); }
      }

      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
      let countSql = 'SELECT COUNT(*) as total FROM leads';
      if (whereClauses.length > 0) {
        countSql += ' WHERE ' + whereClauses.join(' AND ');
      }
      const totalCount = db.prepare(countSql).get(...params).total;

      sql += ' ORDER BY created_at DESC';
      const skip = (parseInt(page) - 1) * parseInt(limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), skip);

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
        updatedAt: new Date(lead.updated_at).toISOString()
      }));
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
      console.error('Error in compatibility search endpoint:', error);
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

  // Compatibility alias: POST /api/leads (same behavior as /api/zip-search-new/add-lead)
  app.post('/api/leads', validateBody(LeadCreateZ), (req, res) => {
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

      const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const now = new Date().toISOString();

      const existingLead = db.prepare('SELECT id FROM leads WHERE address = ?').get(address);
      if (existingLead) {
        return res.status(400).json({ 
          success: false, 
          message: 'A lead with this address already exists',
          existingId: existingLead.id 
        });
      }

      let tableCols = [];
      try { tableCols = db.prepare('PRAGMA table_info(leads)').all(); } catch (_) { tableCols = []; }
      const colSet = new Set(Array.isArray(tableCols) ? tableCols.map(c => c.name) : []);

      const safeMotivation = (typeof motivation_score === 'number' && !Number.isNaN(motivation_score)) ? motivation_score : 50;
      const safeTemperature = temperature_tag || getTemperatureTag(safeMotivation);
      const safeCondition = (typeof condition_score === 'number' && !Number.isNaN(condition_score)) ? condition_score : 50;

      const fieldMap = {
        id: uuid,
        address,
        owner_name: owner_name || null,
        phone: phone || null,
        email: email || null,
        estimated_value: (typeof estimated_value === 'number' && !Number.isNaN(estimated_value)) ? estimated_value : null,
        equity: (typeof equity === 'number' && !Number.isNaN(equity)) ? equity : null,
        motivation_score: safeMotivation,
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

      if (!colSet.has('temperature_tag')) delete fieldMap.temperature_tag;

      const columns = [];
      const values = [];
      for (const [col, val] of Object.entries(fieldMap)) {
        if (colSet.has(col)) { columns.push(col); values.push(val); }
      }

      if (columns.length === 0) {
        return res.status(500).json({ success: false, message: 'Leads table has no recognized columns' });
      }

      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO leads (${columns.join(', ')}) VALUES (${placeholders})`;
      db.prepare(insertSql).run(...values);

      res.json({ success: true, message: 'Lead created successfully', leadId: uuid });
    } catch (error) {
      console.error('Error creating lead (alias):', error);
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

  // Resolve storage root (persistent if LOCAL_STORAGE_PATH provided)
  const STORAGE_ROOT = process.env.LOCAL_STORAGE_PATH
    ? path.resolve(process.env.LOCAL_STORAGE_PATH)
    : path.resolve(__dirname, '..');

  // Append-only audit log for mutating actions (JSONL under artifacts/audit)
  const auditDir = path.resolve(STORAGE_ROOT, 'artifacts', 'audit');
  try { fs.mkdirSync(auditDir, { recursive: true }); } catch {}
  function auditMut(req, payloadBuf) {
    try {
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        user: (basicAuthUser && basicAuthPass) ? 'basic-auth' : 'unknown',
        route: req.originalUrl,
        verb: req.method,
        payloadHash: payloadBuf ? crypto.createHash('sha256').update(payloadBuf).digest('hex') : null
      }) + '\n';
      fs.appendFileSync(path.join(auditDir, 'actions.jsonl'), line);
    } catch {}
  }

  // === Dialer v1 — Vertical slice (minimal, stub-friendly) ===
  // Metrics (will be initialized if prom-client is present)
  let dialAttemptsCounter = null;
  let asrLatencyHist = null;
  let webhookErrorsCounter = null;
  let dialDispositionCounter = null;

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
  const baseDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer');
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
          const computed = Buffer.from(crypto.createHmac('sha1', token).update(toSign).digest('base64'));
          const provided = Buffer.from(String(sig));
          const ok = computed.length === provided.length && crypto.timingSafeEqual(computed, provided);
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
  const baseDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'recordings');
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
  const baseDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'transcripts');
      fs.mkdirSync(baseDir, { recursive: true });
      fs.writeFileSync(path.join(baseDir, `${dialId}.json`), JSON.stringify({ dialId, transcriptUrl, words, latencyMs, at: new Date().toISOString() }, null, 2));
      // Observe latency metric (seconds)
      try { if (asrLatencyHist && typeof latencyMs === 'number') asrLatencyHist.observe(latencyMs / 1000); } catch {}
      return res.json({ success: true });
    } catch (e) {
      return sendProblem(res, 'asr_store_error', String(e?.message || e), undefined, 500);
    }
  });

  // POST /dial/:dialId/notes — append free-text note
  const DialNoteZ = z.object({ text: z.string().min(1) });
  app.post('/dial/:dialId/notes', (req, res) => {
    try {
      const parsed = DialNoteZ.safeParse(req.body || {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid payload', field, 400);
      }
      const { dialId } = req.params;
      const { text } = parsed.data;
      const notesDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'notes');
      fs.mkdirSync(notesDir, { recursive: true });
      const line = `- [${new Date().toISOString()}] ${text}\n`;
      fs.appendFileSync(path.join(notesDir, `${dialId}.md`), line);
      return res.json({ success: true });
    } catch (e) {
      return sendProblem(res, 'dial_note_error', String(e?.message || e), undefined, 500);
    }
  });

  // POST /dial/:dialId/disposition — record disposition and emit metric
  const DispositionZ = z.object({
    type: z.enum(['no_answer','voicemail','bad_number','interested','not_interested','follow_up']),
    notes: z.string().optional()
  });
  app.post('/dial/:dialId/disposition', (req, res) => {
    try {
      const parsed = DispositionZ.safeParse(req.body || {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid payload', field, 400);
      }
      const { dialId } = req.params;
      const { type, notes } = parsed.data;
      // persist
      const dispDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'dispositions');
      fs.mkdirSync(dispDir, { recursive: true });
      const rec = { dialId, type, notes: notes || null, at: new Date().toISOString() };
      fs.writeFileSync(path.join(dispDir, `${dialId}.json`), JSON.stringify(rec, null, 2));
      // metric
      try { dialDispositionCounter && dialDispositionCounter.inc({ type }); } catch {}
      return res.json({ success: true });
    } catch (e) {
      return sendProblem(res, 'dial_disposition_error', String(e?.message || e), undefined, 500);
    }
  });

  // === PI2 AI Call Summary v0 ===
  
  // Helper function for local heuristic call summarization
  const summarizeCallHeuristic = (transcript) => {
    if (!transcript || typeof transcript !== 'string') {
      return {
        summary: 'No transcript available',
        key_points: [],
        sentiment: 'neutral',
        length_secs: null
      };
    }
    
    const text = transcript.toLowerCase();
    const words = text.split(/\s+/);
    const summary_points = [];
    const key_points = [];
    
    // Interest indicators
    const interestKeywords = ['interested', 'tell me more', 'sounds good', 'when can', 'how much', 'that works'];
    const objectionKeywords = ['not interested', 'no thanks', 'busy', 'call back later', 'remove from list'];
    const timingKeywords = ['soon', 'next week', 'next month', 'few months', 'thinking about'];
    const amountKeywords = ['thousand', '$', 'price', 'offer', 'cash', 'million'];
    
    // Analyze sentiment
    let sentiment = 'neutral';
    let interestScore = 0;
    let objectionScore = 0;
    
    interestKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        interestScore++;
        key_points.push(`Interest: mentioned "${keyword}"`);
      }
    });
    
    objectionKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        objectionScore++;
        key_points.push(`Objection: said "${keyword}"`);
      }
    });
    
    if (interestScore > objectionScore) {
      sentiment = 'positive';
    } else if (objectionScore > interestScore) {
      sentiment = 'negative';
    }
    
    // Look for timing indicators
    timingKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        key_points.push(`Timing: mentioned "${keyword}"`);
      }
    });
    
    // Look for amounts
    const amountMatches = text.match(/\$[\d,]+|\d+\s*thousand|\d+\s*million/g);
    if (amountMatches) {
      key_points.push(`Amounts discussed: ${amountMatches.join(', ')}`);
    }
    
    // Callback requests
    if (text.includes('call back') || text.includes('call me back')) {
      key_points.push('Callback requested');
    }
    
    // Generate summary based on findings
    let summary = 'Call completed';
    if (sentiment === 'positive') {
      summary = 'Positive conversation - property owner showed interest';
    } else if (sentiment === 'negative') {
      summary = 'Owner not interested at this time';
    } else if (key_points.length > 0) {
      summary = 'Mixed response - some interest indicators found';
    }
    
    // Estimate call length (rough heuristic: ~150 words per minute)
    const estimatedSeconds = Math.round((words.length / 150) * 60);
    
    return {
      summary,
      key_points: key_points.slice(0, 10), // Limit to top 10 points
      sentiment,
      length_secs: estimatedSeconds > 5 ? estimatedSeconds : null
    };
  };
  
  // POST /dial/:dialId/summarize - Generate call summary (admin-gated)
  app.post('/dial/:dialId/summarize', requireAdmin, async (req, res) => {
    try {
      const { dialId } = req.params;
      
      // Read transcript from artifacts
      const transcriptDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'transcripts');
      const transcriptPath = path.join(transcriptDir, `${dialId}.json`);
      
      let transcript = null;
      let reason = 'ok';
      
      if (!fs.existsSync(transcriptPath)) {
        reason = 'no_transcript';
      } else {
        try {
          const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
          transcript = transcriptData.transcript || transcriptData.text || null;
        } catch (e) {
          console.warn('[Call Summary] Failed to parse transcript:', e?.message);
          reason = 'error';
        }
      }
      
      // Generate summary using local heuristic
      let summaryData;
      try {
        summaryData = summarizeCallHeuristic(transcript);
      } catch (e) {
        console.error('[Call Summary] Heuristic failed:', e);
        reason = 'error';
        summaryData = {
          summary: 'Summary generation failed',
          key_points: [],
          sentiment: 'neutral',
          length_secs: null
        };
      }
      
      // Add metadata
      summaryData.dial_id = dialId;
      summaryData.generated_at = new Date().toISOString();
      summaryData.method = 'local_heuristic';
      
      // Write summary to artifacts
      const summaryDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'summaries');
      fs.mkdirSync(summaryDir, { recursive: true });
      const summaryPath = path.join(summaryDir, `${dialId}.json`);
      
      fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
      
      // Generate signed URL for summary
      const relPath = path.relative(STORAGE_ROOT, summaryPath);
      const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
      const sig = signUtil(relPath, exp, process.env.SIGNED_URL_SECRET || 'dev-secret');
      const summaryUrl = `/admin/artifact-download?path=${encodeURIComponent(relPath)}&exp=${exp}&sig=${sig}`;
      
      // Track metrics
      if (callSummaryCounter) {
        callSummaryCounter.inc({ reason });
      }
      
      res.json({
        ok: true,
        summary: summaryData,
        summaryUrl,
        transcript_available: !!transcript,
        method: 'local_heuristic'
      });
      
    } catch (e) {
      console.error('[Call Summary] Error:', e);
      if (callSummaryCounter) {
        callSummaryCounter.inc({ reason: 'error' });
      }
      return sendProblem(res, 'call_summary_error', String(e?.message || e), undefined, 500);
    }
  });

  // === Artifacts listing & signed download ===
  const ARTIFACT_ROOT = path.resolve(STORAGE_ROOT, 'run_reports');
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
        const exp = Math.floor(Date.now() / 1000) + defaultTtl;
        const relReport = `${runId}/report.json`;
        const relAudit = `${runId}/audit.json`;
        const sigRep = signUtil(relReport, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret');
        const signedUrl = fs.existsSync(path.join(ARTIFACT_ROOT, relReport))
          ? `/admin/artifact-download?path=${encodeURIComponent(relReport)}&exp=${exp}&sig=${sigRep}`
          : null; // back-compat field
        const reportUrl = signedUrl;
        const relCsv = `${runId}/enriched.csv`;
        const csvAbs = path.join(ARTIFACT_ROOT, relCsv);
        const csvUrl = fs.existsSync(csvAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relCsv)}&exp=${exp}&sig=${signUtil(relCsv, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        const auditAbs = path.join(ARTIFACT_ROOT, relAudit);
        const auditUrl = fs.existsSync(auditAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relAudit)}&exp=${exp}&sig=${signUtil(relAudit, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        const relZip = `${runId}/${runId}.zip`;
        const zipAbs = path.join(ARTIFACT_ROOT, relZip);
        const zipUrl = fs.existsSync(zipAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relZip)}&exp=${exp}&sig=${signUtil(relZip, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        // Type inference: mark item type based on files present
        let type = 'run';
        if (!fs.existsSync(path.join(ARTIFACT_ROOT, relReport)) && fs.existsSync(auditAbs)) type = 'import_audit';
        if (zipUrl || String(runId).startsWith('weekly_export_')) type = 'weekly_export';
        return { runId, type, createdAt: createdAt ? new Date(createdAt).toISOString() : null, size, signedUrl, reportUrl, csvUrl, auditUrl, zipUrl };
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
  
  // === START RUN ENDPOINT (seed + optional async processor) ===
  const StartRunZ = z.object({
    leadIds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(1000).optional().default(20),
    label: z.string().min(1).optional().default('qa-resume-smoke'),
    softPauseAt: z.number().int().min(1).optional().default(5),
    demo: z.boolean().optional(),
    seedOnly: z.boolean().optional().default(false)
  });

  function ensureRunTables(dbx) {
    try {
      dbx.exec(`CREATE TABLE IF NOT EXISTS skiptrace_runs (
        run_id TEXT PRIMARY KEY,
        source_label TEXT,
        started_at DATETIME,
        finished_at DATETIME,
        total INTEGER DEFAULT 0,
        queued INTEGER DEFAULT 0,
        in_flight INTEGER DEFAULT 0,
        done INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        soft_paused INTEGER DEFAULT 0
      );`);
    } catch (_) {}
    try {
      dbx.exec(`CREATE TABLE IF NOT EXISTS skiptrace_run_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER DEFAULT 0,
        idem_key TEXT,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
      );`);
    } catch (_) {}
    try {
      const cols = dbx.prepare('PRAGMA table_info(skiptrace_run_items)').all().map(c => c.name);
      if (!cols.includes('updated_at')) {
        dbx.exec('ALTER TABLE skiptrace_run_items ADD COLUMN updated_at DATETIME');
      }
    } catch (_) {}
  }

  // Helper to write enriched.csv under ARTIFACT_ROOT
  function writeEnrichedCsv(runId) {
    try {
      const dir = path.resolve(ARTIFACT_ROOT, runId);
      fs.mkdirSync(dir, { recursive: true });
      const csvPath = path.join(dir, 'enriched.csv');
      const out = [];
      out.push(['LeadID','Address','Owner','Phone1','Phone2','Phone3','Email1','Email2','Email3','PhonesCount','EmailsCount','HasDNC','Provider','Cached'].join(','));
      // Determine identifier column available for join
      let sriCols = [];
      try { sriCols = db.prepare('PRAGMA table_info(skiptrace_run_items)').all(); } catch (_) { sriCols = []; }
      const colsSet = new Set(Array.isArray(sriCols) ? sriCols.map(c => c.name) : []);
      const sriLeadCol = colsSet.has('lead_id') ? 'lead_id' : (colsSet.has('item_id') ? 'item_id' : (colsSet.has('leadId') ? 'leadId' : null));
      let rows = [];
      if (sriLeadCol) {
        const sql = `SELECT l.id as lead_id, l.address, l.owner_name FROM leads l WHERE l.id IN (SELECT ${sriLeadCol} FROM skiptrace_run_items WHERE run_id = ?)`;
        try { rows = db.prepare(sql).all(runId); } catch(_) { rows = []; }
      }
      // Helpers to check optional columns
      let leadsCols = [];
      try { leadsCols = db.prepare('PRAGMA table_info(leads)').all(); } catch(_) { leadsCols = []; }
      const leadsHas = (c) => Array.isArray(leadsCols) && leadsCols.some(x => x.name === c);
      // Prepare phone/email queries
      const hasTable = (name) => { try { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name); } catch(_) { return false; } };
      const pnTable = hasTable('phone_numbers');
      let pnCols = [];
      if (pnTable) { try { pnCols = db.prepare('PRAGMA table_info(phone_numbers)').all(); } catch(_) { pnCols = []; } }
      const pnLeadCol = pnCols.some(c => c.name === 'lead_id') ? 'lead_id' : (pnCols.some(c => c.name === 'leadId') ? 'leadId' : null);
      const pnNumCol = pnCols.some(c => c.name === 'phone_number') ? 'phone_number' : (pnCols.some(c => c.name === 'phone') ? 'phone' : null);
      const qPhones = pnTable && pnLeadCol && pnNumCol ? db.prepare(`SELECT ${pnNumCol} as phone_number FROM phone_numbers WHERE ${pnLeadCol} = ? ORDER BY is_primary DESC, confidence DESC LIMIT 3`) : null;
      const emTable = hasTable('email_addresses');
      let emCols = [];
      if (emTable) { try { emCols = db.prepare('PRAGMA table_info(email_addresses)').all(); } catch(_) { emCols = []; } }
      const emLeadCol = emCols.some(c => c.name === 'lead_id') ? 'lead_id' : (emCols.some(c => c.name === 'leadId') ? 'leadId' : null);
      const emAddrCol = emCols.some(c => c.name === 'email_address') ? 'email_address' : (emCols.some(c => c.name === 'email') ? 'email' : null);
      const qEmails = emTable && emLeadCol && emAddrCol ? db.prepare(`SELECT ${emAddrCol} as email_address FROM email_addresses WHERE ${emLeadCol} = ? ORDER BY is_primary DESC, confidence DESC LIMIT 3`) : null;
      // Determine provider/cached from skip_trace_logs
      let stlCols = [];
      try { stlCols = db.prepare('PRAGMA table_info(skip_trace_logs)').all(); } catch(_) { stlCols = []; }
      const stlHas = (c) => Array.isArray(stlCols) && stlCols.some(x => x.name === c);
      const stlLeadCol = stlCols.some(c => c.name === 'lead_id') ? 'lead_id' : (stlCols.some(c => c.name === 'leadId') ? 'leadId' : null);
      const qProv = stlLeadCol ? (stlHas('cached')
        ? db.prepare(`SELECT provider, cached FROM skip_trace_logs WHERE ${stlLeadCol} = ? ORDER BY id DESC LIMIT 1`)
        : db.prepare(`SELECT provider FROM skip_trace_logs WHERE ${stlLeadCol} = ? ORDER BY id DESC LIMIT 1`)) : null;
      for (const r of rows) {
        const phones = qPhones ? qPhones.all(r.lead_id).map(row => row.phone_number) : [];
        const emails = qEmails ? qEmails.all(r.lead_id).map(row => row.email_address) : [];
        const provRow = qProv ? (qProv.get(r.lead_id) || {}) : {};
        const prov = { provider: provRow.provider || '', cached: stlHas('cached') ? (provRow.cached ? 1 : 0) : 0 };
        const phonesCount = leadsHas('phones_count') ? (db.prepare('SELECT phones_count as c FROM leads WHERE id = ?').get(r.lead_id)?.c || phones.length) : phones.length;
        const emailsCount = leadsHas('emails_count') ? (db.prepare('SELECT emails_count as c FROM leads WHERE id = ?').get(r.lead_id)?.c || emails.length) : emails.length;
        const hasDnc = leadsHas('has_dnc') ? (db.prepare('SELECT has_dnc as d FROM leads WHERE id = ?').get(r.lead_id)?.d || 0) : 0;
        out.push([
          r.lead_id,
          r.address || '',
          r.owner_name || '',
          phones[0] || '', phones[1] || '', phones[2] || '',
          emails[0] || '', emails[1] || '', emails[2] || '',
          phonesCount || 0,
          emailsCount || 0,
          hasDnc || 0,
          prov.provider || '',
          prov.cached ? 1 : 0
        ].join(','));
      }
      fs.writeFileSync(csvPath, out.join('\n'));
    } catch (e) {
      console.warn('writeEnrichedCsv failed:', e?.message || e);
    }
  }

  app.post('/api/skiptrace-runs/start', async (req, res) => {
    try {
      const parsed = StartRunZ.safeParse(req.body || {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid request body', field, 400);
      }
      const { leadIds, limit, label, softPauseAt, demo, seedOnly } = parsed.data;

      ensureRunTables(db);

      const runId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
      const nowIso = new Date().toISOString();

      // Resolve the lead set
      let ids = Array.isArray(leadIds) && leadIds.length > 0 ? leadIds.slice(0, limit || 20) : [];
      if (ids.length === 0) {
        try {
          const rows = db.prepare('SELECT id FROM leads ORDER BY created_at DESC LIMIT ?').all(limit || 20);
          ids = rows.map(r => r.id);
        } catch (_) { ids = []; }
      }

      // Insert run row (schema tolerant)
      let runCols = [];
      try { runCols = db.prepare('PRAGMA table_info(skiptrace_runs)').all(); } catch(_) { runCols = []; }
      const runHas = (c) => Array.isArray(runCols) && runCols.some(x => x.name === c);
      const runMap = { run_id: runId, source_label: label, started_at: nowIso, total: ids.length, queued: ids.length, soft_paused: 0 };
      const rCols = []; const rVals = [];
      for (const [k,v] of Object.entries(runMap)) { if (runHas(k)) { rCols.push(k); rVals.push(v); } }
      if (rCols.length === 0) return res.status(500).json({ success: false, error: 'skiptrace_runs has no expected columns' });
      const rSql = `INSERT INTO skiptrace_runs (${rCols.join(',')}) VALUES (${rCols.map(()=>'?').join(',')})`;
      db.prepare(rSql).run(...rVals);

      // Insert items
      let sriCols = [];
      try { sriCols = db.prepare('PRAGMA table_info(skiptrace_run_items)').all(); } catch(_) { sriCols = []; }
      const sriHas = (c) => Array.isArray(sriCols) && sriCols.some(x => x.name === c);
      const itemCols = ['run_id','lead_id','status'];
      if (sriHas('attempt')) itemCols.push('attempt');
      if (sriHas('idem_key')) itemCols.push('idem_key');
      if (sriHas('last_error')) itemCols.push('last_error');
      const iSql = `INSERT INTO skiptrace_run_items (${itemCols.join(',')}) VALUES (${itemCols.map(()=>'?').join(',')})`;
      const insItem = db.prepare(iSql);
      let countSeeded = 0;
      for (const id of ids) {
        const vals = [runId, id, 'queued'];
        if (sriHas('attempt')) vals.push(0);
        if (sriHas('idem_key')) vals.push('');
        if (sriHas('last_error')) vals.push(null);
        try { insItem.run(...vals); countSeeded++; } catch(_) {}
      }

      const demoMode = typeof demo === 'boolean' ? demo : (String(process.env.SKIP_TRACE_DEMO_MODE || 'true').toLowerCase() === 'true');

      if (!seedOnly) {
        (async () => {
          try {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            for (;;) {
              // pause gate
              try {
                const paused = db.prepare('SELECT soft_paused AS s FROM skiptrace_runs WHERE run_id = ?').get(runId);
                if (paused && paused.s) { await sleep(2000); continue; }
              } catch (_) {}
              const item = db.prepare(`SELECT lead_id FROM skiptrace_run_items WHERE run_id = ? AND status IN ('queued','in_flight') ORDER BY id ASC LIMIT 1`).get(runId);
              if (!item) break;
              const leadId = item.lead_id;
              const now = new Date().toISOString();
              try {
                const sets = ["status='in_flight'"]; const vals = [];
                if (sriHas('attempt')) sets.push('attempt=attempt+1');
                if (sriHas('updated_at')) { sets.push('updated_at=?'); vals.push(now); }
                const upSql = `UPDATE skiptrace_run_items SET ${sets.join(', ')} WHERE run_id=? AND lead_id=?`;
                vals.push(runId, leadId);
                db.prepare(upSql).run(...vals);
              } catch (_) {}
              let success = false; let errMsg = null;
              try {
                const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
                if (!lead) throw new Error('Lead not found');
                if (demoMode) {
                  const r = skipTraceService.generateDemoResult(leadId, lead);
                  skipTraceService.saveResult(r, false, 'demo');
                  success = true;
                } else {
                  const r = await skipTraceService.skipTraceLeadById(leadId, { forceRefresh: false, useFallback: false, maxRetries: 0, runId });
                  success = !!(r && r.success);
                  if (!success) errMsg = r && (r.error || r.message) || 'unknown';
                }
              } catch (e) {
                success = false; errMsg = e?.message || String(e);
              }
              try {
                if (success) {
                  const sets = ["status='done'"]; const vals = [];
                  if (sriHas('last_error')) { sets.push('last_error=NULL'); }
                  if (sriHas('updated_at')) { sets.push('updated_at=?'); vals.push(new Date().toISOString()); }
                  const sqlD = `UPDATE skiptrace_run_items SET ${sets.join(', ')} WHERE run_id=? AND lead_id=?`;
                  vals.push(runId, leadId);
                  db.prepare(sqlD).run(...vals);
                  try {
                    const runSets = [];
                    if (runHas('done')) runSets.push('done=COALESCE(done,0)+1');
                    if (runHas('queued')) runSets.push('queued=MAX(COALESCE(queued,0)-1,0)');
                    if (runSets.length) db.prepare(`UPDATE skiptrace_runs SET ${runSets.join(', ')} WHERE run_id=?`).run(runId);
                  } catch(_) {}
                } else {
                  const sets = ["status='failed'"]; const vals = [];
                  if (sriHas('last_error')) { sets.push('last_error=?'); vals.push(errMsg || 'unknown'); }
                  if (sriHas('updated_at')) { sets.push('updated_at=?'); vals.push(new Date().toISOString()); }
                  const sqlF = `UPDATE skiptrace_run_items SET ${sets.join(', ')} WHERE run_id=? AND lead_id=?`;
                  vals.push(runId, leadId);
                  db.prepare(sqlF).run(...vals);
                  try {
                    const runSets = [];
                    if (runHas('failed')) runSets.push('failed=COALESCE(failed,0)+1');
                    if (runHas('queued')) runSets.push('queued=MAX(COALESCE(queued,0)-1,0)');
                    if (runSets.length) db.prepare(`UPDATE skiptrace_runs SET ${runSets.join(', ')} WHERE run_id=?`).run(runId);
                  } catch(_) {}
                }
              } catch (_) {}

              // Soft pause at threshold
              try {
                const r = db.prepare('SELECT COALESCE(done,0) AS d, COALESCE(failed,0) AS f FROM skiptrace_runs WHERE run_id=?').get(runId) || { d:0,f:0 };
                const processed = (r.d || 0) + (r.f || 0);
                if (processed === softPauseAt) {
                  try { db.prepare('UPDATE skiptrace_runs SET soft_paused=1 WHERE run_id=?').run(runId); } catch(_) {}
                  for (;;) {
                    const paused2 = db.prepare('SELECT soft_paused AS s FROM skiptrace_runs WHERE run_id = ?').get(runId);
                    if (!paused2 || !paused2.s) break;
                    await (new Promise(r => setTimeout(r, 3000)));
                  }
                }
              } catch (_) {}
            }
            try {
              const sets = [];
              if (runHas('queued')) sets.push('queued=0');
              if (runHas('finished_at')) sets.push("finished_at=datetime('now')");
              if (sets.length) db.prepare(`UPDATE skiptrace_runs SET ${sets.join(', ')} WHERE run_id=?`).run(runId);
            } catch (_) {}
            // Generate artifacts under STORAGE_ROOT
            try {
              const rep = generateRunReport(db, runId);
              const dir = path.resolve(ARTIFACT_ROOT, runId);
              fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(rep, null, 2));
            } catch (e) { console.warn('report generation failed:', e?.message || e); }
            try { writeEnrichedCsv(runId); } catch (_) {}
          } catch (e) {
            console.warn('run processor error:', e?.message || e);
          }
        })();
      }

      return res.json({ success: true, run_id: runId, countSeeded });
    } catch (e) {
      return sendProblem(res, 'run_start_error', String(e?.message || e), undefined, 500);
    }
  });
  
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
      // Dispositions metric
      try {
        dialDispositionCounter = new promClient.Counter({ name: 'dial_disposition_total', help: 'Dial dispositions', labelNames: ['type'] });
      } catch {}
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

  // === Campaign Property Search v0 ===
  // Metrics for campaign queries
  let campaignQueriesCounter = null;
  
  // === Lead Grading v1 ===
  // Metrics for lead grading computations
  let gradeComputationsCounter = null;
  
  // === Dialer Outcomes & Follow-ups ===
  // Metrics for dialer outcomes and follow-ups
  let dialDispositionTotalCounter = null;
  let followupsCreatedCounter = null;
  let followupsCompletedCounter = null;
  let followupsDueGauge = null;
  let followupsOverdueGauge = null;
  let timelineEventsCounter = null;
  
  // PI2 metrics
  let campaignResultsCounter = null;
  let leadGradeCalibrationCounter = null;
  let stageTransitionsCounter = null;
  let leadsByStageGauge = null;
  let callSummaryCounter = null;
  let exportBundlesCounter = null;
  if (promClient) {
    try {
      campaignQueriesCounter = new promClient.Counter({
        name: 'campaign_queries_total',
        help: 'Total campaign search queries',
        labelNames: ['type']
      });
      
      // Grading metrics for Lead Grading v1
      gradeComputationsCounter = new promClient.Counter({
        name: 'lead_grade_computations_total',
        help: 'Total lead grade computations',
        labelNames: ['type']
      });
      
      // Dialer outcomes & follow-ups metrics
      dialDispositionTotalCounter = new promClient.Counter({
        name: 'dialer_disposition_total',
        help: 'Total dial dispositions with grade labels',
        labelNames: ['type', 'grade_label']
      });
      
      followupsCreatedCounter = new promClient.Counter({
        name: 'followups_created_total',
        help: 'Total follow-ups created',
        labelNames: ['channel', 'priority']
      });
      
      followupsCompletedCounter = new promClient.Counter({
        name: 'followups_completed_total',
        help: 'Total follow-ups completed',
        labelNames: ['status']
      });
      
      followupsDueGauge = new promClient.Gauge({
        name: 'followups_due_gauge',
        help: 'Count of open follow-ups due now'
      });
      
      followupsOverdueGauge = new promClient.Gauge({
        name: 'followups_overdue_gauge',
        help: 'Count of open follow-ups overdue'
      });
      
      timelineEventsCounter = new promClient.Counter({
        name: 'timeline_events_total',
        help: 'Total timeline events created',
        labelNames: ['kind']
      });
      
      // PI2 Additional metrics
      campaignResultsCounter = new promClient.Counter({
        name: 'campaign_results_total',
        help: 'Total campaign search results returned',
        labelNames: ['type']
      });
      
      leadGradeCalibrationCounter = new promClient.Counter({
        name: 'lead_grade_calibration_runs_total',
        help: 'Lead grade calibration runs',
        labelNames: ['mode']
      });
      
      stageTransitionsCounter = new promClient.Counter({
        name: 'stage_transitions_total',
        help: 'Lead stage transitions',
        labelNames: ['from', 'to']
      });
      
      leadsByStageGauge = new promClient.Gauge({
        name: 'leads_by_stage_gauge',
        help: 'Count of leads by stage',
        labelNames: ['stage']
      });
      
      callSummaryCounter = new promClient.Counter({
        name: 'call_summary_generated_total',
        help: 'Call summaries generated',
        labelNames: ['reason']
      });
      
      exportBundlesCounter = new promClient.Counter({
        name: 'export_bundles_total',
        help: 'Export bundles created',
        labelNames: ['kind']
      });
    } catch (e) {
      console.warn('Campaign metrics init error:', e?.message || e);
    }
  }

  // API endpoint for campaign property search
  app.get('/api/campaigns/search', (req, res) => {
    try {
      const type = String(req.query.type || '').toLowerCase().trim();
      const city = String(req.query.city || '').trim();
      const state = String(req.query.state || '').trim();
      const zip = String(req.query.zip || '').trim();
      const minValue = req.query.minValue ? Number(req.query.minValue) : null;
      const maxValue = req.query.maxValue ? Number(req.query.maxValue) : null;
      const status = String(req.query.status || '').trim();
      const temperature = String(req.query.temperature || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));

      // Increment campaign query metrics
      try {
        if (campaignQueriesCounter && type) {
          campaignQueriesCounter.inc({ type: type || 'unknown' });
        }
      } catch (e) {}

      let sql = 'SELECT * FROM leads';
      const params = [];
      const where = [];
      const criteria_used = [];

      // Type-based heuristics (zero external spend)
      if (type) {
        switch (type) {
          case 'distressed':
            // Heuristic: motivation_score >= 70 OR temperature_tag in ('hot','warm')
            where.push("(motivation_score >= 70 OR temperature_tag IN ('hot', 'warm'))");
            criteria_used.push('high motivation or hot/warm temperature');
            break;
          case 'divorce':
            // Heuristic: look for certain keywords in notes or owner_name patterns
            where.push("(notes LIKE '%divorce%' OR notes LIKE '%separation%' OR owner_name LIKE '%/%' OR owner_name LIKE '%and%')");
            criteria_used.push('divorce indicators in notes or joint ownership');
            break;
          case 'preforeclosure':
            // Heuristic: high condition issues or tax problems
            where.push("(condition_score <= 30 OR notes LIKE '%tax%' OR notes LIKE '%foreclosure%')");
            criteria_used.push('poor condition or tax/foreclosure notes');
            break;
          case 'inheritance':
            // Heuristic: probate flag or inheritance indicators
            where.push("(is_probate = 1 OR notes LIKE '%inherit%' OR notes LIKE '%estate%' OR notes LIKE '%deceased%')");
            criteria_used.push('probate flag or inheritance indicators');
            break;
          case 'vacant':
            where.push('is_vacant = 1');
            criteria_used.push('vacant flag');
            break;
          case 'absentee':
            // Heuristic: owner mailing address different or out-of-area phone numbers
            where.push('(owner_name IS NOT NULL AND owner_name != "")');
            criteria_used.push('owner presence (absentee heuristic)');
            break;
          default:
            // Fallback to general filters without specific type criteria
            criteria_used.push(`type '${type}' not recognized - using general filters`);
        }
      }

      // Common filters
      if (city) {
        where.push('address LIKE ?');
        params.push(`%${city}%`);
        criteria_used.push(`city: ${city}`);
      }
      if (state) {
        where.push('address LIKE ?');
        params.push(`%${state}%`);
        criteria_used.push(`state: ${state}`);
      }
      if (zip) {
        where.push('address LIKE ?');
        params.push(`%${zip}%`);
        criteria_used.push(`zip: ${zip}`);
      }
      if (minValue !== null) {
        where.push('estimated_value >= ?');
        params.push(minValue);
        criteria_used.push(`min value: $${minValue.toLocaleString()}`);
      }
      if (maxValue !== null) {
        where.push('estimated_value <= ?');
        params.push(maxValue);
        criteria_used.push(`max value: $${maxValue.toLocaleString()}`);
      }
      if (status) {
        where.push('status = ?');
        params.push(status.toUpperCase());
        criteria_used.push(`status: ${status}`);
      }
      if (temperature) {
        where.push('temperature_tag = ?');
        params.push(temperature.toLowerCase());
        criteria_used.push(`temperature: ${temperature}`);
      }

      // Build final query
      if (where.length) {
        sql += ' WHERE ' + where.join(' AND ');
      }

      // Get total count
      const countSql = where.length ? 
        `SELECT COUNT(*) as total FROM leads WHERE ${where.join(' AND ')}` :
        'SELECT COUNT(*) as total FROM leads';
      const totalCount = db.prepare(countSql).get(...params).total;

      // Add pagination
      const offset = (page - 1) * limit;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // Execute query
      const leads = db.prepare(sql).all(...params);

      // Track campaign results metrics
      try {
        if (campaignResultsCounter && type) {
          campaignResultsCounter.inc({ type: type || 'unknown' }, leads.length);
        }
      } catch (e) {}

      // Calculate pagination
      const pages = Math.ceil(totalCount / limit);

      res.json({
        leads: leads.map(lead => ({
          id: lead.id,
          address: lead.address,
          owner_name: lead.owner_name,
          estimated_value: lead.estimated_value,
          equity: lead.equity,
          motivation_score: lead.motivation_score,
          temperature_tag: lead.temperature_tag,
          status: lead.status,
          is_probate: lead.is_probate,
          is_vacant: lead.is_vacant,
          created_at: lead.created_at,
          updated_at: lead.updated_at
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages
        },
        criteria_used
      });

    } catch (error) {
      console.error('Campaign search error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        type: 'problem+json'
      });
    }
  });

  // UI for campaign search
  app.get('/ops/campaigns', (req, res) => {
    try {
      const type = String(req.query.type || '').toLowerCase().trim();
      const city = String(req.query.city || '').trim();
      const state = String(req.query.state || '').trim();
      const zip = String(req.query.zip || '').trim();
      const minValue = req.query.minValue ? Number(req.query.minValue) : null;
      const maxValue = req.query.maxValue ? Number(req.query.maxValue) : null;
      const status = String(req.query.status || '').trim();
      const temperature = String(req.query.temperature || '').trim();
      
      // Use the same logic as the API endpoint
      let campaigns = [];
      let total = 0;
      let criteria_used = [];

      if (type || city || state || zip || status || temperature || minValue || maxValue) {
        // Build query similar to API endpoint
        let sql = 'SELECT * FROM leads';
        const params = [];
        const where = [];

        // Type-based filtering
        if (type) {
          switch (type) {
            case 'probate':
              where.push('is_probate = 1');
              criteria_used.push('probate');
              break;
            case 'vacant':
              where.push('is_vacant = 1');
              criteria_used.push('vacant');
              break;
            case 'absentee':
              where.push('(owner_name IS NOT NULL AND owner_name != "")');
              criteria_used.push('absentee heuristic');
              break;
            case 'high_equity':
              where.push('equity >= 0.35');
              criteria_used.push('high equity');
              break;
            case 'distressed':
              where.push("(motivation_score >= 70 OR temperature_tag IN ('hot', 'warm'))");
              criteria_used.push('distressed');
              break;
            default:
              criteria_used.push(`${type} (unsupported)`);
          }
        }

        // Common filters (same as API)
        if (city) { where.push('address LIKE ?'); params.push(`%${city}%`); criteria_used.push(`city: ${city}`); }
        if (state) { where.push('address LIKE ?'); params.push(`%${state}%`); criteria_used.push(`state: ${state}`); }
        if (zip) { where.push('address LIKE ?'); params.push(`%${zip}%`); criteria_used.push(`zip: ${zip}`); }
        if (minValue !== null) { where.push('estimated_value >= ?'); params.push(minValue); }
        if (maxValue !== null) { where.push('estimated_value <= ?'); params.push(maxValue); }
        if (status) { where.push('status = ?'); params.push(status.toUpperCase()); }
        if (temperature) { where.push('temperature_tag = ?'); params.push(temperature.toLowerCase()); }

        if (where.length) {
          sql += ' WHERE ' + where.join(' AND ');
          const countSql = `SELECT COUNT(*) as total FROM leads WHERE ${where.join(' AND ')}`;
          total = db.prepare(countSql).get(...params).total;
          
          sql += ' ORDER BY created_at DESC LIMIT 50';
          campaigns = db.prepare(sql).all(...params);
        }
      }

      // Generate HTML response
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Campaign Property Search</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .form-group { margin: 10px 0; }
    .form-group label { display: inline-block; width: 120px; }
    .form-group input, .form-group select { width: 200px; padding: 5px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .badge { padding: 2px 6px; border-radius: 3px; font-size: 12px; }
    .badge-hot { background: #ff4444; color: white; }
    .badge-warm { background: #ff8800; color: white; }
    .badge-cold { background: #4444ff; color: white; }
    .badge-dead { background: #999; color: white; }
    .status-new { color: #007acc; }
    .status-working { color: #ff8800; }
    .status-won { color: #00aa44; }
    .status-lost { color: #cc0000; }
    .criteria { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 4px solid #007acc; }
  </style>
</head>
<body>
  <h1>Campaign Property Search</h1>
  
  <form method="GET">
    <div class="form-group">
      <label>Campaign Type:</label>
      <select name="type">
        <option value="">-- Select Type --</option>
        <option value="probate" ${type === 'probate' ? 'selected' : ''}>Probate</option>
        <option value="vacant" ${type === 'vacant' ? 'selected' : ''}>Vacant</option>
        <option value="absentee" ${type === 'absentee' ? 'selected' : ''}>Absentee Owner</option>
        <option value="high_equity" ${type === 'high_equity' ? 'selected' : ''}>High Equity</option>
        <option value="distressed" ${type === 'distressed' ? 'selected' : ''}>Distressed</option>
        <option value="pre_foreclosure" ${type === 'pre_foreclosure' ? 'selected' : ''}>Pre-Foreclosure (No Data)</option>
        <option value="divorce" ${type === 'divorce' ? 'selected' : ''}>Divorce (No Data)</option>
        <option value="inheritance" ${type === 'inheritance' ? 'selected' : ''}>Inheritance (No Data)</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>City:</label>
      <input type="text" name="city" value="${city}" placeholder="Enter city">
    </div>
    
    <div class="form-group">
      <label>State:</label>
      <input type="text" name="state" value="${state}" placeholder="Enter state">
    </div>
    
    <div class="form-group">
      <label>ZIP Code:</label>
      <input type="text" name="zip" value="${zip}" placeholder="Enter ZIP">
    </div>
    
    <div class="form-group">
      <label>Min Value:</label>
      <input type="number" name="minValue" value="${minValue || ''}" placeholder="Min property value">
    </div>
    
    <div class="form-group">
      <label>Max Value:</label>
      <input type="number" name="maxValue" value="${maxValue || ''}" placeholder="Max property value">
    </div>
    
    <div class="form-group">
      <label>Status:</label>
      <select name="status">
        <option value="">-- Any Status --</option>
        <option value="new" ${status === 'new' ? 'selected' : ''}>New</option>
        <option value="working" ${status === 'working' ? 'selected' : ''}>Working</option>
        <option value="won" ${status === 'won' ? 'selected' : ''}>Won</option>
        <option value="lost" ${status === 'lost' ? 'selected' : ''}>Lost</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>Temperature:</label>
      <select name="temperature">
        <option value="">-- Any Temperature --</option>
        <option value="hot" ${temperature === 'hot' ? 'selected' : ''}>Hot</option>
        <option value="warm" ${temperature === 'warm' ? 'selected' : ''}>Warm</option>
        <option value="cold" ${temperature === 'cold' ? 'selected' : ''}>Cold</option>
        <option value="dead" ${temperature === 'dead' ? 'selected' : ''}>Dead</option>
      </select>
    </div>
    
    <div class="form-group">
      <button type="submit">Search Campaigns</button>
      <a href="/ops/campaigns" style="margin-left: 10px;">Reset</a>
    </div>
  </form>

  ${criteria_used.length > 0 ? `<div class="criteria"><strong>Search Criteria:</strong> ${criteria_used.join(', ')}</div>` : ''}
  
  <h2>Results (${total} total)</h2>
  
  ${campaigns.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Address</th>
        <th>Owner</th>
        <th>Value</th>
        <th>Equity</th>
        <th>Motivation</th>
        <th>Temperature</th>
        <th>Status</th>
        <th>Tags</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${campaigns.map(lead => `
        <tr>
          <td><a href="/ops/leads/${lead.id}">${lead.id.substring(0, 8)}...</a></td>
          <td>${lead.address || 'N/A'}</td>
          <td>${lead.owner_name || 'N/A'}</td>
          <td>$${lead.estimated_value ? lead.estimated_value.toLocaleString() : 'N/A'}</td>
          <td>${lead.equity ? (lead.equity * 100).toFixed(1) + '%' : 'N/A'}</td>
          <td>${lead.motivation_score || 0}</td>
          <td><span class="badge badge-${lead.temperature_tag || 'dead'}">${lead.temperature_tag || 'DEAD'}</span></td>
          <td class="status-${(lead.status || 'new').toLowerCase()}">${lead.status || 'NEW'}</td>
          <td>
            ${lead.is_probate ? '<span class="badge" style="background: #8b4513; color: white;">Probate</span>' : ''}
            ${lead.is_vacant ? '<span class="badge" style="background: #666; color: white;">Vacant</span>' : ''}
          </td>
          <td><a href="/ops/leads/${lead.id}">View</a></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>No campaigns found matching your criteria.</p>'}

  <div style="margin-top: 20px;">
    <a href="/ops/leads">← Back to All Leads</a> | 
    <a href="/admin">Admin Panel</a>
  </div>
</body>
</html>`;

      res.send(html);
    } catch (error) {
      console.error('Campaign UI error:', error);
      res.status(500).send(`Error: ${error.message}`);
    }
  });

  // === Operator UI (server-side rendered HTML) ===
  app.get('/ops/leads', (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const city = String(req.query.city || '').trim();
      const state = String(req.query.state || '').trim();
      const zip = String(req.query.zip || '').trim();
      const status = String(req.query.status || '').trim();
      const temperature = String(req.query.temperature || '').trim();
      const minValue = req.query.minValue ? Number(req.query.minValue) : null;
      const maxValue = req.query.maxValue ? Number(req.query.maxValue) : null;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
      const params = [];
      const where = [];
      if (q) { where.push('(l.address LIKE ? OR l.owner_name LIKE ?)'); params.push(`%${q}%`,`%${q}%`); }
      if (city) { where.push('l.address LIKE ?'); params.push(`%${city}%`); }
      if (state) { where.push('l.address LIKE ?'); params.push(`%${state}%`); }
      if (zip) { where.push('l.address LIKE ?'); params.push(`%${zip}%`); }
      if (status) { where.push('l.status = ?'); params.push(status); }
      if (temperature) { where.push('l.temperature_tag = ?'); params.push(temperature); }
      if (minValue != null) { where.push('l.estimated_value >= ?'); params.push(minValue); }
      if (maxValue != null) { where.push('l.estimated_value <= ?'); params.push(maxValue); }
      
      // Enhanced query to include next follow-up info
      let sql = `
        SELECT l.*, 
        MIN(f.due_at) as next_followup_due,
        COUNT(f.id) as open_followups_count
        FROM leads l
        LEFT JOIN follow_ups f ON l.id = f.lead_id AND f.status = 'open'
      `;
      
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' GROUP BY l.id';
      
      const countSql = where.length ? `SELECT COUNT(DISTINCT l.id) as n FROM leads l WHERE ${where.join(' AND ')}` : 'SELECT COUNT(*) as n FROM leads';
      const total = db.prepare(countSql).get(...params).n;
      sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
      const offset = (page-1)*limit;
      const rows = db.prepare(sql).all(...params, limit, offset);
      const pages = Math.max(1, Math.ceil(total/limit));
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      
      const htmlRows = rows.map(r => {
        let followupInfo = '';
        if (r.next_followup_due) {
          const dueDate = new Date(r.next_followup_due);
          const isOverdue = dueDate < new Date();
          const isDueToday = dueDate < new Date(Date.now() + 24 * 60 * 60 * 1000) && !isOverdue;
          
          let style = '';
          if (isOverdue) {
            style = 'color:red;font-weight:bold';
          } else if (isDueToday) {
            style = 'color:orange;font-weight:bold';
          }
          
          followupInfo = `<span style="${style}">${dueDate.toLocaleDateString()}</span>${r.open_followups_count > 1 ? ` (+${r.open_followups_count-1})` : ''}`;
        }
        
        return `<tr><td><a href="/ops/leads/${encodeURIComponent(r.id)}">${esc(r.id)}</a></td><td>${esc(r.address)}</td><td>${esc(r.owner_name)}</td><td>${esc(r.status||'')}</td><td>${r.motivation_score ?? ''}</td><td>${r.grade_label ? `<span class="grade-${String(r.grade_label).toLowerCase().replace('+','plus')}">${esc(r.grade_label)}</span>` : ''}</td><td>${followupInfo}</td></tr>`;
      }).join('');
      const nav = `Page ${page}/${pages}`;
      const queryStr = q ? `&q=${encodeURIComponent(q)}` : '';
      const prev = page>1 ? `<a href="/ops/leads?page=${page-1}&limit=${limit}${queryStr}">Prev</a>` : '';
      const next = page<pages ? `<a href="/ops/leads?page=${page+1}&limit=${limit}${queryStr}">Next</a>` : '';
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Leads</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:16px} 
        table{border-collapse:collapse;width:100%} 
        th,td{border:1px solid #ddd;padding:8px} 
        th{background:#f8f8f8;text-align:left} 
        .toolbar{margin-bottom:12px}
        .grade-a-plus,.grade-aplus{color:#008000;font-weight:bold}
        .grade-a{color:#228B22;font-weight:bold}
        .grade-b-plus,.grade-bplus{color:#32CD32;font-weight:bold}
        .grade-b{color:#9ACD32;font-weight:bold}
        .grade-c-plus,.grade-cplus{color:#FFD700;font-weight:bold}
        .grade-c{color:#FFA500;font-weight:bold}
        .grade-d{color:#FF6347;font-weight:bold}
        .grade-f{color:#DC143C;font-weight:bold}
      </style></head><body>
      <h1>Leads</h1>
      <div class="toolbar">
        <form method="GET" action="/ops/leads">
          <input name="q" placeholder="Search..." value="${esc(q)}" />
          <input name="city" placeholder="City" value="${esc(city)}" />
          <input name="state" placeholder="State" value="${esc(state)}" />
          <input name="zip" placeholder="Zip" value="${esc(zip)}" />
          <input name="status" placeholder="Status" value="${esc(status)}" />
          <input name="temperature" placeholder="Temp" value="${esc(temperature)}" />
          <input name="minValue" type="number" placeholder="Min Value" value="${minValue ?? ''}" />
          <input name="maxValue" type="number" placeholder="Max Value" value="${maxValue ?? ''}" />
          <input name="limit" type="number" min="1" max="100" value="${limit}" />
          <button type="submit">Apply</button>
        </form>
        <div style="margin-top:8px">
          <a href="/ops/import"><button type="button">Import CSV (admin)</button></a>
          <a href="/ops/grading"><button type="button">Lead Grading</button></a>
          <a href="/ops/campaigns"><button type="button">Campaign Search</button></a>
          <a href="/ops/followups"><button type="button">Follow-ups</button></a>
        </div>
      </div>
      <table><thead><tr><th>ID</th><th>Address</th><th>Owner</th><th>Status</th><th>Motivation</th><th>Grade</th><th>Next Follow-up</th></tr></thead>
      <tbody>${htmlRows || '<tr><td colspan="7">No leads</td></tr>'}</tbody></table>
      <div class="pager">${nav} ${prev} ${next}</div>
      <p><a href="/ops/artifacts">Artifacts</a></p>
      </body></html>`;
      res.set('Content-Type','text/html; charset=utf-8').send(html);
    } catch (e) { return sendProblem(res, 'ui_leads_error', String(e?.message || e), undefined, 500); }
  });

  app.get('/ops/leads/:id', (req, res) => {
    try {
      const { id } = req.params;
      const r = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!r) return res.status(404).send('<h1>Not found</h1>');
      
      // Get timeline events for this lead
      const timelineEvents = db.prepare(`
        SELECT kind, payload_json, created_at 
        FROM timeline_events 
        WHERE lead_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(id);
      
      // Get open follow-ups for this lead
      const followups = db.prepare(`
        SELECT * FROM follow_ups 
        WHERE lead_id = ? AND status = 'open'
        ORDER BY due_at ASC
      `).all(id);
      
      // Check for call summaries in artifacts
      let callSummaries = [];
      try {
        const summariesDir = path.resolve(STORAGE_ROOT, 'artifacts', 'dialer', 'summaries');
        if (fs.existsSync(summariesDir)) {
          const summaryFiles = fs.readdirSync(summariesDir)
            .filter(f => f.endsWith('.json') && f.includes(id))
            .slice(-5); // Show last 5 summaries
          
          for (const file of summaryFiles) {
            try {
              const summaryPath = path.join(summariesDir, file);
              const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
              if (summaryData.dial_id) {
                callSummaries.push(summaryData);
              }
            } catch (e) {
              console.warn('[Call Summary] Failed to read summary file:', file, e?.message);
            }
          }
        }
      } catch (e) {
        console.warn('[Call Summary] Failed to check summaries:', e?.message);
      }
      
      // Gather recent artifact links (report/audit/csv/zip)
      const exp = Math.floor(Date.now() / 1000) + defaultTtl;
      let links = [];
      try {
        if (fs.existsSync(ARTIFACT_ROOT)) {
          const dirs = fs.readdirSync(ARTIFACT_ROOT).filter(n => fs.statSync(path.join(ARTIFACT_ROOT,n)).isDirectory()).slice(-20);
          for (const runId of dirs) {
            const relReport = `${runId}/report.json`;
            const relAudit = `${runId}/audit.json`;
            const relCsv = `${runId}/enriched.csv`;
            const relZip = `${runId}/${runId}.zip`;
            if (fs.existsSync(path.join(ARTIFACT_ROOT, relReport))) links.push({ name: `${runId}/report.json`, url: `/admin/artifact-download?path=${encodeURIComponent(relReport)}&exp=${exp}&sig=${signUtil(relReport, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` });
            if (fs.existsSync(path.join(ARTIFACT_ROOT, relAudit))) links.push({ name: `${runId}/audit.json`, url: `/admin/artifact-download?path=${encodeURIComponent(relAudit)}&exp=${exp}&sig=${signUtil(relAudit, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` });
            if (fs.existsSync(path.join(ARTIFACT_ROOT, relCsv))) links.push({ name: `${runId}/enriched.csv`, url: `/admin/artifact-download?path=${encodeURIComponent(relCsv)}&exp=${exp}&sig=${signUtil(relCsv, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` });
            if (fs.existsSync(path.join(ARTIFACT_ROOT, relZip))) links.push({ name: `${runId}.zip`, url: `/admin/artifact-download?path=${encodeURIComponent(relZip)}&exp=${exp}&sig=${signUtil(relZip, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` });
          }
        }
      } catch {}
      
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      
      // Format timeline events for display
      const timelineHtml = timelineEvents.map(event => {
        let payload = {};
        try {
          payload = JSON.parse(event.payload_json || '{}');
        } catch (e) {
          payload = {};
        }
        
        let summary = '';
        let icon = '📋';
        switch (event.kind) {
          case 'created':
            summary = 'Lead created';
            icon = '✨';
            break;
          case 'skiptrace':
            summary = 'Skip trace completed';
            icon = '🔍';
            break;
          case 'dial':
            summary = 'Dial attempt made';
            icon = '📞';
            break;
          case 'disposition':
            summary = `Disposition: ${payload.type || 'unknown'}`;
            icon = '📝';
            break;
          case 'followup_created':
            summary = `Follow-up created: ${payload.channel} (${payload.priority} priority)`;
            icon = '📅';
            break;
          case 'followup_done':
            summary = `Follow-up completed: ${payload.channel}`;
            icon = '✅';
            break;
          case 'note':
            summary = 'Note added';
            icon = '💭';
            break;
          default:
            summary = `${event.kind} event`;
        }
        
        const timeAgo = new Date(event.created_at).toLocaleString();
        return `<li style="margin:8px 0;padding:8px;border-left:3px solid #ddd;background:#f9f9f9">
          <div style="font-weight:bold">${icon} ${esc(summary)}</div>
          <div style="font-size:0.9em;color:#666">${timeAgo}</div>
          ${payload.notes ? `<div style="font-size:0.9em;margin-top:4px">${esc(payload.notes)}</div>` : ''}
        </li>`;
      }).join('');
      
      // Format follow-ups for display
      const followupsHtml = followups.map(f => {
        const dueDate = new Date(f.due_at);
        const isOverdue = dueDate < new Date();
        const dueDateStr = dueDate.toLocaleString();
        const overdueStyle = isOverdue ? 'color:red;font-weight:bold' : '';
        
        return `<li style="margin:8px 0;padding:8px;border:1px solid #ddd;border-radius:4px;background:${isOverdue ? '#ffebee' : '#f0f8ff'}">
          <div style="font-weight:bold;${overdueStyle}">${esc(f.channel.toUpperCase())} - ${esc(f.priority.toUpperCase())} priority</div>
          <div style="font-size:0.9em;${overdueStyle}">Due: ${dueDateStr}</div>
          ${f.notes ? `<div style="font-size:0.9em;margin-top:4px">${esc(f.notes)}</div>` : ''}
          <div style="margin-top:8px">
            <button onclick="completeFollowup('${f.id}')" style="background:#4CAF50;color:white;border:none;padding:4px 8px;margin-right:4px;cursor:pointer">Done</button>
            <button onclick="snoozeFollowup('${f.id}')" style="background:#FF9800;color:white;border:none;padding:4px 8px;cursor:pointer">Snooze 24h</button>
          </div>
        </li>`;
      }).join('');
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lead ${esc(r.id)}</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:16px} 
        dt{font-weight:bold}
        .grade-a-plus,.grade-aplus{color:#008000;font-weight:bold}
        .grade-a{color:#228B22;font-weight:bold}
        .grade-b-plus,.grade-bplus{color:#32CD32;font-weight:bold}
        .grade-b{color:#9ACD32;font-weight:bold}
        .grade-c-plus,.grade-cplus{color:#FFD700;font-weight:bold}
        .grade-c{color:#FFA500;font-weight:bold}
        .grade-d{color:#FF6347;font-weight:bold}
        .grade-f{color:#DC143C;font-weight:bold}
        .disposition-btn{margin:4px;padding:8px 12px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:4px}
        .disposition-btn:hover{background:#f0f0f0}
        .section{margin:20px 0;padding:16px;border:1px solid #ddd;border-radius:8px;background:#fafafa}
        .timeline{list-style:none;padding:0;margin:0}
        input,select,textarea{margin:4px;padding:8px;border:1px solid #ccc;border-radius:4px}
        button{padding:8px 16px;margin:4px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:4px}
        button:hover{background:#f0f0f0}
        .btn-primary{background:#007bff;color:white;border-color:#007bff}
        .btn-primary:hover{background:#0056b3}
      </style></head><body>
      <h1>Lead Detail</h1>
      <p><a href="/ops/leads">← Back to Leads</a> | <a href="/ops/followups">Follow-ups</a></p>
      
      <div class="section">
        <h3>Lead Information</h3>
        <dl>
          <dt>ID</dt><dd>${esc(r.id)}</dd>
          <dt>Address</dt><dd>${esc(r.address)}</dd>
          <dt>Owner</dt><dd>${esc(r.owner_name)}</dd>
          <dt>Status</dt><dd>${esc(r.status)}</dd>
          <dt>Estimated Value</dt><dd>${esc(r.estimated_value)}</dd>
          <dt>Equity</dt><dd>${esc(r.equity)}</dd>
          <dt>Motivation</dt><dd>${esc(r.motivation_score)}</dd>
          <dt>Temperature</dt><dd>${esc(r.temperature_tag)}</dd>
          <dt>Grade</dt><dd>${r.grade_label ? `<span class="grade-${String(r.grade_label).toLowerCase().replace('+','plus')}">${esc(r.grade_label)}</span> (${r.grade_score}/100)` : 'Not graded'}</dd>
          ${r.grade_reason ? `<dt>Grade Reason</dt><dd style="font-size:0.9em;color:#666">${esc(r.grade_reason)}</dd>` : ''}
          <dt>Phones Count</dt><dd>${esc(r.phones_count)}</dd>
          <dt>Emails Count</dt><dd>${esc(r.emails_count)}</dd>
          <dt>Has DNC</dt><dd>${esc(r.has_dnc)}</dd>
          <dt>Created</dt><dd>${esc(r.created_at)}</dd>
          <dt>Updated</dt><dd>${esc(r.updated_at)}</dd>
        </dl>
      </div>

      <div class="section">
        <h3>Quick Dispositions</h3>
        <div>
          <button class="disposition-btn" onclick="addDisposition('no_answer')">No Answer</button>
          <button class="disposition-btn" onclick="addDisposition('voicemail')">Voicemail</button>
          <button class="disposition-btn" onclick="addDisposition('bad_number')">Bad Number</button>
          <button class="disposition-btn" onclick="addDisposition('interested')">Interested</button>
          <button class="disposition-btn" onclick="addDisposition('not_interested')">Not Interested</button>
          <button class="disposition-btn" onclick="addDisposition('follow_up')">Follow Up</button>
        </div>
        <div style="margin-top:12px">
          <textarea id="dispositionNotes" placeholder="Add notes (optional)" style="width:300px;height:60px"></textarea>
        </div>
      </div>

      <div class="section">
        <h3>Create Follow-up</h3>
        <form id="followupForm">
          <div style="margin:8px 0">
            <label>Due Date:</label>
            <input type="datetime-local" id="dueAt" required style="width:200px">
          </div>
          <div style="margin:8px 0">
            <label>Channel:</label>
            <select id="channel" required>
              <option value="call">Call</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="task">Task</option>
            </select>
            <label>Priority:</label>
            <select id="priority">
              <option value="low">Low</option>
              <option value="med" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style="margin:8px 0">
            <textarea id="followupNotes" placeholder="Notes (optional)" style="width:400px;height:60px"></textarea>
          </div>
          <button type="submit" class="btn-primary">Create Follow-up</button>
        </form>
      </div>

      <div class="section">
        <h3>Open Follow-ups (${followups.length})</h3>
        ${followups.length ? `<ul class="timeline">${followupsHtml}</ul>` : '<p>No open follow-ups</p>'}
      </div>

      <div class="section">
        <h3>Call Summaries (${callSummaries.length})</h3>
        ${callSummaries.length ? callSummaries.map(summary => {
          const sentimentColor = summary.sentiment === 'positive' ? '#4caf50' : 
                                summary.sentiment === 'negative' ? '#f44336' : '#757575';
          const generatedDate = new Date(summary.generated_at).toLocaleString();
          
          return `
            <div style="margin:12px 0;padding:12px;border:1px solid #ddd;border-radius:6px;background:white">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong>Call ${esc(summary.dial_id.slice(-8))}</strong>
                <span style="color:${sentimentColor};font-weight:bold;text-transform:uppercase;font-size:0.9em">${esc(summary.sentiment)}</span>
              </div>
              <div style="margin:8px 0;font-size:0.95em">${esc(summary.summary)}</div>
              ${summary.key_points && summary.key_points.length > 0 ? 
                `<div style="margin:8px 0">
                  <strong>Key Points:</strong>
                  <ul style="margin:4px 0 0 20px;font-size:0.9em">
                    ${summary.key_points.map(point => `<li>${esc(point)}</li>`).join('')}
                  </ul>
                </div>` : ''}
              <div style="font-size:0.8em;color:#666;margin-top:8px">
                Generated: ${generatedDate} | Method: ${esc(summary.method || 'unknown')}
                ${summary.length_secs ? ` | Duration: ~${Math.floor(summary.length_secs / 60)}:${String(summary.length_secs % 60).padStart(2, '0')}` : ''}
              </div>
            </div>
          `;
        }).join('') : '<p>No call summaries available</p>'}
      </div>

      <div class="section">
        <h3>Timeline</h3>
        ${timelineEvents.length ? `<ul class="timeline">${timelineHtml}</ul>` : '<p>No timeline events</p>'}
        <p><a href="/leads/${encodeURIComponent(r.id)}/timeline" target="_blank">View full timeline (JSON)</a></p>
      </div>

      <div class="section">
        <h3>Artifacts</h3>
        <ul>${links.map(l => `<li><a href="${l.url}">${esc(l.name)}</a></li>`).join('') || '<li>None</li>'}</ul>
      </div>

      <script>
        async function addDisposition(type) {
          const notes = document.getElementById('dispositionNotes').value;
          try {
            const response = await fetch('/dial/${encodeURIComponent(r.id)}/disposition', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, notes })
            });
            
            const result = await response.json();
            if (result.ok) {
              alert('Disposition added successfully');
              document.getElementById('dispositionNotes').value = '';
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to add disposition'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }

        async function completeFollowup(id) {
          try {
            const response = await fetch('/followups/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'done' })
            });
            
            const result = await response.json();
            if (result.ok) {
              alert('Follow-up marked as done');
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to complete follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }

        async function snoozeFollowup(id) {
          const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          try {
            const response = await fetch('/followups/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'snoozed', snoozeUntil })
            });
            
            const result = await response.json();
            if (result.ok) {
              alert('Follow-up snoozed for 24 hours');
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to snooze follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }

        document.getElementById('followupForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const dueAt = document.getElementById('dueAt').value;
          const channel = document.getElementById('channel').value;
          const priority = document.getElementById('priority').value;
          const notes = document.getElementById('followupNotes').value;
          
          if (!dueAt) {
            alert('Due date is required');
            return;
          }
          
          try {
            const response = await fetch('/leads/${encodeURIComponent(r.id)}/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                dueAt: new Date(dueAt).toISOString(), 
                channel, 
                priority, 
                notes 
              })
            });
            
            const result = await response.json();
            if (result.ok) {
              alert('Follow-up created successfully');
              document.getElementById('followupForm').reset();
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to create follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        });

        // Set default due date to 1 hour from now
        const defaultDue = new Date(Date.now() + 60 * 60 * 1000);
        document.getElementById('dueAt').value = defaultDue.toISOString().slice(0, 16);
      </script>
      </body></html>`;
      
      res.set('Content-Type','text/html; charset=utf-8').send(html);
    } catch (e) { return sendProblem(res, 'ui_lead_error', String(e?.message || e), undefined, 500); }
  });

  app.get('/ops/artifacts', (req, res) => {
    try {
      if (!fs.existsSync(ARTIFACT_ROOT)) return res.set('Content-Type','text/html').send('<h1>No artifacts</h1>');
      const runs = fs.readdirSync(ARTIFACT_ROOT).filter(name => fs.statSync(path.join(ARTIFACT_ROOT, name)).isDirectory());
      const exp = Math.floor(Date.now() / 1000) + defaultTtl;
      const items = runs.map(runId => {
        const relReport = `${runId}/report.json`;
        const relCsv = `${runId}/enriched.csv`;
        const relAudit = `${runId}/audit.json`;
        const relZip = `${runId}/${runId}.zip`;
        const reportUrl = fs.existsSync(path.join(ARTIFACT_ROOT, relReport)) ? `/admin/artifact-download?path=${encodeURIComponent(relReport)}&exp=${exp}&sig=${signUtil(relReport, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        const csvAbs = path.join(ARTIFACT_ROOT, relCsv);
        const csvUrl = fs.existsSync(csvAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relCsv)}&exp=${exp}&sig=${signUtil(relCsv, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        const auditAbs = path.join(ARTIFACT_ROOT, relAudit);
        const auditUrl = fs.existsSync(auditAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relAudit)}&exp=${exp}&sig=${signUtil(relAudit, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        const zipAbs = path.join(ARTIFACT_ROOT, relZip);
        const zipUrl = fs.existsSync(zipAbs) ? `/admin/artifact-download?path=${encodeURIComponent(relZip)}&exp=${exp}&sig=${signUtil(relZip, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}` : null;
        let type = 'run';
        if (!fs.existsSync(path.join(ARTIFACT_ROOT, relReport)) && fs.existsSync(auditAbs)) type = 'import_audit';
        if (zipUrl || String(runId).startsWith('weekly_export_')) type = 'weekly_export';
        return { runId, type, reportUrl, csvUrl, auditUrl, zipUrl };
      });
      const rows = items.map(it => `<tr><td>${it.runId}</td><td>${it.type||''}</td><td>${it.reportUrl ? `<a href="${it.reportUrl}">report.json</a>`:''}${it.auditUrl ? ` <a href="${it.auditUrl}">audit.json</a>`:''}${it.zipUrl ? ` <a href="${it.zipUrl}">bundle.zip</a>`:''}</td><td>${it.csvUrl ? `<a href="${it.csvUrl}">enriched.csv</a>`:''}</td></tr>`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Artifacts</title><style>body{font-family:system-ui,Segoe UI,Arial;padding:16px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#f8f8f8;text-align:left}</style></head><body>
      <h1>Artifacts</h1>
      <p>Downloads are served from /admin and may prompt for Basic Auth if enabled.</p>
      <table><thead><tr><th>ID</th><th>Type</th><th>Reports</th><th>CSV</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No runs</td></tr>'}</tbody></table>
      <p><a href="/ops/leads">Leads</a></p>
      </body></html>`;
      res.set('Content-Type','text/html; charset=utf-8').send(html);
    } catch (e) { return sendProblem(res, 'ui_artifacts_error', String(e?.message || e), undefined, 500); }
  });

  // Follow-ups management page
  app.get('/ops/followups', async (req, res) => {
    try {
      const { status = 'open', page = 1, limit = 20 } = req.query;
      
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;
      
      let whereConditions = [];
      let params = [];
      
      const now = new Date().toISOString();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      if (status === 'due') {
        whereConditions.push("f.status = 'open' AND f.due_at <= ?");
        params.push(now);
      } else if (status === 'overdue') {
        whereConditions.push("f.status = 'open' AND f.due_at < ?");
        params.push(startOfToday.toISOString());
      } else {
        whereConditions.push("f.status = ?");
        params.push(status);
      }
      
      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Get stats
      const stats = {
        open: db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'open'").get().count,
        due: db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'open' AND due_at <= ?").get(now).count,
        overdue: db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'open' AND due_at < ?").get(startOfToday.toISOString()).count,
        done: db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'done'").get().count
      };
      
      // Get total count for pagination
      const countSql = `SELECT COUNT(*) as count FROM follow_ups f JOIN leads l ON f.lead_id = l.id ${whereClause}`;
      const total = db.prepare(countSql).get(...params).count;
      
      // Get follow-ups with lead details
      const sql = `
        SELECT f.*, l.address, l.owner_name 
        FROM follow_ups f
        JOIN leads l ON f.lead_id = l.id
        ${whereClause}
        ORDER BY f.due_at ASC, f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const followups = db.prepare(sql).all(...params, limitNum, offset);
      const pages = Math.max(1, Math.ceil(total / limitNum));
      
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      
      // Format follow-ups for display
      const followupsHtml = followups.map(f => {
        const dueDate = new Date(f.due_at);
        const isOverdue = dueDate < new Date();
        const isDueToday = dueDate < new Date(Date.now() + 24 * 60 * 60 * 1000) && !isOverdue;
        const dueDateStr = dueDate.toLocaleString();
        
        let statusBadge = '';
        let rowStyle = '';
        if (isOverdue) {
          statusBadge = '<span style="background:#f44336;color:white;padding:2px 6px;border-radius:3px;font-size:0.8em">OVERDUE</span>';
          rowStyle = 'background:#ffebee';
        } else if (isDueToday) {
          statusBadge = '<span style="background:#ff9800;color:white;padding:2px 6px;border-radius:3px;font-size:0.8em">DUE TODAY</span>';
          rowStyle = 'background:#fff3e0';
        }
        
        const priorityColor = f.priority === 'high' ? '#f44336' : f.priority === 'med' ? '#ff9800' : '#4caf50';
        
        return `<tr style="${rowStyle}">
          <td><a href="/ops/leads/${encodeURIComponent(f.lead_id)}">${esc(f.address || 'N/A')}</a></td>
          <td>${esc(f.owner_name || 'N/A')}</td>
          <td><span style="color:${priorityColor};font-weight:bold">${esc(f.channel.toUpperCase())}</span></td>
          <td><span style="color:${priorityColor}">${esc(f.priority.toUpperCase())}</span></td>
          <td>${dueDateStr} ${statusBadge}</td>
          <td>${esc(f.notes || '')}</td>
          <td>
            ${f.status === 'open' ? `
              <button onclick="completeFollowup('${f.id}')" style="background:#4CAF50;color:white;border:none;padding:4px 8px;margin:2px;cursor:pointer;border-radius:3px">Done</button>
              <button onclick="snoozeFollowup('${f.id}', 24)" style="background:#FF9800;color:white;border:none;padding:4px 8px;margin:2px;cursor:pointer;border-radius:3px">24h</button>
              <button onclick="snoozeFollowup('${f.id}', 72)" style="background:#FF9800;color:white;border:none;padding:4px 8px;margin:2px;cursor:pointer;border-radius:3px">72h</button>
              <button onclick="cancelFollowup('${f.id}')" style="background:#f44336;color:white;border:none;padding:4px 8px;margin:2px;cursor:pointer;border-radius:3px">Cancel</button>
            ` : `<span style="color:#666">${esc(f.status)}</span>`}
          </td>
        </tr>`;
      }).join('');
      
      // Navigation
      const nav = `Page ${pageNum}/${pages} (${total} total)`;
      const prev = pageNum > 1 ? `<a href="/ops/followups?status=${status}&page=${pageNum-1}&limit=${limitNum}">Prev</a>` : '';
      const next = pageNum < pages ? `<a href="/ops/followups?status=${status}&page=${pageNum+1}&limit=${limitNum}">Next</a>` : '';
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Follow-ups Management</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:16px}
        table{border-collapse:collapse;width:100%;margin:16px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#f8f8f8}
        .tabs{margin:16px 0;padding:0;border-bottom:2px solid #ddd}
        .tab{display:inline-block;padding:12px 20px;margin:0 4px 0 0;background:#f0f0f0;border:1px solid #ddd;border-bottom:none;cursor:pointer;text-decoration:none;color:#333}
        .tab.active{background:white;border-bottom:2px solid white;margin-bottom:-2px;font-weight:bold}
        .tab:hover{background:#e0e0e0}
        .stats{display:flex;gap:20px;margin:16px 0}
        .stat{padding:12px;background:white;border:1px solid #ddd;border-radius:4px;text-align:center}
        .stat-value{font-size:24px;font-weight:bold;color:#333}
        .stat-label{font-size:12px;color:#666;margin-top:4px}
        .toolbar{margin:16px 0;padding:12px;background:#f0f0f0;border-radius:4px}
        button{padding:6px 12px;margin:2px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:3px}
        button:hover{background:#f0f0f0}
      </style></head><body>
      <h1>Follow-ups Management</h1>
      <p><a href="/ops/leads">← Back to Leads</a> | <a href="/ops/grading">Lead Grading</a></p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${stats.open}</div>
          <div class="stat-label">Open</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#ff9800">${stats.due}</div>
          <div class="stat-label">Due Now</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#f44336">${stats.overdue}</div>
          <div class="stat-label">Overdue</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#4caf50">${stats.done}</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
      
      <div class="tabs">
        <a href="/ops/followups?status=open" class="tab${status === 'open' ? ' active' : ''}">Open (${stats.open})</a>
        <a href="/ops/followups?status=due" class="tab${status === 'due' ? ' active' : ''}">Due Today (${stats.due})</a>
        <a href="/ops/followups?status=overdue" class="tab${status === 'overdue' ? ' active' : ''}">Overdue (${stats.overdue})</a>
        <a href="/ops/followups?status=done" class="tab${status === 'done' ? ' active' : ''}">Done (${stats.done})</a>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Address</th>
            <th>Owner</th>
            <th>Channel</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${followupsHtml || '<tr><td colspan="7">No follow-ups found</td></tr>'}
        </tbody>
      </table>
      
      <div class="toolbar">
        ${nav} | ${prev} ${next}
      </div>

      <script>
        async function completeFollowup(id) {
          if (!confirm('Mark this follow-up as done?')) return;
          
          try {
            const response = await fetch('/followups/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'done' })
            });
            
            const result = await response.json();
            if (result.ok) {
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to complete follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }

        async function snoozeFollowup(id, hours) {
          const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
          
          try {
            const response = await fetch('/followups/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'snoozed', snoozeUntil })
            });
            
            const result = await response.json();
            if (result.ok) {
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to snooze follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }

        async function cancelFollowup(id) {
          if (!confirm('Cancel this follow-up?')) return;
          
          try {
            const response = await fetch('/followups/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'canceled' })
            });
            
            const result = await response.json();
            if (result.ok) {
              location.reload();
            } else {
              alert('Error: ' + (result.message || 'Failed to cancel follow-up'));
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }
      </script>
      </body></html>`;
      
      res.set('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (e) {
      console.error('[Follow-ups] UI error:', e);
      return sendProblem(res, 'followups_ui_error', String(e?.message || e), undefined, 500);
    }
  });

  // Operator UI: Import (admin-only; gated by basic auth header presence if configured)
  app.get('/ops/import', (req, res) => {
    try {
      const hasAuth = !!(basicAuthUser && basicAuthPass);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Import CSV</title><style>body{font-family:system-ui,Segoe UI,Arial;padding:16px} .section{margin-bottom:16px} pre{background:#f8f8f8;padding:8px;border:1px solid #eee;max-height:240px;overflow:auto} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px} th{background:#f6f6f6}</style></head><body>
      <h1>Import CSV</h1>
      ${hasAuth ? '' : '<p><em>Note: This page expects admin auth to be configured for /admin/*.</em></p>'}
      <div class="section">
        <h3>1) Upload</h3>
        <input id="file" type="file" accept=".csv" /> <button id="btnPreview">Preview</button>
      </div>
      <div class="section" id="preview" style="display:none">
        <h3>Preview</h3>
        <div id="totals"></div>
        <h4>Errors (first 10)</h4>
        <table id="errtbl"><thead><tr><th>#</th><th>Field</th><th>Message</th></tr></thead><tbody></tbody></table>
        <button id="btnCommit">Commit Import</button>
      </div>
      <div class="section" id="commit" style="display:none">
        <h3>Commit Result</h3>
        <div id="commitRes"></div>
      </div>
      <p><a href="/ops/leads">Back to Leads</a> · <a href="/ops/artifacts">Artifacts</a></p>
      <script>
      async function postMultipart(mode, file) {
        const form = new FormData(); form.append('file', file);
        const res = await fetch('/admin/import/csv?mode=' + mode, { method: 'POST', body: form });
        const json = await res.json(); if (!res.ok) throw json; return json;
      }
      const $ = (s) => document.querySelector(s);
      let lastFile = null;
      $('#btnPreview').onclick = async () => {
        const f = $('#file').files[0]; if (!f) { alert('Choose a CSV'); return; }
        lastFile = f;
        try {
          const r = await postMultipart('preview', f);
          const p = r.preview || {};
          $('#totals').innerText = 'Totals — total: ' + (p.rows_total||0) + ', valid: ' + (p.rows_valid||0) + ', invalid: ' + (p.rows_invalid||0) + ', create: ' + (p.would_create||0) + ', merge: ' + (p.would_merge||0) + ', skip: ' + (p.would_skip||0);
          const tbody = $('#errtbl tbody'); tbody.innerHTML = '';
          (p.sample_errors||[]).forEach(e => { const tr = document.createElement('tr'); tr.innerHTML = '<td>' + (e.row) + '</td><td>' + (e.field||'') + '</td><td>' + (e.message||'') + '</td>'; tbody.appendChild(tr); });
          $('#preview').style.display = '';
        } catch (e) { alert('Preview failed: ' + (e.message||JSON.stringify(e))); }
      };
      $('#btnCommit').onclick = async () => {
        const f = lastFile || ($('#file').files[0]); if (!f) { alert('Choose a CSV'); return; }
        try {
          const r = await postMultipart('commit', f);
          var link = (r.artifact && r.artifact.auditUrl) ? ' — <a href="' + r.artifact.auditUrl + '">audit.json</a>' : '';
          $('#commitRes').innerHTML = 'Created: ' + (r.created||0) + ', Merged: ' + (r.merged||0) + ', Skipped: ' + (r.skipped||0) + link;
          $('#commit').style.display = '';
        } catch (e) { alert('Commit failed: ' + (e.message||JSON.stringify(e))); }
      };
      </script>
      </body></html>`;
      res.set('Content-Type','text/html; charset=utf-8').send(html);
    } catch (e) { return sendProblem(res, 'ui_import_error', String(e?.message || e), undefined, 500); }
  });

  // Lead-level quick actions
  const LeadNoteZ2 = z.object({ text: z.string().min(1) });
  app.post('/leads/:id/notes', (req, res) => {
    try {
      const { id } = req.params;
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
      if (!lead) return sendProblem(res, 'not_found', 'Lead not found', 'id', 404);
      const parsed = LeadNoteZ2.safeParse(req.body || {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid payload', field, 400);
      }
      const notesDir = path.resolve(STORAGE_ROOT, 'artifacts', 'leads', id, 'notes');
      fs.mkdirSync(notesDir, { recursive: true });
      const line = `- [${new Date().toISOString()}] ${parsed.data.text}\n`;
      fs.appendFileSync(path.join(notesDir, 'notes.md'), line);
      try { auditMut(req); } catch {}
      return res.json({ success: true });
    } catch (e) { return sendProblem(res, 'lead_note_error', String(e?.message || e), undefined, 500); }
  });
  const LeadDispZ2 = z.object({ type: z.enum(['no_answer','voicemail','bad_number','interested','not_interested','follow_up']) });
  app.post('/leads/:id/disposition', (req, res) => {
    try {
      const { id } = req.params;
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
      if (!lead) return sendProblem(res, 'not_found', 'Lead not found', 'id', 404);
      const parsed = LeadDispZ2.safeParse(req.body || {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
        return sendProblem(res, 'validation_error', issue?.message || 'Invalid payload', field, 400);
      }
      const dispDir = path.resolve(STORAGE_ROOT, 'artifacts', 'leads', id, 'dispositions');
      fs.mkdirSync(dispDir, { recursive: true });
      const rec = { leadId: id, type: parsed.data.type, at: new Date().toISOString() };
      fs.writeFileSync(path.join(dispDir, `${Date.now()}.json`), JSON.stringify(rec, null, 2));
      try { auditMut(req); } catch {}
      return res.json({ success: true });
    } catch (e) { return sendProblem(res, 'lead_disposition_error', String(e?.message || e), undefined, 500); }
  });

  // === CSV Import (preview + commit) ===
  const ImportRowZ = z.object({
    address: z.string().min(1),
    owner_name: z.string().optional(),
    phone: z.string().optional(),
    // Treat empty string as undefined so blank email cells don't fail validation
    email: z.preprocess(v => v === '' || v == null ? undefined : v, z.string().email().optional()),
    estimated_value: z.preprocess(v => v === '' || v == null ? undefined : Number(v), z.number().finite().optional()),
    equity: z.preprocess(v => v === '' || v == null ? undefined : Number(v), z.number().finite().nullable().optional()),
    motivation_score: z.preprocess(v => v === '' || v == null ? undefined : Number(v), z.number().int().min(0).max(100).nullable().optional()),
    temperature_tag: z.preprocess(v => (v===''||v==null?undefined:String(v).toLowerCase()), z.enum(['cold','warm','hot']).nullable().optional()),
    source_type: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  });
  function normalizeAddress(addr) {
    return String(addr || '')
      .toLowerCase()
      .replace(/[\.,#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function mergeLeadRecord(existing, incoming) {
    const out = { ...existing };
    const keys = ['owner_name','phone','email','estimated_value','equity','motivation_score','temperature_tag','source_type','status','notes'];
    for (const k of keys) {
      const inc = incoming[k];
      if (inc != null && inc !== '') {
        if (existing[k] == null || existing[k] === '') out[k] = inc;
      }
    }
    // keep updated_at
    out.updated_at = new Date().toISOString();
    return out;
  }
  // Helper to parse CSV buffer into rows with headers (minimal parser; covers simple cases used in tests)
  async function parseCsvBuffer(buf) {
    try {
      const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) return { rows: [], headers: [] };
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = (values[i] ?? '').trim();
        });
        return obj;
      });
      return { rows, headers };
    } catch (e) {
      console.error('[ImportCSV] simple parse error:', e && (e.stack || e.message || e));
      throw e;
    }
  }
  // Admin auth already applied to /admin via basicAuth middleware.
  // Custom wrapper to capture multer errors and map to Problem+JSON
  app.post('/admin/import/csv', async (req, res) => {
    try {
      await new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (!err) return resolve(null);
          // Map known multer/fileFilter errors
          if (err && (err.code === 'LIMIT_FILE_SIZE')) {
            return reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
          }
          if (String(err?.message) === 'unsupported_content_type') {
            return reject(Object.assign(new Error('unsupported_media_type'), { status: 415 }));
          }
          // Generic validation
          return reject(Object.assign(new Error('validation_error'), { status: 400 }));
        });
      });
      // Mode
      const mode = String(req.query.mode || 'preview').toLowerCase();
      if (mode !== 'preview' && mode !== 'commit') {
        return sendProblem(res, 'validation_error', 'mode must be preview or commit', 'mode', 400);
      }
      const file = req.file;
      if (!file) return sendProblem(res, 'validation_error', 'file is required', 'file', 400);
      try { console.log('[ImportCSV] accepted upload', { mode, name: file.originalname, type: file.mimetype, size: file.size }); } catch {}
      if (!(file.mimetype === 'text/csv' || (file.originalname || '').toLowerCase().endsWith('.csv'))) {
        return sendProblem(res, 'unsupported_media_type', 'Content must be CSV', undefined, 415);
      }
      if (file.size > 10 * 1024 * 1024) {
        return sendProblem(res, 'payload_too_large', 'CSV exceeds 10MB', undefined, 413);
      }

      const t0 = Date.now();
      const { rows, headers } = await (async () => {
        try {
          const out = await parseCsvBuffer(file.buffer);
          try { console.log('[ImportCSV] parsed rows:', out.rows.length, 'headers:', out.headers); } catch {}
          return out;
        } catch (perr) {
          console.error('[ImportCSV] parse error:', perr && (perr.stack || perr.message || perr));
          throw perr;
        }
      })();
      const dedupe = new Map(); // key -> index of kept record
      const normalizedCollisions = [];
      let rows_total = rows.length, rows_valid = 0, rows_invalid = 0;
      let would_create = 0, would_merge = 0, would_skip = 0;
      const sample_errors = [];
      let normalizedRows;
      try {
        normalizedRows = rows.map((r, idx) => {
        const candidate = {
          address: r.address || r.Address || r.ADDRESS || '',
          owner_name: r.owner_name || r.owner || r.Owner || '',
          phone: r.phone || r.Phone || '',
          email: r.email || r.Email || '',
          estimated_value: r.estimated_value || r.value || r.estimatedValue || '',
          equity: r.equity || '',
          motivation_score: r.motivation_score || r.motivation || '',
          temperature_tag: r.temperature_tag || r.temperature || '',
          source_type: r.source_type || r.source || '',
          status: r.status || '',
          notes: r.notes || '',
          city: r.city || '',
          state: r.state || '',
          zip: r.zip || r.zipcode || '',
        };
        const parsed = ImportRowZ.safeParse(candidate);
        if (!parsed.success) {
          rows_invalid++;
          const issue = parsed.error.issues[0];
          const field = Array.isArray(issue?.path) ? issue.path.join('.') : undefined;
          if (sample_errors.length < 10) sample_errors.push({ row: idx+1, field, message: issue?.message || 'invalid' });
          return { ok:false, raw: r };
        }
        const data = parsed.data;
        data.normalized_address = normalizeAddress(data.address);
        rows_valid++;
        return { ok:true, data };
        });
      } catch (mapErr) {
        console.error('[ImportCSV] normalize error:', mapErr && (mapErr.stack || mapErr.message || mapErr));
        throw mapErr;
      }
      try { console.log('[ImportCSV] normalized', { rows_total, rows_valid, rows_invalid, sample_errors }); } catch {}

      // In-batch dedupe
      try { console.log('[ImportCSV] start in-batch dedupe'); } catch {}
      const keyOf = (d) => {
        const ident = d.owner_name || d.email || d.phone || '';
        return `${d.normalized_address}|${ident}`;
      };
      normalizedRows.forEach((row, idx) => {
        if (!row.ok) return;
        const key = keyOf(row.data);
        if (dedupe.has(key)) {
          would_skip++;
          normalizedCollisions.push({ row: idx+1, reason: 'duplicate_in_batch', key });
        } else {
          dedupe.set(key, idx);
        }
      });
      try { console.log('[ImportCSV] dedupe complete', { kept: dedupe.size, would_skip }); } catch {}

      // DB dedupe and preview/commit actions
      try { console.log('[ImportCSV] defining selectByKey'); } catch {}
      const selectByKey = (addrKey, identVal) => {
        // Try best-effort matching using existing columns
        const candidates = db.prepare("SELECT * FROM leads WHERE LOWER(REPLACE(REPLACE(REPLACE(address, ',', ' '), '.', ' '), '#', ' ')) LIKE ?").all(`%${addrKey.split('|')[0]}%`);
        return candidates.find(c => {
          const matchOwner = identVal && c.owner_name && String(c.owner_name).toLowerCase() === String(identVal).toLowerCase();
          const matchEmail = identVal && c.email && String(c.email).toLowerCase() === String(identVal).toLowerCase();
          const matchPhone = identVal && c.phone && String(c.phone) === String(identVal);
          return matchOwner || matchEmail || matchPhone;
        }) || null;
      };
      try { console.log('[ImportCSV] selectByKey defined'); } catch {}

      const toCreate = [];
      const toMerge = [];
      // Only consider deduped rows (unique keys) for create/merge preview
      try { console.log('[ImportCSV] compute create/merge'); } catch {}
      try {
        for (const keptIdx of dedupe.values()) {
          const row = normalizedRows[keptIdx];
          if (!row || !row.ok) continue;
          const [addrKey, identVal] = keyOf(row.data).split('|');
          const existing = selectByKey(addrKey, identVal);
          if (existing) { would_merge++; toMerge.push({ existing, incoming: row.data }); }
          else { would_create++; toCreate.push(row.data); }
        }
        try { console.log('[ImportCSV] toCreate/toMerge', { toCreate: toCreate.length, toMerge: toMerge.length }); } catch {}
      } catch (cmpErr) {
        console.error('[ImportCSV] compute create/merge error:', cmpErr && (cmpErr.stack || cmpErr.message || cmpErr));
        // Fallback: treat all kept deduped rows as creates to keep preview resilient
        would_create = dedupe.size;
        would_merge = 0;
        toCreate.length = 0; // reset in case partially filled
        for (const keptIdx of dedupe.values()) {
          const row = normalizedRows[keptIdx];
          if (row && row.ok) toCreate.push(row.data);
        }
      }

      if (mode === 'preview') {
        // Normalize counts from computed arrays for determinism
        would_create = toCreate.length;
        would_merge = toMerge.length;
        try { console.log('[ImportCSV] preview counts', { rows_total, rows_valid, rows_invalid, would_create, would_merge, would_skip }); } catch {}
        return res.json({ ok: true, preview: { rows_total, rows_valid, rows_invalid, would_create, would_merge, would_skip, sample_errors } });
      }

      // commit mode: perform upserts/merges
      let created = 0, merged = 0, skipped = would_skip;
      const nowIso = new Date().toISOString();
      // Discover existing table columns
      let tableCols = [];
      try { tableCols = db.prepare('PRAGMA table_info(leads)').all(); } catch(_) { tableCols = []; }
      const colSet = new Set(Array.isArray(tableCols) ? tableCols.map(c => c.name) : []);
      const insertLead = (data) => {
        const uuid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
        const safe = {
          id: uuid,
          address: data.address,
          owner_name: data.owner_name || null,
          phone: data.phone || null,
          email: data.email || null,
          estimated_value: typeof data.estimated_value === 'number' ? data.estimated_value : null,
          equity: typeof data.equity === 'number' ? data.equity : null,
          motivation_score: typeof data.motivation_score === 'number' ? data.motivation_score : 50,
          temperature_tag: data.temperature_tag || getTemperatureTag(typeof data.motivation_score === 'number' ? data.motivation_score : 50),
          source_type: data.source_type || 'manual',
          status: data.status || 'new',
          notes: data.notes || null,
          created_at: nowIso,
          updated_at: nowIso,
        };
        if (!colSet.has('temperature_tag')) delete safe.temperature_tag;
        const columns = []; const values = [];
        for (const [k,v] of Object.entries(safe)) { if (colSet.has(k)) { columns.push(k); values.push(v); } }
        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT INTO leads (${columns.join(',')}) VALUES (${placeholders})`;
        db.prepare(sql).run(...values);
        created++;
      };
      const updateLead = (existing, incoming) => {
        const mergedObj = mergeLeadRecord(existing, incoming);
        // Build dynamic update
        const allowed = ['owner_name','phone','email','estimated_value','equity','motivation_score','temperature_tag','source_type','status','notes','updated_at'];
        const sets = []; const values = [];
        for (const k of allowed) {
          if (!colSet.has(k)) continue;
          sets.push(`${k} = ?`);
          values.push(mergedObj[k] ?? null);
        }
        values.push(existing.id);
        const sql = `UPDATE leads SET ${sets.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);
        merged++;
      };
      toCreate.forEach(insertLead);
      toMerge.forEach(({ existing, incoming }) => updateLead(existing, incoming));

      // Write audit artifact
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const runId = `import_${ts}`;
      const dir = path.resolve(ARTIFACT_ROOT, runId);
      fs.mkdirSync(dir, { recursive: true });
      const audit = {
        input_filename: file.originalname,
        headers_detected: headers,
        dedupe_key: 'normalized_address|owner_name|email|phone',
        rows_total, rows_valid, rows_invalid,
        created, merged, skipped,
        warnings: normalizedCollisions,
        duration_ms: Date.now() - t0
      };
      fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(audit, null, 2));
      const exp = Math.floor(Date.now() / 1000) + defaultTtl;
      const relAudit = `${runId}/audit.json`;
      const auditUrl = `/admin/artifact-download?path=${encodeURIComponent(relAudit)}&exp=${exp}&sig=${signUtil(relAudit, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}`;
      // metrics + audit log
      try { recordImportResults({ created, merged, skipped, invalid: rows_invalid }); } catch {}
      try { auditMut(req, file.buffer); } catch {}
      return res.json({ ok: true, created, merged, skipped, artifact: { auditUrl } });
    } catch (e) {
      // Map custom errors we annotated above
      console.error('[ImportCSV] Error during import:', e && (e.stack || e.message || e));
      const status = typeof e?.status === 'number' ? e.status : undefined;
      if (status === 415) return sendProblem(res, 'unsupported_media_type', 'Content must be CSV', undefined, 415);
      if (status === 413) return sendProblem(res, 'payload_too_large', 'CSV exceeds 10MB', undefined, 413);
      if (status === 400) return sendProblem(res, 'validation_error', 'Invalid upload', undefined, 400);
      // Fallback
      return sendProblem(res, 'import_error', String(e?.message || e), undefined, 500);
    }
  });

  // Weekly export bundle (CSV + summary.json zipped) — returns signed bundle URL
  const Archiver = (await import('archiver')).default;
  app.post('/admin/export/weekly-bundle', async (req, res) => {
    try {
      // last 7 days by updated_at
      const d = new Date(); const to = d.toISOString(); d.setDate(d.getDate()-7); const from = d.toISOString();
      const leads = db.prepare("SELECT * FROM leads WHERE datetime(updated_at) >= datetime(?)").all(from);
      const dateKey = new Date().toISOString().slice(0,10);
      const runId = `weekly_export_${dateKey}`;
      const dir = path.resolve(ARTIFACT_ROOT, runId);
      fs.mkdirSync(dir, { recursive: true });
      
      // 1. leads.csv (enhanced with PI2 data)
      const leadsHeaders = ['id','address','owner_name','phone','email','estimated_value','equity','motivation_score','temperature_tag','status','source_type','created_at','updated_at','grade_score','grade_label','grade_reason','grade_computed_at','stage'];
      const leadsCsv = [leadsHeaders.join(',')].concat(
        leads.map(r => leadsHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'leads.csv'), leadsCsv);
      
      // 2. grades.csv (PI2 requirement)
      const gradedLeads = leads.filter(l => l.grade_score !== null);
      const gradesHeaders = ['id','grade_score','grade_label','grade_reason','grade_computed_at'];
      const gradesCsv = [gradesHeaders.join(',')].concat(
        gradedLeads.map(r => gradesHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'grades.csv'), gradesCsv);
      
      // 3. stages.csv (PI2 requirement)
      const stagesHeaders = ['id','stage','updated_at'];
      const stagesCsv = [stagesHeaders.join(',')].concat(
        leads.map(r => stagesHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'stages.csv'), stagesCsv);
      
      // 4. dispositions.csv (PI2 requirement)
      const dispositions = db.prepare(`
        SELECT dial_id, lead_id, type, grade_label, created_at as ts 
        FROM dial_outcomes 
        WHERE datetime(created_at) >= datetime(?)
      `).all(from);
      
      const dispositionsHeaders = ['dialId','leadId','type','grade_label','ts'];
      const dispositionsCsv = [dispositionsHeaders.join(',')].concat(
        dispositions.map(r => dispositionsHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'dispositions.csv'), dispositionsCsv);
      
      // 5. followups.csv (PI2 requirement)
      const followups = db.prepare(`
        SELECT id, lead_id, status, due_at, priority, channel 
        FROM follow_ups 
        WHERE datetime(created_at) >= datetime(?)
      `).all(from);
      
      const followupsHeaders = ['id','leadId','status','due_at','priority','channel'];
      const followupsCsv = [followupsHeaders.join(',')].concat(
        followups.map(r => followupsHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'followups.csv'), followupsCsv);
      
      // 6. timeline.csv (PI2 requirement)
      const timeline = db.prepare(`
        SELECT lead_id as leadId, kind, created_at as ts, 
               substr(payload_json, 1, 100) as details 
        FROM timeline_events 
        WHERE datetime(created_at) >= datetime(?)
      `).all(from);
      
      const timelineHeaders = ['leadId','kind','ts','details'];
      const timelineCsv = [timelineHeaders.join(',')].concat(
        timeline.map(r => timelineHeaders.map(h => {
          const val = r[h] ?? '';
          return String(val).includes(',') ? `"${val}"` : val;
        }).join(','))
      ).join('\n');
      fs.writeFileSync(path.join(dir,'timeline.csv'), timelineCsv);
      
      // 7. Enhanced summary.json
      const byStatus = {}; const byTemp = {}; const byStage = {}; const byGrade = {};
      leads.forEach(r => { 
        byStatus[r.status||'unknown'] = (byStatus[r.status||'unknown']||0)+1; 
        byTemp[r.temperature_tag||'unknown'] = (byTemp[r.temperature_tag||'unknown']||0)+1;
        byStage[r.stage||'new'] = (byStage[r.stage||'new']||0)+1;
        byGrade[r.grade_label||'ungraded'] = (byGrade[r.grade_label||'ungraded']||0)+1;
      });
      
      const summary = {
        export_date: new Date().toISOString(),
        period: { from, to },
        counts: {
          leads: leads.length,
          graded_leads: gradedLeads.length,
          dispositions: dispositions.length,
          followups: followups.length,
          timeline_events: timeline.length
        },
        breakdowns: {
          by_status: byStatus,
          by_temperature: byTemp,
          by_stage: byStage,
          by_grade: byGrade
        }
      };
      
      fs.writeFileSync(path.join(dir,'summary.json'), JSON.stringify(summary, null, 2));
      
      // zip directory to runId.zip
      const zipPath = path.join(dir, `${runId}.zip`);
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = Archiver('zip', { zlib: { level: 9 } });
        output.on('close', resolve); archive.on('error', reject);
        archive.pipe(output); 
        archive.file(path.join(dir,'leads.csv'), { name: 'leads.csv' });
        archive.file(path.join(dir,'grades.csv'), { name: 'grades.csv' });
        archive.file(path.join(dir,'stages.csv'), { name: 'stages.csv' });
        archive.file(path.join(dir,'dispositions.csv'), { name: 'dispositions.csv' });
        archive.file(path.join(dir,'followups.csv'), { name: 'followups.csv' });
        archive.file(path.join(dir,'timeline.csv'), { name: 'timeline.csv' });
        archive.file(path.join(dir,'summary.json'), { name: 'summary.json' });
        archive.finalize();
      });
      
      // Track metrics
      if (exportBundlesCounter) {
        exportBundlesCounter.inc({ kind: 'weekly' });
      }
      
      const exp = Math.floor(Date.now()/1000) + defaultTtl;
      const relZip = `${runId}/${runId}.zip`;
      const bundleUrl = `/admin/artifact-download?path=${encodeURIComponent(relZip)}&exp=${exp}&sig=${signUtil(relZip, exp, process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret')}`;
      try { auditMut(req); } catch {}
      return res.json({ 
        ok: true, 
        bundleUrl,
        export_summary: summary
      });
    } catch (e) {
      console.error('[Weekly Export] Error:', e);
      return sendProblem(res, 'export_error', String(e?.message || e), undefined, 500);
    }
  });

  // === Lead Grading v1 ===
  
  // === Dialer Outcomes & Follow-ups Helper Functions ===
  
  // Generate UUID for database IDs
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Add timeline event
  function addTimelineEvent(leadId, kind, payload = {}) {
    try {
      const id = generateId();
      const payloadJson = JSON.stringify(payload);
      
      db.prepare(`
        INSERT INTO timeline_events (id, lead_id, kind, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, leadId, kind, payloadJson, new Date().toISOString());
      
      // Increment metrics
      if (timelineEventsCounter) {
        timelineEventsCounter.inc({ kind });
      }
      
      return id;
    } catch (e) {
      console.warn('[Timeline] Error adding event:', e.message);
      return null;
    }
  }
  
  // Update follow-up gauges
  function updateFollowupGauges() {
    try {
      const now = new Date().toISOString();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      // Count due follow-ups (open and due_at <= now)
      const dueCount = db.prepare(`
        SELECT COUNT(*) as count FROM follow_ups 
        WHERE status = 'open' AND due_at <= ?
      `).get(now).count;
      
      // Count overdue follow-ups (open and due_at < today)
      const overdueCount = db.prepare(`
        SELECT COUNT(*) as count FROM follow_ups 
        WHERE status = 'open' AND due_at < ?
      `).get(startOfToday.toISOString()).count;
      
      if (followupsDueGauge) {
        followupsDueGauge.set(dueCount);
      }
      
      if (followupsOverdueGauge) {
        followupsOverdueGauge.set(overdueCount);
      }
    } catch (e) {
      console.warn('[Metrics] Error updating follow-up gauges:', e.message);
    }
  }
  
  // Lead grading computation function
  function computeLeadGrade(lead) {
    let score = 0;
    const reasons = [];
    
    // Equity percentage (0-40 points)
    if (lead.equity !== null && lead.equity !== undefined && lead.estimated_value > 0) {
      const equityPct = lead.equity * 100; // Convert to percentage
      if (equityPct >= 50) {
        score += 40;
        reasons.push(`High equity (${equityPct.toFixed(1)}%)`);
      } else if (equityPct >= 35) {
        score += 30;
        reasons.push(`Good equity (${equityPct.toFixed(1)}%)`);
      } else if (equityPct >= 20) {
        score += 20;
        reasons.push(`Moderate equity (${equityPct.toFixed(1)}%)`);
      } else if (equityPct > 0) {
        score += 10;
        reasons.push(`Low equity (${equityPct.toFixed(1)}%)`);
      }
    } else {
      reasons.push('No equity data');
    }
    
    // Motivation score (0-25 points)
    if (lead.motivation_score >= 80) {
      score += 25;
      reasons.push(`Very high motivation (${lead.motivation_score})`);
    } else if (lead.motivation_score >= 60) {
      score += 20;
      reasons.push(`High motivation (${lead.motivation_score})`);
    } else if (lead.motivation_score >= 40) {
      score += 15;
      reasons.push(`Moderate motivation (${lead.motivation_score})`);
    } else if (lead.motivation_score >= 20) {
      score += 10;
      reasons.push(`Low motivation (${lead.motivation_score})`);
    } else {
      reasons.push(`Very low motivation (${lead.motivation_score})`);
    }
    
    // Temperature tag (0-15 points)
    if (lead.temperature_tag === 'hot') {
      score += 15;
      reasons.push('Hot temperature');
    } else if (lead.temperature_tag === 'warm') {
      score += 10;
      reasons.push('Warm temperature');
    } else if (lead.temperature_tag === 'cold') {
      score += 5;
      reasons.push('Cold temperature');
    } else {
      reasons.push(`${lead.temperature_tag} temperature`);
    }
    
    // Skip trace presence (0-10 points)
    if (lead.skip_traced_at) {
      if (lead.phones_count > 0) {
        score += 10;
        reasons.push(`Skip traced with ${lead.phones_count} phone(s)`);
      } else {
        score += 5;
        reasons.push('Skip traced but no phones found');
      }
    } else {
      reasons.push('Not skip traced');
    }
    
    // Property characteristics bonus (0-10 points)
    let propBonus = 0;
    if (lead.is_probate) {
      propBonus += 5;
      reasons.push('Probate property');
    }
    if (lead.is_vacant) {
      propBonus += 5;
      reasons.push('Vacant property');
    }
    score += Math.min(propBonus, 10);
    
    // Determine grade label
    let label;
    if (score >= 85) {
      label = 'A+';
    } else if (score >= 75) {
      label = 'A';
    } else if (score >= 65) {
      label = 'B+';
    } else if (score >= 55) {
      label = 'B';
    } else if (score >= 45) {
      label = 'C+';
    } else if (score >= 35) {
      label = 'C';
    } else if (score >= 25) {
      label = 'D';
    } else {
      label = 'F';
    }
    
    return {
      score: Math.min(score, 100), // Cap at 100
      label,
      reason: reasons.join('; ')
    };
  }

  // API endpoint to recompute grades for all leads
  app.post('/admin/grade/recompute', async (req, res) => {
    try {
      const { force = false } = req.body;
      
      // Get leads to grade (either all if force=true, or only ungraded)
      const whereClause = force ? '' : 'WHERE grade_score IS NULL OR grade_computed_at IS NULL';
      const leads = db.prepare(`SELECT * FROM leads ${whereClause}`).all();
      
      let processed = 0;
      let updated = 0;
      
      for (const lead of leads) {
        processed++;
        const grade = computeLeadGrade(lead);
        
        // Update the lead with computed grade
        const result = db.prepare(`
          UPDATE leads 
          SET grade_score = ?, grade_label = ?, grade_reason = ?, grade_computed_at = ?
          WHERE id = ?
        `).run(grade.score, grade.label, grade.reason, new Date().toISOString(), lead.id);
        
        if (result.changes > 0) {
          updated++;
        }
      }
      
      // Record metrics
      if (gradeComputationsCounter) {
        gradeComputationsCounter.inc({ type: force ? 'recompute_all' : 'compute_missing' }, processed);
      }
      
      return res.json({
        ok: true,
        processed,
        updated,
        message: `Processed ${processed} leads, updated ${updated} grades`
      });
      
    } catch (e) {
      console.error('[Grading] Error during grade computation:', e);
      return sendProblem(res, 'grade_computation_error', String(e?.message || e), undefined, 500);
    }
  });

  // API endpoint to get individual lead grade
  app.get('/api/leads/:id/grade', (req, res) => {
    try {
      const { id } = req.params;
      
      const lead = db.prepare(`
        SELECT grade_score, grade_label, grade_reason, grade_computed_at
        FROM leads WHERE id = ?
      `).get(id);
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      return res.json({
        grade_score: lead.grade_score,
        grade_label: lead.grade_label,
        grade_reason: lead.grade_reason,
        grade_computed_at: lead.grade_computed_at
      });
      
    } catch (e) {
      console.error('[Grading] Error fetching grade:', e);
      return sendProblem(res, 'grade_fetch_error', String(e?.message || e), undefined, 500);
    }
  });

  // UI endpoint for grading management
  app.get('/ops/grading', (req, res) => {
    try {
      // Get grade distribution stats
      const gradeStats = db.prepare(`
        SELECT 
          grade_label,
          COUNT(*) as count,
          AVG(grade_score) as avg_score
        FROM leads 
        WHERE grade_label IS NOT NULL
        GROUP BY grade_label
        ORDER BY grade_label
      `).all();
      
      const totalGraded = db.prepare('SELECT COUNT(*) as count FROM leads WHERE grade_score IS NOT NULL').get().count;
      const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
      const ungradedCount = totalLeads - totalGraded;
      
      // Recent high-grade leads for preview
      const highGradeLeads = db.prepare(`
        SELECT id, address, owner_name, grade_score, grade_label, grade_reason
        FROM leads 
        WHERE grade_score >= 70
        ORDER BY grade_score DESC, grade_computed_at DESC
        LIMIT 10
      `).all();
      
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      
      const gradeStatsRows = gradeStats.map(g => 
        `<tr><td>${esc(g.grade_label)}</td><td>${g.count}</td><td>${g.avg_score ? g.avg_score.toFixed(1) : 'N/A'}</td></tr>`
      ).join('');
      
      const highGradeRows = highGradeLeads.map(r =>
        `<tr><td><a href="/ops/leads/${encodeURIComponent(r.id)}">${esc(r.id.slice(0,8))}...</a></td><td>${esc(r.address)}</td><td>${esc(r.owner_name)}</td><td><span class="grade-${r.grade_label?.toLowerCase()?.replace('+','plus')}">${esc(r.grade_label)}</span></td><td>${r.grade_score}</td><td title="${esc(r.grade_reason)}">${esc(r.grade_reason?.substring(0,50))}...</td></tr>`
      ).join('');
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lead Grading</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:16px}
        table{border-collapse:collapse;width:100%;margin:16px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#f8f8f8}
        .toolbar{margin-bottom:16px;padding:12px;background:#f0f0f0;border-radius:4px}
        .stats{display:flex;gap:20px;margin:16px 0}
        .stat{padding:12px;background:white;border:1px solid #ddd;border-radius:4px;text-align:center}
        .stat-value{font-size:24px;font-weight:bold;color:#333}
        .stat-label{font-size:12px;color:#666;margin-top:4px}
        .grade-a-plus,.grade-aplus{color:#008000;font-weight:bold}
        .grade-a{color:#228B22;font-weight:bold}
        .grade-b-plus,.grade-bplus{color:#32CD32}
        .grade-b{color:#9ACD32}
        .grade-c-plus,.grade-cplus{color:#FFD700}
        .grade-c{color:#FFA500}
        .grade-d{color:#FF6347}
        .grade-f{color:#DC143C;font-weight:bold}
        button{padding:8px 16px;margin:4px;border:1px solid #ccc;background:white;cursor:pointer}
        button:hover{background:#f0f0f0}
        .btn-primary{background:#007bff;color:white;border-color:#007bff}
        .btn-primary:hover{background:#0056b3}
      </style></head><body>
      <h1>Lead Grading Dashboard</h1>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${totalLeads}</div>
          <div class="stat-label">Total Leads</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalGraded}</div>
          <div class="stat-label">Graded</div>
        </div>
        <div class="stat">
          <div class="stat-value">${ungradedCount}</div>
          <div class="stat-label">Ungraded</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalGraded > 0 ? Math.round((totalGraded/totalLeads)*100) : 0}%</div>
          <div class="stat-label">Coverage</div>
        </div>
      </div>
      
      <div class="toolbar">
        <button class="btn-primary" onclick="recomputeGrades(false)">Grade Ungraded Leads</button>
        <button onclick="recomputeGrades(true)">Regrade All Leads</button>
        <span style="margin-left:16px">
          <a href="/ops/leads">View All Leads</a> | 
          <a href="/ops/campaigns">Campaign Search</a>
        </span>
      </div>

      <h3>Grade Distribution</h3>
      <table>
        <thead><tr><th>Grade</th><th>Count</th><th>Avg Score</th></tr></thead>
        <tbody>${gradeStatsRows || '<tr><td colspan="3">No graded leads</td></tr>'}</tbody>
      </table>

      <h3>Top Graded Leads</h3>
      <table>
        <thead><tr><th>ID</th><th>Address</th><th>Owner</th><th>Grade</th><th>Score</th><th>Reasoning</th></tr></thead>
        <tbody>${highGradeRows || '<tr><td colspan="6">No high-grade leads</td></tr>'}</tbody>
      </table>

      <script>
        async function recomputeGrades(force) {
          const btn = event.target;
          btn.disabled = true;
          btn.textContent = 'Processing...';
          
          try {
            const response = await fetch('/admin/grade/recompute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force })
            });
            
            const result = await response.json();
            if (result.ok) {
              alert(\`Success: \${result.message}\`);
              location.reload();
            } else {
              alert('Error: ' + result.message);
            }
          } catch (e) {
            alert('Error: ' + e.message);
          } finally {
            btn.disabled = false;
            btn.textContent = force ? 'Regrade All Leads' : 'Grade Ungraded Leads';
          }
        }
      </script>
      </body></html>`;
      
      res.set('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (e) {
      console.error('[Grading] UI error:', e);
      return sendProblem(res, 'grading_ui_error', String(e?.message || e), undefined, 500);
    }
  });

  // === PI2 Grade Calibration v1.1 ===
  
  // Helper function to compute grade with custom weights
  const computeGradeWithWeights = (lead, weights = {}) => {
    const defaultWeights = {
      motivation_score: 0.3,
      estimated_value: 0.2,
      equity: 0.2,
      condition_score: 0.1,
      temperature_factor: 0.1,
      vacant_penalty: -0.1,
      probate_bonus: 0.1
    };
    
    const w = { ...defaultWeights, ...weights };
    let score = 0;
    const reasons = [];
    
    // Motivation score (0-100)
    if (lead.motivation_score) {
      const motivationContrib = (lead.motivation_score / 100) * w.motivation_score * 100;
      score += motivationContrib;
      reasons.push(`motivation: ${motivationContrib.toFixed(1)}`);
    }
    
    // Estimated value (higher is better)
    if (lead.estimated_value && lead.estimated_value > 0) {
      const valueContrib = Math.min(50, (lead.estimated_value / 500000) * w.estimated_value * 100);
      score += valueContrib;
      reasons.push(`value: ${valueContrib.toFixed(1)}`);
    }
    
    // Equity (0-1 scale)
    if (lead.equity && lead.equity > 0) {
      const equityContrib = lead.equity * w.equity * 100;
      score += equityContrib;
      reasons.push(`equity: ${equityContrib.toFixed(1)}`);
    }
    
    // Condition score (0-100, higher is better)
    if (lead.condition_score) {
      const conditionContrib = (lead.condition_score / 100) * w.condition_score * 100;
      score += conditionContrib;
      reasons.push(`condition: ${conditionContrib.toFixed(1)}`);
    }
    
    // Temperature factor
    const tempScore = { 'hot': 100, 'warm': 70, 'cold': 30, 'dead': 0 }[lead.temperature_tag] || 0;
    const tempContrib = (tempScore / 100) * w.temperature_factor * 100;
    score += tempContrib;
    reasons.push(`temp: ${tempContrib.toFixed(1)}`);
    
    // Penalties and bonuses
    if (lead.is_vacant) {
      score += w.vacant_penalty * 100;
      reasons.push(`vacant penalty: ${(w.vacant_penalty * 100).toFixed(1)}`);
    }
    if (lead.is_probate) {
      score += w.probate_bonus * 100;
      reasons.push(`probate bonus: ${(w.probate_bonus * 100).toFixed(1)}`);
    }
    
    // Ensure score is in 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Assign letter grade
    let label = 'D';
    if (score >= 90) label = 'A+';
    else if (score >= 85) label = 'A';
    else if (score >= 80) label = 'B+';
    else if (score >= 75) label = 'B';
    else if (score >= 70) label = 'C+';
    else if (score >= 65) label = 'C';
    else if (score >= 60) label = 'D+';
    
    return {
      score: Math.round(score),
      label,
      reason: reasons.join('; ')
    };
  };
  
  // POST /admin/grade/calibrate - Dry-run grade calibration
  app.post('/admin/grade/calibrate', async (req, res) => {
    try {
      const { weights = {}, sampleLimit = 100 } = req.body;
      
      // Get sample of leads for calibration preview
      const leads = db.prepare(`
        SELECT * FROM leads 
        ORDER BY RANDOM() 
        LIMIT ?
      `).all(Math.max(1, Math.min(1000, sampleLimit)));
      
      if (leads.length === 0) {
        return sendProblem(res, 'no_leads_found', 'No leads available for calibration', undefined, 400);
      }
      
      // Compute grades with current and new weights
      const currentGrades = leads.map(lead => computeLeadGrade(lead));
      const newGrades = leads.map(lead => computeGradeWithWeights(lead, weights));
      
      // Calculate deltas and summary stats
      const by_label = {};
      const deltas = [];
      const top_examples = [];
      
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const current = currentGrades[i];
        const updated = newGrades[i];
        const delta = updated.score - current.score;
        
        // Track by label
        if (!by_label[updated.label]) {
          by_label[updated.label] = { count: 0, avg_score: 0, examples: [] };
        }
        by_label[updated.label].count++;
        by_label[updated.label].avg_score += updated.score;
        if (by_label[updated.label].examples.length < 3) {
          by_label[updated.label].examples.push({
            id: lead.id,
            address: lead.address,
            current_grade: current.label,
            new_grade: updated.label,
            score_delta: delta
          });
        }
        
        deltas.push(delta);
        
        // Top scoring examples
        if (top_examples.length < 10) {
          top_examples.push({
            id: lead.id,
            address: lead.address,
            owner_name: lead.owner_name,
            current_score: current.score,
            new_score: updated.score,
            current_grade: current.label,
            new_grade: updated.label,
            delta
          });
        }
      }
      
      // Calculate averages for by_label
      Object.keys(by_label).forEach(label => {
        by_label[label].avg_score = Math.round(by_label[label].avg_score / by_label[label].count);
      });
      
      // Sort examples by new score descending
      top_examples.sort((a, b) => b.new_score - a.new_score);
      
      // Calculate delta statistics
      const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
      const maxDelta = Math.max(...deltas);
      const minDelta = Math.min(...deltas);
      
      // Track metrics
      if (leadGradeCalibrationCounter) {
        leadGradeCalibrationCounter.inc({ mode: 'dry' });
      }
      
      res.json({
        ok: true,
        preview: {
          by_label,
          deltas: {
            avg: Math.round(avgDelta * 100) / 100,
            min: Math.round(minDelta * 100) / 100,
            max: Math.round(maxDelta * 100) / 100
          },
          top_examples: top_examples.slice(0, 10)
        },
        sample_size: leads.length,
        weights_used: { ...computeGradeWithWeights.defaultWeights, ...weights }
      });
      
    } catch (e) {
      console.error('[Grade Calibration] Dry-run error:', e);
      return sendProblem(res, 'calibration_dry_run_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // POST /admin/grade/apply-calibration - Apply calibration to all leads
  app.post('/admin/grade/apply-calibration', async (req, res) => {
    try {
      const { weights = {} } = req.body;
      
      // Get all leads for re-grading
      const leads = db.prepare('SELECT * FROM leads').all();
      
      if (leads.length === 0) {
        return sendProblem(res, 'no_leads_found', 'No leads available for calibration', undefined, 400);
      }
      
      let updated = 0;
      const computedAt = new Date().toISOString();
      
      // Begin transaction for bulk updates
      const updateStmt = db.prepare(`
        UPDATE leads 
        SET grade_score = ?, grade_label = ?, grade_reason = ?, grade_computed_at = ?
        WHERE id = ?
      `);
      
      const transaction = db.transaction((leads) => {
        for (const lead of leads) {
          const grade = computeGradeWithWeights(lead, weights);
          const result = updateStmt.run(grade.score, grade.label, grade.reason, computedAt, lead.id);
          if (result.changes > 0) updated++;
        }
      });
      
      transaction(leads);
      
      // Track metrics
      if (leadGradeCalibrationCounter) {
        leadGradeCalibrationCounter.inc({ mode: 'apply' });
      }
      if (gradeComputationsCounter) {
        gradeComputationsCounter.inc({ type: 'apply_v11' }, leads.length);
      }
      
      res.json({
        ok: true,
        total_leads: leads.length,
        updated_leads: updated,
        weights_applied: weights,
        computed_at: computedAt
      });
      
    } catch (e) {
      console.error('[Grade Calibration] Apply error:', e);
      return sendProblem(res, 'calibration_apply_error', String(e?.message || e), undefined, 500);
    }
  });

  // === PI2 CRM-Lite Stages ===
  
  const VALID_STAGES = ['new', 'working', 'contacted', 'follow_up', 'offer_made', 'under_contract', 'closed', 'lost'];
  
  // Helper function to update leads_by_stage_gauge
  const updateStageGauges = () => {
    if (!leadsByStageGauge) return;
    
    try {
      const stageCounts = db.prepare(`
        SELECT stage, COUNT(*) as count 
        FROM leads 
        GROUP BY stage
      `).all();
      
      // Reset all stage gauges to 0 first
      VALID_STAGES.forEach(stage => {
        leadsByStageGauge.set({ stage }, 0);
      });
      
      // Set actual counts
      stageCounts.forEach(({ stage, count }) => {
        if (VALID_STAGES.includes(stage)) {
          leadsByStageGauge.set({ stage }, count);
        }
      });
    } catch (e) {
      console.warn('[Stages] Failed to update stage gauges:', e?.message);
    }
  };
  
  // PATCH /leads/:id/stage - Update lead stage
  app.patch('/leads/:id/stage', async (req, res) => {
    try {
      const { id } = req.params;
      const { stage } = req.body;
      
      // Validate stage
      if (!VALID_STAGES.includes(stage)) {
        return sendProblem(res, 'invalid_stage', `Stage must be one of: ${VALID_STAGES.join(', ')}`, 'stage', 400);
      }
      
      // Get current lead to check existing stage
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) {
        return sendProblem(res, 'lead_not_found', 'Lead not found', 'id', 404);
      }
      
      const oldStage = lead.stage || 'new';
      
      // Update stage
      const result = db.prepare(`
        UPDATE leads 
        SET stage = ?, updated_at = ? 
        WHERE id = ?
      `).run(stage, new Date().toISOString(), id);
      
      if (result.changes === 0) {
        return sendProblem(res, 'stage_update_failed', 'Failed to update stage', undefined, 500);
      }
      
      // Add timeline event
      addTimelineEvent(id, 'stage_change', { 
        from: oldStage, 
        to: stage,
        changed_at: new Date().toISOString()
      });
      
      // Track metrics
      if (stageTransitionsCounter) {
        stageTransitionsCounter.inc({ from: oldStage, to: stage });
      }
      
      // Update stage gauges
      updateStageGauges();
      
      res.json({
        ok: true,
        lead_id: id,
        old_stage: oldStage,
        new_stage: stage,
        updated_at: new Date().toISOString()
      });
      
    } catch (e) {
      console.error('[Stages] Stage update error:', e);
      return sendProblem(res, 'stage_update_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // GET /stages/board - Get stage board view
  app.get('/stages/board', async (req, res) => {
    try {
      const columns = [];
      
      for (const stage of VALID_STAGES) {
        // Get count and sample leads for this stage
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM leads WHERE stage = ?
        `).get(stage).count;
        
        const sample = db.prepare(`
          SELECT id, address, owner_name, estimated_value, grade_label, updated_at
          FROM leads 
          WHERE stage = ?
          ORDER BY updated_at DESC
          LIMIT 5
        `).all(stage);
        
        columns.push({
          stage,
          count,
          sample: sample.map(lead => ({
            id: lead.id,
            address: lead.address,
            owner_name: lead.owner_name,
            estimated_value: lead.estimated_value,
            grade_label: lead.grade_label,
            updated_at: lead.updated_at
          }))
        });
      }
      
      res.json({ columns });
      
    } catch (e) {
      console.error('[Stages] Board error:', e);
      return sendProblem(res, 'stage_board_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // GET /ops/stages - HTML stage board view
  app.get('/ops/stages', async (req, res) => {
    try {
      const columns = [];
      
      for (const stage of VALID_STAGES) {
        // Get count and sample leads for this stage
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM leads WHERE stage = ?
        `).get(stage).count;
        
        const sample = db.prepare(`
          SELECT id, address, owner_name, estimated_value, grade_label, updated_at
          FROM leads 
          WHERE stage = ?
          ORDER BY updated_at DESC
          LIMIT 8
        `).all(stage);
        
        columns.push({
          stage,
          count,
          sample
        });
      }
      
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      
      const columnsHtml = columns.map(col => {
        const sampleRows = col.sample.map(lead => 
          `<div class="lead-card">
            <div class="lead-header">
              <a href="/ops/leads/${encodeURIComponent(lead.id)}" class="lead-id">${esc(lead.id.slice(0,8))}...</a>
              <span class="grade-badge grade-${(lead.grade_label||'').toLowerCase()}">${esc(lead.grade_label||'N/A')}</span>
            </div>
            <div class="lead-address">${esc(lead.address||'')}</div>
            <div class="lead-owner">${esc(lead.owner_name||'Unknown')}</div>
            <div class="lead-value">$${lead.estimated_value ? lead.estimated_value.toLocaleString() : 'N/A'}</div>
          </div>`
        ).join('');
        
        return `
          <div class="stage-column">
            <div class="stage-header">
              <h3>${esc(col.stage.toUpperCase())}</h3>
              <span class="stage-count">${col.count}</span>
            </div>
            <div class="stage-content">
              ${sampleRows}
              ${col.count > col.sample.length ? `<div class="more-leads">+${col.count - col.sample.length} more leads</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>CRM Stages</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:16px;margin:0;background:#f8f9fa}
        .stage-board{display:flex;gap:16px;overflow-x:auto;padding:16px 0}
        .stage-column{background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);min-width:280px;max-width:320px;flex-shrink:0}
        .stage-header{padding:16px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center}
        .stage-header h3{margin:0;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
        .stage-count{background:#6c757d;color:white;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500}
        .stage-content{padding:8px;max-height:600px;overflow-y:auto}
        .lead-card{background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:12px;margin-bottom:8px}
        .lead-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .lead-id{font-family:monospace;font-size:12px;color:#007bff;text-decoration:none}
        .lead-id:hover{text-decoration:underline}
        .grade-badge{font-size:10px;padding:2px 6px;border-radius:3px;font-weight:600}
        .grade-a,.grade-aplus{background:#d4edda;color:#155724}
        .grade-b,.grade-bplus{background:#d1ecf1;color:#0c5460}
        .grade-c,.grade-cplus{background:#fff3cd;color:#856404}
        .grade-d,.grade-dplus{background:#f8d7da;color:#721c24}
        .lead-address{font-size:13px;font-weight:500;margin-bottom:4px}
        .lead-owner{font-size:12px;color:#6c757d;margin-bottom:4px}
        .lead-value{font-size:12px;color:#28a745;font-weight:500}
        .more-leads{text-align:center;padding:8px;color:#6c757d;font-size:12px;font-style:italic}
        .toolbar{background:white;padding:16px;margin-bottom:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
        .toolbar h1{margin:0 0 8px 0}
        .toolbar p{margin:0;color:#6c757d}
      </style></head>
      <body>
        <div class="toolbar">
          <h1>CRM Stages</h1>
          <p>Track leads through your sales pipeline</p>
        </div>
        <div class="stage-board">
          ${columnsHtml}
        </div>
      </body></html>`;
      
      res.set('Content-Type', 'text/html; charset=utf-8').send(html);
      
    } catch (e) {
      console.error('[Stages] HTML board error:', e);
      return sendProblem(res, 'stage_board_html_error', String(e?.message || e), undefined, 500);
    }
  });

  // === Dialer Outcomes & Follow-ups ===
  
  // POST /dial/:dialId/disposition - Record disposition for a dial attempt
  app.post('/dial/:dialId/disposition', async (req, res) => {
    try {
      const { dialId } = req.params;
      const { type, notes = '' } = req.body;
      
      // Validate disposition type
      const validTypes = ['no_answer', 'voicemail', 'bad_number', 'interested', 'not_interested', 'follow_up'];
      if (!validTypes.includes(type)) {
        return sendProblem(res, 'invalid_disposition_type', `Type must be one of: ${validTypes.join(', ')}`, 'type', 400);
      }
      
      // For this implementation, we'll need to find the lead_id from existing dial records or create a synthetic one
      // Since we don't have a dial attempts table, we'll use the dialId as a reference
      const leadId = dialId; // Simplified: assuming dialId maps to leadId
      
      // Get lead's current grade for metrics
      const lead = db.prepare('SELECT grade_label FROM leads WHERE id = ?').get(leadId);
      const gradeLabel = lead?.grade_label || 'ungraded';
      
      // Generate disposition ID and create record
      const dispositionId = generateId();
      
      db.prepare(`
        INSERT INTO dial_outcomes (id, dial_id, lead_id, type, notes, grade_label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(dispositionId, dialId, leadId, type, notes, gradeLabel, new Date().toISOString());
      
      // Add timeline event
      addTimelineEvent(leadId, 'disposition', { type, notes, dialId });
      
      // Create artifact file
      try {
        const artifactDir = path.resolve(ARTIFACT_ROOT, 'dialer', 'dispositions');
        fs.mkdirSync(artifactDir, { recursive: true });
        const artifactPath = path.join(artifactDir, `${dialId}.json`);
        
        const dispositionData = {
          id: dispositionId,
          dialId,
          leadId,
          type,
          notes,
          gradeLabel,
          createdAt: new Date().toISOString()
        };
        
        // Append to existing file or create new one
        let dispositions = [];
        if (fs.existsSync(artifactPath)) {
          try {
            dispositions = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          } catch (e) {
            dispositions = [];
          }
        }
        dispositions.push(dispositionData);
        fs.writeFileSync(artifactPath, JSON.stringify(dispositions, null, 2));
      } catch (e) {
        console.warn('[Disposition] Error writing artifact:', e.message);
      }
      
      // Update metrics
      if (dialDispositionTotalCounter) {
        dialDispositionTotalCounter.inc({ type, grade_label: gradeLabel });
      }
      
      return res.json({ ok: true, id: dispositionId });
      
    } catch (e) {
      console.error('[Disposition] Error:', e);
      return sendProblem(res, 'disposition_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // POST /leads/:id/followups - Create follow-up (admin-gated)
  app.post('/leads/:id/followups', async (req, res) => {
    try {
      const { id: leadId } = req.params;
      const { dueAt, channel, priority = 'med', notes = '' } = req.body;
      
      // Validate inputs
      if (!dueAt) {
        return sendProblem(res, 'missing_due_at', 'dueAt is required', 'dueAt', 400);
      }
      
      const validChannels = ['call', 'sms', 'email', 'task'];
      if (!validChannels.includes(channel)) {
        return sendProblem(res, 'invalid_channel', `Channel must be one of: ${validChannels.join(', ')}`, 'channel', 400);
      }
      
      const validPriorities = ['low', 'med', 'high'];
      if (!validPriorities.includes(priority)) {
        return sendProblem(res, 'invalid_priority', `Priority must be one of: ${validPriorities.join(', ')}`, 'priority', 400);
      }
      
      // Check if lead exists
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId);
      if (!lead) {
        return sendProblem(res, 'lead_not_found', 'Lead not found', 'id', 404);
      }
      
      // Validate dueAt is a valid ISO date
      let dueAtDate;
      try {
        dueAtDate = new Date(dueAt);
        if (isNaN(dueAtDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (e) {
        return sendProblem(res, 'invalid_due_at', 'dueAt must be a valid ISO date', 'dueAt', 400);
      }
      
      // Create follow-up
      const followupId = generateId();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO follow_ups (id, lead_id, due_at, status, channel, priority, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(followupId, leadId, dueAt, 'open', channel, priority, notes, now, now);
      
      // Add timeline event
      addTimelineEvent(leadId, 'followup_created', { channel, priority, dueAt, notes });
      
      // Update metrics
      if (followupsCreatedCounter) {
        followupsCreatedCounter.inc({ channel, priority });
      }
      
      // Update gauges
      updateFollowupGauges();
      
      return res.json({ ok: true, id: followupId });
      
    } catch (e) {
      console.error('[Follow-up] Creation error:', e);
      return sendProblem(res, 'followup_creation_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // PATCH /followups/:id - Update follow-up status (admin-gated)
  app.patch('/followups/:id', async (req, res) => {
    try {
      const { id: followupId } = req.params;
      const { status, notes = '', snoozeUntil } = req.body;
      
      // Validate status
      const validStatuses = ['done', 'snoozed', 'canceled'];
      if (!validStatuses.includes(status)) {
        return sendProblem(res, 'invalid_status', `Status must be one of: ${validStatuses.join(', ')}`, 'status', 400);
      }
      
      // Get existing follow-up
      const existing = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(followupId);
      if (!existing) {
        return sendProblem(res, 'followup_not_found', 'Follow-up not found', 'id', 404);
      }
      
      const now = new Date().toISOString();
      let updateFields = ['status', 'updated_at'];
      let updateValues = [status, now];
      
      // Handle snooze logic
      if (status === 'snoozed') {
        if (snoozeUntil) {
          try {
            const snoozeDate = new Date(snoozeUntil);
            if (isNaN(snoozeDate.getTime())) {
              throw new Error('Invalid date');
            }
            updateFields.push('due_at');
            updateValues.push(snoozeUntil);
          } catch (e) {
            return sendProblem(res, 'invalid_snooze_until', 'snoozeUntil must be a valid ISO date', 'snoozeUntil', 400);
          }
        } else {
          // Default snooze: 24 hours from now
          const snoozeDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          updateFields.push('due_at');
          updateValues.push(snoozeDate.toISOString());
        }
        // Reset status to open when snoozing
        updateValues[0] = 'open';
      }
      
      if (notes) {
        updateFields.push('notes');
        updateValues.push(notes);
      }
      
      // Build dynamic UPDATE query
      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      updateValues.push(followupId); // WHERE clause parameter
      
      db.prepare(`UPDATE follow_ups SET ${setClause} WHERE id = ?`).run(...updateValues);
      
      // Add timeline event for completion
      if (status === 'done') {
        addTimelineEvent(existing.lead_id, 'followup_done', { 
          followupId, 
          channel: existing.channel, 
          notes 
        });
      }
      
      // Update metrics
      if (followupsCompletedCounter) {
        followupsCompletedCounter.inc({ status });
      }
      
      // Update gauges
      updateFollowupGauges();
      
      return res.json({ ok: true });
      
    } catch (e) {
      console.error('[Follow-up] Update error:', e);
      return sendProblem(res, 'followup_update_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // GET /leads/:id/timeline - Get timeline events for a lead
  app.get('/leads/:id/timeline', async (req, res) => {
    try {
      const { id: leadId } = req.params;
      
      // Check if lead exists
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId);
      if (!lead) {
        return sendProblem(res, 'lead_not_found', 'Lead not found', 'id', 404);
      }
      
      // Get timeline events from database
      const timelineEvents = db.prepare(`
        SELECT kind, payload_json, created_at 
        FROM timeline_events 
        WHERE lead_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(leadId);
      
      // Transform events for display
      const events = timelineEvents.map(event => {
        let payload = {};
        try {
          payload = JSON.parse(event.payload_json || '{}');
        } catch (e) {
          payload = {};
        }
        
        let summary = '';
        switch (event.kind) {
          case 'created':
            summary = 'Lead created';
            break;
          case 'skiptrace':
            summary = 'Skip trace completed';
            break;
          case 'dial':
            summary = 'Dial attempt made';
            break;
          case 'disposition':
            summary = `Disposition: ${payload.type || 'unknown'}`;
            break;
          case 'followup_created':
            summary = `Follow-up created: ${payload.channel} (${payload.priority} priority)`;
            break;
          case 'followup_done':
            summary = `Follow-up completed: ${payload.channel}`;
            break;
          case 'note':
            summary = 'Note added';
            break;
          default:
            summary = `${event.kind} event`;
        }
        
        return {
          kind: event.kind,
          at: event.created_at,
          summary,
          data: payload
        };
      });
      
      return res.json({ events });
      
    } catch (e) {
      console.error('[Timeline] Error:', e);
      return sendProblem(res, 'timeline_error', String(e?.message || e), undefined, 500);
    }
  });
  
  // GET /followups - List follow-ups with filters
  app.get('/followups', async (req, res) => {
    try {
      const { 
        status = 'open',
        assignee,
        limit = 50,
        page = 1
      } = req.query;
      
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const offset = (pageNum - 1) * limitNum;
      
      let whereConditions = [];
      let params = [];
      
      if (status === 'due') {
        whereConditions.push("status = 'open' AND due_at <= ?");
        params.push(new Date().toISOString());
      } else if (status === 'overdue') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        whereConditions.push("status = 'open' AND due_at < ?");
        params.push(startOfToday.toISOString());
      } else {
        whereConditions.push("status = ?");
        params.push(status);
      }
      
      // Note: assignee filtering would require user/assignment system - skip for now
      
      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM follow_ups ${whereClause}`;
      const total = db.prepare(countSql).get(...params).count;
      
      // Get records with lead details
      const sql = `
        SELECT f.*, l.address, l.owner_name 
        FROM follow_ups f
        JOIN leads l ON f.lead_id = l.id
        ${whereClause}
        ORDER BY f.due_at ASC, f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const followups = db.prepare(sql).all(...params, limitNum, offset);
      
      const pages = Math.max(1, Math.ceil(total / limitNum));
      
      return res.json({
        followups,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages
        }
      });
      
    } catch (e) {
      console.error('[Follow-ups] List error:', e);
      return sendProblem(res, 'followups_list_error', String(e?.message || e), undefined, 500);
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
    
    // Initialize and periodically update follow-up and stage gauges
    updateFollowupGauges();
    updateStageGauges();
    const metricsInterval = setInterval(() => {
      updateFollowupGauges();
      updateStageGauges();
    }, 5 * 60 * 1000); // Update every 5 minutes
    console.log(`📊 Follow-up and stage metrics gauges initialized (5 minute refresh interval)`);
    
    // Handle process termination gracefully
    const gracefulShutdown = (signal) => {
      console.log(`${signal} received: cleaning up metrics scheduler...`);
      clearInterval(metricsInterval);
      console.log('Closing database connection...');
      db.close();
      console.log('Graceful shutdown complete');
      process.exit(0);
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
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
