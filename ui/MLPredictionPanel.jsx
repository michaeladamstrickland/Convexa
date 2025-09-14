// MLPredictionPanel.jsx
// React component for displaying machine learning predictions

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardHeader, 
  CardContent, 
  Typography, 
  CircularProgress,
  Divider,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Score as ScoreIcon,
  Insights as InsightsIcon,
  ContactMail as ContactMailIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

/**
 * Machine Learning Prediction Panel Component
 * Displays ML-based predictions and insights for a property
 */
const MLPredictionPanel = ({ 
  propertyData, 
  onRefresh, 
  onContactStrategyGenerate,
  apiBaseUrl = '/api' 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [contactStrategy, setContactStrategy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load predictions when property data changes
  useEffect(() => {
    if (propertyData && propertyData.id) {
      loadPredictions();
    } else {
      setPredictions(null);
    }
  }, [propertyData?.id]);

  // Load predictions from API
  const loadPredictions = async () => {
    if (!propertyData || !propertyData.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${apiBaseUrl}/properties/${propertyData.id}/predictions`);
      setPredictions(response.data);
    } catch (err) {
      console.error('Failed to load predictions:', err);
      setError('Failed to load property predictions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Refresh predictions
  const handleRefresh = async () => {
    setRefreshing(true);
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/properties/${propertyData.id}/predictions/refresh`
      );
      
      setPredictions(response.data);
      
      if (onRefresh) {
        onRefresh(response.data);
      }
    } catch (err) {
      console.error('Failed to refresh predictions:', err);
      setError('Failed to refresh predictions. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Generate contact strategy
  const handleGenerateContactStrategy = async () => {
    if (!propertyData || !propertyData.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/properties/${propertyData.id}/contact-strategy`
      );
      
      setContactStrategy(response.data);
      
      if (onContactStrategyGenerate) {
        onContactStrategyGenerate(response.data);
      }
    } catch (err) {
      console.error('Failed to generate contact strategy:', err);
      setError('Failed to generate contact strategy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine score color
  const getScoreColor = (score, threshold = 70) => {
    if (score >= threshold) return 'success';
    if (score >= threshold / 2) return 'warning';
    return 'error';
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'N/A';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper function to format percentage
  const formatPercent = (value) => {
    if (!value && value !== 0) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  if (!propertyData) {
    return (
      <Card>
        <CardHeader title="ML Predictions" />
        <CardContent>
          <Typography variant="body2" color="textSecondary">
            Select a property to view predictions.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader 
        title="Machine Learning Insights" 
        action={
          <Button 
            startIcon={<RefreshIcon />}
            disabled={refreshing}
            onClick={handleRefresh}
            size="small"
            variant="outlined"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        }
      />
      
      {loading && !refreshing && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ mt: 2 }}>
            Loading predictions...
          </Typography>
        </Box>
      )}
      
      {refreshing && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
        </Box>
      )}
      
      {error && (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      
      {!loading && predictions && (
        <CardContent>
          {/* Value Estimate Section */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <TrendingUpIcon sx={{ mr: 1 }} /> Value Estimate
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Estimated Value:
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(predictions.valueEstimate?.estimatedValue)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Confidence:
                </Typography>
                <Box display="flex" alignItems="center">
                  <Box sx={{ position: 'relative', display: 'inline-flex', mr: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={predictions.valueEstimate?.confidenceScore * 100 || 0}
                      size={40}
                      color={getScoreColor(predictions.valueEstimate?.confidenceScore * 100 || 0)}
                    />
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" component="div" color="text.secondary">
                        {Math.round(predictions.valueEstimate?.confidenceScore * 100 || 0)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
              
              {predictions.profitPotential && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Potential Profit:
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold"
                      color={predictions.profitPotential.potentialProfit > 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(predictions.profitPotential.potentialProfit)}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      ROI:
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold"
                      color={predictions.profitPotential.returnOnInvestment > 0 ? 'success.main' : 'error.main'}
                    >
                      {formatPercent(predictions.profitPotential.returnOnInvestment)}
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Distress Signals Section */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <WarningIcon sx={{ mr: 1 }} /> Distress Signals
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Distress Score:
                </Typography>
                <Box display="flex" alignItems="center">
                  <Box sx={{ position: 'relative', display: 'inline-flex', mr: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={predictions.distressSignals?.distressScore * 100 || 0}
                      size={40}
                      color={getScoreColor(predictions.distressSignals?.distressScore * 100 || 0, 60)}
                    />
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" component="div" color="text.secondary">
                        {Math.round(predictions.distressSignals?.distressScore * 100 || 0)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Detected Signals:
                </Typography>
                <Box>
                  {predictions.distressSignals?.distressSignals?.length > 0 ? (
                    predictions.distressSignals.distressSignals.map((signal, index) => (
                      <Chip
                        key={index}
                        label={signal}
                        size="small"
                        color="warning"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No distress signals detected
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Lead Score Section */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <ScoreIcon sx={{ mr: 1 }} /> Lead Score
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Total Score:
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {predictions.leadScore?.totalScore?.toFixed(1) || 'N/A'}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Classification:
                </Typography>
                <Chip
                  label={predictions.leadScore?.classification || 'UNKNOWN'}
                  color={
                    predictions.leadScore?.classification === 'HOT' ? 'error' :
                    predictions.leadScore?.classification === 'WARM' ? 'warning' :
                    predictions.leadScore?.classification === 'LUKEWARM' ? 'info' :
                    'default'
                  }
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Key Factors:
                </Typography>
                {predictions.leadScore?.factors?.length > 0 ? (
                  <List dense>
                    {predictions.leadScore.factors.slice(0, 3).map((factor, index) => (
                      <ListItem key={index} disableGutters>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <CheckIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={factor} />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No factors available
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
          
          {/* Contact Strategy Section */}
          <Box mb={2}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <ContactMailIcon sx={{ mr: 1 }} /> Contact Strategy
            </Typography>
            
            {contactStrategy ? (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    Recommended Method:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {contactStrategy.contactStrategy?.recommendedMethod || 'N/A'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Alternative Methods:
                  </Typography>
                  <Box>
                    {contactStrategy.contactStrategy?.alternativeMethods?.map((method, index) => (
                      <Chip
                        key={index}
                        label={method}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Recommended Actions:
                  </Typography>
                  <List dense>
                    {contactStrategy.actionPlan?.actions?.slice(0, 3).map((action, index) => (
                      <ListItem key={index} disableGutters>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <PlayArrowIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={action} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            ) : (
              <Box textAlign="center" py={1}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<InsightsIcon />}
                  onClick={handleGenerateContactStrategy}
                  disabled={loading}
                >
                  Generate Contact Strategy
                </Button>
              </Box>
            )}
          </Box>
          
          <Box textAlign="right">
            <Typography variant="caption" color="textSecondary">
              Last updated: {new Date(predictions.mlTimestamp).toLocaleString()}
            </Typography>
          </Box>
        </CardContent>
      )}
    </Card>
  );
};

export default MLPredictionPanel;
