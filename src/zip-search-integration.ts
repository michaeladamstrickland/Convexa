/*
 * ZIP Search Integration
 * 
 * This file shows how to integrate the ZIP search routes into the main server.
 * Copy and paste these sections into your server.ts file.
 */

// Import section - add to your imports
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Express, Request, Response } from 'express';

interface LeadRecord {
  id: string;
  address: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  estimated_value: number | null;
  equity: number | null;
  motivation_score: number;
  temperature_tag: string | null;
  status: string;
  source_type: string;
  is_probate: boolean;
  is_vacant: boolean;
  condition_score: number;
  lead_score: number;
  created_at: Date;
  updated_at: Date;
}

interface SearchResult {
  count: number;
  total: number;
}

// Database connection - add near other database connections
const setupZipSearchDb = (): BetterSqlite3.Database | null => {
  const rootDbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
  
  if (!fs.existsSync(rootDbPath)) {
    console.error(`Database file not found at ${rootDbPath}`);
    return null;
  }
  
  try {
    const db = new BetterSqlite3(rootDbPath, { readonly: false });
    const countResult = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
    console.log(`Connected to SQLite database with ${countResult.count} leads`);
    return db;
  } catch (error) {
    console.error('Error connecting to SQLite database:', error);
    return null;
  }
};

// Create database connection
const zipSearchDb = setupZipSearchDb();

// Helper function - add near your utility functions
function getTemperatureTag(motivationScore: number): string {
  if (motivationScore <= 25) return 'dead';
  if (motivationScore <= 50) return 'warm';
  if (motivationScore <= 75) return 'hot';
  return 'on_fire';
}

// Route handlers - add to your Express app setup
const setupZipSearchRoutes = (app: Express): void => {
  if (!zipSearchDb) {
    console.warn('ZIP search database not available, routes will not be added');
    return;
  }
  
  // Unified search endpoint
  app.get('/api/zip-search/search', (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      const minValue = req.query.minValue as string;
      const maxValue = req.query.maxValue as string;
      const city = req.query.city as string;
      const state = req.query.state as string;
      const zipCode = req.query.zipCode as string;
      const propertyType = req.query.propertyType as string;
      const source = req.query.source as string;
      const temperature = req.query.temperature as string;
      const limit = req.query.limit ? String(req.query.limit) : '50';
      const page = req.query.page ? String(req.query.page) : '1';
      
      let sql = 'SELECT * FROM leads';
      const params: (string | number)[] = [];
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
      
      const countResult = zipSearchDb!.prepare(countSql).get(...params) as { total: number };
      const totalCount = countResult.total;
      
      // Add ORDER BY and pagination
      sql += ' ORDER BY created_at DESC';
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limitNum, skip);
      
      // Execute query
      const leads = zipSearchDb!.prepare(sql).all(...params) as LeadRecord[];
      
      // Process the results
      const formattedLeads = leads.map((lead: LeadRecord) => ({
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
        createdAt: lead.created_at,
        updatedAt: lead.updated_at
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
  app.post('/api/zip-search/search-zip', (req, res) => {
    try {
      const { zipCode } = req.body;
      
      if (!zipCode) {
        return res.status(400).json({ error: 'Zip code is required' });
      }
      
      // Execute query
      const leads = zipSearchDb.prepare('SELECT * FROM leads WHERE address LIKE ?')
        .all(`%${zipCode}%`) as LeadRecord[];
      
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
  
  // Revenue analytics endpoint
  app.get('/api/zip-search/revenue-analytics', (req: Request, res: Response) => {
    try {
      // Calculate total estimated value
      const totalValueResult = zipSearchDb!.prepare('SELECT SUM(estimated_value) as totalValue FROM leads')
        .get() as { totalValue: number | null };
      
      // Get lead counts by source
      const leadsBySource = zipSearchDb!.prepare('SELECT source_type as source, COUNT(*) as count FROM leads GROUP BY source_type')
        .all() as Array<{ source: string; count: number }>;
      
      // Get temperature distribution
      const temperatureDistribution = zipSearchDb!.prepare(
        'SELECT temperature_tag as tag, COUNT(*) as count FROM leads GROUP BY temperature_tag'
      ).all() as Array<{ tag: string; count: number }>;
      
      // Prepare response
      const totalLeadsResult = zipSearchDb!.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
      const avgScoreResult = zipSearchDb!.prepare('SELECT AVG(motivation_score) as avg FROM leads').get() as { avg: number | null };
      
      res.json({
        analytics: {
          totalLeads: totalLeadsResult.count,
          totalEstimatedValue: totalValueResult.totalValue || 0,
          avgMotivationScore: avgScoreResult.avg || 0,
          leadsBySource,
          temperatureDistribution,
          potentialRevenue: (totalValueResult.totalValue || 0) * 0.05, // Example: 5% of total value
        }
      });
    } catch (error) {
      console.error('Error in revenue analytics endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  console.log('ZIP search routes added successfully');
};

// Use in your server.ts like:
// setupZipSearchRoutes(app);

// Cleanup on exit - add to your cleanup handlers
process.on('exit', () => {
  if (zipSearchDb) {
    console.log('Closing ZIP search database connection...');
    zipSearchDb.close();
  }
});
