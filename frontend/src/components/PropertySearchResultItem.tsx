// PropertySearchResultItem component to link to enhanced property details
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardActionArea, Typography, Grid, Box, Chip } from '@mui/material';
import { Home, LocationOn, AspectRatio, AttachMoney } from '@mui/icons-material';

/**
 * Formats a currency value
 * @param value - The value to format
 * @returns Formatted currency string
 */
const formatCurrency = (value: number | undefined) => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * PropertySearchResultItem component
 * Displays a property search result with a link to the enhanced property detail view
 */
interface PropertyResult {
  attomId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  ownerName?: string;
  ownerOccupied?: boolean;
  estimatedValue?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

const PropertySearchResultItem = ({ property }: { property: PropertyResult }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    // Navigate to the enhanced property detail page
    navigate(`/property/${property.attomId}`);
  };
  
  return (
    <Card 
      elevation={2}
      sx={{ 
        mb: 2,
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'scale(1.01)',
          boxShadow: 3
        }
      }}
    >
      <CardActionArea onClick={handleClick}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                {property.address}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                <LocationOn fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                {property.city}, {property.state} {property.zipCode}
              </Typography>
              
              <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                {property.bedrooms && (
                  <Chip 
                    size="small" 
                    label={`${property.bedrooms} bed`} 
                    icon={<Home fontSize="small" />} 
                  />
                )}
                {property.bathrooms && (
                  <Chip 
                    size="small" 
                    label={`${property.bathrooms} bath`} 
                  />
                )}
                {property.squareFeet && (
                  <Chip 
                    size="small" 
                    label={`${property.squareFeet.toLocaleString()} sq ft`} 
                    icon={<AspectRatio fontSize="small" />} 
                  />
                )}
                {property.propertyType && (
                  <Chip 
                    size="small" 
                    label={property.propertyType} 
                  />
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box display="flex" flexDirection="column" alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                {property.estimatedValue && (
                  <Typography variant="h6" color="primary">
                    {formatCurrency(property.estimatedValue)}
                  </Typography>
                )}
                
                {property.lastSalePrice && (
                  <Box display="flex" alignItems="center">
                    <AttachMoney fontSize="small" color="action" />
                    <Typography variant="body2">
                      Last sold: {formatCurrency(property.lastSalePrice)}
                      {property.lastSaleDate && (
                        <span style={{ marginLeft: '4px', color: 'text.secondary' }}>
                          ({new Date(property.lastSaleDate).getFullYear()})
                        </span>
                      )}
                    </Typography>
                  </Box>
                )}
                
                <Box mt={1}>
                  <Typography variant="body2" color="text.secondary">
                    Click for enhanced property details
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default PropertySearchResultItem;
