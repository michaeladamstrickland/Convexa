const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config');

// ATTOM API configuration
const ATTOM_API_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || config.attomApiKey;

// Middleware to set up ATTOM API headers
const attomApiHeaders = {
  'apikey': ATTOM_API_KEY,
  'accept': 'application/json'
};

// Error handler helper
const handleApiError = (res, error, message) => {
  console.error(`ATTOM API Error: ${message}`, error);
  const statusCode = error.response?.status || 500;
  const errorMsg = error.response?.data?.status?.msg || error.message || message;
  return res.status(statusCode).json({
    status: 'error',
    message: errorMsg
  });
};

// Basic property search by address
router.get('/address', async (req, res) => {
  try {
    const { address, city, state, zip } = req.query;
    
    if (!address || !city || !state) {
      return res.status(400).json({
        status: 'error',
        message: 'Address, city, and state are required parameters'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/address`, {
      headers: attomApiHeaders,
      params: {
        address,
        city,
        state,
        postalcode: zip || '',
      }
    });
    
    return res.json({
      status: 'success',
      properties: processPropertyResults(response.data)
    });
  } catch (error) {
    return handleApiError(res, error, 'Error searching by address');
  }
});

// Property search by ZIP code
router.get('/zip', async (req, res) => {
  try {
    const { zip, page = 1, pageSize = 20, ...filters } = req.query;
    
    if (!zip) {
      return res.status(400).json({
        status: 'error',
        message: 'ZIP code is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/address`, {
      headers: attomApiHeaders,
      params: {
        postalcode: zip,
        page,
        pagesize: pageSize,
        ...buildFilterParams(filters)
      }
    });
    
    return res.json({
      status: 'success',
      total: response.data?.status?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      properties: processPropertyResults(response.data)
    });
  } catch (error) {
    return handleApiError(res, error, 'Error searching by ZIP code');
  }
});

// Property search by location (latitude/longitude + radius)
router.get('/location', async (req, res) => {
  try {
    const { latitude, longitude, radius = 1, page = 1, pageSize = 20, ...filters } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude are required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/geo`, {
      headers: attomApiHeaders,
      params: {
        latitude,
        longitude,
        radius,
        page,
        pagesize: pageSize,
        ...buildFilterParams(filters)
      }
    });
    
    return res.json({
      status: 'success',
      total: response.data?.status?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      properties: processPropertyResults(response.data)
    });
  } catch (error) {
    return handleApiError(res, error, 'Error searching by location');
  }
});

// Property search by polygon
router.get('/polygon', async (req, res) => {
  try {
    const { polygon, page = 1, pageSize = 20, ...filters } = req.query;
    
    if (!polygon) {
      return res.status(400).json({
        status: 'error',
        message: 'Polygon coordinates are required'
      });
    }
    
    // Parse the polygon from JSON string
    const polygonCoords = JSON.parse(polygon);
    
    // Format polygon for ATTOM API
    const polygonString = polygonCoords
      .map(point => `${point.lat},${point.lng}`)
      .join('|');
    
    const response = await axios.get(`${ATTOM_API_URL}/property/geo`, {
      headers: attomApiHeaders,
      params: {
        polygon: polygonString,
        page,
        pagesize: pageSize,
        ...buildFilterParams(filters)
      }
    });
    
    return res.json({
      status: 'success',
      total: response.data?.status?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      properties: processPropertyResults(response.data)
    });
  } catch (error) {
    return handleApiError(res, error, 'Error searching by polygon');
  }
});

// Get basic property details by ATTOM ID
router.get('/:attomId', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/basicprofile`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    const properties = processPropertyResults(response.data);
    
    if (!properties || properties.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Property with ATTOM ID ${attomId} not found`
      });
    }
    
    return res.json({
      status: 'success',
      property: properties[0]
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting property with ATTOM ID ${req.params.attomId}`);
  }
});

// Get ENRICHED property details by ATTOM ID
router.get('/:attomId/detail', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/detailwithschools`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    const properties = processPropertyResults(response.data, true);
    
    if (!properties || properties.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Property with ATTOM ID ${attomId} not found`
      });
    }
    
    return res.json({
      status: 'success',
      property: properties[0]
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting detailed property data with ATTOM ID ${req.params.attomId}`);
  }
});

// Get owner information by ATTOM ID
router.get('/:attomId/owner', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/ownerinfo`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    if (!response.data || !response.data.property || !response.data.property[0]) {
      return res.status(404).json({
        status: 'error',
        message: `Owner information for property with ATTOM ID ${attomId} not found`
      });
    }
    
    const ownerData = response.data.property[0];
    
    return res.json({
      status: 'success',
      owner: processOwnerData(ownerData)
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting owner information with ATTOM ID ${req.params.attomId}`);
  }
});

// Get property valuation by ATTOM ID
router.get('/:attomId/valuation', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    // Call AVM API for property valuation
    const response = await axios.get(`${ATTOM_API_URL}/property/avm`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    if (!response.data || !response.data.property || !response.data.property[0]) {
      return res.status(404).json({
        status: 'error',
        message: `Valuation for property with ATTOM ID ${attomId} not found`
      });
    }
    
    const valuationData = response.data.property[0];
    
    // Calculate estimated equity if possible
    let estimatedEquity = null;
    if (valuationData.avm?.amount?.value && valuationData.assessment?.sale?.saleAmt) {
      const currentValue = valuationData.avm.amount.value;
      const lastSalePrice = valuationData.assessment.sale.saleAmt;
      estimatedEquity = currentValue - lastSalePrice;
    }
    
    return res.json({
      status: 'success',
      valuation: {
        estimatedValue: valuationData.avm?.amount?.value,
        estimatedValueLow: valuationData.avm?.amount?.valueRange?.low,
        estimatedValueHigh: valuationData.avm?.amount?.valueRange?.high,
        confidenceScore: valuationData.avm?.amount?.confidence,
        lastSalePrice: valuationData.assessment?.sale?.saleAmt,
        lastSaleDate: valuationData.assessment?.sale?.saleDate,
        taxAssessedValue: valuationData.assessment?.assessed?.assdTtlValue,
        taxMarketValue: valuationData.assessment?.market?.mktTtlValue,
        taxYear: valuationData.assessment?.tax?.taxYear,
        estimatedEquity: estimatedEquity
      }
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting property valuation with ATTOM ID ${req.params.attomId}`);
  }
});

