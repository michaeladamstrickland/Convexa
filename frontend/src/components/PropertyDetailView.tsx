import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Tab,
  Tabs,
  Typography,
  Snackbar,
  Alert,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@mui/material';
import {
  Home,
  Person,
  AttachMoney,
  Assessment,
  History,
  Description,
  Save,
  FavoriteBorder,
  Share,
  OpenInNew
} from '@mui/icons-material';

import { PropertyResult } from '../services/AttomPropertyService';
import { LeadService } from '../services/leadService';

interface PropertyDetailViewProps {
  property: PropertyResult;
  onClose: () => void;
  onSaveAsLead?: (property: PropertyResult) => Promise<void>;
}

const PropertyDetailView: React.FC<PropertyDetailViewProps> = ({ property, onClose, onSaveAsLead }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // Define tabs
  const tabs = [
    { label: 'Property Details', icon: <Home /> },
    { label: 'Owner Info', icon: <Person /> },
    { label: 'Financial', icon: <AttachMoney /> },
    { label: 'History', icon: <History /> },
    { label: 'Assessment', icon: <Assessment /> }
  ];

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle save as lead
  const handleSaveAsLead = async () => {
    try {
      if (onSaveAsLead) {
        await onSaveAsLead(property);
        setSnackbarMessage('Property saved as lead successfully');
        setSnackbarSeverity('success');
      } else {
        await LeadService.createLead({
          propertyId: property.attomId,
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          ownerName: property.ownerName || 'Unknown',
          estimatedValue: property.estimatedValue || 0,
          lastSalePrice: property.lastSalePrice || 0,
          propertyType: property.propertyType,
          squareFeet: property.squareFeet || 0,
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          yearBuilt: property.yearBuilt || 0,
          status: 'New',
          notes: 'Lead created from property search',
          lastContact: null,
          leadSource: 'Property Search'
        });
        setSnackbarMessage('Property saved as lead successfully');
        setSnackbarSeverity('success');
      }
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error saving lead:', error);
      setSnackbarMessage('Failed to save property as lead');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Format currency
  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onClose}
        >
          Back to Search
        </Button>
        <Box>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<Save />}
            onClick={handleSaveAsLead}
            sx={{ mr: 1 }}
          >
            Save as Lead
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<FavoriteBorder />}
            sx={{ mr: 1 }}
          >
            Add to Favorites
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Share />}
          >
            Share
          </Button>
        </Box>
      </Box>

      {/* Property Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Typography variant="h5" gutterBottom>
                {property.address}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                {property.city}, {property.state} {property.zipCode}
              </Typography>
              
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {property.bedrooms && (
                  <Chip label={`${property.bedrooms} BR`} variant="outlined" />
                )}
                {property.bathrooms && (
                  <Chip label={`${property.bathrooms} BA`} variant="outlined" />
                )}
                {property.squareFeet && (
                  <Chip label={`${property.squareFeet.toLocaleString()} sqft`} variant="outlined" />
                )}
                {property.yearBuilt && (
                  <Chip label={`Built ${property.yearBuilt}`} variant="outlined" />
                )}
                <Chip 
                  label={property.propertyType} 
                  variant="outlined" 
                  color="primary"
                />
                {property.ownerOccupied !== undefined && (
                  <Chip 
                    label={property.ownerOccupied ? "Owner Occupied" : "Non-Owner Occupied"} 
                    color={property.ownerOccupied ? "default" : "secondary"}
                  />
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
              {property.estimatedValue && (
                <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  {formatCurrency(property.estimatedValue)}
                </Typography>
              )}
              
              {property.lastSaleDate && property.lastSalePrice && (
                <Typography variant="body2" color="text.secondary">
                  Last Sale: {formatCurrency(property.lastSalePrice)} ({property.lastSaleDate})
                </Typography>
              )}
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  endIcon={<OpenInNew />}
                  href={`https://maps.google.com/?q=${property.address}, ${property.city}, ${property.state} ${property.zipCode}`}
                  target="_blank"
                >
                  View on Map
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Property Details Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="property detail tabs">
          {tabs.map((tab, index) => (
            <Tab 
              key={index}
              icon={tab.icon} 
              iconPosition="start"
              label={tab.label} 
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab 1: Property Details */}
      {activeTab === 0 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Property Details
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Basic Information</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Property Type</Typography>
                      <Typography variant="body1">{property.propertyType || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Year Built</Typography>
                      <Typography variant="body1">{property.yearBuilt || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Square Feet</Typography>
                      <Typography variant="body1">
                        {property.squareFeet ? property.squareFeet.toLocaleString() : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Lot Size</Typography>
                      <Typography variant="body1">
                        {property.lotSize 
                          ? `${property.lotSize.toLocaleString()} ${property.lotSizeUnit || 'sq ft'}` 
                          : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Bedrooms</Typography>
                      <Typography variant="body1">{property.bedrooms || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Bathrooms</Typography>
                      <Typography variant="body1">{property.bathrooms || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Stories</Typography>
                      <Typography variant="body1">{property.stories || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Pool</Typography>
                      <Typography variant="body1">{property.pool ? 'Yes' : 'No'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Location Information</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Address</Typography>
                      <Typography variant="body1">{property.address}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">City</Typography>
                      <Typography variant="body1">{property.city}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">State</Typography>
                      <Typography variant="body1">{property.state}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">ZIP</Typography>
                      <Typography variant="body1">{property.zipCode}</Typography>
                    </Grid>
                    {property.latitude && property.longitude && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Coordinates</Typography>
                        <Typography variant="body1">
                          {property.latitude}, {property.longitude}
                        </Typography>
                      </Grid>
                    )}
                    {property.parcelId && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Parcel ID</Typography>
                        <Typography variant="body1">{property.parcelId}</Typography>
                      </Grid>
                    )}
                    {property.legal1 && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Legal Description</Typography>
                        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                          {property.legal1}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
      
      {/* Tab 2: Owner Info */}
      {activeTab === 1 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Owner Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Owner Details</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Owner Name</Typography>
                      <Typography variant="body1">{property.ownerName || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Owner Occupied</Typography>
                      <Typography variant="body1">
                        {property.ownerOccupied !== undefined 
                          ? (property.ownerOccupied ? 'Yes' : 'No')
                          : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Owner Type</Typography>
                      <Typography variant="body1">{property.ownerType || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Ownership Information
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Deed Type</Typography>
                      <Typography variant="body1">{property.deedType || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Deed Date</Typography>
                      <Typography variant="body1">{property.deedDate || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Mailing Address</Typography>
                  
                  {property.ownerMailingAddress ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body1" gutterBottom>
                          {property.ownerMailingAddress}
                        </Typography>
                        <Typography variant="body1">
                          {property.ownerMailingCity}, {property.ownerMailingState} {property.ownerMailingZip}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                          {property.ownerOccupied 
                            ? "The owner lives at this property."
                            : "This is an investment property (owner does not live here)."}
                        </Typography>
                        
                        {!property.ownerOccupied && property.ownerMailingZip !== property.zipCode && (
                          <Chip 
                            label="Out of Area Owner" 
                            color="error"
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Grid>
                    </Grid>
                  ) : (
                    <Typography>No mailing address information available</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
      
      {/* Tab 3: Financial */}
      {activeTab === 2 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Financial Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Valuation</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Estimated Value</Typography>
                      <Typography variant="h6" color="primary.main">
                        {formatCurrency(property.estimatedValue)}
                      </Typography>
                    </Grid>
                    
                    {property.estimatedValueRange && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Value Range</Typography>
                        <Typography variant="body1">
                          {formatCurrency(property.estimatedValueRange.low)} - {formatCurrency(property.estimatedValueRange.high)}
                        </Typography>
                        {property.confidenceScore && (
                          <Chip 
                            label={`${property.confidenceScore}% Confidence`} 
                            color={property.confidenceScore > 70 ? "success" : property.confidenceScore > 50 ? "warning" : "error"}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Grid>
                    )}
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Last Sale Price</Typography>
                      <Typography variant="body1">
                        {formatCurrency(property.lastSalePrice)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Last Sale Date</Typography>
                      <Typography variant="body1">
                        {property.lastSaleDate || 'N/A'}
                      </Typography>
                    </Grid>
                    
                    {property.estimatedEquity !== undefined && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Estimated Equity</Typography>
                        <Typography 
                          variant="body1" 
                          color={property.estimatedEquity > 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(property.estimatedEquity)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Mortgage Information</Typography>
                  
                  {property.mortgageAmount ? (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Mortgage Amount</Typography>
                        <Typography variant="body1">
                          {formatCurrency(property.mortgageAmount)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Mortgage Date</Typography>
                        <Typography variant="body1">
                          {property.mortgageDate || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Lender</Typography>
                        <Typography variant="body1">
                          {property.mortgageLender || 'N/A'}
                        </Typography>
                      </Grid>
                      {property.mortgageInterestRate && (
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                          <Typography variant="body1">
                            {property.mortgageInterestRate}%
                          </Typography>
                        </Grid>
                      )}
                      {property.mortgageMaturityDate && (
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Maturity Date</Typography>
                          <Typography variant="body1">
                            {property.mortgageMaturityDate}
                          </Typography>
                        </Grid>
                      )}
                      
                      {property.estimatedValue && property.mortgageAmount && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">LTV Ratio</Typography>
                          <Typography variant="body1">
                            {Math.round((property.mortgageAmount / property.estimatedValue) * 100)}%
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  ) : (
                    <Typography variant="body1">No mortgage information available</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
      
      {/* Tab 4: History */}
      {activeTab === 3 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Property History
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Sale History
          </Typography>
          <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sale Date</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Buyer</TableCell>
                    <TableCell>Seller</TableCell>
                    <TableCell>Deed Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Sample sale history entry */}
                  <TableRow>
                    <TableCell>{property.lastSaleDate || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(property.lastSalePrice)}</TableCell>
                    <TableCell>{property.ownerName || 'N/A'}</TableCell>
                    <TableCell>Prior Owner</TableCell>
                    <TableCell>{property.deedType || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        To view complete sale history, use the Sales History API
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          
          <Typography variant="subtitle1" gutterBottom>
            Tax History
          </Typography>
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Year</TableCell>
                    <TableCell>Assessed Value</TableCell>
                    <TableCell>Market Value</TableCell>
                    <TableCell>Tax Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Sample tax history entry */}
                  <TableRow>
                    <TableCell>{property.taxYear || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(property.taxAssessedValue)}</TableCell>
                    <TableCell>{formatCurrency(property.taxMarketValue)}</TableCell>
                    <TableCell>{formatCurrency(property.taxAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">
                        To view complete tax history, use the Tax History API
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
      
      {/* Tab 5: Assessment */}
      {activeTab === 4 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Tax Assessment
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Assessment Details</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Assessed Value</Typography>
                      <Typography variant="body1">
                        {formatCurrency(property.taxAssessedValue)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Market Value</Typography>
                      <Typography variant="body1">
                        {formatCurrency(property.taxMarketValue)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Tax Amount</Typography>
                      <Typography variant="body1">
                        {formatCurrency(property.taxAmount)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Tax Year</Typography>
                      <Typography variant="body1">
                        {property.taxYear || 'N/A'}
                      </Typography>
                    </Grid>
                    
                    {property.taxRate && (
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">Tax Rate</Typography>
                        <Typography variant="body1">
                          {property.taxRate}%
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Property Identifiers</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">ATTOM ID</Typography>
                      <Typography variant="body1">
                        {property.attomId}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Parcel ID</Typography>
                      <Typography variant="body1">
                        {property.parcelId || 'N/A'}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">APN</Typography>
                      <Typography variant="body1">
                        {property.apn || 'N/A'}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">FIPS Code</Typography>
                      <Typography variant="body1">
                        {property.fips || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PropertyDetailView;
