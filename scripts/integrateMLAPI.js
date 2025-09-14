/**
 * integrateMLAPI.js
 * Script to integrate ML API with the main application
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import MLClient from '../services/MLClient.js';
import MLPredictionService from '../services/MLPredictionService.js';
import logger from '../utils/logger.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express application
const app = express();
const PORT = 3030;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Create ML client
const mlClient = new MLClient({
  modelEndpoints: {
    baseUrl: 'http://localhost:5050'
  }
});

// Create ML prediction service
const predictionService = new MLPredictionService(mlClient);

// Initialize ML client
async function initializeApp() {
  logger.info('Initializing application...');
  
  try {
    // Initialize ML client - continue even if it fails
    const initialized = await mlClient.initialize().catch(err => {
      logger.error('ML client initialization error:', err);
      logger.info('Continuing in fallback mode');
      return false;
    });
    
    if (initialized) {
      logger.info('ML client initialized successfully');
    } else {
      logger.warn('ML client initialization failed, running in fallback mode');
    }
    
    // Set up routes
    setupRoutes();
    
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Integration server running on http://0.0.0.0:${PORT}`);
      logger.info(`Visit http://localhost:${PORT} for API documentation`);
    });
    
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Set up API routes
function setupRoutes() {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Property valuation endpoint
  app.post('/api/predict/value', async (req, res) => {
    try {
      const propertyData = req.body;
      logger.info(`Valuation request for property: ${propertyData.address}`);
      
      const result = await predictionService.predictPropertyValue(propertyData);
      res.json(result);
    } catch (error) {
      logger.error('Property valuation failed:', error);
      res.status(500).json({ 
        error: 'Failed to predict property value',
        message: error.message
      });
    }
  });
  
  // Lead scoring endpoint
  app.post('/api/predict/lead-score', async (req, res) => {
    try {
      const leadData = req.body;
      logger.info(`Lead scoring request for: ${leadData.address}`);
      
      const result = await predictionService.generateLeadScore(leadData);
      res.json(result);
    } catch (error) {
      logger.error('Lead scoring failed:', error);
      res.status(500).json({ 
        error: 'Failed to generate lead score',
        message: error.message
      });
    }
  });
  
  // Distress signals endpoint
  app.post('/api/predict/distress', async (req, res) => {
    try {
      const propertyData = req.body;
      logger.info(`Distress prediction request for: ${propertyData.address}`);
      
      const result = await predictionService.predictDistressSignals(propertyData);
      res.json(result);
    } catch (error) {
      logger.error('Distress prediction failed:', error);
      res.status(500).json({ 
        error: 'Failed to predict distress signals',
        message: error.message
      });
    }
  });
  
  // Contact recommendation endpoint
  app.post('/api/predict/contact-method', async (req, res) => {
    try {
      const ownerData = req.body;
      logger.info(`Contact recommendation request for: ${ownerData.name}`);
      
      const result = await predictionService.findBestContactMethod(ownerData);
      res.json(result);
    } catch (error) {
      logger.error('Contact recommendation failed:', error);
      res.status(500).json({ 
        error: 'Failed to find best contact method',
        message: error.message
      });
    }
  });
  
  // Bulk prediction endpoint
  app.post('/api/predict/batch', async (req, res) => {
    try {
      const { properties } = req.body;
      logger.info(`Batch prediction request for ${properties.length} properties`);
      
      const results = await predictionService.processBatch(properties);
      res.json({ results });
    } catch (error) {
      logger.error('Batch prediction failed:', error);
      res.status(500).json({ 
        error: 'Failed to process batch prediction',
        message: error.message
      });
    }
  });
  
  // Root endpoint with documentation
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head>
          <title>LeadFlow AI - ML Integration</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            h2 { color: #666; }
            code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
            .endpoint { margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1>LeadFlow AI - ML Integration</h1>
          <p>This server integrates machine learning capabilities for property analysis and lead scoring.</p>
          
          <h2>Available Endpoints:</h2>
          
          <div class="endpoint">
            <h3>Health Check</h3>
            <code>GET /api/health</code>
            <p>Check if the service is running properly.</p>
          </div>
          
          <div class="endpoint">
            <h3>Predict Property Value</h3>
            <code>POST /api/predict/value</code>
            <p>Predict the value of a property based on its characteristics.</p>
            <pre>{
  "address": "123 Main St, City, State",
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFeet": 1500,
  "yearBuilt": 1990,
  "zipCode": "12345"
}</pre>
          </div>
          
          <div class="endpoint">
            <h3>Generate Lead Score</h3>
            <code>POST /api/predict/lead-score</code>
            <p>Generate a score for a lead based on property and owner data.</p>
          </div>
          
          <div class="endpoint">
            <h3>Predict Distress Signals</h3>
            <code>POST /api/predict/distress</code>
            <p>Predict distress signals for a property.</p>
          </div>
          
          <div class="endpoint">
            <h3>Find Best Contact Method</h3>
            <code>POST /api/predict/contact-method</code>
            <p>Recommend the best method to contact a property owner.</p>
          </div>
          
          <div class="endpoint">
            <h3>Batch Prediction</h3>
            <code>POST /api/predict/batch</code>
            <p>Process multiple properties in a single request.</p>
          </div>
        </body>
      </html>
    `);
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Not Found',
      message: `The requested endpoint ${req.path} does not exist`
    });
  });
}

// Run the application
initializeApp();
