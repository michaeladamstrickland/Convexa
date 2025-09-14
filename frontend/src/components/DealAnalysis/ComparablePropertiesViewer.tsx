import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Grid,
  Divider,
  Card,
  CardContent,
  CardHeader,
  TableSortLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import { Comparable } from '../../../shared/types/deal';

interface ComparablePropertiesViewerProps {
  comparables: Comparable[];
  excludedComps?: string[];
  onExcludeComp?: (compId: string, excluded: boolean) => void;
  onARVUpdate?: (arv: number) => void;
  propertySquareFootage?: number;
}

type SortField = 'salePrice' | 'saleDate' | 'sqft' | 'distanceMi' | 'adjustedPrice';
type SortDirection = 'asc' | 'desc';

// Helper function to format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
};

// Helper function to format currency
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const ComparablePropertiesViewer: React.FC<ComparablePropertiesViewerProps> = ({
  comparables,
  excludedComps = [],
  onExcludeComp,
  onARVUpdate,
  propertySquareFootage
}) => {
  // State
  const [sortField, setSortField] = useState<SortField>('distanceMi');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [manualARV, setManualARV] = useState<string>('');
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false);

  // Calculate estimated ARV
  const estimatedARV = React.useMemo(() => {
    if (!propertySquareFootage || comparables.length === 0) return 0;
    
    // Filter out excluded comps
    const filteredComps = comparables.filter(comp => !excludedComps.includes(comp.address));
    
    if (filteredComps.length === 0) return 0;
    
    // Calculate ARV
    const totalValue = filteredComps.reduce((sum, comp) => {
      // Use adjusted price if available, otherwise calculate based on $/sqft
      const compValue = comp.adjustedPrice || (comp.salePrice / comp.sqft * propertySquareFootage);
      return sum + compValue;
    }, 0);
    
    return Math.round(totalValue / filteredComps.length);
  }, [comparables, excludedComps, propertySquareFootage]);

  // Update parent when ARV changes
  useEffect(() => {
    if (onARVUpdate && estimatedARV > 0) {
      onARVUpdate(estimatedARV);
    }
  }, [estimatedARV, onARVUpdate]);

  // Handle sort change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle manual ARV update
  const handleManualARVUpdate = () => {
    const arvValue = parseFloat(manualARV);
    if (!isNaN(arvValue) && onARVUpdate) {
      onARVUpdate(arvValue);
    }
  };

  // Sort comparables
  const sortedComparables = [...comparables].sort((a, b) => {
    // Handle sort by field
    switch (sortField) {
      case 'salePrice':
        return sortDirection === 'asc' ? a.salePrice - b.salePrice : b.salePrice - a.salePrice;
      case 'saleDate':
        return sortDirection === 'asc' 
          ? new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
          : new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      case 'sqft':
        return sortDirection === 'asc' ? a.sqft - b.sqft : b.sqft - a.sqft;
      case 'distanceMi':
        return sortDirection === 'asc' ? a.distanceMi - b.distanceMi : b.distanceMi - a.distanceMi;
      case 'adjustedPrice':
        const aPrice = a.adjustedPrice || a.salePrice;
        const bPrice = b.adjustedPrice || b.salePrice;
        return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
      default:
        return 0;
    }
  });

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader
          title="Comparable Properties"
          subheader={`Found ${comparables.length - excludedComps.length} comparable properties`}
          action={
            <Box>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  // Reload comps functionality would go here
                  console.log('Reload comps clicked');
                }}
              >
                Refresh
              </Button>
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Typography variant="body2" gutterBottom>
                After Repair Value (ARV) based on comparables:
              </Typography>
              <Typography variant="h5" color="primary" gutterBottom>
                {formatCurrency(estimatedARV)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {excludedComps.length > 0 && `${excludedComps.length} comparable(s) excluded from calculation`}
              </Typography>
            </Grid>
            <Grid xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TextField
                  label="Manual ARV Override"
                  size="small"
                  value={manualARV}
                  onChange={(e) => setManualARV(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ mr: 2, flexGrow: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleManualARVUpdate}
                  disabled={!manualARV}
                >
                  Update
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Override the calculated ARV if you have better information about the market.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Address</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'saleDate'}
                  direction={sortDirection}
                  onClick={() => handleSort('saleDate')}
                >
                  Sale Date
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'salePrice'}
                  direction={sortDirection}
                  onClick={() => handleSort('salePrice')}
                >
                  Sale Price
                </TableSortLabel>
              </TableCell>
              <TableCell>Bed/Bath</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'sqft'}
                  direction={sortDirection}
                  onClick={() => handleSort('sqft')}
                >
                  Sqft
                </TableSortLabel>
              </TableCell>
              <TableCell>$/Sqft</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'distanceMi'}
                  direction={sortDirection}
                  onClick={() => handleSort('distanceMi')}
                >
                  Distance
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'adjustedPrice'}
                  direction={sortDirection}
                  onClick={() => handleSort('adjustedPrice')}
                >
                  Adjusted
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Include</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedComparables.map((comp, index) => {
              const isExcluded = excludedComps.includes(comp.address);
              
              return (
                <React.Fragment key={index}>
                  <TableRow 
                    sx={{ 
                      backgroundColor: isExcluded ? 'rgba(255,0,0,0.05)' : 'inherit',
                      '&:hover': { 
                        backgroundColor: isExcluded ? 'rgba(255,0,0,0.1)' : 'rgba(0,0,0,0.04)' 
                      }
                    }}
                  >
                    <TableCell 
                      component="th" 
                      scope="row"
                      sx={{ 
                        textDecoration: isExcluded ? 'line-through' : 'none',
                        color: isExcluded ? 'text.disabled' : 'text.primary'
                      }}
                    >
                      {comp.address}
                    </TableCell>
                    <TableCell>{formatDate(comp.saleDate)}</TableCell>
                    <TableCell>{formatCurrency(comp.salePrice)}</TableCell>
                    <TableCell>{comp.beds}/{comp.baths}</TableCell>
                    <TableCell>{comp.sqft.toLocaleString()}</TableCell>
                    <TableCell>{formatCurrency(comp.sqft ? comp.salePrice / comp.sqft : 0)}</TableCell>
                    <TableCell>{comp.distanceMi.toFixed(1)} mi</TableCell>
                    <TableCell>{formatCurrency(comp.adjustedPrice)}</TableCell>
                    <TableCell align="center">
                      {onExcludeComp && (
                        <IconButton 
                          size="small" 
                          color={isExcluded ? 'default' : 'success'}
                          onClick={() => onExcludeComp(comp.address, !isExcluded)}
                        >
                          {isExcluded ? <CloseIcon /> : <CheckIcon />}
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Adjustments row, if any */}
                  {showAdjustments && comp.adjustments && comp.adjustments.length > 0 && (
                    <TableRow 
                      sx={{ 
                        backgroundColor: isExcluded ? 'rgba(255,0,0,0.02)' : 'rgba(0,0,0,0.02)'
                      }}
                    >
                      <TableCell colSpan={9} size="small">
                        <Box sx={{ pl: 3, py: 1 }}>
                          <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                            Adjustments:
                          </Typography>
                          <Grid container spacing={1}>
                            {comp.adjustments.map((adj, i) => (
                              <Grid key={i}>
                                <Chip 
                                  size="small" 
                                  label={`${adj.label}: ${formatCurrency(adj.amount)}`} 
                                  variant="outlined"
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          size="small" 
          onClick={() => setShowAdjustments(!showAdjustments)}
        >
          {showAdjustments ? 'Hide Adjustments' : 'Show Adjustments'}
        </Button>
        
        <Typography variant="body2" color="text.secondary">
          {comparables.length} properties found
        </Typography>
      </Box>
    </Box>
  );
};

export default ComparablePropertiesViewer;

