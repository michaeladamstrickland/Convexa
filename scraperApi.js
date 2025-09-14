/**
 * scraperApi.js
 * API interface for the scraper system to connect with the UI
 */

const express = require('express');
const ScrapingPipeline = require('./src/scrapingPipeline.cjs');
const DatabaseConnector = require('./src/db/dbConnector.cjs');
const ZillowScraper = require('./src/scraping/zillow-scraper.cjs');
const { scorePropertyBatch } = require('./src/scoring/leadScoring.cjs');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Set up middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database connector
const dbConnector = new DatabaseConnector({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'fliptracker'
});

// Initialize scraping pipeline
const pipeline = new ScrapingPipeline({
  useDatabase: true,
  dbConnector,
  dbConfig: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'fliptracker'
  }
});

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Setup logging
const logStream = fs.createWriteStream(path.join(logsDir, 'api.log'), { flags: 'a' });
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  logStream.write(logMessage);
  console.log(message);
}

// Error handler
function handleError(res, error, message) {
  const errorMessage = `ERROR: ${message} - ${error.message}`;
  logMessage(errorMessage);
  console.error(error);
  res.status(500).json({ error: message, details: error.message });
}

// Initialize active scrapers map
const activeScrapers = new Map();

/**
 * API Routes
 */

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await dbConnector.connect();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Get hot leads endpoint
app.get('/api/leads/hot', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    
    logMessage(`Getting hot leads (limit: ${limit}, skip: ${skip})`);
    const leads = await dbConnector.getHotLeads({ limit, skip });
    
    res.json({
      leads,
      count: leads.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get hot leads');
  }
});

// Search properties endpoint
app.get('/api/properties/search', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    // Build search criteria
    const criteria = {};
    
    if (req.query.city) {
      criteria['address.city'] = { $regex: new RegExp(req.query.city, 'i') };
    }
    
    if (req.query.state) {
      criteria['address.state'] = { $regex: new RegExp(req.query.state, 'i') };
    }
    
    if (req.query.zip) {
      criteria['address.zip'] = req.query.zip;
    }
    
    if (req.query.address) {
      criteria['normalizedAddress'] = { $regex: new RegExp(req.query.address, 'i') };
    }
    
    if (req.query.distressSignal) {
      criteria['distressSignals'] = req.query.distressSignal;
    }
    
    if (req.query.minBeds) {
      criteria['attributes.bedrooms'] = { $gte: parseInt(req.query.minBeds) };
    }
    
    if (req.query.minBaths) {
      criteria['attributes.bathrooms'] = { $gte: parseFloat(req.query.minBaths) };
    }
    
    if (req.query.minSqft) {
      criteria['attributes.squareFeet'] = { $gte: parseInt(req.query.minSqft) };
    }
    
    logMessage(`Searching properties with criteria: ${JSON.stringify(criteria)}`);
    const properties = await dbConnector.searchProperties(criteria, { limit, skip });
    
    res.json({
      properties,
      count: properties.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to search properties');
  }
});

// Start scraper endpoint
app.post('/api/scraper/start', async (req, res) => {
  try {
    const { target, type, options } = req.body;
    
    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }
    
    if (!type || (type !== 'address' && type !== 'area')) {
      return res.status(400).json({ error: 'Valid type is required (address or area)' });
    }
    
    const scraperId = `${type}-${Date.now()}`;
    
    // Configure scraper
    const scraperOptions = {
      headless: options?.headless !== false, // Default to headless true
      screenshots: options?.screenshots || true,
      screenshotDir: path.join(dataDir, 'screenshots')
    };
    
    logMessage(`Starting ${type} scraper for target: ${target}`);
    
    // Initialize scraper asynchronously
    const startScraping = async () => {
      try {
        const scraper = new ZillowScraper(scraperOptions);
        activeScrapers.set(scraperId, { scraper, status: 'initializing' });
        
        await scraper.initialize();
        activeScrapers.set(scraperId, { scraper, status: 'running' });
        
        let properties = [];
        if (type === 'address') {
          logMessage(`Scraping address: ${target}`);
          properties = await scraper.searchByAddress(target);
        } else {
          logMessage(`Scraping area: ${target}`);
          properties = await scraper.searchDistressedProperties(target, options?.maxResults || 5);
        }
        
        logMessage(`Found ${properties.length} properties`);
        activeScrapers.set(scraperId, { scraper, status: 'processing', count: properties.length });
        
        if (properties.length > 0) {
          // Process the scraped properties through the pipeline
          const processed = await pipeline.processScrapedProperties({
            source: 'ZILLOW',
            items: properties
          }, {
            enhanceWithAttom: true,
            deduplicate: true,
            scoreLeads: true
          });
          
          logMessage(`Processed ${processed.length} properties`);
          activeScrapers.set(scraperId, { status: 'completed', count: processed.length });
          
          // Create leads from high-scoring properties
          const leads = await pipeline.createLeadsFromProperties(processed);
          logMessage(`Created ${leads.length} leads`);
        } else {
          activeScrapers.set(scraperId, { status: 'completed', count: 0 });
        }
        
        // Close scraper
        await scraper.close();
      } catch (error) {
        logMessage(`Scraper error: ${error.message}`);
        activeScrapers.set(scraperId, { status: 'error', error: error.message });
      }
    };
    
    // Start scraping process in background
    startScraping();
    
    // Return immediately with scraper ID
    res.json({
      scraperId,
      status: 'started',
      message: `Started ${type} scraper for target: ${target}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to start scraper');
  }
});

// Get scraper status endpoint
app.get('/api/scraper/status/:scraperId', (req, res) => {
  try {
    const { scraperId } = req.params;
    
    if (!activeScrapers.has(scraperId)) {
      return res.status(404).json({ error: 'Scraper not found' });
    }
    
    const scraperInfo = activeScrapers.get(scraperId);
    
    res.json({
      scraperId,
      status: scraperInfo.status,
      count: scraperInfo.count,
      error: scraperInfo.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get scraper status');
  }
});

// Score property endpoint
app.post('/api/score/property', (req, res) => {
  try {
    const property = req.body;
    
    if (!property) {
      return res.status(400).json({ error: 'Property data is required' });
    }
    
    // Score property
    const scoredProperty = scorePropertyBatch([property])[0];
    
    res.json({
      property: scoredProperty,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to score property');
  }
});

// Start the server
app.listen(port, () => {
  logMessage(`Scraper API server listening on port ${port}`);
});
