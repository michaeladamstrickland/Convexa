// Simple standalone API server for ZIP search using better-sqlite3
// This file doesn't rely on Prisma and connects directly to the SQLite database

import express from 'express';
import cors from 'cors';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express
const app = express();
const PORT = 5001;

// Find the database file
function findDatabaseFile() {
  const possiblePaths = [
    path.resolve(__dirname, 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`✓ Found database at: ${p}`);
      return p;
    }
  }

  console.error('❌ Database file not found in any of the expected locations');
  process.exit(1);
}

// Connect to SQLite database
const dbPath = findDatabaseFile();
const db = new BetterSqlite3(dbPath, { readonly: false });

// Configure Express middleware
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    database: 'sqlite',
    timestamp: new Date().toISOString()
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
  
  res.json({
    status: 'online',
    database: 'connected',
    leadCount: leadCount.count,
    timestamp: new Date().toISOString()
  });
});

// General search endpoint
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
    
    // Add search filters
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
    
    // Add WHERE clause if we have any filters
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Add ORDER BY
    sql += ' ORDER BY created_at DESC';
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM leads';
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    const totalCount = db.prepare(countSql).get(...params)?.total || 0;
    
    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), skip);
    
    // Execute query
    const leads = db.prepare(sql).all(...params);
    
    // Format lead data for response
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
    
    // Return response
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

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    availableEndpoints: [
      '/health',
      '/api/zip-search-new/search',
      '/api/zip-search-new/search-zip',
      '/api/zip-search-new/revenue-analytics',
      '/api/db-info'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start the server on all interfaces (0.0.0.0) to ensure accessibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 ZIP Search API Server running on port ${PORT}

📋 Available endpoints:
  • Health check:       http://localhost:${PORT}/health
  • Search:             http://localhost:${PORT}/api/zip-search-new/search?limit=5
  • ZIP search (POST):  http://localhost:${PORT}/api/zip-search-new/search-zip 
                        Body: {"zipCode":"90210"}
  • Analytics:          http://localhost:${PORT}/api/zip-search-new/revenue-analytics
  • Database info:      http://localhost:${PORT}/api/db-info

🔌 Server is listening on all interfaces (0.0.0.0:${PORT})
  • Local access:       http://localhost:${PORT}
  • Network access:     http://<your-ip-address>:${PORT}
  `);
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\nClosing database connection and shutting down server...');
    db.close();
    process.exit(0);
  });
});
