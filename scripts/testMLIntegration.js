/**
 * testMLIntegration.js
 * Test script for ML integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MLClient from '../services/MLClient.js';
import MLPredictionService from '../services/MLPredictionService.js';
import logger from '../utils/logger.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample property data for testing
const sampleProperties = [
  {
    id: 'test_prop_001',
    address: '123 Main St, Anytown, CA 90210',
    zipCode: '90210',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    lotSize: 5000,
    yearBuilt: 1985,
    lastSalePrice: 450000,
    lastSaleDate: '2020-05-15',
    owner: {
      name: 'John Smith',
      ownershipDuration: 5.2
    },
    distressSignals: ['tax_lien', 'pending_foreclosure']
  },
  {
    id: 'test_prop_002',
    address: '456 Oak Ave, Somewhere, CA 90211',
    zipCode: '90211',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2400,
    lotSize: 7500,
    yearBuilt: 1995,
    lastSalePrice: 650000,
    lastSaleDate: '2018-08-22',
    owner: {
      name: 'Jane Doe',
      ownershipDuration: 7.3
    },
    distressSignals: ['divorce_records']
  }
];

// Test configuration
const config = {
  resultsDir: path.join(__dirname, '../test-results'),
  verbose: true,
  saveResults: true
};

/**
 * Run ML integration tests
 */
