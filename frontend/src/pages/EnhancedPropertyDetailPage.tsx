import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button, Container } from '@mui/material';
import { useProperty } from '../hooks/useProperty';
import PropertyDetailView from '../components/PropertyDetailView';
import type { PropertyResult } from '../services/AttomPropertyService';

/**
 * Enhanced Property Detail Page
 * Displays comprehensive property information using the enhanced property detail component
 */
const EnhancedPropertyDetailPage: React.FC = () => {
  const { attomId } = useParams<{ attomId: string }>();
  const navigate = useNavigate();
  const query = useProperty(attomId);
  const raw = query.data as any;
  const property = raw?.data ?? raw?.property ?? raw ?? null;

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  if (query.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
        <CircularProgress size={60} />
        <Typography variant="h6" style={{ marginLeft: 16 }}>
          Loading property details...
        </Typography>
      </Box>
    );
  }

  if (query.error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Error Loading Property
        </Typography>
        <Typography color="error" paragraph>
          Failed to load property details
        </Typography>
        <Button variant="contained" onClick={handleBack}>
          Back to Search
        </Button>
      </Container>
    );
  }

  if (!attomId) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          No Property ID Provided
        </Typography>
        <Typography paragraph>
          Please select a property from search results to view details.
        </Typography>
        <Button variant="contained" onClick={handleBack}>
          Back to Search
        </Button>
      </Container>
    );
  }

  // Adapt API result shape into PropertyResult expected by PropertyDetailView
  const toPropertyResult = (p: any): PropertyResult => ({
    attomId: String(p?.attomId ?? p?.id ?? attomId),
    address: p?.address ?? p?.propertyAddress ?? [p?.streetNumber, p?.streetName].filter(Boolean).join(' ') ?? 'Unknown address',
    city: p?.city ?? p?.propertyCity ?? p?.mailingCity ?? '',
    state: p?.state ?? p?.propertyState ?? p?.mailingState ?? '',
    zipCode: p?.zipCode ?? p?.propertyZip ?? p?.mailingZip ?? '',
    latitude: p?.latitude ?? p?.lat,
    longitude: p?.longitude ?? p?.lng,
    propertyType: p?.propertyType ?? p?.type ?? 'Residential',
    yearBuilt: p?.yearBuilt,
    bedrooms: p?.bedrooms ?? p?.beds,
    bathrooms: p?.bathrooms ?? p?.baths,
    squareFeet: p?.squareFeet ?? p?.sqft,
    lotSize: p?.lotSize,
    lotSizeUnit: p?.lotSizeUnit,
    stories: p?.stories,
    pool: p?.pool,
    fireplaces: p?.fireplaces,
    ownerName: p?.ownerName,
    ownerOccupied: p?.ownerOccupied,
    ownerType: p?.ownerType,
    ownerMailingAddress: p?.ownerMailingAddress,
    ownerMailingCity: p?.ownerMailingCity,
    ownerMailingState: p?.ownerMailingState,
    ownerMailingZip: p?.ownerMailingZip,
    deedType: p?.deedType,
    deedDate: p?.deedDate,
    lastSaleDate: p?.lastSaleDate,
    lastSalePrice: p?.lastSalePrice,
    estimatedValue: p?.estimatedValue,
    estimatedValueRange: p?.estimatedValueRange,
    confidenceScore: p?.confidenceScore,
    taxAssessedValue: p?.taxAssessedValue,
    taxMarketValue: p?.taxMarketValue,
    taxYear: p?.taxYear,
    estimatedEquity: p?.estimatedEquity,
    parcelId: p?.parcelId,
    fips: p?.fips,
    apn: p?.apn,
    legal1: p?.legal1,
    zoning: p?.zoning,
    taxRate: p?.taxRate,
    taxAmount: p?.taxAmount,
    mortgageAmount: p?.mortgageAmount,
    mortgageLender: p?.mortgageLender,
    mortgageDate: p?.mortgageDate,
    mortgageMaturityDate: p?.mortgageMaturityDate,
    mortgageInterestRate: p?.mortgageInterestRate,
    subdivision: p?.subdivision,
  });

  return <PropertyDetailView property={toPropertyResult(property)} onClose={handleBack} />;
};

export default EnhancedPropertyDetailPage;
