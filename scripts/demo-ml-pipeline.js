/**
 * demo-ml-pipeline.js
 * Demonstration of the complete ML pipeline
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

// Sample property data
const sampleProperty = {
  id: 'demo_property_123',
  address: '123 Flip Street, Moneyville, CA 90210',
  latitude: 34.0522,
  longitude: -118.2437,
  zipCode: '90210',
  bedrooms: 4,
  bathrooms: 2.5,
  squareFeet: 2200,
  lotSize: 8500,
  yearBuilt: 1988,
  propertyType: 'SINGLE_FAMILY',
  lastSalePrice: 580000,
  lastSaleDate: '2020-06-15',
  taxAssessedValue: 550000,
  owner: {
    name: 'John Investor',
    ownershipDuration: 5.3,
    age: 45,
    occupation: 'Business Owner',
    contactHistory: [
      { type: 'MAIL', date: '2025-08-01', response: false },
      { type: 'EMAIL', date: '2025-08-15', response: true }
    ]
  },
  distressSignals: [
    'tax_lien',
    'missed_payments'
  ],
  financialDetails: {
    mortgageAmount: 460000,
    monthlyPayment: 2450,
    taxesOwed: 12000,
    liens: [
      { type: 'TAX_LIEN', amount: 8500, filingDate: '2025-02-10' },
      { type: 'MECHANIC_LIEN', amount: 3500, filingDate: '2025-03-22' }
    ]
  },
  propertyCondition: 'FAIR',
  marketData: {
    averageDaysOnMarket: 45,
    medianHomeValue: 620000,
    marketTrend: 'RISING',
    comparableSales: [
      { address: '125 Flip Street', salePrice: 610000, saleDate: '2025-07-10', squareFeet: 2300 },
      { address: '130 Flip Street', salePrice: 595000, saleDate: '2025-06-22', squareFeet: 2100 }
    ]
  }
};

// Configuration
const config = {
  outputDir: path.join(__dirname, 'demo-output'),
  verbose: true
};

/**
 * Run the complete ML pipeline demonstration
 */
