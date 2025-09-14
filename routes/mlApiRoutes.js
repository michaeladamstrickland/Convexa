/**
 * mlApiRoutes.js
 * API routes for machine learning services
 */

const express = require('express');
const MLPredictionService = require('../services/MLPredictionService');
const { validatePropertyData, validatePropertyId, validateBatchData } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Initialize router
const router = express.Router();

// Initialize ML prediction service
const mlService = new MLPredictionService();

// Initialize ML service on startup
(async () => {
  try {
    await mlService.initialize();
    logger.info('ML Prediction Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize ML Prediction Service:', error);
  }
})();

/**
 * @route   GET /api/ml/status
 * @desc    Get ML service status
 * @access  Private
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const mlClient = mlService.mlClient;
    const isAvailable = await mlClient.healthCheck();
    
    res.json({
      available: isAvailable,
      modelsLoaded: mlService.mlClient.modelCache.size > 0,
      activeModels: isAvailable ? [
        'propertyValuation',
        'distressPredictor',
        'leadScoring',
        'contactRecommendation'
      ] : []
    });
  } catch (error) {
    logger.error('Error getting ML status:', error);
    res.status(500).json({ 
      error: 'Failed to get ML service status', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/process-property
 * @desc    Process a property through ML models
 * @access  Private
 */
router.post('/process-property', requireAuth, validatePropertyData, async (req, res) => {
  try {
    const { property } = req.body;
    logger.info(`Processing property via ML: ${property.address}`);
    
    const processedProperty = await mlService.processProperty(property);
    
    res.json(processedProperty);
  } catch (error) {
    logger.error('Error processing property:', error);
    res.status(500).json({ 
      error: 'Failed to process property', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/process-batch
 * @desc    Process a batch of properties
 * @access  Private
 */
router.post('/process-batch', requireAuth, validateBatchData, async (req, res) => {
  try {
    const { properties } = req.body;
    logger.info(`Processing batch of ${properties.length} properties`);
    
    const processedProperties = await mlService.processBatch(properties);
    
    res.json(processedProperties);
  } catch (error) {
    logger.error('Error processing property batch:', error);
    res.status(500).json({ 
      error: 'Failed to process property batch', 
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/ml/properties/:id/predictions
 * @desc    Get predictions for a specific property
 * @access  Private
 */
router.get('/properties/:id/predictions', requireAuth, validatePropertyId, async (req, res) => {
  try {
    const propertyId = req.params.id;
    
    // Fetch property from database
    const property = await req.db.properties.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Check if property already has ML predictions
    if (property.mlProcessed) {
      return res.json(property);
    }
    
    // Process property through ML
    const processedProperty = await mlService.processProperty(property);
    
    // Update property in database
    await req.db.properties.updateOne(
      { _id: propertyId },
      { $set: processedProperty }
    );
    
    res.json(processedProperty);
  } catch (error) {
    logger.error(`Error getting property predictions (ID: ${req.params.id}):`, error);
    res.status(500).json({ 
      error: 'Failed to get property predictions', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/properties/:id/predictions/refresh
 * @desc    Refresh predictions for a specific property
 * @access  Private
 */
router.post('/properties/:id/predictions/refresh', requireAuth, validatePropertyId, async (req, res) => {
  try {
    const propertyId = req.params.id;
    
    // Fetch property from database
    const property = await req.db.properties.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Force refresh of property through ML
    const processedProperty = await mlService.processProperty(property);
    
    // Update property in database
    await req.db.properties.updateOne(
      { _id: propertyId },
      { $set: processedProperty }
    );
    
    res.json(processedProperty);
  } catch (error) {
    logger.error(`Error refreshing property predictions (ID: ${req.params.id}):`, error);
    res.status(500).json({ 
      error: 'Failed to refresh property predictions', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/properties/:id/contact-strategy
 * @desc    Generate contact strategy for a property
 * @access  Private
 */
router.post('/properties/:id/contact-strategy', requireAuth, validatePropertyId, async (req, res) => {
  try {
    const propertyId = req.params.id;
    
    // Fetch property from database
    const property = await req.db.properties.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Generate contact strategy
    const contactStrategy = await mlService.createContactStrategy(property);
    
    // Update property in database with contact strategy
    await req.db.properties.updateOne(
      { _id: propertyId },
      { $set: { contactStrategy } }
    );
    
    res.json(contactStrategy);
  } catch (error) {
    logger.error(`Error generating contact strategy (Property ID: ${req.params.id}):`, error);
    res.status(500).json({ 
      error: 'Failed to generate contact strategy', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/feedback
 * @desc    Submit feedback about prediction accuracy
 * @access  Private
 */
router.post('/feedback', requireAuth, async (req, res) => {
  try {
    const feedbackData = req.body;
    
    if (!feedbackData || !feedbackData.propertyId) {
      return res.status(400).json({ error: 'Invalid feedback data: missing property ID' });
    }
    
    // Submit feedback to ML service
    const success = await mlService.submitFeedback(feedbackData);
    
    // Log feedback in database
    await req.db.feedbacks.insertOne({
      ...feedbackData,
      userId: req.user.id,
      timestamp: new Date()
    });
    
    res.json({ success });
  } catch (error) {
    logger.error('Error submitting ML feedback:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/lead-score
 * @desc    Get lead score for a property
 * @access  Private
 */
router.post('/lead-score', requireAuth, validatePropertyData, async (req, res) => {
  try {
    const { property } = req.body;
    
    // Create property profile for ML processing
    const propertyProfile = mlService.createPropertyProfile(property);
    
    // Get lead score from ML client
    const leadScore = await mlService.mlClient.generateLeadScore(propertyProfile);
    
    res.json(leadScore);
  } catch (error) {
    logger.error('Error generating lead score:', error);
    res.status(500).json({ 
      error: 'Failed to generate lead score', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/value-estimate
 * @desc    Get property value estimate
 * @access  Private
 */
router.post('/value-estimate', requireAuth, validatePropertyData, async (req, res) => {
  try {
    const { property } = req.body;
    
    // Create property profile for ML processing
    const propertyProfile = mlService.createPropertyProfile(property);
    
    // Get value estimate from ML client
    const valueEstimate = await mlService.mlClient.predictPropertyValue(propertyProfile);
    
    res.json(valueEstimate);
  } catch (error) {
    logger.error('Error generating value estimate:', error);
    res.status(500).json({ 
      error: 'Failed to generate value estimate', 
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/ml/distress-signals
 * @desc    Check for distress signals in a property
 * @access  Private
 */
router.post('/distress-signals', requireAuth, validatePropertyData, async (req, res) => {
  try {
    const { property } = req.body;
    
    // Create property profile for ML processing
    const propertyProfile = mlService.createPropertyProfile(property);
    
    // Get distress signals from ML client
    const distressSignals = await mlService.mlClient.predictDistressSignals(propertyProfile);
    
    res.json(distressSignals);
  } catch (error) {
    logger.error('Error checking distress signals:', error);
    res.status(500).json({ 
      error: 'Failed to check distress signals', 
      details: error.message 
    });
  }
});

// Export the router
module.exports = router;
