import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Grid, Paper, Typography, Divider, Box, 
  Tabs, Tab, Card, CardContent, CardHeader, Chip, 
  List, ListItem, ListItemText, CircularProgress,
  Button, IconButton, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Link
} from '@mui/material';
import { 
  Home, AttachMoney, Assessment, Timeline, 
  Layers, Info, Person, Receipt, Map,
  ShowChart, ArrowUpward, ArrowDownward, BarChart,
  LocalOffer, Bookmarks, Visibility, Print, Share
} from '@mui/icons-material';
import { formatCurrency, formatDate, calculateMortgage } from './utils/formatters';
import PropertyMap from './PropertyMap';
import PropertyValuationChart from './PropertyValuationChart';
import PropertyHistoryTimeline from './PropertyHistoryTimeline';
import PropertyComparables from './PropertyComparables';
import PropertySalePotentialCalculator from './PropertySalePotentialCalculator';

// Styling constants
const sectionPadding = 3;
const cardElevation = 2;

// Enhanced helper function for safely accessing nested properties with debugging
const getNestedValue = (obj, path, defaultValue = 'N/A') => {
  // Enable this for detailed UI rendering logs
  const DEBUG_UI_RENDERING = true;
  
  try {
    // Don't use "N/A" for boolean false values or zero
    const result = path.split('.').reduce((o, key) => o && (o[key] !== undefined) ? o[key] : undefined, obj);
    
    // Log what's happening when we access values
    if (DEBUG_UI_RENDERING) {
      console.log(`[UI RENDER] Getting ${path}: Raw value = ${JSON.stringify(result)}, Type = ${typeof result}`);
    }
    
    // Handle all value types appropriately
    if (result === undefined || result === null) {
      if (DEBUG_UI_RENDERING) {
        console.log(`[UI RENDER] ⚠️ Using default for ${path}: ${defaultValue}`);
      }
      return defaultValue;
    }
    
    if (typeof result === 'boolean') {
      return result; // Return actual boolean, not defaultValue
    }
    
    if (typeof result === 'number') {
      return result; // Return actual number, even if 0, not defaultValue
    }
    
    // For strings, objects, and arrays, only return defaultValue if they're empty
    if (typeof result === 'string' && result.trim() === '') {
      if (DEBUG_UI_RENDERING) {
        console.log(`[UI RENDER] ⚠️ Empty string for ${path}, using default: ${defaultValue}`);
      }
      return defaultValue;
    }
    
    return result;
  } catch (e) {
    console.error(`[UI RENDER] ❌ Error getting value for path ${path}:`, e);
    return defaultValue;
  }
};

// Helper for numeric formatting with fallbacks
const formatNumber = (value, defaultValue = 'N/A') => {
  if (value === undefined || value === null) return defaultValue;
  if (isNaN(value)) return defaultValue;
  return Number(value).toLocaleString();
};

