// ATTOM API Server - Integrates the ATTOM Property Data API with FlipTracker

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import attomRoutes from './attom-routes-fixed.js';

// Load environment variables
dotenv.config();

// Get current file path (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express
const app = express();
const PORT = 5002; // Force port 5002 for ATTOM server to avoid conflicts

// Configure middleware
app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.1',
    service: 'attom-api',
    timestamp: new Date().toISOString()
  });
});

// API status endpoint
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

// Mount ATTOM routes with fixed implementation
app.use('/api/attom', attomRoutes);

// Static documentation
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
    error: err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 ATTOM API Server running on port ${PORT}`);
  console.log(`✅ API endpoints ready for use:`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log(`  - Status: http://localhost:${PORT}/api/attom/status`);
  console.log(`  - Property by Address: http://localhost:${PORT}/api/attom/property/address?address=123+Main+St&city=Beverly+Hills&state=CA&zip=90210`);
  console.log(`  - Properties by ZIP: http://localhost:${PORT}/api/attom/property/zip?zip=90210&page=1&pageSize=10`);
  console.log(`  - Property Detail: http://localhost:${PORT}/api/attom/property/42116/detail`);
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down ATTOM API server...');
    process.exit();
  });
});
