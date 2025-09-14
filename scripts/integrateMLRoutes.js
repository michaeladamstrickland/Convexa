/**
 * integrateMLRoutes.js
 * Script to integrate ML API routes into the main application
 */

const express = require('express');
const logger = require('../utils/logger');
const mlApiRoutes = require('../routes/mlApiRoutes');
const { initializeModels } = require('./initializeMLModels');

/**
 * Integrate ML routes with an Express application
 * @param {Object} app - Express application instance
 * @param {Object} options - Integration options
 */
const integrateMLRoutes = async (app, options = {}) => {
  const config = {
    apiPrefix: options.apiPrefix || '/api/ml',
    initializeModels: options.initializeModels !== false,
    requireDb: options.requireDb !== false,
    ...options
  };
  
  logger.info(`Integrating ML routes with prefix: ${config.apiPrefix}`);
  
  // Initialize ML models if configured
  if (config.initializeModels) {
    try {
      await initializeModels();
      logger.info('ML models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ML models:', error);
      logger.warn('Continuing with ML route integration despite model initialization failure');
    }
  }
  
  // Middleware to add database connection to request if required
  if (config.requireDb && config.db) {
    app.use(config.apiPrefix, (req, res, next) => {
      req.db = config.db;
      next();
    });
  }
  
  // Register routes
  app.use(config.apiPrefix, mlApiRoutes);
  
  logger.info('ML routes integrated successfully');
};

module.exports = integrateMLRoutes;