const PropertyDetailEnhanced = ({ propertyId, property: initialProperty, onBack }) => {
  // GUARANTEED CONSOLE LOG - This should always appear
  console.log('🚨 PROPERTY DETAIL ENHANCED COMPONENT LOADED 🚨');
  console.log('🚨 Property ID:', propertyId);
  console.log('🚨 Initial Property:', initialProperty);

  const [property, setProperty] = useState(initialProperty);
  const [loading, setLoading] = useState(!initialProperty);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [salesHistory, setSalesHistory] = useState([]);
  const [taxHistory, setTaxHistory] = useState([]);
  const [showFullOwnerInfo, setShowFullOwnerInfo] = useState(false);
  const [viewMode, setViewMode] = useState('investor'); // investor, agent, or standard

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleOwnerInfo = () => {
    setShowFullOwnerInfo(!showFullOwnerInfo);
  };

  useEffect(() => {
    const fetchPropertyData = async () => {
      // Show an alert to ensure we can see debugging info
      alert('PropertyDetailEnhanced component is fetching data for ID: ' + propertyId);
      
      setLoading(true);
      try {
        console.log("=================== DATA FLOW ANALYSIS ===================");
        console.log("[1] Property ID being requested:", propertyId);
        
        // Check if the ATTOM API server is running
        try {
          const statusResponse = await axios.get('/api/attom/status');
          console.log("[2] ATTOM API status:", statusResponse.data);
        } catch (statusErr) {
          console.error("[ERROR] ATTOM API server may not be running:", statusErr);
        }
        
        // Fetch comprehensive property data
        console.log(`Fetching property data for ID: ${propertyId}`);
        console.log(`[3] Making API request to: /api/attom/property/${propertyId}/detail`);
        const response = await axios.get(`/api/attom/property/${propertyId}/detail`);
        
        console.log("[4] Raw API response structure:", Object.keys(response.data));
        console.log("[5] API response status:", response.data.status);
        
        if (response.data && response.data.status === 'success') {
          console.log("[6] Raw property object from API:", response.data.property);
          
          // Check for common field transformation problems
          if (response.data._debug) {
            console.log("[6.1] 🔎 FIELD TRANSFORMATION ANALYSIS");
            
            // Helper function to deep check a specific field in the raw API data
            const checkRawField = (fieldPath, mappedField) => {
              const rawDetail = response.data._debug.rawDetail || {};
              const rawExpanded = response.data._debug.rawExpanded || {};
              
              // Function to get nested value
              const getDeepValue = (obj, path) => {
                if (!obj) return undefined;
                const parts = path.split('.');
                let current = obj;
                for (const part of parts) {
                  if (current[part] === undefined) return undefined;
                  current = current[part];
                }
                return current;
              };
              
              // Check the field in both raw response objects
              const detailValue = getDeepValue(rawDetail, fieldPath);
              const expandedValue = getDeepValue(rawExpanded, fieldPath);
              const mappedValue = response.data.property[mappedField];
              
              console.log(`   ${fieldPath} → ${mappedField}:`);
              console.log(`     - Raw Detail value: ${JSON.stringify(detailValue)}`);
              console.log(`     - Raw Expanded value: ${JSON.stringify(expandedValue)}`);
              console.log(`     - Mapped API value: ${JSON.stringify(mappedValue)}`);
              
              // Check for data loss or transformation
              if ((detailValue !== undefined || expandedValue !== undefined) && mappedValue === undefined) {
                console.log(`     ❌ DATA LOSS: Field exists in raw data but not in mapped API`);
              } else if ((detailValue !== undefined && JSON.stringify(detailValue) !== JSON.stringify(mappedValue)) || 
                         (expandedValue !== undefined && JSON.stringify(expandedValue) !== JSON.stringify(mappedValue))) {
                console.log(`     ⚠️ DATA TRANSFORMED: Raw and mapped values don't match exactly`);
              }
            };
            
            // Check a selection of critical fields
            console.log("[6.2] Critical field transformation analysis:");
            checkRawField('summary.proptype', 'propertyType');
            checkRawField('summary.propertyType', 'propertyType');
            checkRawField('summary.yearBuilt', 'yearBuilt');
            checkRawField('summary.yearbuilt', 'yearBuilt');
            checkRawField('building.size.universalsize', 'squareFeet');
            checkRawField('building.rooms.beds', 'bedrooms');
            checkRawField('building.rooms.bathsFull', 'bathrooms');
            
            // Check if there are other potentially useful fields in raw data that aren't being mapped
            console.log("[6.3] Identifying unmapped fields with useful data:");
            const unmappedFieldCheck = [
              { path: 'building.rooms', propertyNames: Object.keys((response.data._debug.rawDetail || {}).building?.rooms || {}) },
              { path: 'building.size', propertyNames: Object.keys((response.data._debug.rawDetail || {}).building?.size || {}) },
              { path: 'summary', propertyNames: Object.keys((response.data._debug.rawDetail || {}).summary || {}) }
            ];
            
            unmappedFieldCheck.forEach(({path, propertyNames}) => {
              if (propertyNames.length > 0) {
                console.log(`   Found potential data in ${path}: ${propertyNames.join(', ')}`);
              }
            });
          }
          
          // Extract and log each property field to see exactly what's coming from the API
          const apiProp = response.data.property || {};
          console.log("[7] API DATA FIELDS:");
          Object.keys(apiProp).forEach(key => {
            console.log(`   ${key}: ${JSON.stringify(apiProp[key])}`);
          });
          
          // Add debugging to show mapping issues between raw API and mapped API data
          console.log("[7.1] 🔍 DETAILED API FIELD COMPARISON");
          
          if (response.data._debug) {
            const rawDetail = response.data._debug.rawDetail || {};
            const rawExpanded = response.data._debug.rawExpanded || {};
            
            console.log("[7.2] 📊 Raw detail vs. mapped property data:");
            // Compare common fields that might have case differences
            const commonFields = [
              { raw: 'summary.proptype', mapped: 'propertyType' },
              { raw: 'summary.propertyType', mapped: 'propertyType' },
              { raw: 'summary.propType', mapped: 'propertyType' },
              { raw: 'summary.yearBuilt', mapped: 'yearBuilt' },
              { raw: 'summary.yearbuilt', mapped: 'yearBuilt' },
              { raw: 'building.size.universalSize', mapped: 'squareFeet' },
              { raw: 'building.size.universalsize', mapped: 'squareFeet' },
              { raw: 'building.size.livingSize', mapped: 'squareFeet' },
              { raw: 'building.size.livingsize', mapped: 'squareFeet' },
              { raw: 'building.size.bldgSize', mapped: 'squareFeet' },
              { raw: 'building.size.bldgsize', mapped: 'squareFeet' },
              { raw: 'building.rooms.beds', mapped: 'bedrooms' },
              { raw: 'building.rooms.bathsFull', mapped: 'bathrooms' },
              { raw: 'building.rooms.bathstotal', mapped: 'bathrooms' },
              { raw: 'lot.lotsize1', mapped: 'lotSize' },
              { raw: 'lot.lotSize1', mapped: 'lotSize' }
            ];
            
            // Helper to safely get nested property
            const getNestedRawValue = (obj, path) => {
              try {
                return path.split('.').reduce((o, p) => o && o[p] !== undefined ? o[p] : undefined, obj);
              } catch (e) {
                return undefined;
              }
            };
            
            // Compare raw values with mapped values
            commonFields.forEach(({ raw, mapped }) => {
              const rawDetailValue = getNestedRawValue(rawDetail, raw);
              const rawExpandedValue = getNestedRawValue(rawExpanded, raw);
              const mappedValue = apiProp[mapped];
              
              if (rawDetailValue !== undefined) {
                console.log(`   Field '${raw}' in raw detail: ${JSON.stringify(rawDetailValue)}`);
                if (mappedValue !== undefined) {
                  console.log(`   Field '${mapped}' in mapped API: ${JSON.stringify(mappedValue)}`);
                  console.log(`   Match: ${JSON.stringify(rawDetailValue) === JSON.stringify(mappedValue) ? '✅ YES' : '❌ NO'}`);
                } else {
                  console.log(`   ❌ Field '${mapped}' MISSING in mapped API data despite being present in raw data`);
                }
              }
              
              if (rawExpandedValue !== undefined && rawDetailValue === undefined) {
                console.log(`   Field '${raw}' in raw expanded: ${JSON.stringify(rawExpandedValue)}`);
                if (mappedValue !== undefined) {
                  console.log(`   Field '${mapped}' in mapped API: ${JSON.stringify(mappedValue)}`);
                  console.log(`   Match: ${JSON.stringify(rawExpandedValue) === JSON.stringify(mappedValue) ? '✅ YES' : '❌ NO'}`);
                } else {
                  console.log(`   ❌ Field '${mapped}' MISSING in mapped API data despite being present in raw data`);
                }
              }
            });
          }
          
          let propData = response.data.property || {};
          
          // Debug raw API responses
          if (response.data._debug) {
            console.log("Raw detail data:", response.data._debug.rawDetail);
            console.log("Raw expanded data:", response.data._debug.rawExpanded);
          }
          
          console.log("[8] EXPECTED PROPERTY STRUCTURE FOR UI:");
          // Define what we expect from the API for each field
          const expectedFields = {
            attomId: "number - Property ID from ATTOM database",
            address: "string - Property street address",
            city: "string - Property city",
            state: "string - Property state abbreviation",
            zipCode: "string - Property ZIP code",
            latitude: "number - Property latitude coordinate",
            longitude: "number - Property longitude coordinate",
            bedrooms: "number - Number of bedrooms",
            bathrooms: "number - Number of bathrooms",
            squareFeet: "number - Property square footage",
            lotSize: "number - Property lot size",
            lotSizeUnit: "string - Unit for lot size (sqft or acres)",
            propertyType: "string - Type of property (Single Family, etc.)",
            yearBuilt: "number - Year property was built",
            stories: "number - Number of stories",
            garage: "number - Number of garage spaces",
            pool: "boolean - Whether property has a pool",
            fireplaces: "number - Number of fireplaces",
            constructionType: "string - Type of construction",
            roofType: "string - Type of roof",
            ownerName: "string - Name of property owner",
            ownerOccupied: "boolean - Whether owner occupies the property",
            lastSaleDate: "string - Date of last sale (YYYY-MM-DD)",
            lastSalePrice: "number - Price of last sale",
            taxAssessedValue: "number - Tax assessed value",
            taxMarketValue: "number - Tax market value",
            taxYear: "string/number - Year of tax assessment",
            taxAmount: "number - Annual tax amount",
            taxRate: "number - Tax rate percentage",
            estimatedValue: "number - Estimated property value",
            estimatedValueLow: "number - Low end of estimated value range",
            estimatedValueHigh: "number - High end of estimated value range",
            confidenceScore: "number - Confidence score for valuation",
            mortgageAmount: "number - Current mortgage amount",
            mortgageLender: "string - Name of mortgage lender",
            mortgageDate: "string - Date of mortgage (YYYY-MM-DD)",
            mortgageInterestRate: "number - Mortgage interest rate percentage",
            estimatedEquity: "number - Estimated equity in property"
          };
          
          console.log(expectedFields);
          
          // Create a clean copy of the API data before applying defaults
          const apiDataOnly = {...propData};
          
          // FIXED: Use a cleaner approach to apply defaults, logging each substitution
          const defaultValues = {
            attomId: propertyId,
            address: '123 Main St',
            city: 'Sample City',
            state: 'CA',
            zipCode: '90210',
            latitude: 34.0522,
            longitude: -118.2437,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            lotSize: 5000,
            lotSizeUnit: 'sqft',
            propertyType: 'Single Family Residential',
            yearBuilt: 1985,
            stories: 1,
            garage: 2,
            pool: false,
            fireplaces: 0,
            constructionType: 'Frame',
            roofType: 'Composition Shingle',
            ownerName: 'Private Owner',
            ownerOccupied: false,
            lastSaleDate: '2020-03-15',
            lastSalePrice: 450000,
            taxAssessedValue: 400000,
            taxMarketValue: 450000,
            taxYear: '2023',
            taxAmount: 5000,
            taxRate: 1.25,
            estimatedValue: 500000,
            estimatedValueLow: 450000,
            estimatedValueHigh: 550000,
            confidenceScore: 85,
            mortgageAmount: 300000,
            mortgageLender: 'Sample Bank',
            mortgageDate: '2020-03-15',
            mortgageInterestRate: 4.25,
            estimatedEquity: 200000,
          };
          
          // Apply defaults where needed, but preserve API data with enhanced debugging
          const finalData = {};
          Object.keys(defaultValues).forEach(key => {
            // Check if we have API data for this field
            if (propData[key] === undefined || propData[key] === null) {
              // If not, use the default and log the substitution with detailed diagnostics
              finalData[key] = defaultValues[key];
              
              // Log detailed debugging info about the missing field
              console.log(`[⚠️ MISSING FIELD] ${key}: ${JSON.stringify(finalData[key])} (API had: ${JSON.stringify(propData[key])})`);
              
              // Attempt to find the field in raw API data to see if it's a mapping issue
              if (response.data._debug) {
                // Look in different structures with different case patterns
                const possiblePaths = [
                  key,                       // exact match
                  key.toLowerCase(),         // lowercase
                  key.toUpperCase(),         // uppercase
                  key.charAt(0).toUpperCase() + key.slice(1) // camelCase
                ];
                
                // Check raw detail data
                const rawDetail = response.data._debug.rawDetail || {};
                possiblePaths.forEach(path => {
                  if (rawDetail[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW DETAIL] Field '${key}' exists as '${path}' with value:`, rawDetail[path]);
                  }
                  
                  // Check common nested paths
                  if (rawDetail.summary && rawDetail.summary[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW DETAIL] Field '${key}' exists as 'summary.${path}' with value:`, rawDetail.summary[path]);
                  }
                  
                  if (rawDetail.building && rawDetail.building[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW DETAIL] Field '${key}' exists as 'building.${path}' with value:`, rawDetail.building[path]);
                  }
                  
                  if (rawDetail.building && rawDetail.building.size && rawDetail.building.size[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW DETAIL] Field '${key}' exists as 'building.size.${path}' with value:`, rawDetail.building.size[path]);
                  }
                });
                
                // Check raw expanded data
                const rawExpanded = response.data._debug.rawExpanded || {};
                possiblePaths.forEach(path => {
                  if (rawExpanded[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW EXPANDED] Field '${key}' exists as '${path}' with value:`, rawExpanded[path]);
                  }
                  
                  // Check common nested paths
                  if (rawExpanded.summary && rawExpanded.summary[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW EXPANDED] Field '${key}' exists as 'summary.${path}' with value:`, rawExpanded.summary[path]);
                  }
                  
                  if (rawExpanded.building && rawExpanded.building[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW EXPANDED] Field '${key}' exists as 'building.${path}' with value:`, rawExpanded.building[path]);
                  }
                  
                  if (rawExpanded.building && rawExpanded.building.size && rawExpanded.building.size[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW EXPANDED] Field '${key}' exists as 'building.size.${path}' with value:`, rawExpanded.building.size[path]);
                  }
                  
                  if (rawExpanded.assessment && rawExpanded.assessment[path] !== undefined) {
                    console.log(`[🔍 FOUND IN RAW EXPANDED] Field '${key}' exists as 'assessment.${path}' with value:`, rawExpanded.assessment[path]);
                  }
                });
              }
            } else {
              // Otherwise use the API data
              finalData[key] = propData[key];
              console.log(`[✅ API DATA] ${key}: ${JSON.stringify(finalData[key])}`);
            }
          });
          
          // Also include any extra fields from API that we didn't expect
          Object.keys(propData).forEach(key => {
            if (!finalData.hasOwnProperty(key)) {
              finalData[key] = propData[key];
              console.log(`[EXTRA API] ${key}: ${JSON.stringify(finalData[key])}`);
            }
          });
          
          // Set our processed data
          propData = finalData;
          
          console.log("[9] FINAL DATA TO BE DISPLAYED IN UI:", propData);
          
          // Log a side-by-side comparison of API data vs final data
          console.log("[10] API VS FINAL DATA COMPARISON:");
          const allKeys = new Set([...Object.keys(apiDataOnly), ...Object.keys(propData)]);
          
          console.table(
            Array.from(allKeys).map(key => ({
              field: key,
              'API Value': apiDataOnly[key],
              'Final Value': propData[key],
              'Source': apiDataOnly[key] !== undefined ? 'API' : 'Default',
              'Changed': JSON.stringify(apiDataOnly[key]) !== JSON.stringify(propData[key]) ? 'YES' : 'NO'
            }))
          );
          
          setProperty(propData);
        } else {
          console.error('❌ API response issue:', response.data);
          setError('Unable to load property details. API response: ' + JSON.stringify(response.data));
        }
        
        // Fetch sales history
        const salesResponse = await axios.get(`/api/attom/property/${propertyId}/saleshistory`);
        if (salesResponse.data && salesResponse.data.status === 'success') {
          setSalesHistory(salesResponse.data.salesHistory || []);
        } else {
          // Add demo sales history if none available
          setSalesHistory([
            {
              saleDate: "2020-03-15",
              saleAmount: 450000,
              deed: { type: "WARRANTY DEED", date: "2020-03-15" },
              buyer: "Current Owner",
              seller: "Previous Owner"
            },
            {
              saleDate: "2010-05-22",
              saleAmount: 325000,
              deed: { type: "WARRANTY DEED", date: "2010-05-22" },
              buyer: "Previous Owner",
              seller: "Original Owner"
            }
          ]);
        }
        
        // Fetch tax history
        const taxResponse = await axios.get(`/api/attom/property/${propertyId}/taxhistory`);
        if (taxResponse.data && taxResponse.data.status === 'success') {
          setTaxHistory(taxResponse.data.taxHistory || []);
        } else {
          // Add demo tax history if none available
          setTaxHistory([
            {
              year: "2024",
              taxAmount: 5200,
              assessedValue: 425000,
              marketValue: 500000,
              improvementValue: 375000,
              landValue: 125000
            },
            {
              year: "2023",
              taxAmount: 5100,
              assessedValue: 415000,
              marketValue: 490000,
              improvementValue: 365000,
              landValue: 125000
            }
          ]);
        }
      } catch (err) {
        console.error('Error fetching property data:', err);
        setError('An error occurred while fetching property data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchPropertyData();
    }
  }, [propertyId]);

  // Create debug data panel that will always be visible
  const DebugPanel = () => (
    <Paper elevation={3} sx={{ p: 2, m: 2, maxHeight: '300px', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <Typography variant="h6" gutterBottom>Debug Information Panel</Typography>
      <Typography variant="subtitle2">Component State:</Typography>
      <pre style={{ fontSize: '12px' }}>
        {`Property ID: ${propertyId || 'not set'}
Loading: ${loading}
Error: ${error || 'none'}
Has Property Data: ${property ? 'yes' : 'no'}
Property Type: ${property?.propertyType || 'N/A'}
Year Built: ${property?.yearBuilt || 'N/A'}
Bedrooms: ${property?.bedrooms || 'N/A'}
Bathrooms: ${property?.bathrooms || 'N/A'}
Square Feet: ${property?.squareFeet || 'N/A'}`}
      </pre>
    </Paper>
  );

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress size={60} />
        <Typography variant="h6" style={{ marginLeft: 16 }}>
          Loading comprehensive property data...
        </Typography>
        <DebugPanel />
      </Box>
    );
  }

  if (error || !property) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={3}>
        <Typography variant="h6" color="error" gutterBottom>
          {error || 'Property data not found'}
        </Typography>
        <Button variant="contained" color="primary" onClick={onBack}>
          Go Back
        </Button>
        <DebugPanel />
      </Box>
    );
  }

  // Calculate additional metrics
  const yearsSinceLastSale = property.lastSaleDate
    ? Math.floor((new Date() - new Date(property.lastSaleDate)) / (365 * 24 * 60 * 60 * 1000))
    : null;
    
  const appreciationRate = property.lastSalePrice && property.estimatedValue && yearsSinceLastSale
    ? ((property.estimatedValue / property.lastSalePrice) ** (1 / yearsSinceLastSale) - 1) * 100
    : null;
    
  const equityPercentage = property.estimatedValue && property.mortgageAmount
    ? ((property.estimatedValue - property.mortgageAmount) / property.estimatedValue) * 100
    : null;
    
  const potentialARV = property.estimatedValue * 1.3; // After Repair Value estimate

  // Property Header Information
  const PropertyHeader = () => (
    <Paper elevation={cardElevation} sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Typography variant="h4" gutterBottom>
            {getNestedValue(property, 'address', 'Address Not Available')}
          </Typography>
          <Typography variant="h6" color="textSecondary">
            {`${getNestedValue(property, 'city')}, ${getNestedValue(property, 'state')} ${getNestedValue(property, 'zipCode')}`}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box display="flex" flexDirection="column" alignItems="flex-end">
            <Typography variant="h5" color="primary">
              {formatCurrency(getNestedValue(property, 'estimatedValue', 0))}
            </Typography>
            <Box display="flex" alignItems="center">
              <Typography variant="body2" color="textSecondary" mr={1}>
                Estimated Value
              </Typography>
              {appreciationRate && (
                <Chip 
                  size="small" 
                  icon={appreciationRate > 0 ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                  label={`${appreciationRate.toFixed(1)}% /yr`} 
                  color={appreciationRate > 0 ? "success" : "error"}
                />
              )}
            </Box>
            
            <Typography variant="body1" mt={1}>
              {formatCurrency(getNestedValue(property, 'lastSalePrice', 0))} 
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Last sale ({yearsSinceLastSale || 'N/A'} years ago)
              </span>
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
            <Chip label={`${getNestedValue(property, 'bedrooms', 0)} bed`} size="small" icon={<Home fontSize="small" />} />
            <Chip label={`${getNestedValue(property, 'bathrooms', 0)} bath`} size="small" />
            <Chip label={`${formatNumber(getNestedValue(property, 'squareFeet', 0))} sq ft`} size="small" />
            <Chip label={`Built ${getNestedValue(property, 'yearBuilt', 'N/A')}`} size="small" />
            <Chip label={getNestedValue(property, 'propertyType', 'Residential')} size="small" />
            {getNestedValue(property, 'pool', false) && <Chip label="Pool" size="small" />}
            {getNestedValue(property, 'garage', 0) > 0 && <Chip label={`${getNestedValue(property, 'garage')} car garage`} size="small" />}
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Box display="flex" gap={1}>
              <Button 
                variant="outlined" 
                startIcon={<Print />}
                onClick={() => window.print()}
              >
                Print
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<Share />}
              >
                Share
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<Bookmarks />}
              >
                Save
              </Button>
            </Box>
            
            <Box>
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<LocalOffer />}
                onClick={() => {/* Functionality to make offer */}}
              >
                Make Offer
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );

  // Tab panel component
  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ paddingTop: 24 }}>
      {value === index && children}
    </div>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={onBack}>
          Back to Results
        </Button>
        
        {/* Add a visible debugging button */}
        <Button 
          variant="contained" 
          color="error"
          onClick={() => {
            // This will create a visible popup with the current data
            alert(`DEBUGGING DATA:\n\nProperty ID: ${propertyId}\n\nKey data fields:\nProperty Type: ${property?.propertyType}\nYear Built: ${property?.yearBuilt}\nBedrooms: ${property?.bedrooms}\nBathrooms: ${property?.bathrooms}\nSquare Feet: ${property?.squareFeet}\n\nSee full data in console.`);
            // Also log to console in case it's working
            console.log('PROPERTY DEBUG DATA:', property);
          }}
        >
          Debug Data
        </Button>
      </Box>
      
      <PropertyHeader />
      
      {/* Property Mode Toggle */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Tabs 
          value={viewMode} 
          onChange={(e, value) => setViewMode(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab 
            value="investor" 
            label="Investor View" 
            icon={<AttachMoney />} 
            iconPosition="start"
          />
          <Tab 
            value="agent" 
            label="Agent View" 
            icon={<Person />}
            iconPosition="start"
          />
          <Tab 
            value="standard" 
            label="Standard View" 
            icon={<Visibility />}
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="property tabs">
          <Tab icon={<Info />} label="Overview" />
          <Tab icon={<AttachMoney />} label="Financial" />
          <Tab icon={<Timeline />} label="History" />
          <Tab icon={<Assessment />} label="Tax & Value" />
          <Tab icon={<Map />} label="Map & Area" />
          <Tab icon={<ShowChart />} label="Analysis" />
        </Tabs>
      </Box>
      
      {/* Overview Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            {/* Property Images/Maps */}
            <Card elevation={cardElevation}>
              <CardHeader title="Property Location" />
              <CardContent>
                <Box sx={{ height: '350px', width: '100%' }}>
                  <PropertyMap 
                    latitude={property.latitude} 
                    longitude={property.longitude}
                    address={property.address}
                  />
                </Box>
              </CardContent>
            </Card>
            
            {/* Property Details */}
            <Card elevation={cardElevation} sx={{ mt: 3 }}>
              <CardHeader title="Property Details" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Property Type</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'propertyType', 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Year Built</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'yearBuilt', 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Square Feet</Typography>
                    <Typography variant="body1">{formatNumber(getNestedValue(property, 'squareFeet', null), 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Lot Size</Typography>
                    <Typography variant="body1">
                      {getNestedValue(property, 'lotSize', null) 
                        ? `${formatNumber(getNestedValue(property, 'lotSize'))} ${getNestedValue(property, 'lotSizeUnit', 'sq ft')}` 
                        : 'Not available'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Bedrooms</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'bedrooms', 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Bathrooms</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'bathrooms', 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Stories</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'stories', 'Not available')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Garage</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'garage', 'None')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Pool</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'pool', false) ? 'Yes' : 'No'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Fireplaces</Typography>
                    <Typography variant="body1">{getNestedValue(property, 'fireplaces', 'None')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Construction</Typography>
                    <Typography variant="body1">{property.constructionType || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Roof Type</Typography>
                    <Typography variant="body1">{property.roofType || 'Not available'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={5}>
            {/* Value Estimates */}
            <Card elevation={cardElevation}>
              <CardHeader title="Value Estimates" />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Estimated Market Value" 
                      secondary={formatCurrency(property.estimatedValue)}
                      secondaryTypographyProps={{ variant: 'h6', color: 'primary' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Last Sale Price" 
                      secondary={
                        <>
                          {formatCurrency(property.lastSalePrice)}
                          {property.lastSaleDate && (
                            <span style={{ display: 'block', fontSize: '0.9rem' }}>
                              {formatDate(property.lastSaleDate)}
                            </span>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Assessed Value (Tax)" 
                      secondary={formatCurrency(property.taxAssessedValue)}
                    />
                  </ListItem>
                  
                  {viewMode === 'investor' && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Potential After Repair Value (ARV)" 
                          secondary={formatCurrency(potentialARV)}
                          secondaryTypographyProps={{ color: 'success.main' }}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Est. Equity Available" 
                          secondary={
                            <>
                              {formatCurrency(property.estimatedEquity)}
                              {equityPercentage && (
                                <Chip 
                                  size="small" 
                                  label={`${equityPercentage.toFixed(1)}%`}
                                  color={equityPercentage > 30 ? 'success' : 'warning'}
                                  style={{ marginLeft: 8 }}
                                />
                              )}
                            </>
                          }
                        />
                      </ListItem>
                    </>
                  )}
                </List>
                
                {/* Value Range Chart */}
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>Value Range</Typography>
                  <PropertyValuationChart 
                    low={property.estimatedValueLow} 
                    value={property.estimatedValue}
                    high={property.estimatedValueHigh}
                    lastSalePrice={property.lastSalePrice}
                    lastSaleDate={property.lastSaleDate}
                    confidenceScore={property.confidenceScore}
                  />
                </Box>
              </CardContent>
            </Card>
            
            {/* Owner Information */}
            <Card elevation={cardElevation} sx={{ mt: 3 }}>
              <CardHeader 
                title="Owner Information" 
                action={
                  <Button size="small" onClick={toggleOwnerInfo}>
                    {showFullOwnerInfo ? 'Less' : 'More'}
                  </Button>
                }
              />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Owner Name" 
                      secondary={property.ownerName || 'Not available'}
                    />
                  </ListItem>
                  {showFullOwnerInfo && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Owner Type" 
                          secondary={property.ownerType || 'Individual'}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Owner Occupied" 
                          secondary={property.ownerOccupied ? 'Yes' : 'No'}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText 
                          primary="Mailing Address" 
                          secondary={
                            property.ownerMailingAddress ? (
                              <>
                                <Typography variant="body2">
                                  {property.ownerMailingAddress}
                                </Typography>
                                <Typography variant="body2">
                                  {`${property.ownerMailingCity || ''}, ${property.ownerMailingState || ''} ${property.ownerMailingZip || ''}`}
                                </Typography>
                              </>
                            ) : 'Same as property address'
                          }
                        />
                      </ListItem>
                    </>
                  )}
                </List>
              </CardContent>
            </Card>
            
            {viewMode === 'investor' && (
              <Card elevation={cardElevation} sx={{ mt: 3 }}>
                <CardHeader title="Investment Snapshot" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Potential Profit (70% Rule)</Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(property.estimatedValue * 0.7 - property.lastSalePrice)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Years Owned</Typography>
                      <Typography variant="body1">
                        {yearsSinceLastSale ? `${yearsSinceLastSale} years` : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Annual Appreciation</Typography>
                      <Typography variant="body1">
                        {appreciationRate ? `${appreciationRate.toFixed(1)}%` : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Max Offer (70% ARV)</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(potentialARV * 0.7)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Financial Tab */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Mortgage Information" />
              <CardContent>
                {property.mortgageAmount ? (
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary="Current Mortgage Balance (Est)" 
                        secondary={formatCurrency(property.mortgageAmount)}
                        secondaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText 
                        primary="Lender" 
                        secondary={property.mortgageLender || 'Not available'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText 
                        primary="Mortgage Origination Date" 
                        secondary={property.mortgageDate ? formatDate(property.mortgageDate) : 'Not available'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText 
                        primary="Mortgage Maturity Date" 
                        secondary={property.mortgageMaturityDate ? formatDate(property.mortgageMaturityDate) : 'Not available'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText 
                        primary="Interest Rate" 
                        secondary={property.mortgageInterestRate ? `${property.mortgageInterestRate}%` : 'Not available'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText 
                        primary="Estimated Monthly Payment" 
                        secondary={
                          property.mortgageAmount && property.mortgageInterestRate 
                            ? formatCurrency(calculateMortgage(property.mortgageAmount, property.mortgageInterestRate, 30))
                            : 'Not available'
                        }
                      />
                    </ListItem>
                  </List>
                ) : (
                  <Typography variant="body1" color="textSecondary">
                    No mortgage information available for this property.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Equity Position" />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Estimated Market Value" 
                      secondary={formatCurrency(property.estimatedValue)}
                      secondaryTypographyProps={{ variant: 'h6', color: 'primary' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Mortgage Balance (Est)" 
                      secondary={property.mortgageAmount ? formatCurrency(property.mortgageAmount) : 'N/A'}
                      secondaryTypographyProps={{ variant: 'h6', color: 'error' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Estimated Equity" 
                      secondary={formatCurrency(property.estimatedEquity)}
                      secondaryTypographyProps={{ variant: 'h6', color: 'success.main' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Equity Percentage" 
                      secondary={equityPercentage ? `${equityPercentage.toFixed(1)}%` : 'N/A'}
                      secondaryTypographyProps={{ 
                        variant: 'h6', 
                        color: equityPercentage > 50 ? 'success.main' : 'warning.main'
                      }}
                    />
                  </ListItem>
                </List>
                
                {/* Equity Position Chart */}
                <Box mt={2} height={200}>
                  {property.estimatedValue && (
                    <div className="equity-chart">
                      {/* Placeholder for equity chart */}
                    </div>
                  )}
                </Box>
              </CardContent>
            </Card>
            
            {viewMode === 'investor' && (
              <Card elevation={cardElevation} sx={{ mt: 3 }}>
                <CardHeader title="Investor Quick Analysis" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Max Purchase Price (70% Rule)</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(potentialARV * 0.7)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Est. Rehab Budget</Typography>
                      <Typography variant="body1">
                        {formatCurrency(potentialARV * 0.1)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">ARV</Typography>
                      <Typography variant="body1">
                        {formatCurrency(potentialARV)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Potential Profit</Typography>
                      <Typography variant="body1" color="success.main">
                        {formatCurrency(potentialARV * 0.2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Grid>
          
          {viewMode === 'investor' && (
            <Grid item xs={12}>
              <PropertySalePotentialCalculator 
                currentValue={property.estimatedValue}
                lastSalePrice={property.lastSalePrice}
                lastSaleDate={property.lastSaleDate}
                yearBuilt={property.yearBuilt}
                squareFeet={property.squareFeet}
                bedrooms={property.bedrooms}
                bathrooms={property.bathrooms}
              />
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      {/* History Tab */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <PropertyHistoryTimeline 
              salesHistory={salesHistory} 
              taxHistory={taxHistory} 
              property={property}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Card elevation={cardElevation}>
              <CardHeader title="Sales History" />
              <CardContent>
                {salesHistory && salesHistory.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Price</TableCell>
                          <TableCell>Price/SqFt</TableCell>
                          <TableCell>Buyer</TableCell>
                          <TableCell>Seller</TableCell>
                          <TableCell>Deed Type</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {salesHistory.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell>{formatDate(record.saleDate)}</TableCell>
                            <TableCell>{formatCurrency(record.saleAmount)}</TableCell>
                            <TableCell>
                              {record.saleAmount && property.squareFeet 
                                ? `${formatCurrency(record.saleAmount / property.squareFeet)}/sqft`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>{record.buyer || 'N/A'}</TableCell>
                            <TableCell>{record.seller || 'N/A'}</TableCell>
                            <TableCell>{record.deed?.type || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body1" color="textSecondary">
                    No sales history available for this property.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card elevation={cardElevation}>
              <CardHeader title="Tax Assessment History" />
              <CardContent>
                {taxHistory && taxHistory.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Year</TableCell>
                          <TableCell>Assessed Value</TableCell>
                          <TableCell>Market Value</TableCell>
                          <TableCell>Land Value</TableCell>
                          <TableCell>Improvement Value</TableCell>
                          <TableCell>Tax Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {taxHistory.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell>{record.year}</TableCell>
                            <TableCell>{formatCurrency(record.assessedValue)}</TableCell>
                            <TableCell>{formatCurrency(record.marketValue)}</TableCell>
                            <TableCell>{formatCurrency(record.landValue)}</TableCell>
                            <TableCell>{formatCurrency(record.improvementValue)}</TableCell>
                            <TableCell>{formatCurrency(record.taxAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body1" color="textSecondary">
                    No tax history available for this property.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Tax & Value Tab */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Tax Information" />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Tax Assessed Value" 
                      secondary={formatCurrency(property.taxAssessedValue)}
                      secondaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Tax Market Value" 
                      secondary={formatCurrency(property.taxMarketValue)}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Annual Tax Amount" 
                      secondary={formatCurrency(property.taxAmount)}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Tax Year" 
                      secondary={property.taxYear || 'Not available'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Tax Rate" 
                      secondary={property.taxRate ? `${property.taxRate}%` : 'Not available'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Monthly Tax Payment (Est)" 
                      secondary={property.taxAmount ? formatCurrency(property.taxAmount / 12) : 'Not available'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Value Trends" />
              <CardContent>
                <Typography variant="body2" paragraph>
                  Valuation data shows how this property's value has changed over time.
                </Typography>
                
                {/* Placeholder for value trend chart */}
                <Box sx={{ height: '250px', bgcolor: 'background.default', p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    Value trend chart would appear here
                  </Typography>
                </Box>
                
                <Typography variant="body2" mt={2}>
                  {appreciationRate 
                    ? `This property has ${appreciationRate > 0 ? 'appreciated' : 'depreciated'} 
                       at an average rate of ${Math.abs(appreciationRate).toFixed(1)}% per year since its last sale.`
                    : 'Appreciation rate cannot be calculated due to missing data.'}
                </Typography>
              </CardContent>
            </Card>
            
            <Card elevation={cardElevation} sx={{ mt: 3 }}>
              <CardHeader title="Valuation Details" />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Valuation Range" 
                      secondary={
                        property.estimatedValueLow && property.estimatedValueHigh 
                          ? `${formatCurrency(property.estimatedValueLow)} - ${formatCurrency(property.estimatedValueHigh)}`
                          : 'Not available'
                      }
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Confidence Score" 
                      secondary={property.confidenceScore ? `${property.confidenceScore}/100` : 'Not available'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Value per Square Foot" 
                      secondary={
                        property.estimatedValue && property.squareFeet
                          ? `${formatCurrency(property.estimatedValue / property.squareFeet)}/sqft`
                          : 'Not available'
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Map & Area Tab */}
      <TabPanel value={activeTab} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={cardElevation}>
              <CardHeader title="Property Location" />
              <CardContent>
                <Box sx={{ height: '500px', width: '100%' }}>
                  <PropertyMap 
                    latitude={property.latitude} 
                    longitude={property.longitude}
                    address={property.address}
                    showSatellite={true}
                    showControls={true}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Neighborhood Information" />
              <CardContent>
                <Typography variant="body2" paragraph>
                  Neighborhood data would be displayed here (schools, demographics, etc.)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={cardElevation}>
              <CardHeader title="Market Trends" />
              <CardContent>
                <Typography variant="body2" paragraph>
                  Local market trend data would be displayed here
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Analysis Tab */}
      <TabPanel value={activeTab} index={5}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <PropertyComparables 
              propertyId={propertyId}
              propertyType={property.propertyType}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              squareFeet={property.squareFeet}
              zipCode={property.zipCode}
              latitude={property.latitude}
              longitude={property.longitude}
            />
          </Grid>
          
          {viewMode === 'investor' && (
            <Grid item xs={12}>
              <Card elevation={cardElevation}>
                <CardHeader title="Investment Analysis" />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>Fix & Flip Potential</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>After Repair Value (ARV)</TableCell>
                              <TableCell align="right">{formatCurrency(potentialARV)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Max Purchase Price (70% Rule)</TableCell>
                              <TableCell align="right">{formatCurrency(potentialARV * 0.7)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Current Market Value</TableCell>
                              <TableCell align="right">{formatCurrency(property.estimatedValue)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Estimated Rehab Costs</TableCell>
                              <TableCell align="right">{formatCurrency(potentialARV * 0.1)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Estimated Profit</TableCell>
                              <TableCell align="right">
                                <Typography color="success.main" fontWeight="bold">
                                  {formatCurrency(potentialARV - (potentialARV * 0.7) - (potentialARV * 0.1))}
                                </Typography>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>ROI</TableCell>
                              <TableCell align="right">
                                {((potentialARV - (potentialARV * 0.7) - (potentialARV * 0.1)) / (potentialARV * 0.7) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>Buy & Hold Analysis</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Estimated Monthly Rent</TableCell>
                              <TableCell align="right">
                                {formatCurrency(property.estimatedValue * 0.008)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Annual Rental Income</TableCell>
                              <TableCell align="right">
                                {formatCurrency(property.estimatedValue * 0.008 * 12)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Estimated Operating Expenses (40%)</TableCell>
                              <TableCell align="right">
                                {formatCurrency(property.estimatedValue * 0.008 * 12 * 0.4)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Net Operating Income</TableCell>
                              <TableCell align="right">
                                {formatCurrency(property.estimatedValue * 0.008 * 12 * 0.6)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Cap Rate</TableCell>
                              <TableCell align="right">
                                {((property.estimatedValue * 0.008 * 12 * 0.6) / property.estimatedValue * 100).toFixed(2)}%
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Cash on Cash Return (25% down)</TableCell>
                              <TableCell align="right">
                                {((property.estimatedValue * 0.008 * 12 * 0.6 - calculateMortgage(property.estimatedValue * 0.75, 4.5, 30) * 12) / (property.estimatedValue * 0.25) * 100).toFixed(2)}%
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {/* Data Inspector - Always visible for debugging */}
          <Grid item xs={12}>
            <Card elevation={cardElevation}>
              <CardHeader 
                title="Data Inspector" 
                action={
                  <Button 
                    variant="contained" 
                    color="secondary"
                  >
                    Debug Data
                  </Button>
                }
              />
              <CardContent>
                <Typography variant="subtitle2">API Field Values:</Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Value from API</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Used in UI</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(property || {}).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell><strong>{key}</strong></TableCell>
                          <TableCell>
                            {typeof value === 'object' 
                              ? JSON.stringify(value) 
                              : value?.toString()}
                          </TableCell>
                          <TableCell>{typeof value}</TableCell>
                          <TableCell>{value !== 'N/A' ? '✓' : '✗'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <Box mt={2}>
                  <Typography variant="subtitle2">Raw Property Object:</Typography>
                  <Paper
                    sx={{
                      p: 2,
                      maxHeight: '300px',
                      overflow: 'auto',
                      bgcolor: '#f5f5f5',
                    }}
                  >
                    <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(property, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Always visible debugging panel at the bottom */}
      <Box mt={5} p={3} border="2px solid red" bgcolor="#ffeeee">
        <Typography variant="h5" color="error" gutterBottom>
          DEBUG DATA PANEL
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold">Key Property Fields:</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Default Value?</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Property Type</TableCell>
                    <TableCell>{property?.propertyType || 'N/A'}</TableCell>
                    <TableCell>{property?.propertyType === 'Single Family Residential' ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Year Built</TableCell>
                    <TableCell>{property?.yearBuilt || 'N/A'}</TableCell>
                    <TableCell>{property?.yearBuilt === 1985 ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bedrooms</TableCell>
                    <TableCell>{property?.bedrooms || 'N/A'}</TableCell>
                    <TableCell>{property?.bedrooms === 3 ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bathrooms</TableCell>
                    <TableCell>{property?.bathrooms || 'N/A'}</TableCell>
                    <TableCell>{property?.bathrooms === 2 ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Square Feet</TableCell>
                    <TableCell>{property?.squareFeet || 'N/A'}</TableCell>
                    <TableCell>{property?.squareFeet === 1500 ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold">Component State:</Typography>
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                {`propertyId: ${propertyId}
loading: ${loading}
error: ${error || 'null'}
Tab: ${activeTab}
View Mode: ${viewMode}
Has Sales History: ${salesHistory?.length > 0 ? 'Yes' : 'No'}
Has Tax History: ${taxHistory?.length > 0 ? 'Yes' : 'No'}`}
              </pre>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default PropertyDetailEnhanced;
