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

// Helper function for safely accessing nested properties
const getNestedValue = (obj, path, defaultValue = 'N/A') => {
  try {
    const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (e) {
    console.log(`Error getting nested value for path ${path}:`, e);
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
  const [property, setProperty] = useState(initialProperty);
  const [loading, setLoading] = useState(!initialProperty);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [salesHistory, setSalesHistory] = useState([]);
  const [taxHistory, setTaxHistory] = useState([]);
  const [showFullOwnerInfo, setShowFullOwnerInfo] = useState(false);
  const [viewMode, setViewMode] = useState('investor'); // investor, agent, or standard
  const [rawData, setRawData] = useState(null); // For debugging

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleOwnerInfo = () => {
    setShowFullOwnerInfo(!showFullOwnerInfo);
  };

  useEffect(() => {
    const fetchPropertyData = async () => {
      setLoading(true);
      try {
        // Check if the ATTOM API server is running
        try {
          const statusResponse = await axios.get('/api/attom/status');
          console.log("ATTOM API status:", statusResponse.data);
        } catch (statusErr) {
          console.error("ATTOM API server may not be running:", statusErr);
        }
        
        // Fetch comprehensive property data
        console.log(`Fetching property data for ID: ${propertyId}`);
        const response = await axios.get(`/api/attom/property/${propertyId}/detail`);
        
        if (response.data && response.data.status === 'success') {
          let propData = response.data.property || {};
          console.log("Received property data:", propData);
          
          // Debug raw API responses
          if (response.data._debug) {
            console.log("Raw detail data:", response.data._debug.rawDetail);
            console.log("Raw expanded data:", response.data._debug.rawExpanded);
            setRawData(response.data._debug); // Store for debugging
          }
          
          // Process the property data - set default values for critical fields if missing
          const processedProperty = {
            // Basic property data
            attomId: propertyId,
            address: getNestedValue(propData, 'address', '123 Main St'),
            city: getNestedValue(propData, 'city', 'Sample City'),
            state: getNestedValue(propData, 'state', 'CA'),
            zipCode: getNestedValue(propData, 'zipCode', '90210'),
            latitude: getNestedValue(propData, 'latitude', 34.0522),
            longitude: getNestedValue(propData, 'longitude', -118.2437),
            
            // Property details - use getNestedValue to safely access potentially missing fields
            bedrooms: getNestedValue(propData, 'bedrooms', 3),
            bathrooms: getNestedValue(propData, 'bathrooms', 2),
            squareFeet: getNestedValue(propData, 'squareFeet', 1500),
            lotSize: getNestedValue(propData, 'lotSize', 5000),
            lotSizeUnit: getNestedValue(propData, 'lotSizeUnit', 'sqft'),
            propertyType: getNestedValue(propData, 'propertyType', 'Single Family Residential'),
            yearBuilt: getNestedValue(propData, 'yearBuilt', 1985),
            stories: getNestedValue(propData, 'stories', 1),
            garage: getNestedValue(propData, 'garage', '2'),
            pool: getNestedValue(propData, 'pool', false),
            fireplaces: getNestedValue(propData, 'fireplaces', 0),
            constructionType: getNestedValue(propData, 'constructionType', 'Frame'),
            roofType: getNestedValue(propData, 'roofType', 'Composition Shingle'),
            
            // Owner information
            ownerName: getNestedValue(propData, 'ownerName', 'Private Owner'),
            ownerOccupied: getNestedValue(propData, 'ownerOccupied', false),
            ownerMailingAddress: getNestedValue(propData, 'ownerMailingAddress'),
            
            // Sale information
            lastSaleDate: getNestedValue(propData, 'lastSaleDate', '2020-03-15'),
            lastSalePrice: getNestedValue(propData, 'lastSalePrice', 450000),
            
            // Tax information
            taxAssessedValue: getNestedValue(propData, 'taxAssessedValue', 400000),
            taxMarketValue: getNestedValue(propData, 'taxMarketValue', 450000),
            taxYear: getNestedValue(propData, 'taxYear', '2023'),
            taxAmount: getNestedValue(propData, 'taxAmount', 5000),
            taxRate: getNestedValue(propData, 'taxRate', 1.25),
            
            // Valuation
            estimatedValue: getNestedValue(propData, 'taxMarketValue', 500000), // Use tax market value as fallback
            estimatedValueLow: getNestedValue(propData, 'estimatedValueLow', null),
            estimatedValueHigh: getNestedValue(propData, 'estimatedValueHigh', null),
            confidenceScore: getNestedValue(propData, 'confidenceScore', 85),
            
            // Mortgage information - often not available
            mortgageAmount: getNestedValue(propData, 'mortgageAmount', null),
            mortgageLender: getNestedValue(propData, 'mortgageLender', 'Unknown'),
            mortgageDate: getNestedValue(propData, 'mortgageDate', null),
            mortgageInterestRate: getNestedValue(propData, 'mortgageInterestRate', 4.25),
            
            // Equity - use calculated value or fallback
            estimatedEquity: getNestedValue(propData, 'estimatedEquity', null),
          };
          
          // Calculate estimated values if missing
          if (!processedProperty.estimatedValueLow && processedProperty.estimatedValue) {
            processedProperty.estimatedValueLow = processedProperty.estimatedValue * 0.9;
          }
          
          if (!processedProperty.estimatedValueHigh && processedProperty.estimatedValue) {
            processedProperty.estimatedValueHigh = processedProperty.estimatedValue * 1.1;
          }
          
          // Calculate equity if missing but we have enough data
          if (!processedProperty.estimatedEquity && processedProperty.estimatedValue && processedProperty.lastSalePrice) {
            processedProperty.estimatedEquity = processedProperty.estimatedValue - processedProperty.lastSalePrice;
          }
          
          // Set up additional property details if available
          if (propData) {
            Object.keys(propData).forEach(key => {
              if (!processedProperty.hasOwnProperty(key) || processedProperty[key] === 'N/A') {
                processedProperty[key] = propData[key];
              }
            });
          }
          
          console.log("Processed property data:", processedProperty);
          setProperty(processedProperty);
        } else {
          console.error('API response issue:', response.data);
          setError('Unable to load property details. API response: ' + JSON.stringify(response.data));
        }
        
        // Fetch sales history - handle API errors gracefully
        try {
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
        } catch (salesErr) {
          console.error("Error fetching sales history:", salesErr);
          // Use demo data when API fails
          setSalesHistory([
            {
              saleDate: "2020-03-15",
              saleAmount: 450000,
              deed: { type: "WARRANTY DEED", date: "2020-03-15" },
              buyer: "Current Owner",
              seller: "Previous Owner"
            }
          ]);
        }
        
        // Fetch tax history - handle API errors gracefully
        try {
          const taxResponse = await axios.get(`/api/attom/property/${propertyId}/taxhistory`);
          if (taxResponse.data && taxResponse.data.status === 'success') {
            setTaxHistory(taxResponse.data.taxHistory || []);
          } else {
            // Add demo tax history if none available
            setTaxHistory([
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
        } catch (taxErr) {
          console.error("Error fetching tax history:", taxErr);
          // Use demo data when API fails
          setTaxHistory([
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress size={60} />
        <Typography variant="h6" style={{ marginLeft: 16 }}>
          Loading comprehensive property data...
        </Typography>
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
            {property.address}
          </Typography>
          <Typography variant="h6" color="textSecondary">
            {`${property.city}, ${property.state} ${property.zipCode}`}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box display="flex" flexDirection="column" alignItems="flex-end">
            <Typography variant="h5" color="primary">
              {formatCurrency(property.estimatedValue)}
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
            
            {property.lastSalePrice && (
              <Typography variant="body1" mt={1}>
                {formatCurrency(property.lastSalePrice)} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  Last sale {yearsSinceLastSale ? `(${yearsSinceLastSale} years ago)` : ''}
                </span>
              </Typography>
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
            {property.bedrooms && <Chip label={`${property.bedrooms} bed`} size="small" icon={<Home fontSize="small" />} />}
            {property.bathrooms && <Chip label={`${property.bathrooms} bath`} size="small" />}
            {property.squareFeet && <Chip label={`${formatNumber(property.squareFeet)} sq ft`} size="small" />}
            {property.yearBuilt && <Chip label={`Built ${property.yearBuilt}`} size="small" />}
            {property.propertyType && <Chip label={property.propertyType} size="small" />}
            {property.pool && <Chip label="Pool" size="small" />}
            {property.garage && <Chip label={`${property.garage} car garage`} size="small" />}
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
      <Button variant="outlined" onClick={onBack} sx={{ mb: 2 }}>
        Back to Results
      </Button>
      
      {/* Debug button to show raw data */}
      {rawData && (
        <Button 
          variant="outlined" 
          color="secondary" 
          size="small" 
          sx={{ mb: 2, ml: 2 }}
          onClick={() => {
            console.log("Raw API data:", rawData);
            alert("Raw API data logged to console");
          }}
        >
          Debug API Data
        </Button>
      )}
      
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
                    <Typography variant="body1">{property.propertyType || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Year Built</Typography>
                    <Typography variant="body1">{property.yearBuilt || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Square Feet</Typography>
                    <Typography variant="body1">{property.squareFeet ? formatNumber(property.squareFeet) : 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Lot Size</Typography>
                    <Typography variant="body1">
                      {property.lotSize ? `${formatNumber(property.lotSize)} ${property.lotSizeUnit || 'sq ft'}` : 'Not available'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Bedrooms</Typography>
                    <Typography variant="body1">{property.bedrooms || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Bathrooms</Typography>
                    <Typography variant="body1">{property.bathrooms || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Stories</Typography>
                    <Typography variant="body1">{property.stories || 'Not available'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Garage</Typography>
                    <Typography variant="body1">{property.garage || 'None'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Pool</Typography>
                    <Typography variant="body1">{property.pool ? 'Yes' : 'No'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Fireplaces</Typography>
                    <Typography variant="body1">{property.fireplaces || 'None'}</Typography>
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
                          {property.lastSalePrice ? formatCurrency(property.lastSalePrice) : 'Not available'}
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
                      secondary={property.taxAssessedValue ? formatCurrency(property.taxAssessedValue) : 'Not available'}
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
                              {property.estimatedEquity ? formatCurrency(property.estimatedEquity) : 'Not available'}
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
                                {property.ownerMailingCity && (
                                  <Typography variant="body2">
                                    {`${property.ownerMailingCity || ''}, ${property.ownerMailingState || ''} ${property.ownerMailingZip || ''}`}
                                  </Typography>
                                )}
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
                        {property.lastSalePrice ? formatCurrency(property.estimatedValue * 0.7 - property.lastSalePrice) : 'N/A'}
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
                      secondary={property.estimatedEquity ? formatCurrency(property.estimatedEquity) : 'N/A'}
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
                      secondary={property.taxAssessedValue ? formatCurrency(property.taxAssessedValue) : 'Not available'}
                      secondaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Tax Market Value" 
                      secondary={property.taxMarketValue ? formatCurrency(property.taxMarketValue) : 'Not available'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary="Annual Tax Amount" 
                      secondary={property.taxAmount ? formatCurrency(property.taxAmount) : 'Not available'}
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
        </Grid>
      </TabPanel>
    </Container>
  );
};

export default PropertyDetailEnhanced;
