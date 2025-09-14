import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  Tabs,
  Tab,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Card,
  CardContent
} from '@mui/material';

import {
  Home,
  LocationOn,
  ArrowBack,
  Person,
  AttachMoney,
  Description,
  Receipt,
  LocalOffer,
  Add,
  Favorite,
  FavoriteBorder,
  PersonSearch,
  Phone,
  Email
} from '@mui/icons-material';

import { AttomPropertyService } from '../services/AttomPropertyService';

interface PropertyDetailsViewProps {
  attomId: string;
  onBack: () => void;
  onAddLead?: (property: any) => void;
  onSkipTrace?: (property: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`property-tabpanel-${index}`}
      aria-labelledby={`property-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const PropertyDetailsView: React.FC<PropertyDetailsViewProps> = ({ 
  attomId, 
  onBack, 
  onAddLead,
  onSkipTrace
}) => {
  // State
  const [property, setProperty] = useState<any>(null);
  const [taxHistory, setTaxHistory] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Load property details on mount
  useEffect(() => {
    loadPropertyDetails();
  }, [attomId]);
  
  // Load property details
  const loadPropertyDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load enriched property details
      const propertyData = await AttomPropertyService.getPropertyDetails(attomId);
      setProperty(propertyData);
      
      // Load tax and sales history in parallel if needed
      if (activeTab === 2 || activeTab === 3) {
        loadHistoricalData();
      }
    } catch (error) {
      console.error('Error loading property details:', error);
      setError(error instanceof Error ? error.message : 'Error loading property details');
    } finally {
      setLoading(false);
    }
  };
  
  // Load tax and sales history
  const loadHistoricalData = async () => {
    try {
      const [taxData, salesData] = await Promise.all([
        AttomPropertyService.getPropertyTaxHistory(attomId),
        AttomPropertyService.getPropertySalesHistory(attomId)
      ]);
      
      setTaxHistory(taxData || []);
      setSalesHistory(salesData || []);
    } catch (error) {
      console.error('Error loading historical data:', error);
      // Don't show error for this since it's secondary data
    }
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    
    // Load tax and sales history if switching to those tabs
    if ((newValue === 2 || newValue === 3) && (!taxHistory.length || !salesHistory.length)) {
      loadHistoricalData();
    }
  };
  
  // Toggle favorite status
  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Implement API call to save/remove favorite
  };
  
  // Format currency
  const formatCurrency = (value: number | undefined): string => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ my: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          variant="outlined" 
          onClick={onBack} 
          startIcon={<ArrowBack />}
          sx={{ mt: 2 }}
        >
          Back to Results
        </Button>
      </Box>
    );
  }
  
  if (!property) {
    return (
      <Box sx={{ my: 2 }}>
        <Alert severity="info">Property details not found</Alert>
        <Button 
          variant="outlined" 
          onClick={onBack} 
          startIcon={<ArrowBack />}
          sx={{ mt: 2 }}
        >
          Back to Results
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button 
          variant="outlined" 
          onClick={onBack} 
          startIcon={<ArrowBack />}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Property Details
        </Typography>
        <Box>
          {onSkipTrace && (
            <Button 
              variant="outlined"
              startIcon={<PersonSearch />}
              onClick={() => onSkipTrace(property)}
              sx={{ mr: 1 }}
            >
              Skip Trace
            </Button>
          )}
          {onAddLead && (
            <Button 
              variant="contained"
              startIcon={<Add />}
              onClick={() => onAddLead(property)}
              color="primary"
            >
              Add to Leads
            </Button>
          )}
        </Box>
      </Box>
      
      {/* Property summary card */}
      <Paper elevation={3} sx={{ mb: 3, p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" gutterBottom>
              {property.address}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              <LocationOn sx={{ fontSize: 18, verticalAlign: 'text-bottom', mr: 0.5 }} />
              {property.city}, {property.state} {property.zipCode}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ATTOM ID: {property.attomId}
              {property.parcelId && ` • Parcel ID: ${property.parcelId}`}
              {property.apn && ` • APN: ${property.apn}`}
            </Typography>
          </Box>
          <Box>
            <IconButton 
              color="primary"
              onClick={toggleFavorite}
            >
              {isFavorite ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Beds
                </Typography>
                <Typography variant="h6">
                  {property.bedrooms || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Baths
                </Typography>
                <Typography variant="h6">
                  {property.bathrooms || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Sq Ft
                </Typography>
                <Typography variant="h6">
                  {property.squareFeet ? property.squareFeet.toLocaleString() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Year Built
                </Typography>
                <Typography variant="h6">
                  {property.yearBuilt || 'N/A'}
                </Typography>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Chip 
                label={property.propertyType || 'Unknown Type'} 
                size="small" 
                sx={{ mr: 0.5, mb: 0.5 }}
              />
              {property.stories && (
                <Chip 
                  label={`${property.stories} ${property.stories > 1 ? 'Stories' : 'Story'}`} 
                  size="small" 
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {property.garage && (
                <Chip 
                  label={`Garage: ${property.garage}`} 
                  size="small" 
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {property.pool && (
                <Chip 
                  label="Pool" 
                  size="small" 
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {property.fireplaces > 0 && (
                <Chip 
                  label={`${property.fireplaces} Fireplace${property.fireplaces > 1 ? 's' : ''}`} 
                  size="small" 
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {property.ownerOccupied !== undefined && (
                <Chip 
                  label={property.ownerOccupied ? 'Owner Occupied' : 'Non-Owner Occupied'} 
                  color={property.ownerOccupied ? 'primary' : 'default'}
                  size="small" 
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-end', 
                height: '100%', 
                justifyContent: 'space-between' 
              }}
            >
              <Box>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(property.estimatedValue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Estimated Value
                </Typography>
              </Box>
              
              {property.lastSaleDate && property.lastSalePrice && (
                <Box sx={{ textAlign: 'right', mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Last Sold: {formatDate(property.lastSaleDate)}
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(property.lastSalePrice)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Tabs for property details */}
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="property details tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Details" icon={<Home />} iconPosition="start" />
            <Tab label="Owner" icon={<Person />} iconPosition="start" />
            <Tab label="Financial" icon={<AttachMoney />} iconPosition="start" />
            <Tab label="History" icon={<Description />} iconPosition="start" />
          </Tabs>
        </Box>
        
        {/* Details Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Property Characteristics
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Property Type</TableCell>
                      <TableCell>{property.propertyType || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Year Built</TableCell>
                      <TableCell>{property.yearBuilt || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Bedrooms</TableCell>
                      <TableCell>{property.bedrooms || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Bathrooms</TableCell>
                      <TableCell>{property.bathrooms || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Square Feet</TableCell>
                      <TableCell>{property.squareFeet ? property.squareFeet.toLocaleString() : 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Lot Size</TableCell>
                      <TableCell>
                        {property.lotSize ? `${property.lotSize.toLocaleString()} ${property.lotSizeUnit || ''}` : 'N/A'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Stories</TableCell>
                      <TableCell>{property.stories || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Garage</TableCell>
                      <TableCell>{property.garage || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Pool</TableCell>
                      <TableCell>{property.pool ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Fireplaces</TableCell>
                      <TableCell>{property.fireplaces || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Location Information
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Address</TableCell>
                      <TableCell>{property.address}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">City</TableCell>
                      <TableCell>{property.city}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">State</TableCell>
                      <TableCell>{property.state}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">ZIP Code</TableCell>
                      <TableCell>{property.zipCode}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">FIPS</TableCell>
                      <TableCell>{property.fips || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Legal Description</TableCell>
                      <TableCell>{property.legal1 || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Subdivision</TableCell>
                      <TableCell>{property.subdivision || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Zoning</TableCell>
                      <TableCell>{property.zoning || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Parcel ID</TableCell>
                      <TableCell>{property.parcelId || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">APN</TableCell>
                      <TableCell>{property.apn || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Owner Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Owner Information
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">
                      {property.ownerName || 'Owner Name Not Available'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {property.ownerType || 'Owner Type Unknown'}
                    </Typography>
                  </Box>
                  <Chip 
                    label={property.ownerOccupied ? 'Owner Occupied' : 'Non-Owner Occupied'} 
                    color={property.ownerOccupied ? 'success' : 'default'}
                  />
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Mailing Address:
                </Typography>
                
                {property.ownerMailingAddress ? (
                  <Box>
                    <Typography variant="body1">
                      {property.ownerMailingAddress}
                    </Typography>
                    <Typography variant="body1">
                      {property.ownerMailingCity}, {property.ownerMailingState} {property.ownerMailingZip}
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">Mailing address not available</Typography>
                )}
              </Paper>
              
              <Typography variant="subtitle1" gutterBottom>
                Deed Information:
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Deed Type</TableCell>
                      <TableCell>{property.deedType || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Deed Date</TableCell>
                      <TableCell>{formatDate(property.deedDate) || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Contact Opportunities
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                Owner contact details require skip tracing. Click the "Skip Trace" button to find phone numbers and email addresses.
              </Alert>
              
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Phone color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Phone Numbers</Typography>
                  </Box>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Run skip trace to find phone numbers
                  </Typography>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Email color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Email Addresses</Typography>
                  </Box>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Run skip trace to find email addresses
                  </Typography>
                </CardContent>
              </Card>
              
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button 
                  variant="contained"
                  startIcon={<PersonSearch />}
                  color="primary"
                  onClick={() => onSkipTrace && onSkipTrace(property)}
                >
                  Skip Trace Owner
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Financial Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Property Valuation
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(property.estimatedValue)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Estimated Market Value
                </Typography>
                
                {property.estimatedValueRange?.low && property.estimatedValueRange?.high && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body1">
                      Value Range: {formatCurrency(property.estimatedValueRange.low)} - {formatCurrency(property.estimatedValueRange.high)}
                    </Typography>
                    {property.confidenceScore && (
                      <Typography variant="body2" color="text.secondary">
                        Confidence Score: {property.confidenceScore}
                      </Typography>
                    )}
                  </Box>
                )}
                
                {property.estimatedEquity !== undefined && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: property.estimatedEquity > 50000 ? 'success.50' : 'warning.50', borderRadius: 1 }}>
                    <Typography variant="h6" color={property.estimatedEquity > 50000 ? 'success.main' : 'text.primary'}>
                      {formatCurrency(property.estimatedEquity)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Equity (based on last sale price)
                    </Typography>
                  </Box>
                )}
              </Paper>
              
              <Typography variant="h6" gutterBottom>
                Tax Information
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Tax Assessed Value</TableCell>
                      <TableCell>{formatCurrency(property.taxAssessedValue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Tax Market Value</TableCell>
                      <TableCell>{formatCurrency(property.taxMarketValue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Tax Year</TableCell>
                      <TableCell>{property.taxYear || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Tax Amount</TableCell>
                      <TableCell>{formatCurrency(property.taxAmount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Tax Rate</TableCell>
                      <TableCell>{property.taxRate ? `${property.taxRate}%` : 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Last Sale Information
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Last Sale Date</TableCell>
                      <TableCell>{formatDate(property.lastSaleDate)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Last Sale Price</TableCell>
                      <TableCell>{formatCurrency(property.lastSalePrice)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Deed Type</TableCell>
                      <TableCell>{property.deedType || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Typography variant="h6" gutterBottom>
                Mortgage Information
              </Typography>
              
              {property.mortgageAmount || property.mortgageLender ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell component="th" scope="row">Mortgage Amount</TableCell>
                        <TableCell>{formatCurrency(property.mortgageAmount)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell component="th" scope="row">Lender</TableCell>
                        <TableCell>{property.mortgageLender || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell component="th" scope="row">Mortgage Date</TableCell>
                        <TableCell>{formatDate(property.mortgageDate)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell component="th" scope="row">Maturity Date</TableCell>
                        <TableCell>{formatDate(property.mortgageMaturityDate)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell component="th" scope="row">Interest Rate Type</TableCell>
                        <TableCell>{property.mortgageInterestRate || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No mortgage information available</Alert>
              )}
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* History Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Sales History
              </Typography>
              
              {salesHistory && salesHistory.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Buyer</TableCell>
                        <TableCell>Seller</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salesHistory.map((sale, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(sale.date)}</TableCell>
                          <TableCell>{formatCurrency(sale.amount)}</TableCell>
                          <TableCell>{sale.buyerName || 'N/A'}</TableCell>
                          <TableCell>{sale.sellerName || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No sales history available</Alert>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Tax History
              </Typography>
              
              {taxHistory && taxHistory.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Year</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Assessed Value</TableCell>
                        <TableCell>Market Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {taxHistory.map((tax, index) => (
                        <TableRow key={index}>
                          <TableCell>{tax.year}</TableCell>
                          <TableCell>{formatCurrency(tax.amount)}</TableCell>
                          <TableCell>{formatCurrency(tax.assessedValue)}</TableCell>
                          <TableCell>{formatCurrency(tax.marketValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No tax history available</Alert>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Box>
  );
};

export default PropertyDetailsView;
