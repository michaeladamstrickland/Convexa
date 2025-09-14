// ATTOM API routes for FlipTracker
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const router = express.Router();

// Helper function to log values for debugging
function logValue(field, value) {
  console.log(`[ATTOM API] Field '${field}': ${value === undefined ? 'undefined' : value === null ? 'null' : value}`);
  return value;
}

// Helper function for ATTOM API requests
async function attomRequest(endpoint, params) {
  const apiKey = process.env.ATTOM_API_KEY;
  const baseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  
  console.log(`[ATTOM API] Making request to ${endpoint} with params:`, params);
  
  // Remove any quotes if they exist in the API key
  const cleanApiKey = apiKey ? apiKey.replace(/["']/g, '') : '';
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${baseUrl}/${endpoint}`,
      headers: {
        'apikey': cleanApiKey,
        'Accept': 'application/json'
      },
      params
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error in ATTOM API request to ${endpoint}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Get property details by ATTOM ID (enhanced endpoint with correct field mappings)
router.get('/property/:attomId/detail', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: attomId' 
      });
    }
    
    console.log(`[ATTOM API] Fetching property details for ID: ${attomId}`);
    
    // Make multiple API requests in parallel for different data types
    // Based on our testing, the detail and expandedprofile endpoints are the most reliable
    const [detailResponse, expandedResponse, saleResponse, assessmentResponse] = await Promise.all([
      attomRequest('property/detail', { attomid: attomId }),
      attomRequest('property/expandedprofile', { attomid: attomId }),
      attomRequest('sale/snapshot', { id: attomId }).catch(err => ({ property: [] })), // Optional
      attomRequest('assessment/snapshot', { id: attomId }).catch(err => ({ property: [] })) // Optional
    ]);
    
    // Log raw responses to debug data structure
    console.log(`[ATTOM API] Detail response structure:`, JSON.stringify(detailResponse, null, 2).substring(0, 500) + '...');
    
    // Check if we have property data
    if (detailResponse.property && detailResponse.property.length > 0) {
      // Get the basic property data
      const detailProp = detailResponse.property[0];
      console.log(`[ATTOM API] Detail property keys:`, Object.keys(detailProp));
      
      // Get expanded data if available
      const expandedProp = expandedResponse.property && expandedResponse.property.length > 0 ? 
        expandedResponse.property[0] : null;
      console.log(`[ATTOM API] Expanded property keys:`, expandedProp ? Object.keys(expandedProp) : 'No expanded data');
      
      // Get sale data if available
      const saleProp = saleResponse.property && saleResponse.property.length > 0 ? 
        saleResponse.property[0] : null;
      
      // Get assessment data if available
      const assessmentProp = assessmentResponse.property && assessmentResponse.property.length > 0 ? 
        assessmentResponse.property[0] : null;
      
      // Format the complete property data for frontend with correct field mappings
      // Based on our API exploration results
      const property = {
        attomId: detailProp.identifier?.attomId,
        address: detailProp.address?.line1,
        city: detailProp.address?.locality,
        state: detailProp.address?.countrySubd,
        zipCode: detailProp.address?.postal1,
        latitude: detailProp.location?.latitude,
        longitude: detailProp.location?.longitude,
        
        // Property details - using correct field names based on our API exploration
        propertyType: logValue('propertyType', detailProp.summary?.proptype || detailProp.summary?.propertyType),
        propertyUse: logValue('propertyUse', detailProp.summary?.propLandUse),
        yearBuilt: logValue('yearBuilt', detailProp.summary?.yearbuilt || detailProp.summary?.yearBuilt),
        bedrooms: logValue('bedrooms', detailProp.building?.rooms?.beds),
        bathrooms: logValue('bathrooms', detailProp.building?.rooms?.bathsFull),
        squareFeet: logValue('squareFeet', detailProp.building?.size?.universalsize || detailProp.building?.size?.universalSize || detailProp.building?.size?.livingsize || detailProp.building?.size?.livingSize || detailProp.building?.size?.bldgsize || detailProp.building?.size?.bldgSize),
        lotSize: logValue('lotSize', detailProp.lot?.lotsize1 || detailProp.lot?.lotSize1),
        lotSizeUnit: logValue('lotSizeUnit', (detailProp.lot?.lotsize2 && detailProp.lot?.lotsize2 > 0) ? 'sqft' : 'acres'),
        
        // Building details
        stories: logValue('stories', detailProp.building?.summary?.levels),
        garage: logValue('garage', detailProp.building?.parking?.prkgSpaces),
        pool: logValue('pool', detailProp.lot?.poolType !== 'NO POOL'),
        fireplaces: logValue('fireplaces', detailProp.building?.interior?.fplccount),
        constructionType: logValue('constructionType', detailProp.building?.construction?.constructiontype || detailProp.building?.construction?.constructionType),
        roofType: logValue('roofType', detailProp.building?.construction?.roofcover),
        
        // Identifiers
        parcelId: detailProp.identifier?.obPropId,
        fips: detailProp.area?.countrysecsubd || detailProp.area?.countrySecSubd,
        apn: detailProp.identifier?.apn,
        legal1: detailProp.summary?.legal1,
        
        // Owner information - these fields may not be available due to privacy restrictions
        ownerName: detailProp.owner?.owner1?.name,
        ownerOccupied: detailProp.summary?.absenteeInd === 'OWNER OCCUPIED',
        
        // Sale information
        lastSaleDate: expandedProp?.sale?.saleTransDate || expandedProp?.sale?.saleSearchDate || saleProp?.sale?.saleTransDate,
        lastSalePrice: expandedProp?.sale?.amount?.saleAmt || expandedProp?.sale?.amount?.saleamt || saleProp?.sale?.amount?.saleamt,
        
        // Tax information - from assessment endpoint or expandedprofile
        taxAssessedValue: assessmentProp?.assessment?.assessed?.assdttlvalue || expandedProp?.assessment?.assessed?.assdTtlValue,
        taxMarketValue: assessmentProp?.assessment?.market?.mktttlvalue || expandedProp?.assessment?.market?.mktTtlValue,
        taxYear: assessmentProp?.assessment?.tax?.taxyear || expandedProp?.assessment?.tax?.taxYear,
        taxAmount: assessmentProp?.assessment?.tax?.taxamt || expandedProp?.assessment?.tax?.taxAmt,
        
        // Additional data from expanded profile
        ownerMailingAddress: expandedProp?.assessment?.owner?.mailingAddressOneLine,
        
        // Estimated equity - may not be accurately calculated due to lack of current mortgage data
        estimatedEquity: expandedProp?.assessment?.market?.mktTtlValue && expandedProp?.sale?.amount?.saleAmt ?
          expandedProp.assessment.market.mktTtlValue - expandedProp.sale.amount.saleAmt : null
      };
      
      console.log(`[ATTOM API] Formatted property data:`, JSON.stringify(property, null, 2));
      
      res.json({
        status: 'success',
        message: `Enriched property data found for ID ${attomId}`,
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
    console.error(`Error in enriched property detail lookup for ID ${req.params.attomId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error looking up enriched property details',
      error: error.message
    });
  }
});

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
      // Format property data for frontend using correct field mappings
      const properties = response.property.map(prop => ({
        attomId: prop.identifier?.attomId,
        address: prop.address?.line1,
        city: prop.address?.locality,
        state: prop.address?.countrySubd,
        zipCode: prop.address?.postal1,
        latitude: prop.location?.latitude,
        longitude: prop.location?.longitude,
        propertyType: prop.summary?.proptype || prop.summary?.propertyType,
        yearBuilt: prop.summary?.yearbuilt || prop.summary?.yearBuilt,
        bedrooms: prop.building?.rooms?.beds,
        bathrooms: prop.building?.rooms?.bathsFull,
        squareFeet: prop.building?.size?.universalsize || prop.building?.size?.universalSize || prop.building?.size?.livingsize || prop.building?.size?.livingSize || prop.building?.size?.bldgsize || prop.building?.size?.bldgSize,
        lotSize: prop.lot?.lotsize1 || prop.lot?.lotSize1,
        lastSaleDate: prop.sale?.salesearchdate || prop.sale?.saleSearchDate,
        lastSalePrice: prop.sale?.amount?.saleamt || prop.sale?.amount?.saleAmt,
      }));
      
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
      // Format property data for frontend using correct field mappings
      const properties = response.property.map(prop => ({
        attomId: prop.identifier?.attomId,
        address: prop.address?.line1,
        city: prop.address?.locality,
        state: prop.address?.countrySubd,
        zipCode: prop.address?.postal1,
        latitude: prop.location?.latitude,
        longitude: prop.location?.longitude,
        propertyType: prop.summary?.proptype || prop.summary?.propertyType,
        yearBuilt: prop.summary?.yearbuilt || prop.summary?.yearBuilt,
        bedrooms: prop.building?.rooms?.beds,
        bathrooms: prop.building?.rooms?.bathsFull,
        squareFeet: prop.building?.size?.universalsize || prop.building?.size?.universalSize || prop.building?.size?.livingsize || prop.building?.size?.livingSize || prop.building?.size?.bldgsize || prop.building?.size?.bldgSize,
        lotSize: prop.lot?.lotsize1 || prop.lot?.lotSize1,
        lastSaleDate: prop.sale?.salesearchdate || prop.sale?.saleSearchDate,
        lastSalePrice: prop.sale?.amount?.saleamt || prop.sale?.amount?.saleAmt,
      }));
      
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

