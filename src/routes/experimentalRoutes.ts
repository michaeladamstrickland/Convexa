import express, { Request, Response } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Create router
const router = express.Router();

// Initialize database connection
let db: BetterSqlite3.Database | null = null;

// Setup database connection
const setupDb = () => {
  const rootDbPath = path.resolve(__dirname, '..', '..', 'prisma', 'dev.db');
  
  if (!fs.existsSync(rootDbPath)) {
    console.error(`Database file not found at ${rootDbPath}`);
    return null;
  }
  
  try {
    const database = new BetterSqlite3(rootDbPath, { readonly: false });
    const leadCountRow = database.prepare('SELECT COUNT(*) as count FROM Lead').get() as { count: number };
    console.log(`Connected to SQLite database with ${leadCountRow.count} leads`);
    return database;
  } catch (error: any) {
    console.error('Error connecting to SQLite database:', error);
    return null;
  }
};

// Helper function
function getTemperatureTag(motivationScore: number) {
  if (motivationScore <= 25) return 'DEAD';
  if (motivationScore <= 50) return 'WARM';
  if (motivationScore <= 75) return 'HOT';
  return 'ON_FIRE';
}

// Middleware to ensure database is connected
router.use((req: Request, res: Response, next) => {
  if (!db) {
    db = setupDb();
    
    if (!db) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        message: 'Could not connect to SQLite database'
      });
    }
  }
  next();
});

// GET /api/_experimental/search - Legacy search endpoint using better-sqlite3
router.get('/search', (req: Request, res: Response) => {
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
    
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }
    
    let sql = 'SELECT * FROM Lead';
    const params: any[] = [];
    const whereClauses: string[] = [];
    
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
      whereClauses.push('source = ?');
      params.push(source);
    }
    
    if (temperature) {
      whereClauses.push('temperature_tag = ?');
      params.push(temperature);
    }
    
    if (minValue || maxValue) {
      if (minValue) {
        whereClauses.push('estimated_value >= ?');
        params.push(parseFloat(minValue as string));
      }
      
      if (maxValue) {
        whereClauses.push('estimated_value <= ?');
        params.push(parseFloat(maxValue as string));
      }
    }
    
    // Add WHERE clause if needed
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM Lead';
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
  const totalRow = db.prepare(countSql).get(...params) as { total: number };
  const totalCount = totalRow.total;
    
    // Add ORDER BY and pagination
    sql += ' ORDER BY created_at DESC';
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), skip);
    
    // Execute query
    const leads = db.prepare(sql).all(...params);
    
    // Process the results
    const formattedLeads = leads.map((lead: any) => ({
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
      source: lead.source,
      sourceType: lead.source_type,
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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('Error in experimental search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/_experimental/search-zip - Legacy ZIP code search using better-sqlite3
router.post('/search-zip', (req: Request, res: Response) => {
  try {
    const { zipCode } = req.body;
    
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }
    
    if (!zipCode) {
      return res.status(400).json({ error: 'Zip code is required' });
    }
    
    // Execute query
    const leads = db.prepare('SELECT * FROM Lead WHERE address LIKE ?')
      .all(`%${zipCode}%`);
    
    // Format response
    res.json({
      leadCount: leads.length,
      zipCode,
      leads: leads.map((lead: any) => ({
        id: lead.id,
        propertyAddress: lead.address,
        ownerName: lead.owner_name,
        estimatedValue: lead.estimated_value,
        equity: lead.equity,
        motivationScore: lead.motivation_score
      }))
    });
  } catch (error: any) {
    console.error('Error in experimental ZIP search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/_experimental/revenue-analytics - Legacy revenue analytics using better-sqlite3
router.get('/revenue-analytics', (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }
    
    // Calculate total estimated value
    const totalValueResult = db.prepare('SELECT SUM(estimated_value) as totalValue FROM Lead')
      .get() as { totalValue: number | null };
    
    // Get lead counts by source
    const leadsBySource = db.prepare('SELECT source as source, COUNT(*) as count FROM Lead GROUP BY source')
      .all();
    
    // Get temperature distribution
    const temperatureDistribution = db.prepare(
      'SELECT temperature_tag as tag, COUNT(*) as count FROM Lead GROUP BY temperature_tag'
    ).all();
    
    // Prepare response
    res.json({
      analytics: {
        totalLeads: (db.prepare('SELECT COUNT(*) as count FROM Lead').get() as { count: number }).count,
        totalEstimatedValue: (totalValueResult.totalValue || 0),
        avgMotivationScore: (db.prepare('SELECT AVG(motivation_score) as avg FROM Lead').get() as { avg: number | null }).avg || 0,
        leadsBySource,
        temperatureDistribution,
        potentialRevenue: (totalValueResult.totalValue || 0) * 0.05 // 5% of total value
      }
    });
  } catch (error: any) {
    console.error('Error in experimental revenue analytics endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup on module unload
process.on('exit', () => {
  if (db) {
    console.log('Closing experimental database connection...');
    db.close();
  }
});

export default router;
