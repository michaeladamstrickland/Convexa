import React, { useState } from 'react';
import { 
  Container, Box, TextField, Button, Typography, 
  Grid, Card, CardContent, Divider, InputAdornment,
  CircularProgress, Alert
} from '@mui/material';
import { Search, LocationOn } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/**
 * Enhanced Property Search Component
 * Search for properties and link to the enhanced property detail view
 */
const EnhancedPropertySearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Handle form submission for address search
  const handleAddressSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Parse address components from search query
      const addressParts = searchQuery.split(',').map(part => part.trim());
      let address, city, state, zip;
      
      if (addressParts.length >= 3) {
        address = addressParts[0];
        city = addressParts[1];
        // Handle state and zip which may be together like "CA 90210" or separate
        const stateZipParts = addressParts[2].split(' ').filter(Boolean);
        state = stateZipParts[0];
        zip = stateZipParts[1] || '';
      } else {
        // Fallback if not enough parts
        address = searchQuery;
        city = '';
        state = '';
        zip = zipCode;
      }
      
      // Call property search API with address components
      const response = await axios.get('/api/attom/property/address', {
        params: { address, city, state, zip }
      });
      
      if (response.data.status === 'success') {
        setSearchResults(response.data.properties || []);
        if (response.data.properties.length === 0) {
          setError('No properties found for this address.');
        }
      } else {
        setError('Error searching for properties.');
      }
    } catch (err) {
      console.error('Error searching properties:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle zip code search
  const handleZipSearch = async () => {
    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('/api/attom/property/zip', {
        params: { zip: zipCode, page: 1, pageSize: 10 }
      });
      
      if (response.data.status === 'success') {
        setSearchResults(response.data.properties || []);
        if (response.data.properties.length === 0) {
          setError('No properties found in this ZIP code.');
        }
      } else {
        setError('Error searching for properties.');
      }
    } catch (err) {
      console.error('Error searching by ZIP:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle property selection
  const handlePropertySelect = (attomId) => {
    navigate(`/property/${attomId}`);
  };
  
  // Format currency values
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Enhanced Property Search
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        Search for properties to view detailed information including valuation, owner data, and investment metrics.
      </Typography>
      
      <Box sx={{ mt: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <form onSubmit={handleAddressSearch}>
              <TextField
                fullWidth
                label="Search by Address"
                variant="outlined"
                placeholder="123 Main St, Los Angeles, CA"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ mt: 2 }}>
                <Button 
                  type="submit" 
                  variant="contained" 
                  startIcon={<Search />}
                  disabled={loading}
                >
                  Search by Address
                </Button>
              </Box>
            </form>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search by ZIP Code"
              variant="outlined"
              placeholder="90210"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              inputProps={{ maxLength: 5 }}
            />
            <Box sx={{ mt: 2 }}>
              <Button 
                onClick={handleZipSearch} 
                variant="outlined" 
                disabled={loading}
              >
                Search by ZIP
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      {/* Results Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Search Results
        </Typography>
        
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {!loading && searchResults.length > 0 && (
          <Grid container spacing={3}>
            {searchResults.map((property) => (
              <Grid item xs={12} key={property.attomId}>
                <Card 
                  elevation={2}
                  onClick={() => handlePropertySelect(property.attomId)}
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.01)',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="h6">
                          {property.address}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {property.city}, {property.state} {property.zipCode}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            {property.bedrooms || 'N/A'} bed • {property.bathrooms || 'N/A'} bath • {property.squareFeet ? `${property.squareFeet.toLocaleString()} sq ft` : 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            {property.propertyType || 'Residential'} • Built {property.yearBuilt || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box display="flex" flexDirection="column" alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                          <Typography variant="h6" color="primary">
                            {formatCurrency(property.estimatedValue || property.lastSalePrice)}
                          </Typography>
                          {property.lastSalePrice && (
                            <Typography variant="body2" color="text.secondary">
                              Last sold: {formatCurrency(property.lastSalePrice)}
                              {property.lastSaleDate && ` (${new Date(property.lastSaleDate).getFullYear()})`}
                            </Typography>
                          )}
                          <Button 
                            variant="outlined" 
                            size="small" 
                            sx={{ mt: 1 }}
                          >
                            View Enhanced Details
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        
        {!loading && searchResults.length === 0 && !error && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Enter an address or ZIP code to search for properties.
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default EnhancedPropertySearch;
