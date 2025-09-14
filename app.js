/**
 * app.js
 * Main application entry point with ML integration
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const integrateMLRoutes = require('./scripts/integrateMLRoutes');
const logger = require('./utils/logger');
const { connectDatabase } = require('./database/connection');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection
let db;
(async () => {
  try {
    db = await connectDatabase();
    logger.info('Connected to database');
  } catch (error) {
    logger.error('Database connection failed:', error);
  }
})();

// API Routes
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/scraper', require('./routes/scraperRoutes'));
app.use('/api/scheduler', require('./backend/src/routes/scheduler'));

// Integrate ML routes
(async () => {
  try {
    await integrateMLRoutes(app, {
      apiPrefix: '/api/ml',
      db: db,
      initializeModels: true
    });
    
    logger.info('ML routes integrated successfully');
  } catch (error) {
    logger.error('Failed to integrate ML routes:', error);
  }
})();

// The "catchall" handler for any request that doesn't match the ones above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, err);
  
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
