import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Button, Card, Container, Divider, FormControl,
  Grid, InputLabel, MenuItem, Select, TextField, Typography,
  CircularProgress, Alert, Paper, Table, TableContainer, 
  TableHead, TableRow, TableCell, TableBody, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, 
  FormControlLabel, Checkbox, Rating, Tooltip
} from '@mui/material';
import { Search, Home, LocationOn, AttachMoney, Add, Save } from '@mui/icons-material';

// API base URLs
const ATTOM_API_URL = 'http://localhost:5002/api/attom'; // ATTOM server runs on port 5002
const LEADS_API_URL = 'http://localhost:5001/api/leads'; // Main server runs on port 5001

const AttomLeadGenerator = () => {
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
  
  // State for lead generation
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [savingLeads, setSavingLeads] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  
  // Lead form state
  const [leadFormData, setLeadFormData] = useState({
    ownerName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    estimatedValue: 0,
    equity: 0,
    motivationScore: 50,
    sourceType: 'attom',
    isProbate: false,
    isVacant: false,
    notes: '',
  });
  
  // Reset state function
  const resetState = () => {
    setError(null);
    setProperties([]);
    setSelectedProperty(null);
    setPropertyValuation(null);
    setSelectedLeads([]);
  };
  
  // Handle search by address
  const handleAddressSearch = async () => {
    resetState();
    setLoading(true);
    
    try {
      const response = await axios.get(`${ATTOM_API_URL}/property/address`, {
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
      const response = await axios.get(`${ATTOM_API_URL}/property/zip`, {
        params: { zip: zipCode, page: 1, pageSize: 20 }
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
      const response = await axios.get(`${ATTOM_API_URL}/property/${attomId}`);
      
      if (response.data.property) {
        setSelectedProperty(response.data.property);
        
        // Get property valuation
        const valuationResponse = await axios.get(`${ATTOM_API_URL}/property/${attomId}/valuation`);
        setPropertyValuation(valuationResponse.data.valuation || null);
      } else {
        setError(`No property found with ATTOM ID: ${attomId}`);
      }
    } catch (error) {
      console.error('Error searching by ATTOM ID:', error);
      setError(error.response?.data?.message || error.message || 'Error searching for property');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle property selection
  const handleSelectProperty = async (property) => {
    setLoading(true);
    setSelectedProperty(property);
    setPropertyValuation(null);
    
    try {
      // Use the comprehensive property detail endpoint that combines data from multiple ATTOM API sources
      const detailResponse = await axios.get(`${ATTOM_API_URL}/property/${property.attomId}/detail`);
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
        const basicDetailResponse = await axios.get(`${ATTOM_API_URL}/property/${property.attomId}`);
        setSelectedProperty(basicDetailResponse.data.property || property);
        
        // Get property valuation separately
        const valuationResponse = await axios.get(`${ATTOM_API_URL}/property/${property.attomId}/valuation`);
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
  
  // Toggle lead selection with enriched data
  const toggleLeadSelection = async (property) => {
    if (selectedLeads.some(p => p.attomId === property.attomId)) {
      // If already selected, just remove it
      setSelectedLeads(selectedLeads.filter(p => p.attomId !== property.attomId));
    } else {
      // If not selected, enrich the data first then add it
      setLoading(true);
      try {
        // Import the AttomPropertyService
        const { AttomPropertyService } = await import('../services/AttomPropertyService');
        
        // Get enriched property data
        const enrichedProperty = await AttomPropertyService.addPropertyAsLead(property.attomId);
        
        // Add the enriched property to selected leads
        setSelectedLeads([...selectedLeads, enrichedProperty]);
        
        // Show success notification
        setNotification({
          open: true,
          message: 'Property data successfully enriched with owner and financial details',
          severity: 'success'
        });
      } catch (error) {
        console.error('Error enriching property data:', error);
        // Fall back to adding the basic property if enrichment fails
        setSelectedLeads([...selectedLeads, property]);
        
        setNotification({
          open: true,
          message: 'Could not fully enrich property data, using basic information',
          severity: 'warning'
        });
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Check if a property is selected
  const isPropertySelected = (property) => {
    return selectedLeads.some(p => p.attomId === property.attomId);
  };
  
  // Open lead form to edit details before saving (with enriched data)
  const openLeadForm = async (property) => {
    setLoading(true);
    
    try {
      // Import the AttomPropertyService
      const { AttomPropertyService } = await import('../services/AttomPropertyService');
      
      // Get enriched property data
      const enrichedProperty = await AttomPropertyService.getPropertyDetails(property.attomId);
      
      // Calculate estimated equity
      let equity = 0;
      if (enrichedProperty.estimatedValue && enrichedProperty.lastSalePrice) {
        equity = enrichedProperty.estimatedValue - enrichedProperty.lastSalePrice;
      }
      
      // Set initial form data from enriched property
      setLeadFormData({
        ownerName: enrichedProperty.ownerName || property.ownerName || '',
        address: enrichedProperty.address || property.address || '',
        city: enrichedProperty.city || property.city || '',
        state: enrichedProperty.state || property.state || '',
        zipCode: enrichedProperty.zipCode || property.zipCode || '',
        estimatedValue: enrichedProperty.estimatedValue || property.estimatedValue || 0,
        equity: enrichedProperty.estimatedEquity || equity,
        motivationScore: 50, // Default motivation
        sourceType: 'attom',
        isProbate: false,
        isVacant: !(enrichedProperty.ownerOccupied || property.ownerOccupied),
        notes: `Property details from ATTOM API: ${enrichedProperty.propertyType || property.propertyType || ''}, ${enrichedProperty.yearBuilt || property.yearBuilt || ''} year built, ${enrichedProperty.bedrooms || property.bedrooms || 0} bed/${enrichedProperty.bathrooms || property.bathrooms || 0} bath, ${enrichedProperty.squareFeet || property.squareFeet || 0} sq ft. Owner: ${enrichedProperty.ownerName || 'Unknown'}${enrichedProperty.ownerMailingAddress ? `, mailing address: ${enrichedProperty.ownerMailingAddress}, ${enrichedProperty.ownerMailingCity || ''}, ${enrichedProperty.ownerMailingState || ''} ${enrichedProperty.ownerMailingZip || ''}` : ''}`,
      });
      
      setCurrentLead(enrichedProperty);
      setLeadFormOpen(true);
      
    } catch (error) {
      console.error('Error enriching property data for lead form:', error);
      
      // Fall back to basic property data if enrichment fails
      let equity = 0;
      if (property.estimatedValue && property.lastSalePrice) {
        equity = property.estimatedValue - property.lastSalePrice;
      }
      
      setLeadFormData({
        ownerName: property.ownerName || '',
        address: property.address || '',
        city: property.city || '',
        state: property.state || '',
        zipCode: property.zipCode || '',
        estimatedValue: property.estimatedValue || 0,
        equity: equity,
        motivationScore: 50,
        sourceType: 'attom',
        isProbate: false,
        isVacant: !property.ownerOccupied,
        notes: `Property details from ATTOM API: ${property.propertyType || ''}, ${property.yearBuilt || ''} year built, ${property.bedrooms || 0} bed/${property.bathrooms || 0} bath, ${property.squareFeet || 0} sq ft`,
      });
      
      setCurrentLead(property);
      setLeadFormOpen(true);
      
      // Show warning notification
      setNotification({
        open: true,
        message: 'Could not fully enrich property data, using basic information',
        severity: 'warning'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle lead form input changes
  const handleLeadFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setLeadFormData({
      ...leadFormData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };
  
  // Save lead to database
  const saveLead = async () => {
    setSavingLeads(true);
    
    try {
      // Prepare the lead data
      const leadData = {
        address: `${leadFormData.address}, ${leadFormData.city}, ${leadFormData.state} ${leadFormData.zipCode}`,
        owner_name: leadFormData.ownerName,
        estimated_value: leadFormData.estimatedValue,
        equity: leadFormData.equity,
        motivation_score: leadFormData.motivationScore,
        temperature_tag: getTemperatureTag(leadFormData.motivationScore),
        source_type: leadFormData.sourceType,
        is_probate: leadFormData.isProbate ? 1 : 0,
        is_vacant: leadFormData.isVacant ? 1 : 0,
        notes: leadFormData.notes,
        status: 'NEW',
        attom_id: currentLead.attomId,
      };
      
      // Save to database
      const response = await axios.post(`${LEADS_API_URL}/add-lead`, leadData);
      
      if (response.data.success) {
        // Remove this property from selected leads
        setSelectedLeads(selectedLeads.filter(p => p.attomId !== currentLead.attomId));
        
        // Close form and show notification
        setLeadFormOpen(false);
        setNotification({
          open: true,
          message: 'Lead saved successfully!',
          severity: 'success'
        });
      } else {
        throw new Error(response.data.message || 'Failed to save lead');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      setNotification({
        open: true,
        message: `Failed to save lead: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSavingLeads(false);
    }
  };
  
  // Save all selected leads to database with enriched data
  const saveAllLeads = async () => {
    setSavingLeads(true);
    let savedCount = 0;
    let errorCount = 0;
    
    try {
      for (const property of selectedLeads) {
        try {
          // We assume that selectedLeads already contains enriched data
          // from the toggleLeadSelection function, but we'll check for
          // the presence of enriched data fields
          
          // Use the property's estimated equity if available, otherwise calculate it
          let equity = property.estimatedEquity || 0;
          if (!equity && property.estimatedValue && property.lastSalePrice) {
            equity = property.estimatedValue - property.lastSalePrice;
          }
          
          // Create rich notes with as much information as we have
          let notesText = `Property details from ATTOM API: ${property.propertyType || ''}, ${property.yearBuilt || ''} year built, ${property.bedrooms || 0} bed/${property.bathrooms || 0} bath, ${property.squareFeet || 0} sq ft`;
          
          // Add owner information if available
          if (property.ownerName) {
            notesText += `\nOwner: ${property.ownerName}`;
          }
          
          // Add mailing address if different from property address
          if (property.ownerMailingAddress && 
              property.ownerMailingAddress !== property.address) {
            notesText += `\nMailing address: ${property.ownerMailingAddress}, ${property.ownerMailingCity || ''}, ${property.ownerMailingState || ''} ${property.ownerMailingZip || ''}`;
          }
          
          // Add financial information
          if (property.lastSaleDate) {
            notesText += `\nLast sale: ${property.lastSaleDate} for ${formatCurrency(property.lastSalePrice)}`;
          }
          
          if (property.estimatedValue) {
            notesText += `\nEstimated value: ${formatCurrency(property.estimatedValue)}`;
          }
          
          if (property.taxAssessedValue) {
            notesText += `\nTax assessed value: ${formatCurrency(property.taxAssessedValue)}`;
          }
          
          // Add mortgage information if available
          if (property.mortgageAmount) {
            notesText += `\nMortgage: ${formatCurrency(property.mortgageAmount)} from ${property.mortgageLender || 'unknown lender'}`;
            if (property.mortgageDate) {
              notesText += ` originated on ${property.mortgageDate}`;
            }
          }
          
          // Determine property type - vacant, absentee, owner-occupied, etc.
          const isAbsenteeOwner = property.ownerMailingAddress && 
                                 property.ownerMailingAddress !== property.address;
          
          const leadData = {
            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
            owner_name: property.ownerName || 'Unknown Owner',
            estimated_value: property.estimatedValue || 0,
            equity: equity,
            motivation_score: property.leadQualityScore ? 
              Math.min(Math.floor(property.leadQualityScore * 0.75), 80) : 50, // Base motivation on lead quality, but cap at 80
            temperature_tag: property.leadQualityScore > 75 ? 'hot' : 
                            property.leadQualityScore > 50 ? 'warm' : 'cold',
            source_type: 'attom',
            is_probate: 0,
            is_vacant: property.ownerOccupied ? 0 : 1,
            is_absentee: isAbsenteeOwner ? 1 : 0,
            notes: notesText,
            status: 'NEW',
            attom_id: property.attomId,
            mailing_address: property.ownerMailingAddress || '',
            mailing_city: property.ownerMailingCity || '',
            mailing_state: property.ownerMailingState || '',
            mailing_zip: property.ownerMailingZip || '',
            property_type: property.propertyType || '',
            year_built: property.yearBuilt || null,
            bedrooms: property.bedrooms || null,
            bathrooms: property.bathrooms || null,
            square_feet: property.squareFeet || null,
            lot_size: property.lotSize || null,
            last_sale_date: property.lastSaleDate || null,
            last_sale_price: property.lastSalePrice || null
          };
          
          // Save to database
          await axios.post(`${LEADS_API_URL}/add-lead`, leadData);
          savedCount++;
        } catch (err) {
          console.error(`Error saving lead for property ${property.attomId}:`, err);
          errorCount++;
        }
      }
      
      // Show notification
      setNotification({
        open: true,
        message: `Saved ${savedCount} leads successfully${errorCount ? `, ${errorCount} failed` : ''}`,
        severity: errorCount ? 'warning' : 'success'
      });
      
      // Clear selected leads
      setSelectedLeads([]);
    } catch (error) {
      console.error('Error in batch lead save:', error);
      setNotification({
        open: true,
        message: 'Failed to save leads',
        severity: 'error'
      });
    } finally {
      setSavingLeads(false);
    }
  };
  
  // Get temperature tag based on motivation score
  const getTemperatureTag = (score) => {
    if (score <= 25) return 'DEAD';
    if (score <= 50) return 'COLD';
    if (score <= 75) return 'WARM';
    return 'HOT';
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Real Leads from ATTOM Property Data
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Search for properties using ATTOM API and convert them to leads in your system
      </Typography>
      
      {/* Search Form */}
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
      
      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}
      
      {/* Selected Leads Summary */}
      {selectedLeads.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {selectedLeads.length} Properties Selected as Leads
            </Typography>
            
            <Button
              variant="contained"
              color="success"
              startIcon={<Save />}
              onClick={saveAllLeads}
              disabled={savingLeads}
            >
              {savingLeads ? 'Saving...' : 'Save All as Leads'}
            </Button>
          </Box>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Address</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedLeads.map((property) => (
                  <TableRow key={property.attomId}>
                    <TableCell>{property.address}, {property.city}, {property.state}</TableCell>
                    <TableCell>{property.ownerName || 'Unknown'}</TableCell>
                    <TableCell>{formatCurrency(property.estimatedValue)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color="secondary"
                        onClick={() => toggleLeadSelection(property)}
                      >
                        Remove
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => openLeadForm(property)}
                      >
                        Edit & Save
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      
      {/* Property List */}
      {properties.length > 0 && !selectedProperty && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">
              Found {properties.length} Properties
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            {properties.map((property) => (
              <Grid xs={12} md={6} key={property.attomId}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    <Home sx={{ mr: 1, verticalAlign: 'bottom' }} />
                    {property.address}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    <LocationOn sx={{ mr: 1, verticalAlign: 'bottom', fontSize: 18 }} />
                    {property.city}, {property.state} {property.zipCode}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Property Type:</strong> {property.propertyType || 'Single Family Residence'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Year Built:</strong> {property.yearBuilt || 'Unknown'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Bedrooms:</strong> {property.bedrooms || '3'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Bathrooms:</strong> {property.bathrooms || '2'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Square Feet:</strong> {property.squareFeet ? property.squareFeet.toLocaleString() : '1,500'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Owner:</strong> {property.ownerName || 'Unknown'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="body2">
                          <strong>Owner Occupied:</strong> {property.ownerOccupied ? 'Yes' : 'No'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                      <AttachMoney sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                      {property.estimatedValue ? formatCurrency(property.estimatedValue) : 'Valuation Pending'}
                    </Typography>
                    
                    <Box>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleSelectProperty(property)}
                        sx={{ mr: 1 }}
                      >
                        View Details
                      </Button>
                      
                      <Button
                        variant={isPropertySelected(property) ? "contained" : "outlined"}
                        color={isPropertySelected(property) ? "success" : "primary"}
                        onClick={() => toggleLeadSelection(property)}
                        startIcon={isPropertySelected(property) ? null : <Add />}
                      >
                        {isPropertySelected(property) ? 'Selected' : 'Add as Lead'}
                      </Button>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
      
      {/* Property Details */}
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
          
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" gutterBottom>
              Property Details
            </Typography>
            
            <Button
              variant={isPropertySelected(selectedProperty) ? "contained" : "outlined"}
              color={isPropertySelected(selectedProperty) ? "success" : "primary"}
              onClick={() => toggleLeadSelection(selectedProperty)}
              startIcon={isPropertySelected(selectedProperty) ? null : <Add />}
            >
              {isPropertySelected(selectedProperty) ? 'Selected as Lead' : 'Add as Lead'}
            </Button>
          </Box>
          
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  {selectedProperty.address}
                </Typography>
                <Typography variant="subtitle1" gutterBottom>
                  {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ATTOM ID: {selectedProperty.attomId}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
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
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        onClick={() => openLeadForm(selectedProperty)}
                      >
                        Convert to Lead with Custom Settings
                      </Button>
                    </Box>
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
      
      {/* Lead Form Dialog */}
      <Dialog open={leadFormOpen} onClose={() => setLeadFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Lead from Property</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid xs={12} sm={6}>
              <TextField
                name="ownerName"
                label="Owner Name"
                value={leadFormData.ownerName}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                name="address"
                label="Street Address"
                value={leadFormData.address}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <TextField
                name="city"
                label="City"
                value={leadFormData.city}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={6} sm={4}>
              <TextField
                name="state"
                label="State"
                value={leadFormData.state}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={6} sm={4}>
              <TextField
                name="zipCode"
                label="ZIP Code"
                value={leadFormData.zipCode}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                name="estimatedValue"
                label="Estimated Value ($)"
                type="number"
                value={leadFormData.estimatedValue}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                name="equity"
                label="Estimated Equity ($)"
                type="number"
                value={leadFormData.equity}
                onChange={handleLeadFormChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid xs={12}>
              <Typography gutterBottom>Motivation Score: {leadFormData.motivationScore}</Typography>
              <Tooltip title="How motivated is the seller? Higher = more motivated">
                <Box>
                  <input
                    type="range"
                    name="motivationScore"
                    min={0}
                    max={100}
                    value={leadFormData.motivationScore}
                    onChange={handleLeadFormChange}
                    style={{ width: '100%' }}
                  />
                </Box>
              </Tooltip>
              <Box display="flex" justifyContent="space-between" px={1} mt={-1}>
                <Typography variant="caption">Dead</Typography>
                <Typography variant="caption">Cold</Typography>
                <Typography variant="caption">Warm</Typography>
                <Typography variant="caption">Hot</Typography>
              </Box>
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Lead Source</InputLabel>
                <Select
                  name="sourceType"
                  value={leadFormData.sourceType}
                  onChange={handleLeadFormChange}
                  label="Lead Source"
                >
                  <MenuItem value="attom">ATTOM Property Data</MenuItem>
                  <MenuItem value="probate">Probate</MenuItem>
                  <MenuItem value="foreclosure">Foreclosure</MenuItem>
                  <MenuItem value="tax_lien">Tax Lien</MenuItem>
                  <MenuItem value="divorce">Divorce</MenuItem>
                  <MenuItem value="violation">Code Violation</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6}>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isProbate"
                      checked={leadFormData.isProbate}
                      onChange={handleLeadFormChange}
                    />
                  }
                  label="Probate Property"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isVacant"
                      checked={leadFormData.isVacant}
                      onChange={handleLeadFormChange}
                    />
                  }
                  label="Vacant Property"
                />
              </Box>
            </Grid>
            <Grid xs={12}>
              <TextField
                name="notes"
                label="Notes"
                value={leadFormData.notes}
                onChange={handleLeadFormChange}
                fullWidth
                multiline
                rows={4}
                margin="normal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadFormOpen(false)}>Cancel</Button>
          <Button 
            onClick={saveLead} 
            variant="contained" 
            color="primary"
            disabled={savingLeads}
          >
            {savingLeads ? 'Saving...' : 'Save Lead'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        message={notification.message}
      />
    </Container>
  );
};

export default AttomLeadGenerator;

