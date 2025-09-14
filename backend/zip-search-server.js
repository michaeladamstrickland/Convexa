// Final solution - ZIP Search API using direct SQLite access
// This approach bypasses the Prisma client issues while providing the same functionality

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

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
      timestamp: new Date().toISOString()
    });
  });
  
  // System status
  app.get('/api/status', (req, res) => {
    try {
      const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      
      res.json({
        status: 'online',
        database: 'connected',
        leadCount: leadCount.count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
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
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 ZIP Search API Server running on port ${PORT}`);
    console.log(`💾 Connected to database with ${db.prepare('SELECT COUNT(*) as count FROM leads').get().count} leads`);
    console.log(`✅ API endpoints ready for use:`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
    console.log(`  - Search: http://localhost:${PORT}/api/zip-search-new/search?limit=5`);
    console.log(`  - Analytics: http://localhost:${PORT}/api/zip-search-new/revenue-analytics`);
    
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
