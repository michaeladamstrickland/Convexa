// ATTOM API routes for FlipTracker
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const router = express.Router();

// Helper function to log values for debugging and provide fallbacks
function logValue(field, value, defaultValue = null) {
  const valueStatus = value === undefined ? 'undefined' : 
                     value === null ? 'null' : 
                     typeof value === 'object' ? 'object' : 
                     JSON.stringify(value);
                     
  console.log(`[ATTOM API] Field '${field}': ${valueStatus}`);
  
  // Return the value if it exists, otherwise the default value
  if (value === undefined || value === null) {
    if (defaultValue !== null) {
      console.log(`[ATTOM API] Using default value for '${field}': ${defaultValue}`);
      return defaultValue;
    }
    return null; // Always return null instead of undefined for consistency
  }
  
  // For number fields that might be strings, try to convert
  if (['squareFeet', 'lotSize', 'bedrooms', 'bathrooms', 'stories', 'garage', 
       'lastSalePrice', 'taxAssessedValue', 'taxMarketValue', 'taxAmount'].includes(field)) {
    if (typeof value === 'string') {
      // Try to convert string to number
      const numValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(numValue)) {
        return numValue;
      }
    }
  }
  
  return value;
}

// Helper function for ATTOM API requests
async function attomRequest(endpoint, params, retryCount = 0) {
  const apiKey = process.env.ATTOM_API_KEY;
  const baseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second delay between retries
  
  console.log(`[ATTOM API] Making request to ${endpoint} with params:`, params);
  
  // Remove any quotes if they exist in the API key
  const cleanApiKey = apiKey ? apiKey.replace(/["']/g, '') : '';
  
  if (!cleanApiKey) {
    console.error('[ATTOM API] Error: API key is missing. Check your .env file.');
    throw new Error('ATTOM API key is missing');
  }
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${baseUrl}/${endpoint}`,
      headers: {
        'apikey': cleanApiKey,
        'Accept': 'application/json'
      },
      params,
      timeout: 10000 // 10 second timeout
    });
    
    // Log success response
    console.log(`[ATTOM API] ${endpoint} response success with status: ${response.status}`);
    
    // Check if response contains expected data structure
    if (!response.data || (endpoint.includes('property') && !response.data.property)) {
      console.warn(`[ATTOM API] Warning: Unexpected response structure from ${endpoint}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error in ATTOM API request to ${endpoint}:`, error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // If we get a rate limit error (429) or server error (5xx), retry the request
      if ((error.response.status === 429 || error.response.status >= 500) && retryCount < maxRetries) {
        console.log(`[ATTOM API] Retrying request to ${endpoint} (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return attomRequest(endpoint, params, retryCount + 1);
      }
    } else if (error.code === 'ECONNABORTED' && retryCount < maxRetries) {
      // Retry on timeout
      console.log(`[ATTOM API] Request timeout, retrying (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
      return attomRequest(endpoint, params, retryCount + 1);
    }
    
    // If we've reached the max retries or it's not a retryable error, throw it
    throw error;
  }
}

// Get property by address
router.get('/property/address', async (req, res) => {
  try {
    const { address, city, state, zip } = req.query;
    
    if (!address || !city || !state) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide address, city, and state.' 
      });
    }
    
    const addressStr = `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}`;
    
    const response = await attomRequest('property/address', {
      address1: address,
      address2: `${city}, ${state}${zip ? ' ' + zip : ''}`
    });
    
    if (response.property && response.property.length > 0) {
      // For each property, fetch enhanced data to get complete information
      const propertyPromises = response.property.map(async (prop) => {
        const attomId = prop.identifier?.attomId;
        if (!attomId) {
          // If no attomId, return basic info with defaults
          return {
            attomId: prop.identifier?.obPropId || 'Unknown',
            address: prop.address?.line1 || address,
            city: prop.address?.locality || city,
            state: prop.address?.countrySubd || state,
            zipCode: prop.address?.postal1 || zip || '',
            propertyType: prop.summary?.proptype || 'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 'Unknown',
            bedrooms: prop.building?.rooms?.beds || 3,
            bathrooms: prop.building?.rooms?.bathsFull || 2,
            ownerName: prop.owner?.owner1?.name || 'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || null
          };
        }
        
        try {
          // Try to get enhanced data for each property
          const enhancedResponse = await attomRequest('property/expandedprofile', {
            attomid: attomId
          }).catch(() => ({ property: [] }));
          
          const enhancedProp = enhancedResponse.property && enhancedResponse.property.length > 0 ? 
            enhancedResponse.property[0] : null;
          
          // Return enhanced property data or fallback to basic with more complete defaults
          return {
            attomId: attomId,
            address: prop.address?.line1 || address,
            city: prop.address?.locality || city,
            state: prop.address?.countrySubd || state,
            zipCode: prop.address?.postal1 || zip || '',
            latitude: prop.location?.latitude,
            longitude: prop.location?.longitude,
            propertyType: prop.summary?.propertyType || 
                         prop.summary?.proptype || 
                         enhancedProp?.summary?.propertyType || 
                         'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 
                       enhancedProp?.summary?.yearBuilt || 
                       'Unknown',
            bedrooms: prop.building?.rooms?.beds || 
                     enhancedProp?.building?.rooms?.beds || 
                     3,
            bathrooms: prop.building?.rooms?.bathsFull || 
                      enhancedProp?.building?.rooms?.bathsFull || 
                      2,
            squareFeet: prop.building?.size?.universalsize || 
                       enhancedProp?.building?.size?.universalsize || 
                       1500,
            lotSize: prop.lot?.lotsize1 || 
                    enhancedProp?.lot?.lotsize1,
            lastSaleDate: prop.sale?.salesearchdate || 
                         enhancedProp?.sale?.salesearchdate,
            lastSalePrice: prop.sale?.amount?.saleamt || 
                          enhancedProp?.sale?.amount?.saleamt,
            ownerName: prop.owner?.owner1?.name || 
                      enhancedProp?.owner?.owner1?.name || 
                      'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y' || 
                          enhancedProp?.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || 
                           enhancedProp?.avm?.amount?.value || 
                           null
          };
        } catch (err) {
          console.warn(`Could not get enhanced data for property ID ${attomId}:`, err.message);
          // Return basic info with defaults if enhancement fails
          return {
            attomId: attomId,
            address: prop.address?.line1 || address,
            city: prop.address?.locality || city,
            state: prop.address?.countrySubd || state,
            zipCode: prop.address?.postal1 || zip || '',
            propertyType: prop.summary?.proptype || 'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 'Unknown',
            bedrooms: prop.building?.rooms?.beds || 3,
            bathrooms: prop.building?.rooms?.bathsFull || 2,
            squareFeet: prop.building?.size?.universalsize || 1500,
            ownerName: prop.owner?.owner1?.name || 'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || null
          };
        }
      });
      
      // Resolve all enhanced property promises
      const properties = await Promise.all(propertyPromises);
      
      res.json({
        status: 'success',
        message: `Found ${properties.length} properties for "${addressStr}"`,
        properties
      });
    } else {
      res.json({
        status: 'success',
        message: `No properties found for "${addressStr}"`,
        properties: []
      });
    }
  } catch (error) {
    console.error('Error in property address lookup:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up property by address',
      error: error.message
    });
  }
});

// Get properties by ZIP code
router.get('/property/zip', async (req, res) => {
  try {
    const { zip, page = 1, pageSize = 10 } = req.query;
    
    if (!zip) {
      return res.status(400).json({ 
        error: 'Missing required parameter: zip' 
      });
    }
    
    const response = await attomRequest('property/basicprofile', {
      postalcode: zip,
      page,
      pagesize: pageSize
    });
    
    if (response.property && response.property.length > 0) {
      // For each property, fetch enhanced data to get complete information
      const propertyPromises = response.property.map(async (prop) => {
        const attomId = prop.identifier?.attomId;
        if (!attomId) {
          // If no attomId, return basic info with defaults
          return {
            attomId: prop.identifier?.obPropId || 'Unknown',
            address: prop.address?.line1 || 'Unknown Address',
            city: prop.address?.locality || '',
            state: prop.address?.countrySubd || '',
            zipCode: prop.address?.postal1 || zip,
            propertyType: prop.summary?.proptype || 'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 'Unknown',
            bedrooms: prop.building?.rooms?.beds || 3,
            bathrooms: prop.building?.rooms?.bathsFull || 1,
            ownerName: prop.owner?.owner1?.name || 'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || 0
          };
        }
        
        try {
          // Try to get enhanced data for each property
          const enhancedResponse = await attomRequest('property/expandedprofile', {
            attomid: attomId
          }).catch(() => ({ property: [] }));
          
          const enhancedProp = enhancedResponse.property && enhancedResponse.property.length > 0 ? 
            enhancedResponse.property[0] : null;
          
          // Return enhanced property data or fallback to basic with more complete defaults
          return {
            attomId: attomId,
            address: prop.address?.line1 || 'Unknown Address',
            city: prop.address?.locality || '',
            state: prop.address?.countrySubd || '',
            zipCode: prop.address?.postal1 || zip,
            latitude: prop.location?.latitude,
            longitude: prop.location?.longitude,
            propertyType: prop.summary?.propertyType || 
                         prop.summary?.proptype || 
                         enhancedProp?.summary?.propertyType || 
                         'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 
                       enhancedProp?.summary?.yearBuilt || 
                       'Unknown',
            bedrooms: prop.building?.rooms?.beds || 
                     enhancedProp?.building?.rooms?.beds || 
                     3,
            bathrooms: prop.building?.rooms?.bathsFull || 
                      enhancedProp?.building?.rooms?.bathsFull || 
                      1,
            squareFeet: prop.building?.size?.universalsize || 
                       enhancedProp?.building?.size?.universalsize || 
                       1500,
            lotSize: prop.lot?.lotsize1 || 
                    enhancedProp?.lot?.lotsize1,
            lastSaleDate: prop.sale?.salesearchdate || 
                         enhancedProp?.sale?.salesearchdate,
            lastSalePrice: prop.sale?.amount?.saleamt || 
                          enhancedProp?.sale?.amount?.saleamt,
            ownerName: prop.owner?.owner1?.name || 
                      enhancedProp?.owner?.owner1?.name || 
                      'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y' || 
                          enhancedProp?.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || 
                           enhancedProp?.avm?.amount?.value || 
                           null
          };
        } catch (err) {
          console.warn(`Could not get enhanced data for property ID ${attomId}:`, err.message);
          // Return basic info with defaults if enhancement fails
          return {
            attomId: attomId,
            address: prop.address?.line1 || 'Unknown Address',
            city: prop.address?.locality || '',
            state: prop.address?.countrySubd || '',
            zipCode: prop.address?.postal1 || zip,
            propertyType: prop.summary?.proptype || 'Single Family Residence',
            yearBuilt: prop.summary?.yearBuilt || 'Unknown',
            bedrooms: prop.building?.rooms?.beds || 3,
            bathrooms: prop.building?.rooms?.bathsFull || 1,
            squareFeet: prop.building?.size?.universalsize || 1500,
            ownerName: prop.owner?.owner1?.name || 'Unknown',
            ownerOccupied: prop.summary?.ownerOccupied === 'Y',
            estimatedValue: prop.avm?.amount?.value || null
          };
        }
      });
      
      // Resolve all enhanced property promises
      const properties = await Promise.all(propertyPromises);
      
      res.json({
        status: 'success',
        message: `Found ${properties.length} properties in ZIP code ${zip}`,
        total: response.status?.total || properties.length,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        properties
      });
    } else {
      res.json({
        status: 'success',
        message: `No properties found in ZIP code ${zip}`,
        properties: []
      });
    }
  } catch (error) {
    console.error('Error in ZIP code search:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up properties by ZIP code',
      error: error.message
    });
  }
});

// Get property details by ATTOM ID
router.get('/property/:attomId', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    const response = await attomRequest('property/detail', {
      attomid: attomId
    });
    
    if (response.property && response.property.length > 0) {
      // Get the property
      const prop = response.property[0];
      
      // Format the property data for frontend
      const property = {
        attomId: prop.identifier?.attomId,
        address: prop.address?.line1,
        city: prop.address?.locality,
        state: prop.address?.countrySubd,
        zipCode: prop.address?.postal1,
        latitude: prop.location?.latitude,
        longitude: prop.location?.longitude,
        
        // Property details
        propertyType: prop.summary?.proptype,
        propertyUse: prop.summary?.propsubtype,
        yearBuilt: prop.summary?.yearBuilt,
        bedrooms: prop.building?.rooms?.beds,
        bathrooms: prop.building?.rooms?.bathsFull,
        squareFeet: prop.building?.size?.universalsize,
        lotSize: prop.lot?.lotsize1,
        lotSizeUnit: prop.lot?.lotsize1unit,
        
        // Owner information
        ownerName: prop.owner?.owner1?.name,
        ownerOccupied: prop.summary?.ownerOccupied === 'Y',
        
        // Sale information
        lastSaleDate: prop.sale?.salesearchdate,
        lastSalePrice: prop.sale?.amount?.saleamt,
        
        // Tax information
        taxAssessedValue: prop.assessment?.assessed?.assdttlvalue,
        taxMarketValue: prop.assessment?.market?.mktttlvalue,
        
        // Valuation
        estimatedValue: prop.avm?.amount?.value || null,
        estimatedValueHigh: prop.avm?.amount?.high || null,
        estimatedValueLow: prop.avm?.amount?.low || null,
        
        // Additional details
        stories: prop.building?.summary?.storycount,
        garage: prop.building?.parking?.prkgSize,
        pool: prop.building?.interior?.haspool === 'Y',
        fireplaces: prop.building?.interior?.fplccount,
        constructionType: prop.building?.construction?.constructiontype,
        roofType: prop.building?.construction?.roofcover,
        
        // Additional identifiers
        parcelId: prop.identifier?.obPropId,
        fips: prop.area?.countrysecsubd,
        apn: prop.identifier?.apn,
        legal1: prop.identifier?.legal1
      };
      
      res.json({
        status: 'success',
        message: `Property found with ID ${attomId}`,
        property
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `No property found with ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in property detail lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up property details',
      error: error.message
    });
  }
});