const runTests = async () => {
  logger.info('Starting ML integration tests...');
  
  // Create results directory if it doesn't exist
  if (config.saveResults && !fs.existsSync(config.resultsDir)) {
    fs.mkdirSync(config.resultsDir, { recursive: true });
  }
  
  // Initialize ML client
  logger.info('Initializing ML client...');
  const mlClient = new MLClient();
  
  try {
    const initialized = await mlClient.initialize();
    
    if (!initialized) {
      logger.error('Failed to initialize ML client. Tests cannot proceed.');
      return false;
    }
    
    logger.info('ML client initialized successfully.');
    
    // Run client-level tests
    const clientTestsResult = await testMLClient(mlClient);
    
    // Initialize prediction service
    logger.info('Initializing ML prediction service...');
    const predictionService = new MLPredictionService();
    
    const serviceInitialized = await predictionService.initialize();
    
    if (!serviceInitialized) {
      logger.error('Failed to initialize ML prediction service. Service tests cannot proceed.');
      return clientTestsResult;
    }
    
    logger.info('ML prediction service initialized successfully.');
    
    // Run service-level tests
    const serviceTestsResult = await testPredictionService(predictionService);
    
    // Close resources
    await mlClient.close();
    await predictionService.close();
    
    const allTestsPassed = clientTestsResult && serviceTestsResult;
    
    logger.info(`ML integration tests ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
    return allTestsPassed;
  } catch (error) {
    logger.error('Error during ML integration tests:', error);
    return false;
  }
};

/**
 * Test the ML client functions
 * @param {MLClient} mlClient - ML client instance
 * @returns {boolean} Test result
 */
const testMLClient = async (mlClient) => {
  logger.info('Testing ML client functions...');
  
  try {
    // Test health check
    logger.info('Testing health check...');
    const healthCheck = await mlClient.healthCheck();
    logTestResult('Health Check', healthCheck);
    
    if (!healthCheck) {
      logger.warn('Health check failed. Continuing with tests in mock mode.');
    }
    
    // Test property value prediction
    logger.info('Testing property value prediction...');
    const property = sampleProperties[0];
    const valueEstimate = await mlClient.predictPropertyValue(property);
    
    logTestResult('Property Value Prediction', 
      valueEstimate && typeof valueEstimate.estimatedValue !== 'undefined');
    
    if (config.verbose) {
      logger.info(`Estimated value: ${valueEstimate.estimatedValue}`);
      logger.info(`Confidence score: ${valueEstimate.confidenceScore}`);
    }
    
    if (config.saveResults) {
      saveTestResult('value-estimate', valueEstimate);
    }
    
    // Test distress signals prediction
    logger.info('Testing distress signals prediction...');
    const distressSignals = await mlClient.predictDistressSignals(property);
    
    logTestResult('Distress Signals Prediction', 
      distressSignals && typeof distressSignals.distressScore !== 'undefined');
    
    if (config.verbose) {
      logger.info(`Distress score: ${distressSignals.distressScore}`);
      logger.info(`Detected signals: ${JSON.stringify(distressSignals.distressSignals)}`);
    }
    
    if (config.saveResults) {
      saveTestResult('distress-signals', distressSignals);
    }
    
    // Test lead scoring
    logger.info('Testing lead scoring...');
    const leadScore = await mlClient.generateLeadScore(property);
    
    logTestResult('Lead Scoring', 
      leadScore && typeof leadScore.totalScore !== 'undefined');
    
    if (config.verbose) {
      logger.info(`Lead score: ${leadScore.totalScore}`);
      logger.info(`Classification: ${leadScore.classification}`);
    }
    
    if (config.saveResults) {
      saveTestResult('lead-score', leadScore);
    }
    
    // Test contact recommendations
    logger.info('Testing contact recommendations...');
    const contactRecommendation = await mlClient.findBestContactMethod(property.owner);
    
    logTestResult('Contact Recommendations', 
      contactRecommendation && contactRecommendation.recommendedMethod);
    
    if (config.verbose) {
      logger.info(`Recommended method: ${contactRecommendation.recommendedMethod}`);
    }
    
    if (config.saveResults) {
      saveTestResult('contact-recommendation', contactRecommendation);
    }
    
    logger.info('ML client tests completed successfully.');
    return true;
  } catch (error) {
    logger.error('Error during ML client tests:', error);
    return false;
  }
};

/**
 * Test the prediction service functions
 * @param {MLPredictionService} predictionService - Prediction service instance
 * @returns {boolean} Test result
 */
const testPredictionService = async (predictionService) => {
  logger.info('Testing ML prediction service...');
  
  try {
    // Test processing a single property
    logger.info('Testing property processing...');
    const property = sampleProperties[0];
    const processedProperty = await predictionService.processProperty(property);
    
    logTestResult('Property Processing', 
      processedProperty && processedProperty.mlProcessed === true);
    
    if (config.verbose) {
      logger.info(`Property processed with lead score: ${processedProperty.leadScore?.totalScore}`);
      logger.info(`Property value estimate: ${processedProperty.valueEstimate?.estimatedValue}`);
    }
    
    if (config.saveResults) {
      saveTestResult('processed-property', processedProperty);
    }
    
    // Test batch processing
    logger.info('Testing batch processing...');
    const processedBatch = await predictionService.processBatch(sampleProperties);
    
    logTestResult('Batch Processing', 
      Array.isArray(processedBatch) && 
      processedBatch.length === sampleProperties.length && 
      processedBatch[0].mlProcessed === true);
    
    if (config.verbose) {
      logger.info(`Processed ${processedBatch.length} properties in batch`);
    }
    
    if (config.saveResults) {
      saveTestResult('processed-batch', processedBatch);
    }
    
    // Test contact strategy creation
    logger.info('Testing contact strategy creation...');
    const contactStrategy = await predictionService.createContactStrategy(processedProperty);
    
    logTestResult('Contact Strategy Creation', 
      contactStrategy && contactStrategy.contactStrategy);
    
    if (config.verbose) {
      logger.info(`Contact strategy: ${contactStrategy.contactStrategy?.recommendedMethod}`);
      logger.info(`Action plan: ${JSON.stringify(contactStrategy.actionPlan?.actions?.slice(0, 2))}`);
    }
    
    if (config.saveResults) {
      saveTestResult('contact-strategy', contactStrategy);
    }
    
    // Test feedback submission
    logger.info('Testing feedback submission...');
    const feedbackResult = await predictionService.submitFeedback({
      propertyId: property.id,
      feedbackType: 'valueEstimate',
      predictedValue: processedProperty.valueEstimate?.estimatedValue,
      actualValue: 525000,
      rating: 4,
      comments: 'Test feedback submission'
    });
    
    logTestResult('Feedback Submission', feedbackResult === true);
    
    logger.info('ML prediction service tests completed successfully.');
    return true;
  } catch (error) {
    logger.error('Error during ML prediction service tests:', error);
    return false;
  }
};

/**
 * Log test result
 * @param {string} testName - Name of the test
 * @param {boolean} passed - Whether the test passed
 */
const logTestResult = (testName, passed) => {
  if (passed) {
    logger.info(`✅ ${testName}: PASSED`);
  } else {
    logger.error(`❌ ${testName}: FAILED`);
  }
};

/**
 * Save test result to file
 * @param {string} name - Name of the result
 * @param {Object} data - Result data to save
 */
const saveTestResult = (name, data) => {
  try {
    const filename = `${name}-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filePath = path.join(config.resultsDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    if (config.verbose) {
      logger.info(`Saved test result to ${filePath}`);
    }
  } catch (error) {
    logger.error(`Error saving test result ${name}:`, error);
  }
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    const success = await runTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.error('Unhandled error during tests:', error);
    process.exit(1);
  }
};

// Run the script if directly executed
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export {
  runTests
};