// Get property tax history by ATTOM ID
router.get('/:attomId/taxhistory', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/taxhistory`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    if (!response.data || !response.data.property || !response.data.property[0]) {
      return res.status(404).json({
        status: 'error',
        message: `Tax history for property with ATTOM ID ${attomId} not found`
      });
    }
    
    const taxData = response.data.property[0];
    
    return res.json({
      status: 'success',
      taxHistory: processTaxHistory(taxData)
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting tax history with ATTOM ID ${req.params.attomId}`);
  }
});

// Get property sales history by ATTOM ID
router.get('/:attomId/saleshistory', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    if (!attomId) {
      return res.status(400).json({
        status: 'error',
        message: 'ATTOM ID is required'
      });
    }
    
    const response = await axios.get(`${ATTOM_API_URL}/property/salehistory`, {
      headers: attomApiHeaders,
      params: {
        attomid: attomId
      }
    });
    
    if (!response.data || !response.data.property || !response.data.property[0]) {
      return res.status(404).json({
        status: 'error',
        message: `Sales history for property with ATTOM ID ${attomId} not found`
      });
    }
    
    const salesData = response.data.property[0];
    
    return res.json({
      status: 'success',
      salesHistory: processSalesHistory(salesData)
    });
  } catch (error) {
    return handleApiError(res, error, `Error getting sales history with ATTOM ID ${req.params.attomId}`);
  }
});

