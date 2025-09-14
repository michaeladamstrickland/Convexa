/**
 * connection.js
 * Database connection handler for LeadFlow AI
 */

import { MongoClient } from 'mongodb';
import logger from '../utils/logger.js';

// Database configuration
const config = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/leadflow_ai',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

// Client instance
let client;
let dbInstance;

/**
 * Connect to MongoDB database
 * @returns {Object} Database instance
 */
async function connectDatabase() {
  try {
    if (dbInstance) {
      return dbInstance;
    }

    logger.info('Connecting to database...');
    client = new MongoClient(config.uri, config.options);
    await client.connect();
    
    // Get database instance
    const db = client.db();
    
    // Initialize collections with schemas/indexes if needed
    await initializeCollections(db);
    
    logger.info('Database connection established');
    
    // Create db interface with collections
    dbInstance = {
      properties: db.collection('properties'),
      leads: db.collection('leads'),
      users: db.collection('users'),
      feedbacks: db.collection('ml_feedbacks'),
      predictions: db.collection('ml_predictions'),
      raw: db
    };
    
    return dbInstance;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Initialize database collections with indexes
 * @param {Object} db - Database instance
 */
async function initializeCollections(db) {
  try {
    // Create indexes for properties collection
    await db.collection('properties').createIndexes([
      { key: { address: 1 }, name: 'idx_address' },
      { key: { zipCode: 1 }, name: 'idx_zipcode' },
      { key: { 'leadScore.classification': 1 }, name: 'idx_lead_score' },
      { key: { 'distressSignals.distressScore': 1 }, name: 'idx_distress_score' }
    ]);
    
    // Create indexes for leads collection
    await db.collection('leads').createIndexes([
      { key: { propertyId: 1 }, name: 'idx_property_id' },
      { key: { status: 1 }, name: 'idx_status' },
      { key: { score: 1 }, name: 'idx_score' }
    ]);
    
    // Create indexes for ML feedbacks collection
    await db.collection('ml_feedbacks').createIndexes([
      { key: { propertyId: 1 }, name: 'idx_property_id' },
      { key: { feedbackType: 1 }, name: 'idx_feedback_type' }
    ]);
    
    logger.info('Database collections initialized');
  } catch (error) {
    logger.error('Failed to initialize collections:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (client) {
    await client.close();
    logger.info('Database connection closed');
  }
}

export {
  connectDatabase,
  closeDatabase
};