// Get property by ATTOM ID (basic endpoint for simple lookups)
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
        propertyType: prop.summary?.proptype || prop.summary?.propertyType,
        propertyUse: prop.summary?.propLandUse,
        yearBuilt: prop.summary?.yearbuilt || prop.summary?.yearBuilt,
        bedrooms: prop.building?.rooms?.beds,
        bathrooms: prop.building?.rooms?.bathsFull,
        squareFeet: prop.building?.size?.universalsize || prop.building?.size?.universalSize,
        lotSize: prop.lot?.lotsize1 || prop.lot?.lotSize1,
        lotSizeUnit: (prop.lot?.lotsize2 && prop.lot?.lotsize2 > 0) ? 'sqft' : 'acres',
        
        // Owner information
        ownerOccupied: prop.summary?.absenteeInd === 'OWNER OCCUPIED',
        
        // Identifiers
        parcelId: prop.identifier?.obPropId,
        fips: prop.area?.countrysecsubd,
        apn: prop.identifier?.apn,
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

// Get API status
router.get('/status', async (req, res) => {
  try {
    // Test a simple API call to verify connectivity
    const testResponse = await attomRequest('property/detail', {
      attomid: '42116' // Use a test property ID
    });
    
    res.json({
      status: 'success',
      message: 'ATTOM API is operational',
      apiKeyValid: true,
      serverRunning: true
    });
  } catch (error) {
    console.error('Error checking API status:', error);
    
    // Check if it's an authentication error
    const isAuthError = error.response && 
      (error.response.status === 401 || 
       error.response.status === 403 || 
       (error.response.data && error.response.data.status && 
        error.response.data.status.code && 
        (error.response.data.status.code === '401' || 
         error.response.data.status.code === '403')));
    
    res.status(500).json({
      status: 'error',
      message: 'ATTOM API status check failed',
      apiKeyValid: !isAuthError,
      serverRunning: true,
      error: error.message
    });
  }
});

export default router;
