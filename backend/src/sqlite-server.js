import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import BetterSqlite3 from 'better-sqlite3';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up Express
const app = express();
const PORT = 5001;

// Connect to SQLite database
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log(`Connecting to SQLite database at: ${dbPath}`);
const db = new BetterSqlite3(dbPath, { readonly: false });

// Middleware
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'connected',
    engine: 'better-sqlite3'
  });
});

// Search endpoint
app.get('/api/zip-search-new/search', (req, res) => {
  try {
    const {
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      limit = 50,
      page = 1
    } = req.query;
    
    // Start building our SQL query
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
    
    // Add WHERE clauses to our SQL query if we have any
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Add order by
    sql += ' ORDER BY created_at DESC';
    
    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), skip);
    
    console.log('SQL Query:', sql);
    console.log('Parameters:', params);
    
    // Execute the query
    const stmt = db.prepare(sql);
    const leads = stmt.all(...params);
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM leads';
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    const totalCount = db.prepare(countSql).get(...params.slice(0, params.length - 2))?.total || 0;
    
    // Format response
    const formattedLeads = leads.map(lead => {
      return {
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score,
        temperatureTag: lead.temperature_tag,
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

// Zip code search endpoint
app.post('/api/zip-search-new/search-zip', (req, res) => {
  try {
    const { zipCode } = req.body;
    
    if (!zipCode) {
      return res.status(400).json({ error: 'Zip code is required' });
    }
    
    // Execute the query
    const leads = db.prepare('SELECT * FROM leads WHERE address LIKE ?')
      .all(`%${zipCode}%`);
    
    res.json({
      leadCount: leads.length,
      zipCode,
      leads: leads.map(lead => {
        return {
          id: lead.id,
          propertyAddress: lead.address,
          ownerName: lead.owner_name,
          estimatedValue: lead.estimated_value,
          equity: lead.equity,
          motivationScore: lead.motivation_score
        };
      })
    });
  } catch (error) {
    console.error('Error in zip code search endpoint:', error);
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

// List database tables
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
  console.log(`🚀 Simple ZIP Search API Server running on port ${PORT}`);
  console.log(`🔍 Try searching: http://localhost:${PORT}/api/zip-search-new/search?limit=5`);
  console.log(`🏠 Try ZIP search: POST http://localhost:${PORT}/api/zip-search-new/search-zip with body {"zipCode":"85034"}`);
  console.log(`💰 Revenue analytics: http://localhost:${PORT}/api/zip-search-new/revenue-analytics`);
  console.log(`ℹ️ Database info: http://localhost:${PORT}/api/db-info`);
});

export default app;
