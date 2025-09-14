import React from 'react';
import { Box, Typography, LinearProgress, Tooltip, Paper } from '@mui/material';
import { formatCurrency, formatDate } from './utils/formatters';

/**
 * Component to display property valuation range with confidence score
 * 
 * @param {Object} props
 * @param {number} props.low - Low-end valuation
 * @param {number} props.value - Current valuation
 * @param {number} props.high - High-end valuation
 * @param {number} props.lastSalePrice - Last sale price
 * @param {string} props.lastSaleDate - Last sale date
 * @param {number} props.confidenceScore - Confidence score (0-100)
 * @returns {JSX.Element}
 */
const PropertyValuationChart = ({ low, value, high, lastSalePrice, lastSaleDate, confidenceScore }) => {
  // Handle case when valuation data is incomplete
  if (!value) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Valuation data is not available for this property.
        </Typography>
      </Box>
    );
  }
  
  // If low and high are not provided, generate default range
  const valuationLow = low || value * 0.9;
  const valuationHigh = high || value * 1.1;
  const range = valuationHigh - valuationLow;
  
  // Calculate position of current value in the range (0-100%)
  const valuePosition = ((value - valuationLow) / range) * 100;
  
  // Calculate position of last sale price in the range (if available)
  const lastSalePosition = lastSalePrice
    ? Math.max(0, Math.min(100, ((lastSalePrice - valuationLow) / range) * 100))
    : null;
  
  // Determine the color for the confidence score
  const getConfidenceColor = (score) => {
    if (!score) return 'grey.500';
    if (score >= 80) return 'success.main';
    if (score >= 60) return 'success.light';
    if (score >= 40) return 'warning.main';
    return 'error.light';
  };

  return (
    <Paper elevation={0} sx={{ p: 1, bgcolor: 'background.default' }}>
      {/* Current value marker */}
      <Box sx={{ position: 'relative', height: 50, mb: 1 }}>
        <Box
          sx={{
            position: 'absolute',
            left: `${valuePosition}%`,
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" fontWeight="bold">Current</Typography>
          <Box
            sx={{
              width: 4,
              height: 20,
              bgcolor: 'primary.main',
              mb: 0.5,
            }}
          />
          <Typography variant="body2" fontWeight="bold">
            {formatCurrency(value)}
          </Typography>
        </Box>
        
        {/* Last sale price marker (if available) */}
        {lastSalePrice && (
          <Box
            sx={{
              position: 'absolute',
              left: `${lastSalePosition}%`,
              bottom: 0,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2">
              {formatCurrency(lastSalePrice)}
            </Typography>
            <Box
              sx={{
                width: 4,
                height: 20,
                bgcolor: 'grey.500',
                mt: 0.5,
              }}
            />
            <Typography variant="caption">
              Last Sale {lastSaleDate ? `(${formatDate(lastSaleDate)})` : ''}
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Valuation range bar */}
      <Box sx={{ position: 'relative', mb: 2 }}>
        <Tooltip title="Valuation range">
          <LinearProgress
            variant="determinate"
            value={100}
            sx={{
              height: 20,
              borderRadius: 1,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.light',
              },
            }}
          />
        </Tooltip>
        
        {/* Confidence score indicator */}
        {confidenceScore && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: getConfidenceColor(confidenceScore),
              }}
            />
            <Typography variant="caption" fontWeight="bold">
              {confidenceScore}% confidence
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Range labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2">{formatCurrency(valuationLow)}</Typography>
        <Typography variant="body2">{formatCurrency(valuationHigh)}</Typography>
      </Box>
      
      {/* Range description */}
      <Typography variant="caption" color="text.secondary">
        This estimate has a valuation range of {formatCurrency(valuationHigh - valuationLow)}.
        {confidenceScore && ` Confidence score: ${confidenceScore}%`}
      </Typography>
    </Paper>
  );
};

export default PropertyValuationChart;
