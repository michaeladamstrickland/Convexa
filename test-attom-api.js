/**
 * ATTOM API Test Utility
 * This script helps debug the ATTOM API responses for a specific property
 */

import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './backend/.env' });

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_API_ENDPOINT = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// ATTOM ID to test - you can change this to test different properties
// Used ID 42116 from the screenshot example
const TEST_ATTOM_ID = '42116';

// Helper function to make ATTOM API requests with retry logic
async function attomRequest(endpoint, params, retryCount = 0) {
  if (!ATTOM_API_KEY) {
    throw new Error('ATTOM_API_KEY is not defined in your environment variables');
  }

  const maxRetries = 3;
  const retryDelay = 1000; // 1 second delay between retries
  
  console.log(`Making request to ${endpoint} with params:`, params);
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${ATTOM_API_ENDPOINT}/${endpoint}`,
      headers: {
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/json'
      },
      params,
      timeout: 10000 // 10 second timeout
    });
    
    // Log success response
    console.log(`${endpoint} response success with status: ${response.status}`);
    
    // Check if response contains expected data structure
    if (!response.data || (endpoint.includes('property') && !response.data.property)) {
      console.warn(`Warning: Unexpected response structure from ${endpoint}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error in ATTOM API request to ${endpoint}:`, error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // If we get a rate limit error (429) or server error (5xx), retry the request
      if ((error.response.status === 429 || error.response.status >= 500) && retryCount < maxRetries) {
        console.log(`Retrying request to ${endpoint} (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return attomRequest(endpoint, params, retryCount + 1);
      }
    } else if (error.code === 'ECONNABORTED' && retryCount < maxRetries) {
      // Retry on timeout
      console.log(`Request timeout, retrying (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
      return attomRequest(endpoint, params, retryCount + 1);
    }
    
    // If we've reached the max retries or it's not a retryable error, throw it
    throw error;
  }
}

// Helper function to safely get nested values
function getNestedValue(obj, path, defaultValue = null) {
  try {
    const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// Function to explore all available data for a property
async function explorePropertyData(attomId) {
  try {
    console.log(`\n=== EXPLORING PROPERTY DATA FOR ATTOM ID: ${attomId} ===\n`);
    
    // Get basic property details
    console.log('Fetching basic property details...');
    const detailResponse = await attomRequest('property/detail', { attomid: attomId });
    
    // Get expanded profile
    console.log('Fetching expanded property profile...');
    const expandedResponse = await attomRequest('property/expandedprofile', { attomid: attomId });
    
    // Get property history
    console.log('Fetching property history...');
    const historyResponse = await attomRequest('property/detailwithhistory', { attomid: attomId });
    
    // Save all responses to files for detailed analysis
    fs.writeFileSync(`attom-detail-${attomId}.json`, JSON.stringify(detailResponse, null, 2));
    fs.writeFileSync(`attom-expanded-${attomId}.json`, JSON.stringify(expandedResponse, null, 2));
    fs.writeFileSync(`attom-history-${attomId}.json`, JSON.stringify(historyResponse, null, 2));
    
    console.log('\n=== ANALYSIS OF PROPERTY DATA ===\n');
    
    // Extract and log key information with enhanced field mapping
    if (detailResponse.property && detailResponse.property.length > 0) {
      const detailProp = detailResponse.property[0];
      const expandedProp = expandedResponse.property && expandedResponse.property.length > 0 ? 
        expandedResponse.property[0] : null;
      
      // Build a consolidated property object using our enhanced field mapping
      const property = {
        // Basic property identification
        attomId: getNestedValue(detailProp, 'identifier.attomId'),
        
        // Address information
        address: getNestedValue(detailProp, 'address.line1'),
        city: getNestedValue(detailProp, 'address.locality'),
        state: getNestedValue(detailProp, 'address.countrySubd'),
        zipCode: getNestedValue(detailProp, 'address.postal1'),
        
        // Geolocation
        latitude: getNestedValue(detailProp, 'location.latitude'),
        longitude: getNestedValue(detailProp, 'location.longitude'),
        
        // Property characteristics with multiple possible paths
        propertyType: getNestedValue(detailProp, 'summary.proptype') || 
                      getNestedValue(detailProp, 'summary.propertyType') || 
                      getNestedValue(detailProp, 'summary.propType'),
          
        yearBuilt: getNestedValue(detailProp, 'summary.yearbuilt') || 
                   getNestedValue(detailProp, 'summary.yearBuilt'),
          
        bedrooms: getNestedValue(detailProp, 'building.rooms.beds'),
          
        bathrooms: getNestedValue(detailProp, 'building.rooms.bathsFull'),
          
        squareFeet: getNestedValue(detailProp, 'building.size.universalsize') || 
                    getNestedValue(detailProp, 'building.size.universalSize') || 
                    getNestedValue(detailProp, 'building.size.livingsize') || 
                    getNestedValue(detailProp, 'building.size.livingSize') || 
                    getNestedValue(detailProp, 'building.size.bldgsize') || 
                    getNestedValue(detailProp, 'building.size.bldgSize'),
          
        lotSize: getNestedValue(detailProp, 'lot.lotsize1') || 
                 getNestedValue(detailProp, 'lot.lotSize1'),
                 
        lotSizeUnit: getNestedValue(detailProp, 'lot.lotsize1unit') || 
                     getNestedValue(detailProp, 'lot.lotSize1Unit') || 
                     (getNestedValue(detailProp, 'lot.lotsize2') ? 'sqft' : 'acres'),
        
        // Building details
        stories: getNestedValue(detailProp, 'building.summary.levels') || 
                 getNestedValue(detailProp, 'building.summary.storyCount'),
          
        garage: getNestedValue(detailProp, 'building.parking.prkgSpaces'),
          
        pool: getNestedValue(detailProp, 'lot.poolType') !== 'NO POOL' && 
              getNestedValue(detailProp, 'lot.poolType') !== null,
          
        // Owner information
        ownerName: expandedProp ? 
                  getNestedValue(expandedProp, 'assessment.owner.owner1.name') : null,
          
        ownerOccupied: getNestedValue(detailProp, 'summary.absenteeInd') === 'OWNER OCCUPIED',
        
        // Sale information
        lastSaleDate: expandedProp ? 
                     getNestedValue(expandedProp, 'sale.saleTransDate') || 
                     getNestedValue(expandedProp, 'sale.saleSearchDate') : null,
          
        lastSalePrice: expandedProp ? 
                      getNestedValue(expandedProp, 'sale.amount.saleAmt') || 
                      getNestedValue(expandedProp, 'sale.amount.saleamt') : null,
        
        // Tax and valuation information
        taxAssessedValue: expandedProp ? 
                         getNestedValue(expandedProp, 'assessment.assessed.assdTtlValue') || 
                         getNestedValue(expandedProp, 'assessment.assessed.assdttlvalue') : null,
          
        taxMarketValue: expandedProp ? 
                       getNestedValue(expandedProp, 'assessment.market.mktTtlValue') || 
                       getNestedValue(expandedProp, 'assessment.market.mktttlvalue') : null,
          
        estimatedValue: expandedProp ? 
                        getNestedValue(expandedProp, 'avm.amount.value') : null,
                        
        estimatedValueLow: expandedProp ? 
                          getNestedValue(expandedProp, 'avm.amount.low') : null,
                          
        estimatedValueHigh: expandedProp ? 
                           getNestedValue(expandedProp, 'avm.amount.high') : null,
      };
      
      // Display the consolidated property data
      console.log('\n=== CONSOLIDATED PROPERTY DATA ===\n');
      Object.entries(property).forEach(([key, value]) => {
        console.log(`${key}: ${value !== null && value !== undefined ? value : 'N/A'}`);
      });
      
      // Check for missing values
      const missingFields = [];
      Object.entries(property).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          missingFields.push(key);
        }
      });
      
      console.log('\nMissing Fields:', missingFields.length > 0 ? missingFields.join(', ') : 'None');
      
      // Original detailed logging
      console.log('\n=== ORIGINAL API DATA STRUCTURE ===\n');
      
      console.log('\nAvailable Top-Level Keys in Property Object:');
      console.log(Object.keys(detailProp));
      
      // Check specific areas that might contain the missing data
      if (detailProp.building) console.log('\nBuilding Keys:', Object.keys(detailProp.building));
      if (detailProp.summary) console.log('Summary Keys:', Object.keys(detailProp.summary));
      if (detailProp.assessment) console.log('Assessment Keys:', Object.keys(detailProp.assessment));
      if (detailProp.vintage) console.log('Vintage Keys:', Object.keys(detailProp.vintage));
      
      // Add expanded profile data
      if (expandedProp) {
        console.log('\nExpanded Profile Top-Level Keys:');
        console.log(Object.keys(expandedProp));
        
        // Check AVM structure
        if (expandedProp.avm) {
          console.log('\nAVM Object Structure:');
          console.log(JSON.stringify(expandedProp.avm, null, 2));
        }
      }
      
      console.log('\nFiles have been saved for detailed analysis:');
      console.log('- attom-detail-' + attomId + '.json');
      console.log('- attom-expanded-' + attomId + '.json');
      console.log('- attom-history-' + attomId + '.json');
      
    } else {
      console.log('No property data found for the specified ATTOM ID.');
    }
    
  } catch (error) {
    console.error('Error exploring property data:', error);
  }
}

// Run the exploration
explorePropertyData(TEST_ATTOM_ID).then(() => {
  console.log('\nExploration completed.');
});