// Get property valuation by ATTOM ID
router.get('/property/:attomId/valuation', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    const response = await attomRequest('property/expandedprofile', {
      attomid: attomId
    });
    
    if (response.property && response.property.length > 0) {
      // Get the property
      const prop = response.property[0];
      
      // Format the valuation data for frontend
      const valuation = {
        attomId: prop.identifier?.attomId,
        address: prop.address?.line1,
        city: prop.address?.locality,
        state: prop.address?.countrySubd,
        zipCode: prop.address?.postal1,
        
        // Valuation data
        estimatedValue: prop.avm?.amount?.value || null,
        estimatedValueHigh: prop.avm?.amount?.high || null,
        estimatedValueLow: prop.avm?.amount?.low || null,
        estimatedValueRange: prop.avm?.amount?.high && prop.avm?.amount?.low ? 
          prop.avm.amount.high - prop.avm.amount.low : null,
        confidenceScore: prop.avm?.amount?.confidence || null,
        
        // Tax information
        taxAssessedValue: prop.assessment?.assessed?.assdttlvalue,
        taxMarketValue: prop.assessment?.market?.mktttlvalue,
        taxYear: prop.assessment?.tax?.taxyear,
        taxRate: prop.assessment?.tax?.taxrate,
        taxAmount: prop.assessment?.tax?.taxamt,
        
        // Sale history
        lastSaleDate: prop.sale?.salesearchdate,
        lastSalePrice: prop.sale?.amount?.saleamt,
        
        // Equity estimate (if sale price available)
        estimatedEquity: prop.avm?.amount?.value && prop.sale?.amount?.saleamt ?
          prop.avm.amount.value - prop.sale.amount.saleamt : null
      };
      
      res.json({
        status: 'success',
        message: `Valuation found for property ID ${attomId}`,
        valuation
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `No valuation found for property ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in property valuation lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up property valuation',
      error: error.message
    });
  }
});

// Get comprehensive property details by ATTOM ID - Main endpoint that should be used
router.get('/property/:attomId/detail', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    console.log(`[ATTOM API] Fetching comprehensive property details for ID: ${attomId}`);
    
    // Make multiple API requests in parallel for different data types
    const detailPromise = attomRequest('property/detail', { attomid: attomId });
    const expandedPromise = attomRequest('property/expandedprofile', { attomid: attomId });
    
    // Additional API calls with fallback to empty objects if they fail
    const salePromise = attomRequest('sale/snapshot', { id: attomId })
      .catch(() => ({ property: [] }));
    const assessmentPromise = attomRequest('assessment/snapshot', { id: attomId })
      .catch(() => ({ property: [] }));
    
    // Wait for all API requests to complete
    const [detailResponse, expandedResponse, saleResponse, assessmentResponse] = 
      await Promise.all([detailPromise, expandedPromise, salePromise, assessmentPromise]);
    
    // Check if we have property data
    if (detailResponse.property && detailResponse.property.length > 0) {
      // Get the property data from each response
      const detailProp = detailResponse.property[0];
      const expandedProp = expandedResponse.property && expandedResponse.property.length > 0 ? 
        expandedResponse.property[0] : null;
      const saleProp = saleResponse.property && saleResponse.property.length > 0 ? 
        saleResponse.property[0] : null;
      const assessmentProp = assessmentResponse.property && assessmentResponse.property.length > 0 ? 
        assessmentResponse.property[0] : null;
      
      console.log(`[ATTOM API] Successfully retrieved detail data with ${Object.keys(detailProp || {}).length} fields`);
      if (expandedProp) {
        console.log(`[ATTOM API] Successfully retrieved expanded data with ${Object.keys(expandedProp).length} fields`);
      }
      
      // Format the complete property data for frontend with correct field mappings
      const property = {
        // Basic property identification
        attomId: logValue('attomId', detailProp.identifier?.attomId || detailProp.identifier?.Id, attomId),
        fips: logValue('fips', detailProp.identifier?.fips),
        apn: logValue('apn', detailProp.identifier?.apn),
        
        // Address information
        address: logValue('address', detailProp.address?.line1),
        city: logValue('city', detailProp.address?.locality),
        state: logValue('state', detailProp.address?.countrySubd),
        zipCode: logValue('zipCode', detailProp.address?.postal1),
        
        // Geolocation
        latitude: logValue('latitude', detailProp.location?.latitude),
        longitude: logValue('longitude', detailProp.location?.longitude),
        
        // Property characteristics
        propertyType: logValue('propertyType', 
          detailProp.summary?.propertyType || 
          detailProp.summary?.proptype || 
          detailProp.summary?.propType ||
          detailProp.summary?.propClass ||
          expandedProp?.summary?.propertyType ||
          expandedProp?.summary?.propType ||
          'Single Family Residence'),
          
        propertyUse: logValue('propertyUse', 
          detailProp.summary?.propLandUse ||
          expandedProp?.summary?.propLandUse),
          
        yearBuilt: logValue('yearBuilt', 
          detailProp.summary?.yearBuilt || 
          detailProp.summary?.yearbuilt ||
          expandedProp?.summary?.yearBuilt),
          
        bedrooms: logValue('bedrooms', 
          detailProp.building?.rooms?.beds || 
          expandedProp?.building?.rooms?.beds ||
          3), // Default value for typical home
          
        bathrooms: logValue('bathrooms', 
          detailProp.building?.rooms?.bathsFull ||
          detailProp.building?.rooms?.bathstotal ||
          expandedProp?.building?.rooms?.bathsFull ||
          1), // Default value for typical home
          
        squareFeet: logValue('squareFeet', 
          detailProp.building?.size?.universalSize || 
          detailProp.building?.size?.universalsize || 
          detailProp.building?.size?.livingSize || 
          detailProp.building?.size?.livingsize || 
          detailProp.building?.size?.bldgSize || 
          detailProp.building?.size?.bldgsize ||
          expandedProp?.building?.size?.universalSize ||
          expandedProp?.building?.size?.bldgSize),
          
        lotSize: logValue('lotSize', 
          detailProp.lot?.lotSize1 || 
          detailProp.lot?.lotsize1 ||
          expandedProp?.lot?.lotSize1),
          
        lotSizeUnit: logValue('lotSizeUnit', 
          (detailProp.lot?.lotSize2 || detailProp.lot?.lotsize2) ? 'sqft' : 'acres'),
        
        // Building details
        stories: logValue('stories', 
          detailProp.building?.summary?.levels || 
          detailProp.building?.summary?.storyCount ||
          expandedProp?.building?.summary?.levels || 
          1), // Default to 1 story
          
        garage: logValue('garage', 
          detailProp.building?.parking?.prkgSpaces ||
          expandedProp?.building?.parking?.prkgSpaces),
          
        pool: logValue('pool', 
          detailProp.lot?.poolType !== 'NO POOL' ||
          expandedProp?.lot?.poolType !== 'NO POOL'),
          
        constructionType: logValue('constructionType', 
          detailProp.building?.construction?.constructionType || 
          detailProp.building?.construction?.constructiontype ||
          expandedProp?.building?.construction?.constructionType),
        
        // Owner information
        ownerName: logValue('ownerName', 
          expandedProp?.assessment?.owner?.owner1?.fullName ||
          expandedProp?.assessment?.owner?.owner1?.name ||
          'Current Owner'),
          
        ownerOccupied: logValue('ownerOccupied', 
          detailProp.summary?.absenteeInd === 'OWNER OCCUPIED' ||
          expandedProp?.summary?.absenteeInd === 'OWNER OCCUPIED'),
        
        // Sale information
        lastSaleDate: logValue('lastSaleDate', 
          expandedProp?.sale?.saleTransDate || 
          expandedProp?.sale?.saleSearchDate || 
          saleProp?.sale?.salesearchdate ||
          saleProp?.sale?.saleTransDate),
          
        lastSalePrice: logValue('lastSalePrice', 
          expandedProp?.sale?.amount?.saleAmt || 
          expandedProp?.sale?.amount?.saleamt || 
          saleProp?.sale?.amount?.saleamt ||
          saleProp?.sale?.amount?.saleAmt),
        
        // Tax and valuation information
        taxAssessedValue: logValue('taxAssessedValue', 
          expandedProp?.assessment?.assessed?.assdTtlValue || 
          expandedProp?.assessment?.assessed?.assdttlvalue ||
          assessmentProp?.assessment?.assessed?.assdTtlValue ||
          assessmentProp?.assessment?.assessed?.assdttlvalue),
          
        taxMarketValue: logValue('taxMarketValue', 
          expandedProp?.assessment?.market?.mktTtlValue || 
          expandedProp?.assessment?.market?.mktttlvalue ||
          assessmentProp?.assessment?.market?.mktTtlValue ||
          assessmentProp?.assessment?.market?.mktttlvalue),
          
        taxYear: logValue('taxYear', 
          expandedProp?.assessment?.tax?.taxYear || 
          expandedProp?.assessment?.tax?.taxyear ||
          assessmentProp?.assessment?.tax?.taxYear ||
          assessmentProp?.assessment?.tax?.taxyear),
          
        taxAmount: logValue('taxAmount', 
          expandedProp?.assessment?.tax?.taxAmt || 
          expandedProp?.assessment?.tax?.taxamt ||
          assessmentProp?.assessment?.tax?.taxAmt ||
          assessmentProp?.assessment?.tax?.taxamt),
        
        // Owner mailing address
        ownerMailingAddress: logValue('ownerMailingAddress', 
          expandedProp?.assessment?.owner?.mailingAddressOneLine),
        
        // Calculated equity (estimated value - last sale price)
        estimatedEquity: logValue('estimatedEquity', 
          (expandedProp?.assessment?.market?.mktTtlValue && expandedProp?.sale?.amount?.saleAmt) ?
          expandedProp.assessment.market.mktTtlValue - expandedProp.sale.amount.saleAmt : null)
      };
      
      // Create a response with the property data and debug information
      res.json({
        status: 'success',
        message: `Comprehensive property data found for ID ${attomId}`,
        property,
        _debug: {
          rawDetail: detailProp,
          rawExpanded: expandedProp,
          rawSale: saleProp,
          rawAssessment: assessmentProp
        }
      });
    } else {
      console.log(`[ATTOM API] No property data found for ID ${attomId}`);
      res.status(404).json({
        status: 'error',
        message: `No property found with ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in property detail lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up property details',
      error: error.message
    });
  }
});

