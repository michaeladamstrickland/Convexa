/**
 * validation.js
 * Middleware functions for validating API request data
 */

const logger = require('../utils/logger');

/**
 * Validate property data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validatePropertyData = (req, res, next) => {
  const { property } = req.body;
  
  if (!property) {
    return res.status(400).json({ error: 'Property data is required' });
  }
  
  // Check for minimum required fields
  if (!property.address) {
    return res.status(400).json({ error: 'Property address is required' });
  }
  
  // Log validation success
  logger.debug(`Validated property data for: ${property.address}`);
  next();
};

/**
 * Validate property ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validatePropertyId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  // Check if ID is valid (depends on your ID format, this is a basic check)
  if (id.length < 4) {
    return res.status(400).json({ error: 'Invalid property ID format' });
  }
  
  next();
};

/**
 * Validate batch data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateBatchData = (req, res, next) => {
  const { properties } = req.body;
  
  if (!properties || !Array.isArray(properties)) {
    return res.status(400).json({ error: 'Properties must be an array' });
  }
  
  if (properties.length === 0) {
    return res.status(400).json({ error: 'Properties array cannot be empty' });
  }
  
  if (properties.length > 100) {
    return res.status(400).json({ error: 'Batch size exceeds maximum limit of 100' });
  }
  
  // Check if each property has required fields
  for (const property of properties) {
    if (!property.address) {
      return res.status(400).json({ 
        error: 'Each property must have an address',
        invalidProperty: property
      });
    }
  }
  
  // Log validation success
  logger.debug(`Validated batch data for ${properties.length} properties`);
  next();
};

/**
 * Validate contact strategy request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateContactStrategyRequest = (req, res, next) => {
  const { propertyId, ownerData } = req.body;
  
  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  if (!ownerData) {
    return res.status(400).json({ error: 'Owner data is required' });
  }
  
  next();
};

/**
 * Validate feedback data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateFeedbackData = (req, res, next) => {
  const { propertyId, feedbackType, actualValue, predictedValue, rating } = req.body;
  
  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  if (!feedbackType) {
    return res.status(400).json({ error: 'Feedback type is required' });
  }
  
  if (!['valueEstimate', 'distressSignals', 'leadScore', 'contactStrategy'].includes(feedbackType)) {
    return res.status(400).json({ error: 'Invalid feedback type' });
  }
  
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  
  next();
};

module.exports = {
  validatePropertyData,
  validatePropertyId,
  validateBatchData,
  validateContactStrategyRequest,
  validateFeedbackData
};
