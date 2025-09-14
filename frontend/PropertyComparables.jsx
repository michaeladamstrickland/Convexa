import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Grid,
  Box,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CompareArrows,
  Refresh,
  Map,
  Info,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { formatCurrency, formatDate, formatSqFt } from './utils/formatters';

/**
 * PropertyComparables component shows similar properties in the area
 * for valuation comparison and market analysis
 * 
 * @param {Object} props
 * @param {string} props.propertyId - ATTOM ID of the subject property
 * @param {string} props.propertyType - Property type
 * @param {number} props.bedrooms - Number of bedrooms
 * @param {number} props.bathrooms - Number of bathrooms
 * @param {number} props.squareFeet - Square footage
 * @param {string} props.zipCode - ZIP code
 * @param {number} props.latitude - Property latitude
 * @param {number} props.longitude - Property longitude
 * @returns {JSX.Element}
 */
const PropertyComparables = ({ 
  propertyId,
  propertyType, 
  bedrooms, 
  bathrooms, 
  squareFeet, 
  zipCode,
  latitude,
  longitude
}) => {
  const [comparables, setComparables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({
    bedroomDiff: 1,
    bathroomDiff: 1,
    squareFeetPercent: 20,
    radius: 1.0, // miles
    maxResults: 5,
    status: 'sold' // sold, active, both
  });

  // Calculate the average price per square foot of comparables
  const averagePricePerSqFt = comparables.length > 0
    ? comparables.reduce((acc, curr) => acc + (curr.salePrice / curr.squareFeet), 0) / comparables.length
    : 0;
    
  // Calculate suggested value based on average price per square foot
  const suggestedValue = squareFeet ? Math.round(averagePricePerSqFt * squareFeet) : 0;

  const handleFilterChange = (field, value) => {
    setFilterCriteria({
      ...filterCriteria,
      [field]: value
    });
  };

  const refreshComparables = () => {
    fetchComparables();
  };

  const fetchComparables = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would be an API call to fetch comparables
      // For this example, we'll simulate a response with mock data
      
      // Here we would make a call to an endpoint like:
      // const response = await axios.get(`/api/attom/property/${propertyId}/comparables`, {
      //   params: {
      //     bedroomDiff: filterCriteria.bedroomDiff,
      //     bathroomDiff: filterCriteria.bathroomDiff,
      //     squareFeetPercent: filterCriteria.squareFeetPercent,
      //     radius: filterCriteria.radius,
      //     maxResults: filterCriteria.maxResults,
      //     status: filterCriteria.status
      //   }
      // });
      
      // Simulate API response with mock data
      const mockResponse = {
        status: 'success',
        comparables: generateMockComparables()
      };
      
      setComparables(mockResponse.comparables);
    } catch (err) {
      console.error('Error fetching property comparables:', err);
      setError('Failed to load comparable properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Generate mock data for demonstration purposes
  const generateMockComparables = () => {
    const mockComparables = [];
    const currentDate = new Date();
    
    // Base price per square foot with slight variations
    const basePricePerSqFt = Math.random() * 50 + 150; // $150-$200 per sq ft
    
    for (let i = 0; i < filterCriteria.maxResults; i++) {
      // Generate random variations around the subject property
      const bedroomVariation = Math.floor(Math.random() * (filterCriteria.bedroomDiff * 2 + 1)) - filterCriteria.bedroomDiff;
      const bathroomVariation = Math.floor(Math.random() * (filterCriteria.bathroomDiff * 2 + 1)) - filterCriteria.bathroomDiff;
      const sqFtVariation = (Math.random() * filterCriteria.squareFeetPercent * 2 - filterCriteria.squareFeetPercent) / 100;
      
      const compSqFt = Math.round(squareFeet * (1 + sqFtVariation));
      
      // Vary the price per square foot slightly for each comparable
      const compPricePerSqFt = basePricePerSqFt * (1 + (Math.random() * 0.2 - 0.1));
      
      // Sale date within the last year
      const saleDate = new Date(currentDate);
      saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 365));
      
      // Random distance within the specified radius
      const distance = Math.round(Math.random() * filterCriteria.radius * 100) / 100;
      
      mockComparables.push({
        attomId: `MOCK${10000000 + i}`,
        address: `${1000 + i} Sample St`,
        city: 'Sample City',
        state: 'CA',
        zipCode: zipCode,
        bedrooms: Math.max(1, bedrooms + bedroomVariation),
        bathrooms: Math.max(1, bathrooms + bathroomVariation),
        squareFeet: compSqFt,
        yearBuilt: Math.max(1950, 2023 - Math.floor(Math.random() * 30)),
        saleDate: saleDate.toISOString(),
        salePrice: Math.round(compSqFt * compPricePerSqFt),
        pricePerSqFt: Math.round(compPricePerSqFt),
        distance: distance,
        distanceUnit: 'miles',
        propertyType: propertyType,
        status: Math.random() > 0.3 ? 'Sold' : 'Active',
        daysOnMarket: Math.floor(Math.random() * 90),
        latitude: latitude + (Math.random() * 0.01 - 0.005),
        longitude: longitude + (Math.random() * 0.01 - 0.005)
      });
    }
    
    return mockComparables;
  };
  
  useEffect(() => {
    if (propertyId) {
      fetchComparables();
    }
  }, [propertyId]);

  return (
    <Card elevation={2}>
      <CardHeader 
        title="Comparable Properties"
        avatar={<CompareArrows color="primary" />}
        action={
          <Button
            startIcon={<Refresh />}
            onClick={refreshComparables}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />
      <CardContent>
        {/* Filter controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>
            Comparable Property Filters
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Bedroom Difference: ±{filterCriteria.bedroomDiff}
                </Typography>
                <Slider
                  value={filterCriteria.bedroomDiff}
                  min={0}
                  max={3}
                  step={1}
                  onChange={(_, value) => handleFilterChange('bedroomDiff', value)}
                  marks
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Bathroom Difference: ±{filterCriteria.bathroomDiff}
                </Typography>
                <Slider
                  value={filterCriteria.bathroomDiff}
                  min={0}
                  max={3}
                  step={1}
                  onChange={(_, value) => handleFilterChange('bathroomDiff', value)}
                  marks
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Size Difference: ±{filterCriteria.squareFeetPercent}%
                </Typography>
                <Slider
                  value={filterCriteria.squareFeetPercent}
                  min={5}
                  max={50}
                  step={5}
                  onChange={(_, value) => handleFilterChange('squareFeetPercent', value)}
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Radius: {filterCriteria.radius} miles
                </Typography>
                <Slider
                  value={filterCriteria.radius}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(_, value) => handleFilterChange('radius', value)}
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterCriteria.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="sold">Sold</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Max Results"
                type="number"
                InputProps={{ inputProps: { min: 1, max: 20 } }}
                value={filterCriteria.maxResults}
                onChange={(e) => handleFilterChange('maxResults', parseInt(e.target.value) || 5)}
                size="small"
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} sm={12} md={6}>
              <Button 
                variant="contained" 
                onClick={refreshComparables}
                disabled={loading}
                fullWidth
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Summary Section */}
        {comparables.length > 0 && (
          <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Average Price/SqFt
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatCurrency(averagePricePerSqFt)}/sqft
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Suggested Value
                </Typography>
                <Typography variant="h5" color="success.main">
                  {formatCurrency(suggestedValue)}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Comparable Properties
                </Typography>
                <Typography variant="h5">
                  {comparables.length} found
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}
        
        {/* Comparables Table */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" p={3}>
            <CircularProgress size={40} />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading comparable properties...
            </Typography>
          </Box>
        ) : error ? (
          <Typography variant="body1" color="error" align="center" p={3}>
            {error}
          </Typography>
        ) : comparables.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" p={3}>
            No comparable properties found with the current filters.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Address</TableCell>
                  <TableCell align="right">Sale Price</TableCell>
                  <TableCell align="right">$/SqFt</TableCell>
                  <TableCell align="right">Beds</TableCell>
                  <TableCell align="right">Baths</TableCell>
                  <TableCell align="right">SqFt</TableCell>
                  <TableCell align="right">Year</TableCell>
                  <TableCell align="right">Sale Date</TableCell>
                  <TableCell align="right">Distance</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparables.map((comp) => (
                  <TableRow key={comp.attomId}>
                    <TableCell>
                      {comp.address}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {`${comp.city}, ${comp.state} ${comp.zipCode}`}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={comp.status}
                        color={comp.status === 'Active' ? 'primary' : 'default'}
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(comp.salePrice)}
                      {comp.salePrice > suggestedValue ? (
                        <TrendingUp fontSize="small" color="success" />
                      ) : (
                        <TrendingDown fontSize="small" color="error" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(comp.pricePerSqFt)}/sqft
                    </TableCell>
                    <TableCell align="right">
                      {comp.bedrooms}
                      {comp.bedrooms !== bedrooms && (
                        <Typography variant="caption" color={comp.bedrooms > bedrooms ? 'success.main' : 'error.main'}>
                          {` (${comp.bedrooms > bedrooms ? '+' : ''}${comp.bedrooms - bedrooms})`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {comp.bathrooms}
                      {comp.bathrooms !== bathrooms && (
                        <Typography variant="caption" color={comp.bathrooms > bathrooms ? 'success.main' : 'error.main'}>
                          {` (${comp.bathrooms > bathrooms ? '+' : ''}${comp.bathrooms - bathrooms})`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatSqFt(comp.squareFeet)}
                      {comp.squareFeet !== squareFeet && (
                        <Typography variant="caption" color={comp.squareFeet > squareFeet ? 'success.main' : 'error.main'}>
                          {` (${comp.squareFeet > squareFeet ? '+' : ''}${Math.round((comp.squareFeet / squareFeet - 1) * 100)}%)`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {comp.yearBuilt}
                    </TableCell>
                    <TableCell align="right">
                      {formatDate(comp.saleDate)}
                    </TableCell>
                    <TableCell align="right">
                      {comp.distance} {comp.distanceUnit}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View on Map">
                        <IconButton size="small">
                          <Map fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Property Details">
                        <IconButton size="small">
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {/* Map view button */}
        {comparables.length > 0 && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Button 
              variant="outlined" 
              startIcon={<Map />}
              onClick={() => {/* Open map view */}}
            >
              View All on Map
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertyComparables;
