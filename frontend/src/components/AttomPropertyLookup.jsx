import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography
} from '@mui/material';
import { Search, Home } from '@mui/icons-material';

// API base URL - change this to match your server configuration
const API_BASE_URL = 'http://localhost:5002';

/**
 * AttomPropertyLookup - A simple component that can be embedded in existing pages
 * to add ATTOM property data lookup functionality
 * 
 * @param {Object} props
 * @param {Function} props.onPropertySelect - Callback when a property is selected
 * @param {Function} props.onPropertyDataReceived - Callback with all property data
 */
const AttomPropertyLookup = ({ onPropertySelect, onPropertyDataReceived }) => {
  // State for form inputs
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  
  // State for API response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Handle search by address
  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!address || !city || !state) {
      setError('Please fill in all required fields: address, city, and state');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/address`, {
        params: { address, city, state, zip: zipCode }
      });
      
      const propertyData = response.data.properties || [];
      setProperties(propertyData);
      
      // Also notify parent component of all data received
      if (onPropertyDataReceived && typeof onPropertyDataReceived === 'function') {
        onPropertyDataReceived(propertyData);
      }
      
      if (propertyData.length === 0) {
        setError(`No properties found for address: ${address}, ${city}, ${state} ${zipCode}`);
      } else if (propertyData.length === 1) {
        // If only one property is found, select it automatically
        handleSelectProperty(propertyData[0]);
      } else {
        // If multiple properties are found, show results dialog
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error searching for property:', error);
      setError(error.response?.data?.message || error.message || 'Error searching for property');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle property selection
  const handleSelectProperty = async (property) => {
    setShowResults(false);
    
    // Notify parent component of selected property
    if (onPropertySelect && typeof onPropertySelect === 'function') {
      onPropertySelect(property);
    }
  };
  
  return (
    <Box>
      <form onSubmit={handleSearch}>
        <Grid container spacing={2}>
          <Grid xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Look up real property data
            </Typography>
          </Grid>
          
          <Grid xs={12}>
            <TextField
              label="Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              required
              size="small"
            />
          </Grid>
          
          <Grid xs={12} sm={4}>
            <TextField
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              fullWidth
              required
              size="small"
            />
          </Grid>
          
          <Grid xs={6} sm={4}>
            <TextField
              label="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              fullWidth
              required
              size="small"
            />
          </Grid>
          
          <Grid xs={6} sm={4}>
            <TextField
              label="ZIP Code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          
          <Grid xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />}
              disabled={loading}
              size="medium"
            >
              {loading ? 'Searching...' : 'Find Property'}
            </Button>
          </Grid>
          
          {error && (
            <Grid xs={12}>
              <Typography color="error">{error}</Typography>
            </Grid>
          )}
        </Grid>
      </form>
      
      {/* Dialog to show multiple results */}
      <Dialog open={showResults} onClose={() => setShowResults(false)}>
        <DialogTitle>Select a Property</DialogTitle>
        <DialogContent>
          {properties.map((property) => (
            <Card 
              key={property.attomId} 
              sx={{ mb: 2, cursor: 'pointer' }}
              onClick={() => handleSelectProperty(property)}
            >
              <CardContent>
                <Typography variant="body1" gutterBottom>
                  <Home sx={{ mr: 1, verticalAlign: 'bottom', fontSize: 18 }} />
                  {property.address}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {property.city}, {property.state} {property.zipCode}
                </Typography>
                {property.estimatedValue && (
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                    Estimated Value: ${property.estimatedValue.toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResults(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttomPropertyLookup;

