import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, Button, Card, Container, Divider, FormControl,
  Grid, InputLabel, MenuItem, Select, TextField, Typography,
  CircularProgress, Alert, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Snackbar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip
} from '@mui/material';
import { 
  Search, Home, LocationOn, AttachMoney, Favorite, 
  FavoriteBorder, ContentCopy, Person, PersonSearch 
} from '@mui/icons-material';

// API base URLs - Using the integrated server (port 5001)
// ATTOM server runs on port 5002, main server on 5001
const API_BASE_URL = 'http://localhost:5002';
const FAVORITES_API_URL = 'http://localhost:5001/api/favorites';
const SKIPTRACE_API_URL = 'http://localhost:5001/api/skiptrace';

const AttomPropertySearch = () => {
  // State for form inputs
  const [searchType, setSearchType] = useState('address');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [attomId, setAttomId] = useState('');
  
  // State for API response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyValuation, setPropertyValuation] = useState(null);
  
  // State for favorites
  const [favorites, setFavorites] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // State for skip tracing
  const [skipTraceDialogOpen, setSkipTraceDialogOpen] = useState(false);
  const [skipTraceProperty, setSkipTraceProperty] = useState(null);
  const [skipTraceResults, setSkipTraceResults] = useState(null);
  const [skipTraceLoading, setSkipTraceLoading] = useState(false);
  
  // Reset state function
  const resetState = () => {
    setError(null);
    setProperties([]);
    setSelectedProperty(null);
    setPropertyValuation(null);
  };
  
  // Load favorites on component mount
  React.useEffect(() => {
    loadFavorites();
  }, []);
  
  // Load favorites from API
  const loadFavorites = async () => {
    try {
      const response = await axios.get(`${FAVORITES_API_URL}`);
      setFavorites(response.data.favorites || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Don't show error to user as this is a background operation
    }
  };
  
  // Handle search by address
  const handleAddressSearch = async () => {
    resetState();
    setLoading(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/address`, {
        params: { address, city, state, zip: zipCode }
      });
      
      setProperties(response.data.properties || []);
      
      if (response.data.properties?.length === 0) {
        setError(`No properties found for address: ${address}, ${city}, ${state} ${zipCode}`);
      }
    } catch (error) {
      console.error('Error searching by address:', error);
      setError(error.response?.data?.message || error.message || 'Error searching for property');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search by ZIP code
  const handleZipSearch = async () => {
    resetState();
    setLoading(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/zip`, {
        params: { zip: zipCode, page: 1, pageSize: 10 }
      });
      
      setProperties(response.data.properties || []);
      
      if (response.data.properties?.length === 0) {
        setError(`No properties found in ZIP code: ${zipCode}`);
      }
    } catch (error) {
      console.error('Error searching by ZIP code:', error);
      setError(error.response?.data?.message || error.message || 'Error searching for properties');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search by ATTOM ID
  const handleAttomIdSearch = async () => {
    resetState();
    setLoading(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/${attomId}`);
      setSelectedProperty(response.data.property || null);
      
      if (!response.data.property) {
        setError(`No property found with ATTOM ID: ${attomId}`);
      }
    } catch (error) {
      console.error('Error searching by ATTOM ID:', error);
      setError(error.response?.data?.message || error.message || 'Error searching for property');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle property selection and get details
  const handleSelectProperty = async (property) => {
    setLoading(true);
    setSelectedProperty(property);
    setPropertyValuation(null);
    
    try {
      // Use the comprehensive property detail endpoint that combines data from multiple ATTOM API sources
      const detailResponse = await axios.get(`${API_BASE_URL}/api/attom/property/${property.attomId}/detail`);
      if (detailResponse.data && detailResponse.data.status === 'success') {
        // This endpoint returns a more complete property object with all necessary fields
        setSelectedProperty(detailResponse.data.property || property);
        
        // Since the comprehensive endpoint already includes valuation data, we don't need a separate call
        // but we'll still format it for consistency with the rest of the component
        const propertyData = detailResponse.data.property;
        const valuation = {
          estimatedValue: propertyData.estimatedValue,
          estimatedValueHigh: propertyData.estimatedValueHigh,
          estimatedValueLow: propertyData.estimatedValueLow,
          confidenceScore: propertyData.confidenceScore,
          taxAssessedValue: propertyData.taxAssessedValue,
          taxMarketValue: propertyData.taxMarketValue,
          taxYear: propertyData.taxYear,
          taxAmount: propertyData.taxAmount,
          lastSaleDate: propertyData.lastSaleDate,
          lastSalePrice: propertyData.lastSalePrice,
          estimatedEquity: propertyData.estimatedEquity
        };
        setPropertyValuation(valuation);
      } else {
        // Fallback to the original approach if the comprehensive endpoint fails
        console.warn('Using fallback API endpoints for property details');
        
        // Get basic property details
        const basicDetailResponse = await axios.get(`${API_BASE_URL}/api/attom/property/${property.attomId}`);
        setSelectedProperty(basicDetailResponse.data.property || property);
        
        // Get property valuation separately
        const valuationResponse = await axios.get(`${API_BASE_URL}/api/attom/property/${property.attomId}/valuation`);
        setPropertyValuation(valuationResponse.data.valuation || null);
      }
    } catch (error) {
      console.error('Error getting property details:', error);
      setError(error.response?.data?.message || error.message || 'Error getting property details');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (searchType === 'address') {
      if (!address || !city || !state) {
        setError('Please fill in all required fields: address, city, and state');
        return;
      }
      handleAddressSearch();
    } else if (searchType === 'zip') {
      if (!zipCode) {
        setError('Please enter a ZIP code');
        return;
      }
      handleZipSearch();
    } else if (searchType === 'attomId') {
      if (!attomId) {
        setError('Please enter an ATTOM ID');
        return;
      }
      handleAttomIdSearch();
    }
  };
  
  // Format currency
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Check if a property is in favorites
  const isFavorite = (property) => {
    return favorites.some(fav => fav.attom_id === property.attomId);
  };
  
  // Toggle favorite status
  const toggleFavorite = async (property, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      if (isFavorite(property)) {
        // Remove from favorites
        await axios.delete(`${FAVORITES_API_URL}/${property.attomId}`);
        setFavorites(favorites.filter(fav => fav.attom_id !== property.attomId));
        setNotification({
          open: true,
          message: 'Removed from favorites',
          severity: 'success'
        });
      } else {
        // Add to favorites
        const favoriteData = {
          attom_id: property.attomId,
          address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
          property_type: property.propertyType || 'Unknown',
          estimated_value: property.estimatedValue || 0,
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          square_feet: property.squareFeet || 0,
          year_built: property.yearBuilt || 0,
          notes: ''
        };
        
        await axios.post(`${FAVORITES_API_URL}`, favoriteData);
        setFavorites([...favorites, { attom_id: property.attomId, ...favoriteData }]);
        setNotification({
          open: true,
          message: 'Added to favorites',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      setNotification({
        open: true,
        message: 'Error updating favorites',
        severity: 'error'
      });
    }
  };
  
  // Copy property address to clipboard
  const copyAddressToClipboard = (property, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
    navigator.clipboard.writeText(fullAddress).then(() => {
      setNotification({
        open: true,
        message: 'Address copied to clipboard',
        severity: 'success'
      });
    });
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Open skip trace dialog
  const handleOpenSkipTraceDialog = (property) => {
    setSkipTraceProperty(property);
    setSkipTraceResults(null);
    setSkipTraceDialogOpen(true);
  };

  // Close skip trace dialog
  const handleCloseSkipTraceDialog = () => {
    setSkipTraceDialogOpen(false);
    setSkipTraceProperty(null);
  };

  // Perform skip trace
  const performSkipTrace = async () => {
    if (!skipTraceProperty) return;
    
    setSkipTraceLoading(true);
    
    try {
      // Create a temporary lead or use the property data directly
      const skipTraceData = {
        attomId: skipTraceProperty.attomId,
        ownerName: skipTraceProperty.ownerName,
        address: skipTraceProperty.address,
        city: skipTraceProperty.city,
        state: skipTraceProperty.state,
        zipCode: skipTraceProperty.zipCode
      };
      
      // Call skip trace API
      const response = await axios.post(`${SKIPTRACE_API_URL}/property`, skipTraceData);
      
      setSkipTraceResults(response.data);
      
      // Show success message
      setNotification({
        open: true,
        message: 'Skip trace completed successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error performing skip trace:', error);
      setNotification({
        open: true,
        message: 'Error performing skip trace: ' + (error.response?.data?.message || error.message),
        severity: 'error'
      });
    } finally {
      setSkipTraceLoading(false);
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        ATTOM Property Search
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Search for real property data using the ATTOM Property Data API
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Search Type</InputLabel>
                <Select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  label="Search Type"
                >
                  <MenuItem value="address">Search by Address</MenuItem>
                  <MenuItem value="zip">Search by ZIP Code</MenuItem>
                  <MenuItem value="attomId">Search by ATTOM ID</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {searchType === 'address' && (
              <>
                <Grid xs={12} md={8}>
                  <TextField
                    label="Street Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid xs={12} md={4}>
                  <TextField
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid xs={6} md={4}>
                  <TextField
                    label="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid xs={6} md={4}>
                  <TextField
                    label="ZIP Code"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    fullWidth
                  />
                </Grid>
              </>
            )}
            
            {searchType === 'zip' && (
              <Grid xs={12} md={8}>
                <TextField
                  label="ZIP Code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
            )}
            
            {searchType === 'attomId' && (
              <Grid xs={12} md={8}>
                <TextField
                  label="ATTOM ID"
                  value={attomId}
                  onChange={(e) => setAttomId(e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
            )}
            
            <Grid xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<Search />}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                    Searching...
                  </>
                ) : 'Search Properties'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}
      
      {/* Display property list */}
      {properties.length > 0 && !selectedProperty && (
        <>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Found {properties.length} Properties
          </Typography>
          
          <Grid container spacing={3}>
            {properties.map((property) => (
              <Grid xs={12} md={6} key={property.attomId}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        <Home sx={{ mr: 1, verticalAlign: 'bottom' }} />
                        {property.address}
                      </Typography>
                      <Typography variant="body1" color="text.secondary" gutterBottom>
                        <LocationOn sx={{ mr: 1, verticalAlign: 'bottom', fontSize: 18 }} />
                        {property.city}, {property.state} {property.zipCode}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton 
                        color="primary" 
                        onClick={(e) => toggleFavorite(property, e)}
                        aria-label={isFavorite(property) ? "Remove from favorites" : "Add to favorites"}
                      >
                        {isFavorite(property) ? <Favorite /> : <FavoriteBorder />}
                      </IconButton>
                      <IconButton 
                        color="primary" 
                        onClick={(e) => copyAddressToClipboard(property, e)}
                        aria-label="Copy address"
                      >
                        <ContentCopy />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Property Type:</strong> {property.propertyType || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Year Built:</strong> {property.yearBuilt || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Bedrooms:</strong> {property.bedrooms || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Bathrooms:</strong> {property.bathrooms || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Square Feet:</strong> {property.squareFeet || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Last Sale:</strong> {property.lastSaleDate || 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                      <AttachMoney sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                      {formatCurrency(property.estimatedValue)}
                    </Typography>
                    
                    <Box>
                      {property.ownerName && (
                        <Chip 
                          icon={<Person />} 
                          label={property.ownerName.split(' ')[0]} 
                          size="small" 
                          sx={{ mr: 1, mb: 1 }}
                          color={property.ownerOccupied ? "success" : "default"}
                        />
                      )}
                      <Button
                        variant="outlined"
                        color="secondary"
                        size="small"
                        startIcon={<PersonSearch />}
                        onClick={() => handleOpenSkipTraceDialog(property)}
                        sx={{ mr: 1 }}
                      >
                        Skip Trace
                      </Button>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleSelectProperty(property)}
                      >
                        View Details
                      </Button>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
      
      {/* Display selected property details */}
      {selectedProperty && (
        <Box sx={{ mt: 4 }}>
          <Button
            variant="outlined"
            sx={{ mb: 2 }}
            onClick={() => {
              setSelectedProperty(null);
              setPropertyValuation(null);
            }}
          >
            Back to Results
          </Button>
          
          <Typography variant="h5" gutterBottom>
            Property Details
          </Typography>
          
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {selectedProperty.address}
                  </Typography>
                  <Typography variant="subtitle1" gutterBottom>
                    {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ATTOM ID: {selectedProperty.attomId}
                  </Typography>
                </Box>
                <Box>
                  <IconButton 
                    color="primary" 
                    onClick={(e) => toggleFavorite(selectedProperty, e)}
                    aria-label={isFavorite(selectedProperty) ? "Remove from favorites" : "Add to favorites"}
                  >
                    {isFavorite(selectedProperty) ? <Favorite /> : <FavoriteBorder />}
                  </IconButton>
                  <IconButton 
                    color="primary" 
                    onClick={(e) => copyAddressToClipboard(selectedProperty, e)}
                    aria-label="Copy address"
                  >
                    <ContentCopy />
                  </IconButton>
                </Box>
              </Box>                <Divider sx={{ my: 2 }} />
                
                <Typography variant="h6" gutterBottom>
                  Property Characteristics
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Property Type:</strong> {selectedProperty.propertyType || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Year Built:</strong> {selectedProperty.yearBuilt || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Bedrooms:</strong> {selectedProperty.bedrooms || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Bathrooms:</strong> {selectedProperty.bathrooms || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Square Feet:</strong> {selectedProperty.squareFeet || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Lot Size:</strong> {selectedProperty.lotSize || 'N/A'} {selectedProperty.lotSizeUnit || ''}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Stories:</strong> {selectedProperty.stories || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Garage:</strong> {selectedProperty.garage || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Pool:</strong> {selectedProperty.pool ? 'Yes' : 'No'}
                    </Typography>
                  </Grid>
                  <Grid xs={6}>
                    <Typography variant="body2">
                      <strong>Fireplaces:</strong> {selectedProperty.fireplaces || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="h6" gutterBottom>
                  Owner Information
                </Typography>
                
                <Typography variant="body2">
                  <strong>Owner Name:</strong> {selectedProperty.ownerName || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Owner Occupied:</strong> {selectedProperty.ownerOccupied ? 'Yes' : 'No'}
                </Typography>
              </Grid>
              
              <Grid xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Valuation & Financial Information
                </Typography>
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : propertyValuation ? (
                  <>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(propertyValuation.estimatedValue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Market Value
                      </Typography>
                    </Box>
                    
                    {propertyValuation.estimatedValueHigh && propertyValuation.estimatedValueLow && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body1">
                          Valuation Range: {formatCurrency(propertyValuation.estimatedValueLow)} - {formatCurrency(propertyValuation.estimatedValueHigh)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Confidence Score: {propertyValuation.confidenceScore || 'N/A'}
                        </Typography>
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle1" gutterBottom>
                      Tax Information
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Assessed Value:</strong> {formatCurrency(propertyValuation.taxAssessedValue)}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Market Value (Tax):</strong> {formatCurrency(propertyValuation.taxMarketValue)}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Tax Year:</strong> {propertyValuation.taxYear || 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle1" gutterBottom>
                      Sale History
                    </Typography>
                    
                    <Typography variant="body2">
                      <strong>Last Sale Date:</strong> {propertyValuation.lastSaleDate || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Last Sale Price:</strong> {formatCurrency(propertyValuation.lastSalePrice)}
                    </Typography>
                    
                    {propertyValuation.estimatedEquity !== null && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="subtitle1" gutterBottom>
                          Equity Estimate
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="h6" color={propertyValuation.estimatedEquity > 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(propertyValuation.estimatedEquity)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Estimated equity based on last sale price and current market value
                          </Typography>
                        </Box>
                      </>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    Valuation data is not available for this property.
                  </Alert>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
      
      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        message={notification.message}
      />
      
      {/* Skip Trace Dialog */}
      <Dialog 
        open={skipTraceDialogOpen} 
        onClose={handleCloseSkipTraceDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Skip Trace Property Owner</DialogTitle>
        <DialogContent dividers>
          {skipTraceProperty && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Property Information
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Address:</strong> {skipTraceProperty.address}, {skipTraceProperty.city}, {skipTraceProperty.state} {skipTraceProperty.zipCode}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Owner Name:</strong> {skipTraceProperty.ownerName || 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Owner Occupied:</strong> {skipTraceProperty.ownerOccupied ? 'Yes' : 'No'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Property Value:</strong> {formatCurrency(skipTraceProperty.estimatedValue)}
                  </Typography>
                </Grid>
              </Grid>
              
              <Typography variant="body1" gutterBottom>
                Skip tracing allows you to find contact information for property owners including phone numbers, 
                email addresses, and additional property ownership records.
              </Typography>
              
              <Alert severity="info" sx={{ my: 2 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> Skip tracing incurs a cost per lookup. Your current quota will be displayed 
                  before confirming the skip trace.
                </Typography>
              </Alert>
              
              {skipTraceResults && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Skip Trace Results
                  </Typography>
                  
                  {skipTraceResults.success ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Phone Numbers:
                          </Typography>
                          {skipTraceResults.data?.phones?.length > 0 ? (
                            <ul>
                              {skipTraceResults.data.phones.map((phone, index) => (
                                <li key={index}>{phone.number} ({phone.type})</li>
                              ))}
                            </ul>
                          ) : (
                            <Typography variant="body2">No phone numbers found</Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Email Addresses:
                          </Typography>
                          {skipTraceResults.data?.emails?.length > 0 ? (
                            <ul>
                              {skipTraceResults.data.emails.map((email, index) => (
                                <li key={index}>{email}</li>
                              ))}
                            </ul>
                          ) : (
                            <Typography variant="body2">No email addresses found</Typography>
                          )}
                        </Grid>
                      </Grid>
                      
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0, 128, 0, 0.1)', borderRadius: 1 }}>
                        <Typography variant="subtitle2">
                          Skip trace cost: {formatCurrency(skipTraceResults.data?.cost || 0)}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {skipTraceResults.message || 'Failed to perform skip trace'}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseSkipTraceDialog}
          >
            Close
          </Button>
          {!skipTraceResults && (
            <Button 
              onClick={performSkipTrace} 
              variant="contained" 
              color="primary"
              startIcon={<PersonSearch />}
              disabled={skipTraceLoading}
            >
              {skipTraceLoading ? 'Processing...' : 'Perform Skip Trace'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AttomPropertySearch;