// Helper function to process property search results
function processPropertyResults(data, isDetailed = false) {
  if (!data || !data.property) {
    return [];
  }
  
  return data.property.map(prop => {
    const result = {
      attomId: prop.identifier?.attomId,
      parcelId: prop.identifier?.obPropId,
      fips: prop.identifier?.fips,
      apn: prop.identifier?.apn,
      address: prop.address?.line1,
      city: prop.address?.locality,
      state: prop.address?.countrySubd,
      zipCode: prop.address?.postal1,
      latitude: prop.location?.latitude,
      longitude: prop.location?.longitude,
      propertyType: prop.summary?.proptype,
      yearBuilt: prop.summary?.yearBuilt,
      bedrooms: prop.building?.rooms?.beds,
      bathrooms: prop.building?.rooms?.bathstotal,
      squareFeet: prop.building?.size?.universalsize,
      lotSize: prop.lot?.lotsize1,
      lotSizeUnit: prop.lot?.lotsizeunit,
      ownerOccupied: prop.summary?.propIndicator?.ownerOccupied === 'Y',
      lastSaleDate: prop.sale?.saleDate,
      lastSalePrice: prop.sale?.amount?.saleAmt,
      estimatedValue: prop.avm?.amount?.value
    };
    
    // Add additional fields for detailed view
    if (isDetailed) {
      result.stories = prop.building?.summary?.levels;
      result.garage = prop.building?.parking?.prkgSize;
      result.pool = prop.building?.interior?.hasPool === 'Y';
      result.fireplaces = prop.building?.interior?.fireplace;
      result.legal1 = prop.identifier?.legal1;
      result.subdivision = prop.area?.subdName;
      result.zoning = prop.area?.zoneName;
      result.taxRate = prop.assessment?.tax?.taxRate;
      result.taxAmount = prop.assessment?.tax?.taxAmt;
      
      // Add mortgage data if available
      if (prop.mortgage) {
        result.mortgageAmount = prop.mortgage?.amount?.loanAmt;
        result.mortgageLender = prop.mortgage?.lenderName;
        result.mortgageDate = prop.mortgage?.date?.firstConcurrencyDate;
        result.mortgageMaturityDate = prop.mortgage?.maturityDate;
        result.mortgageInterestRate = prop.mortgage?.rate?.rateType;
      }
    }
    
    return result;
  });
}

// Process owner data
function processOwnerData(ownerData) {
  if (!ownerData) return null;
  
  return {
    name: ownerData.owner?.[0]?.name || 'Unknown',
    ownerOccupied: ownerData.summary?.propIndicator?.ownerOccupied === 'Y',
    mailingAddress: ownerData.owner?.[0]?.mailingAddress?.line1,
    mailingCity: ownerData.owner?.[0]?.mailingAddress?.locality,
    mailingState: ownerData.owner?.[0]?.mailingAddress?.countrySubd,
    mailingZip: ownerData.owner?.[0]?.mailingAddress?.postal1,
    ownerType: ownerData.owner?.[0]?.ownerType,
    deedType: ownerData.deed?.deedType,
    deedDate: ownerData.deed?.dateOfDeed
  };
}

// Process tax history
function processTaxHistory(taxData) {
  if (!taxData || !taxData.taxhistory) return [];
  
  return taxData.taxhistory.map(tax => ({
    year: tax.taxyear,
    amount: tax.taxamt,
    assessedValue: tax.assdttlvalue,
    marketValue: tax.mktttlvalue,
    improvementValue: tax.improvementValue,
    landValue: tax.landValue
  }));
}

// Process sales history
function processSalesHistory(salesData) {
  if (!salesData || !salesData.salehistory) return [];
  
  return salesData.salehistory.map(sale => ({
    date: sale.saleDate,
    amount: sale.amount?.saleAmt,
    deedType: sale.deed?.deedType,
    buyerName: sale.buyer?.[0]?.name,
    sellerName: sale.seller?.[0]?.name,
    lenderName: sale.mortgage?.lenderName,
    loanAmount: sale.mortgage?.amount?.loanAmt,
    loanType: sale.mortgage?.loanType
  }));
}

// Build filter parameters for property search
function buildFilterParams(filters) {
  const params = {};
  
  if (filters.minValue) params.minAVMValue = filters.minValue;
  if (filters.maxValue) params.maxAVMValue = filters.maxValue;
  if (filters.minBeds) params.minBeds = filters.minBeds;
  if (filters.minBaths) params.minBaths = filters.minBaths;
  if (filters.propertyType) params.propertyType = filters.propertyType;
  if (filters.yearBuiltAfter) params.minYearBuilt = filters.yearBuiltAfter;
  if (filters.yearBuiltBefore) params.maxYearBuilt = filters.yearBuiltBefore;
  if (filters.squareFeetMin) params.minUniversalSize = filters.squareFeetMin;
  if (filters.squareFeetMax) params.maxUniversalSize = filters.squareFeetMax;
  
  return params;
}

module.exports = router;