// Get owner information by ATTOM ID
router.get('/property/:attomId/owner', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    const response = await attomRequest('property/expandedprofile', {
      attomid: attomId
    });
    
    if (response.property && response.property.length > 0) {
      // Get the property
      const prop = response.property[0];
      
      // Format the owner data for frontend
      const owner = {
        attomId: prop.identifier?.attomId,
        
        // Basic owner info
        name: prop.owner?.owner1?.name,
        firstName: prop.owner?.owner1?.firstNameAndMI,
        lastName: prop.owner?.owner1?.lastName,
        ownerType: prop.owner?.owner1?.ownerType, // Individual, LLC, Trust, etc.
        ownerOccupied: prop.summary?.ownerOccupied === 'Y',
        
        // Mailing address (may differ from property address)
        mailingAddress: prop.owner?.owner1?.mailingAddress,
        mailingCity: prop.owner?.owner1?.mailingCity,
        mailingState: prop.owner?.owner1?.mailingState,
        mailingZip: prop.owner?.owner1?.mailingZip,
        
        // Deed information
        deedType: prop.sale?.deed?.deedtype,
        deedDate: prop.sale?.deed?.deeddate,
        
        // Ownership history
        ownershipTransferDate: prop.sale?.transferDate,
        previousOwnerName: prop.owner?.owner2?.name,
        yearsOwned: prop.sale?.salesearchdate ? 
          Math.floor((new Date() - new Date(prop.sale.salesearchdate)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      };
      
      res.json({
        status: 'success',
        message: `Owner information found for property ID ${attomId}`,
        owner
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `No owner information found for property ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in property owner lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up property owner information',
      error: error.message
    });
  }
});

// Get tax history by ATTOM ID
router.get('/property/:attomId/taxhistory', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    const response = await attomRequest('property/detailwithhistory', {
      attomid: attomId
    });
    
    if (response.property && response.property.length > 0 && 
        response.property[0].assessment && response.property[0].assessment.history) {
      
      const prop = response.property[0];
      const taxHistory = prop.assessment.history.map(record => ({
        year: record.tax?.taxyear,
        taxAmount: record.tax?.taxamt,
        taxRate: record.tax?.taxrate,
        assessedValue: record.assessed?.assdttlvalue,
        marketValue: record.market?.mktttlvalue,
        improvementValue: record.market?.mktimprvalue,
        landValue: record.market?.mktlandvalue
      }));
      
      res.json({
        status: 'success',
        message: `Tax history found for property ID ${attomId}`,
        taxHistory
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `No tax history found for property ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in tax history lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up tax history',
      error: error.message
    });
  }
});

// Get sales history by ATTOM ID
router.get('/property/:attomId/saleshistory', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    const response = await attomRequest('property/detailwithhistory', {
      attomid: attomId
    });
    
    if (response.property && response.property.length > 0 && 
        response.property[0].sale && response.property[0].sale.history) {
      
      const prop = response.property[0];
      const salesHistory = prop.sale.history.map(record => ({
        saleDate: record.salesearchdate,
        saleAmount: record.amount?.saleamt,
        deed: {
          type: record.deed?.deedtype,
          date: record.deed?.deeddate
        },
        buyer: record.buyer?.name,
        seller: record.seller?.name,
        lender: record.mortgage?.lenderName,
        loanAmount: record.mortgage?.amount?.loanamt
      }));
      
      res.json({
        status: 'success',
        message: `Sales history found for property ID ${attomId}`,
        salesHistory
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `No sales history found for property ID ${attomId}`
      });
    }
  } catch (error) {
    console.error(`Error in sales history lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up sales history',
      error: error.message
    });
  }
});

// Create/enrich a lead with full property data
router.post('/lead/enrich', async (req, res) => {
  try {
    const { attomId } = req.body;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    console.log(`Enriching lead data for property ID: ${attomId}`);
    
    // Make multiple API requests in parallel to gather complete property data
    const [detailResponse, expandedResponse, ownerResponse, salesHistoryResponse] = await Promise.all([
      attomRequest('property/detail', { attomid: attomId }),
      attomRequest('property/expandedprofile', { attomid: attomId }),
      attomRequest('property/expandedprofile', { attomid: attomId }), // Reusing for owner info
      attomRequest('property/detailwithhistory', { attomid: attomId })
    ]);
    
    // Check if we have property data
    if (!detailResponse.property || detailResponse.property.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No property found with ID ${attomId}`
      });
    }
    
    // Extract data from each response
    const detailProp = detailResponse.property[0];
    const expandedProp = expandedResponse.property && expandedResponse.property.length > 0 ? 
      expandedResponse.property[0] : null;
    
    // Extract sales history if available
    const salesHistory = salesHistoryResponse.property && 
                        salesHistoryResponse.property.length > 0 && 
                        salesHistoryResponse.property[0].sale && 
                        salesHistoryResponse.property[0].sale.history ?
      salesHistoryResponse.property[0].sale.history.map(record => ({
        saleDate: record.salesearchdate,
        saleAmount: record.amount?.saleamt,
        deed: {
          type: record.deed?.deedtype,
          date: record.deed?.deeddate
        },
        buyer: record.buyer?.name,
        seller: record.seller?.name,
        lender: record.mortgage?.lenderName,
        loanAmount: record.mortgage?.amount?.loanamt
      })) : [];
      
    // Extract tax history if available
    const taxHistory = salesHistoryResponse.property && 
                      salesHistoryResponse.property.length > 0 && 
                      salesHistoryResponse.property[0].assessment && 
                      salesHistoryResponse.property[0].assessment.history ?
      salesHistoryResponse.property[0].assessment.history.map(record => ({
        year: record.tax?.taxyear,
        taxAmount: record.tax?.taxamt,
        taxRate: record.tax?.taxrate,
        assessedValue: record.assessed?.assdttlvalue,
        marketValue: record.market?.mktttlvalue,
        improvementValue: record.market?.mktimprvalue,
        landValue: record.market?.mktlandvalue
      })) : [];
    
    // Create a fully enriched lead object
    const enrichedLead = {
      // Basic property information
      attomId: detailProp.identifier?.attomId,
      address: detailProp.address?.line1,
      city: detailProp.address?.locality,
      state: detailProp.address?.countrySubd,
      zipCode: detailProp.address?.postal1,
      latitude: detailProp.location?.latitude,
      longitude: detailProp.location?.longitude,
      
      // Property details
      propertyType: detailProp.summary?.proptype,
      propertyUse: detailProp.summary?.propsubtype,
      yearBuilt: detailProp.summary?.yearBuilt,
      bedrooms: detailProp.building?.rooms?.beds,
      bathrooms: detailProp.building?.rooms?.bathsFull,
      squareFeet: detailProp.building?.size?.universalsize,
      lotSize: detailProp.lot?.lotsize1,
      lotSizeUnit: detailProp.lot?.lotsize1unit,
      stories: detailProp.building?.summary?.storycount,
      garage: detailProp.building?.parking?.prkgSize,
      pool: detailProp.building?.interior?.haspool === 'Y',
      fireplaces: detailProp.building?.interior?.fplccount,
      constructionType: detailProp.building?.construction?.constructiontype,
      roofType: detailProp.building?.construction?.roofcover,
      
      // Identifiers
      parcelId: detailProp.identifier?.obPropId,
      fips: detailProp.area?.countrysecsubd,
      apn: detailProp.identifier?.apn,
      legal1: detailProp.identifier?.legal1,
      
      // Owner information (crucial for lead generation)
      ownerName: detailProp.owner?.owner1?.name,
      ownerFirstName: expandedProp?.owner?.owner1?.firstNameAndMI,
      ownerLastName: expandedProp?.owner?.owner1?.lastName,
      ownerType: expandedProp?.owner?.owner1?.ownerType,
      ownerOccupied: detailProp.summary?.ownerOccupied === 'Y',
      
      // Mailing address (critical for direct mail campaigns)
      ownerMailingAddress: expandedProp?.owner?.owner1?.mailingAddress,
      ownerMailingCity: expandedProp?.owner?.owner1?.mailingCity,
      ownerMailingState: expandedProp?.owner?.owner1?.mailingState,
      ownerMailingZip: expandedProp?.owner?.owner1?.mailingZip,
      isAbsenteeOwner: expandedProp?.owner?.owner1?.mailingAddress !== detailProp.address?.line1,
      
      // Sale information
      lastSaleDate: detailProp.sale?.salesearchdate,
      lastSalePrice: detailProp.sale?.amount?.saleamt,
      deedType: detailProp.sale?.deed?.deedtype,
      deedDate: detailProp.sale?.deed?.deeddate,
      yearsOwned: detailProp.sale?.salesearchdate ? 
          Math.floor((new Date() - new Date(detailProp.sale.salesearchdate)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      
      // Tax information
      taxAssessedValue: detailProp.assessment?.assessed?.assdttlvalue,
      taxMarketValue: detailProp.assessment?.market?.mktttlvalue,
      taxYear: detailProp.assessment?.tax?.taxyear,
      taxRate: expandedProp?.assessment?.tax?.taxrate,
      taxAmount: expandedProp?.assessment?.tax?.taxamt,
      
      // Valuation
      estimatedValue: expandedProp?.avm?.amount?.value || null,
      estimatedValueHigh: expandedProp?.avm?.amount?.high || null,
      estimatedValueLow: expandedProp?.avm?.amount?.low || null,
      confidenceScore: expandedProp?.avm?.amount?.confidence || null,
      
      // Mortgage info (important for equity analysis)
      mortgageAmount: expandedProp?.mortgage?.amount?.loanamt,
      mortgageLender: expandedProp?.mortgage?.lenderName,
      mortgageDate: expandedProp?.mortgage?.date?.firstDate,
      mortgageMaturityDate: expandedProp?.mortgage?.date?.maturityDate,
      mortgageInterestRate: expandedProp?.mortgage?.calculation?.rate,
      
      // Equity estimate (critical for lead quality)
      estimatedEquity: expandedProp?.avm?.amount?.value && detailProp.sale?.amount?.saleamt ?
        expandedProp.avm.amount.value - detailProp.sale.amount.saleamt : null,
      estimatedEquityPercentage: expandedProp?.avm?.amount?.value && detailProp.sale?.amount?.saleamt ?
        ((expandedProp.avm.amount.value - detailProp.sale.amount.saleamt) / expandedProp.avm.amount.value) * 100 : null,
      
      // Histories for more complete data
      salesHistory: salesHistory.length > 0 ? salesHistory : null,
      taxHistory: taxHistory.length > 0 ? taxHistory : null,
      
      // Lead metadata
      createdAt: new Date().toISOString(),
      enrichmentLevel: 'full', // Track that this is a fully enriched lead
      dataSource: 'ATTOM'
    };
    
    // Add calculated fields for lead quality assessment
    enrichedLead.leadQualityScore = calculateLeadQualityScore(enrichedLead);
    
    res.json({
      status: 'success',
      message: `Lead successfully enriched with property ID ${attomId}`,
      lead: enrichedLead
    });
  } catch (error) {
    console.error(`Error in lead enrichment for property ID ${req.body.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error enriching lead data',
      error: error.message
    });
  }
});

// Helper function to calculate lead quality score based on available data
function calculateLeadQualityScore(lead) {
  let score = 0;
  const maxScore = 100;
  
  // Basic property data (max 20 points)
  if (lead.address) score += 5;
  if (lead.yearBuilt) score += 5;
  if (lead.propertyType) score += 5;
  if (lead.squareFeet) score += 5;
  
  // Owner information (max 30 points)
  if (lead.ownerName) score += 10;
  if (lead.ownerMailingAddress) score += 10;
  if (lead.ownerMailingZip) score += 5;
  if (lead.isAbsenteeOwner === true) score += 5; // Absentee owners often more likely to sell
  
  // Financial data (max 40 points)
  if (lead.estimatedValue) score += 10;
  if (lead.lastSalePrice) score += 10;
  if (lead.mortgageAmount) score += 10;
  if (lead.estimatedEquity && lead.estimatedEquity > 0) score += 10;
  
  // History data (max 10 points)
  if (lead.salesHistory && lead.salesHistory.length > 0) score += 5;
  if (lead.taxHistory && lead.taxHistory.length > 0) score += 5;
  
  // Return score as percentage of max possible
  return Math.min(Math.round((score / maxScore) * 100), 100);
}

export default router;
