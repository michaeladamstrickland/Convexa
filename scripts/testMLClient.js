/**
 * testMLClient.js
 * Script to test the ML Client functionality
 */

import path from 'path';
import { fileURLToPath } from 'url';
import MLClient from '../services/MLClient.js';
import logger from '../utils/logger.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample property data for testing
const sampleProperty = {
  address: "123 Test St, Testville, TX 12345",
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  yearBuilt: 1995,
  lotSize: 0.25,
  lastSoldPrice: 250000,
  lastSoldDate: "2020-01-15",
  zipCode: "12345",
  propertyType: "SINGLE_FAMILY",
  features: ["garage", "pool", "fireplace"]
};

// Sample lead data for testing
const sampleLead = {
  ...sampleProperty,
  ownerName: "John Doe",
  ownerPhone: "555-123-4567",
  ownerEmail: "john@example.com",
  taxStatus: "CURRENT",
  occupancyStatus: "OWNER_OCCUPIED",
  estimatedEquity: 120000,
  mortgageInfo: {
    hasMortgage: true,
    mortgageAmount: 180000,
    mortgageType: "CONVENTIONAL"
  }
};

/**
 * Test the ML Client functionality
 */
async function testMLClient() {
  logger.info("Starting ML Client test...");

  try {
    // Create ML client with custom configuration
    const mlClient = new MLClient({
      modelEndpoints: {
        baseUrl: 'http://localhost:5050'
      }
    });
    
    // Initialize the client
    logger.info("Initializing ML Client...");
    await mlClient.initialize();
    
    // Test each functionality
    logger.info("Testing property valuation...");
    const valuationResult = await mlClient.predictPropertyValue(sampleProperty);
    console.log("Property Valuation Result:", valuationResult);
    
    logger.info("Testing distress signals...");
    const distressResult = await mlClient.predictDistressSignals(sampleProperty);
    console.log("Distress Prediction Result:", distressResult);
    
    logger.info("Testing lead scoring...");
    const leadScore = await mlClient.generateLeadScore(sampleLead);
    console.log("Lead Score Result:", leadScore);
    
    logger.info("Testing contact recommendation...");
    const contactRecommendation = await mlClient.findBestContactMethod({
      name: sampleLead.ownerName,
      phone: sampleLead.ownerPhone,
      email: sampleLead.ownerEmail
    });
    console.log("Contact Recommendation:", contactRecommendation);
    
    // Clean up
    await mlClient.close();
    
    logger.info("ML Client test completed successfully");
  } catch (error) {
    logger.error("ML Client test failed:", error);
    console.error("Test failed:", error);
  }
}

// Run the test
testMLClient();