const runMLDemo = async () => {
  console.log('===================================');
  console.log('Convexa AI - ML Pipeline Demonstration');
  console.log('===================================\n');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  try {
    // Step 1: Initialize ML Client
    console.log('Step 1: Initializing ML Client...');
    const mlClient = new MLClient();
    await mlClient.initialize();
    console.log('✓ ML Client initialized successfully\n');
    
    // Step 2: Check service health
    console.log('Step 2: Checking ML service health...');
    const isHealthy = await mlClient.healthCheck();
    console.log(`✓ ML Service health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY (using fallback mode)'}\n`);
    
    // Step 3: Generate property value estimate
    console.log('Step 3: Generating property value estimate...');
    const valueEstimate = await mlClient.predictPropertyValue(sampleProperty);
    console.log(`✓ Estimated value: ${formatCurrency(valueEstimate.estimatedValue)}`);
    console.log(`  Confidence score: ${(valueEstimate.confidenceScore * 100).toFixed(1)}%`);
    
    if (valueEstimate.comparables && valueEstimate.comparables.length > 0) {
      console.log(`  Based on ${valueEstimate.comparables.length} comparable properties`);
    }
    
    saveOutput('value-estimate.json', valueEstimate);
    console.log('');
    
    // Step 4: Predict distress signals
    console.log('Step 4: Detecting distress signals...');
    const distressSignals = await mlClient.predictDistressSignals(sampleProperty);
    console.log(`✓ Distress score: ${(distressSignals.distressScore * 100).toFixed(1)}%`);
    
    if (distressSignals.distressSignals && distressSignals.distressSignals.length > 0) {
      console.log('  Detected signals:');
      distressSignals.distressSignals.forEach(signal => {
        console.log(`  - ${signal}`);
      });
    }
    
    saveOutput('distress-signals.json', distressSignals);
    console.log('');
    
    // Step 5: Generate lead score
    console.log('Step 5: Generating lead score...');
    const leadScore = await mlClient.generateLeadScore(sampleProperty);
    console.log(`✓ Lead score: ${leadScore.totalScore.toFixed(1)}`);
    console.log(`  Classification: ${leadScore.classification}`);
    
    if (leadScore.factors && leadScore.factors.length > 0) {
      console.log('  Key factors:');
      leadScore.factors.slice(0, 3).forEach(factor => {
        console.log(`  - ${factor}`);
      });
    }
    
    saveOutput('lead-score.json', leadScore);
    console.log('');
    
    // Step 6: Initialize ML Prediction Service
    console.log('Step 6: Initializing ML Prediction Service...');
    const predictionService = new MLPredictionService();
    await predictionService.initialize();
    console.log('✓ ML Prediction Service initialized successfully\n');
    
    // Step 7: Process property through prediction service
    console.log('Step 7: Processing property through prediction service...');
    const processedProperty = await predictionService.processProperty(sampleProperty);
    console.log('✓ Property processed successfully');
    console.log(`  Value estimate: ${formatCurrency(processedProperty.valueEstimate.estimatedValue)}`);
    console.log(`  Lead score: ${processedProperty.leadScore.totalScore.toFixed(1)} (${processedProperty.leadScore.classification})`);
    
    if (processedProperty.profitPotential) {
      console.log(`  Potential profit: ${formatCurrency(processedProperty.profitPotential.potentialProfit)}`);
      console.log(`  ROI: ${processedProperty.profitPotential.returnOnInvestment.toFixed(1)}%`);
    }
    
    saveOutput('processed-property.json', processedProperty);
    console.log('');
    
    // Step 8: Generate contact strategy
    console.log('Step 8: Generating contact strategy...');
    const contactStrategy = await predictionService.createContactStrategy(processedProperty);
    console.log('✓ Contact strategy generated successfully');
    console.log(`  Recommended method: ${contactStrategy.contactStrategy.recommendedMethod}`);
    
    if (contactStrategy.contactStrategy.alternativeMethods) {
      console.log(`  Alternative methods: ${contactStrategy.contactStrategy.alternativeMethods.join(', ')}`);
    }
    
    if (contactStrategy.actionPlan && contactStrategy.actionPlan.actions) {
      console.log('  Recommended actions:');
      contactStrategy.actionPlan.actions.slice(0, 3).forEach(action => {
        console.log(`  - ${action}`);
      });
    }
    
    saveOutput('contact-strategy.json', contactStrategy);
    console.log('');
    
    // Step 9: Submit feedback
    console.log('Step 9: Submitting feedback...');
    const feedbackResult = await predictionService.submitFeedback({
      propertyId: sampleProperty.id,
      feedbackType: 'valueEstimate',
      predictedValue: valueEstimate.estimatedValue,
      actualValue: 625000, // Simulated actual value
      rating: 4,
      comments: 'Estimate was close but slightly under market'
    });
    
    console.log(`✓ Feedback submitted: ${feedbackResult ? 'SUCCESS' : 'FAILURE'}\n`);
    
    // Step 10: Generate complete report
    console.log('Step 10: Generating complete ML report...');
    const completeReport = {
      property: sampleProperty,
      valueEstimate,
      distressSignals,
      leadScore,
      contactStrategy,
      profitPotential: processedProperty.profitPotential,
      timestamp: new Date().toISOString(),
      reportId: `ML-REPORT-${Date.now()}`
    };
    
    saveOutput('complete-ml-report.json', completeReport);
    console.log('✓ Complete ML report generated successfully\n');
    
    // Complete the demo
    console.log('===================================');
    console.log('ML Pipeline Demonstration Complete');
    console.log(`All outputs saved to: ${config.outputDir}`);
    console.log('===================================');
    
    // Clean up
    await mlClient.close();
    await predictionService.close();
    
    return true;
  } catch (error) {
    console.error('Error during ML demo:', error);
    return false;
  }
};

/**
 * Format currency value
 * @param {number} value - Currency value
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
  if (!value && value !== 0) return 'N/A';
  
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(value);
}

/**
 * Save output to JSON file
 * @param {string} filename - Output filename
 * @param {Object} data - Data to save
 */
function saveOutput(filename, data) {
  try {
    const filePath = path.join(config.outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    if (config.verbose) {
      console.log(`  Saved output to: ${filename}`);
    }
  } catch (error) {
    console.error(`Failed to save output to ${filename}:`, error.message);
  }
}

/**
 * Main execution function
 */
const main = async () => {
  try {
    await runMLDemo();
    process.exit(0);
  } catch (error) {
    console.error('Unhandled error during demo:', error);
    process.exit(1);
  }
};

// Run the script if directly executed
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export {
  runMLDemo
};
