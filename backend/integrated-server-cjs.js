// Integrated Server - CommonJS Version - Combines ZIP Search API, ATTOM Property Data API, and Search API
// This server provides both your existing functionality and the ATTOM API integration

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

// Load environment variables
dotenv.config();

// Main function to create and start the server
const startServer = async () => {
  // Setup Express
  const app = express();
  const PORT = process.env.PORT || 5001;
  
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
      services: ['zip-search', 'attom-api', 'search-api'],
      timestamp: new Date().toISOString()
    });
  });
  
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
  
  // Other API endpoints you need from integrated-server.js can be added here
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 FlipTracker Integrated API Server running on port ${PORT}`);
    console.log(`💾 Connected to database with ${db.prepare('SELECT COUNT(*) as count FROM leads').get().count} leads`);
    console.log(`🏠 ATTOM Property Data API ${process.env.ATTOM_API_KEY ? 'enabled' : 'not configured'}`);
    console.log(`✅ API endpoints ready for use:`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
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
