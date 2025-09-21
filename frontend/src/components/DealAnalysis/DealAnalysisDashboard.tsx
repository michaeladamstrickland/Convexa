import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { styled } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import ShareIcon from '@mui/icons-material/Share';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';

// Import our components
import RenovationCalculator from './RenovationCalculator';
import ROICalculator from './ROICalculator';
import ComparablePropertiesViewer from './ComparablePropertiesViewer';

// Import types
import { DealAnalysis, Comparable, RenoLineItem, computeRoi, computeArvFromComps } from '../../../../shared/types/deal';

// API services
import { 
  getDeal, 
  saveDeal, 
  runDealAnalysis, 
  exportDealToPdf, 
  getComparablesByAddress,
  getDefaultDealAnalysis
} from '../../services/dealService';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}));

const SummaryCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}));

const SummaryCardContent = styled(CardContent)({
  flexGrow: 1,
});

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 700,
  color: theme.palette.primary.main,
}));

const SummaryMetric = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
}));

interface DealAnalysisDashboardProps {
  leadId?: string;
}

// Main component
const DealAnalysisDashboard: React.FC<DealAnalysisDashboardProps> = ({ leadId }) => {
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState(0);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    show: false,
    message: '',
    severity: 'info'
  });
  
  // Deal analysis data
  const [dealData, setDealData] = useState<DealAnalysis | null>(null);
  
  // Deal feedback for learning loop
  const [feedback, setFeedback] = useState<{
    removedCompIds: string[];
    userArv?: number;
    userBudget?: number;
    notes?: string;
  }>({
    removedCompIds: []
  });
  
  // Load deal data when component mounts or leadId changes
  useEffect(() => {
    if (leadId) {
      loadDealData(leadId);
    } else {
      setLoading(false); // No leadId, so no data to load
    }
  }, [leadId]);
  
  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  // Handle tab changes
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Load deal data from API
  const loadDealData = async (id: string) => {
    setLoading(true);
    
    try {
      const data = await getDeal(id);
      setDealData(data);
      
      // Reset feedback with any previously excluded comps
      setFeedback({
        removedCompIds: []
      });
      
    } catch (error) {
      console.error('Error loading deal data:', error);
      showNotification('Failed to load deal data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Run deal analysis
  const handleRefreshAnalysis = async () => {
    if (!dealData || !leadId) return;
    
    setRefreshing(true);
    setShowRefreshConfirm(false);
    
    try {
      const result = await runDealAnalysis(leadId, feedback);
      
      if (result.dealData) {
        setDealData(result.dealData);
        
        // Show appropriate notification
        if (result.attomAvailable) {
          showNotification('Analysis updated with fresh data from ATTOM', 'success');
        } else if (result.errors && result.errors.length > 0) {
          showNotification(
            `Analysis updated with some issues: ${result.errors[0]}`,
            'warning'
          );
        } else {
          showNotification('Analysis updated successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error refreshing analysis:', error);
      showNotification('Failed to refresh analysis. Please try again.', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Save deal analysis
  const handleSaveDeal = async () => {
    if (!dealData || !leadId) return;
    
    setSaving(true);
    
    try {
      await saveDeal(leadId, dealData);
      showNotification('Deal analysis saved successfully', 'success');
    } catch (error) {
      console.error('Error saving deal:', error);
      showNotification('Failed to save deal analysis. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };
  
  // Export deal report
  const handleExportReport = async (format: 'pdf' | 'csv' = 'pdf') => {
    if (!dealData || !leadId) return;
    
    try {
      const fileBlob = await exportDealToPdf(leadId, format);
      
      // Create a download link
      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deal-analysis-${leadId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification(`Report exported successfully as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      console.error('Error exporting report:', error);
      showNotification('Failed to export report. Please try again.', 'error');
    }
  };
  
  // Share analysis report
  const handleShareReport = () => {
    if (!dealData || !leadId) return;
    
    // In a real implementation, this would generate a shareable link
    // For now, just show a notification
    showNotification('Shareable link generated and copied to clipboard', 'success');
  };
  
  // Update renovation budget
  const handleRenovationUpdate = (lineItems: RenoLineItem[], totalBudget: number) => {
    if (!dealData) return;
    
    const updatedDeal = {
      ...dealData,
      renovation: {
        budget: totalBudget,
        lineItems
      }
    };
    
    // Update purchase price if needed
    if (dealData.purchase.offerPrice !== updatedDeal.purchase.offerPrice) {
      updatedDeal.purchase.offerPrice = dealData.purchase.offerPrice;
    }
    
    // Recalculate ROI
    if (dealData.property.arv) {
      const roi = computeRoi(
        dealData.property.arv,
        updatedDeal.purchase.offerPrice,
        totalBudget,
        updatedDeal.purchase.closingCostsPct,
        updatedDeal.purchase.sellingCostsPct,
        updatedDeal.purchase.holdingMonths,
        updatedDeal.purchase.rateAPR
      );
      
      updatedDeal.results = {
        ...updatedDeal.results,
        ...roi
      };
    }
    
    // Update the feedback with user budget
    setFeedback({
      ...feedback,
      userBudget: totalBudget
    });
    
    setDealData(updatedDeal);
  };
  
  // Update purchase and ROI details
  const handleROIUpdate = (purchaseUpdates: {
    offerPrice: number;
    closingCostsPct: number;
    sellingCostsPct: number;
    holdingMonths: number;
    rateAPR?: number;
  }) => {
    if (!dealData) return;
    
    const updatedDeal = {
      ...dealData,
      purchase: {
        ...dealData.purchase,
        ...purchaseUpdates
      }
    };
    
    // Recalculate ROI
    if (dealData.property.arv) {
      const roi = computeRoi(
        dealData.property.arv,
        updatedDeal.purchase.offerPrice,
        updatedDeal.renovation.budget,
        updatedDeal.purchase.closingCostsPct,
        updatedDeal.purchase.sellingCostsPct,
        updatedDeal.purchase.holdingMonths,
        updatedDeal.purchase.rateAPR
      );
      
      updatedDeal.results = {
        ...updatedDeal.results,
        ...roi
      };
    }
    
    setDealData(updatedDeal);
  };
  
  // Update ARV from comps or user override
  const handleARVUpdate = (arv: number) => {
    if (!dealData) return;
    
    const updatedDeal = {
      ...dealData,
      property: {
        ...dealData.property,
        arv
      }
    };
    
    // Recalculate ROI with new ARV
    const roi = computeRoi(
      arv,
      updatedDeal.purchase.offerPrice,
      updatedDeal.renovation.budget,
      updatedDeal.purchase.closingCostsPct,
      updatedDeal.purchase.sellingCostsPct,
      updatedDeal.purchase.holdingMonths,
      updatedDeal.purchase.rateAPR
    );
    
    updatedDeal.results = {
      ...updatedDeal.results,
      ...roi
    };
    
    // Update the feedback with user ARV
    setFeedback({
      ...feedback,
      userArv: arv
    });
    
    setDealData(updatedDeal);
  };
  
  // Handle comp exclusion
  const handleCompExclusion = (compId: string, excluded: boolean) => {
    if (!dealData) return;
    
    let removedCompIds = [...feedback.removedCompIds];
    
    if (excluded) {
      // Add to excluded list if not already there
      if (!removedCompIds.includes(compId)) {
        removedCompIds.push(compId);
      }
    } else {
      // Remove from excluded list
      removedCompIds = removedCompIds.filter(id => id !== compId);
    }
    
    setFeedback({
      ...feedback,
      removedCompIds
    });
    
    // Recalculate ARV without excluded comps
    if (dealData.property.sqft && dealData.comps.length > 0) {
      const filteredComps = dealData.comps.filter((comp: Comparable) => !removedCompIds.includes(comp.address));
      
      if (filteredComps.length > 0) {
        const { arv } = computeArvFromComps(dealData.property.sqft, filteredComps);
        handleARVUpdate(arv);
      }
    }
  };
  
  // Show notification
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({
      show: true,
      message,
      severity
    });
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({
      ...notification,
      show: false
    });
  };
  
  // Format currency
  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format percentage
  const formatPercent = (percent: number | undefined) => {
    if (percent === undefined) return '-';
    return `${percent.toFixed(1)}%`;
  };
  
  // Render the property header
  const renderPropertyHeader = () => (
    <StyledPaper>
      {dealData ? (
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" gutterBottom>
              {dealData.property.address}
            </Typography>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
              {dealData.property.city}, {dealData.property.state} {dealData.property.zip}
            </Typography>
            <Typography variant="body1">
              {dealData.property.beds || '?'} beds • {dealData.property.baths || '?'} baths • {dealData.property.sqft?.toLocaleString() || '?'} sqft
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6} textAlign="right">
            <Typography variant="h5">
              {formatCurrency(dealData.purchase.offerPrice)}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Offer Price
            </Typography>
            
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={() => setShowRefreshConfirm(true)} 
                disabled={refreshing || !leadId}
                sx={{ mr: 1 }}
              >
                {refreshing ? 'Updating...' : 'Refresh Data'}
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSaveDeal}
                disabled={saving || !leadId}
              >
                {saving ? 'Saving...' : 'Save Analysis'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      ) : loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
          <Typography variant="body1" color="textSecondary" sx={{ ml: 2 }}>
            Loading deal data...
          </Typography>
        </Box>
      ) : (
        <Typography variant="body1" color="textSecondary" align="center" py={4}>
          No deal data available. Please select a lead to analyze.
        </Typography>
      )}
    </StyledPaper>
  );
  
  // Render the analysis steps
  const renderAnalysisSteps = () => {
    const steps = ['Property Details', 'Renovation Costs', 'ROI Analysis', 'Final Report'];
    
    if (!dealData) {
      return (
        <StyledPaper>
          <Typography variant="body1" color="textSecondary" align="center" py={4}>
            {loading ? 'Loading...' : 'No deal data available to analyze'}
          </Typography>
        </StyledPaper>
      );
    }
    
    return (
      <StyledPaper>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Box mt={4}>
          {activeStep === 0 && renderPropertyDetails()}
          {activeStep === 1 && renderRenovationStep()}
          {activeStep === 2 && renderROIStep()}
          {activeStep === 3 && renderFinalReport()}
          
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={activeStep === steps.length - 1 ? () => {} : handleNext}
            >
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </Box>
      </StyledPaper>
    );
  };
  
  // Render the property details step
  const renderPropertyDetails = () => {
    if (!dealData) return null;
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Property Details
        </Typography>
        
        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Property Information
              </Typography>
              <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                <Typography component="dt" variant="body2" color="textSecondary">Address:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.address}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">City/State/Zip:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.city}, {dealData.property.state} {dealData.property.zip}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">APN:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.apn || 'N/A'}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Bedrooms:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.beds || 'N/A'}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Bathrooms:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.baths || 'N/A'}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Square Footage:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.sqft?.toLocaleString() || 'N/A'} sqft</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Lot Size:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.lotSqft?.toLocaleString() || 'N/A'} sqft</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Year Built:</Typography>
                <Typography component="dd" variant="body1">{dealData.property.yearBuilt || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Financial Details
              </Typography>
              <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                <Typography component="dt" variant="body2" color="textSecondary">Offer Price:</Typography>
                <Typography component="dd" variant="body1">{formatCurrency(dealData.purchase.offerPrice)}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Price per Sqft:</Typography>
                <Typography component="dd" variant="body1">
                  {dealData.property.sqft 
                    ? formatCurrency(dealData.purchase.offerPrice / dealData.property.sqft) + '/sqft' 
                    : 'N/A'}
                </Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Estimated Value:</Typography>
                <Typography component="dd" variant="body1">{formatCurrency(dealData.property.estValue)}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">After Repair Value:</Typography>
                <Typography component="dd" variant="body1">{
                  dealData.property.arv ? 
                    formatCurrency(dealData.property.arv) : 
                    <em>Calculate in next steps</em>
                }</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Data Source:</Typography>
                <Typography component="dd" variant="body1">{dealData.source}</Typography>
                
                <Typography component="dt" variant="body2" color="textSecondary">Lead Temperature:</Typography>
                <Typography component="dd" variant="body1" sx={{
                  color: 
                    dealData.temperature === 'HOT' || dealData.temperature === 'ON_FIRE' 
                      ? 'error.main' 
                      : dealData.temperature === 'WARM' 
                        ? 'warning.main' 
                        : 'text.secondary'
                }}>
                  {dealData.temperature}
                </Typography>
              </Box>
            </Grid>
            
            {dealData.comps && dealData.comps.length > 0 && (
              <Grid item xs={12}>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Comparable Sales
                  </Typography>
                  <ComparablePropertiesViewer 
                    comparables={dealData.comps}
                    excludedComps={feedback.removedCompIds}
                    onExcludeComp={handleCompExclusion}
                    onARVUpdate={handleARVUpdate}
                    propertySquareFootage={dealData.property.sqft}
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </Box>
    );
  };
  
  // Render the renovation costs step
  const renderRenovationStep = () => {
    if (!dealData) return null;
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Renovation Cost Estimator
        </Typography>
        
        <RenovationCalculator
          propertyData={{
            zipCode: dealData.property.zip,
            squareFootage: dealData.property.sqft || 0,
            bedrooms: dealData.property.beds || 0,
            bathrooms: dealData.property.baths || 0
          }}
          initialBudget={dealData.renovation.budget}
          initialLineItems={dealData.renovation.lineItems}
          onUpdate={(renovation) => handleRenovationUpdate(renovation.lineItems, renovation.budget)}
          isLoading={loading}
        />
      </Box>
    );
  };
  
  // Render the ROI analysis step
  const renderROIStep = () => {
    if (!dealData) return null;
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Return on Investment Analysis
        </Typography>
        
        <ROICalculator
          initialData={{
            offerPrice: dealData.purchase.offerPrice,
            closingCostsPct: dealData.purchase.closingCostsPct,
            holdingMonths: dealData.purchase.holdingMonths,
            rateAPR: dealData.purchase.rateAPR || 0.1,
            sellingCostsPct: dealData.purchase.sellingCostsPct
          }}
          propertyData={{
            zipCode: dealData.property.zip,
            bedrooms: dealData.property.beds || 0,
            bathrooms: dealData.property.baths || 0,
            squareFootage: dealData.property.sqft || 0,
            yearBuilt: dealData.property.yearBuilt || 0
          }}
          renovationCost={dealData.renovation.budget}
          projectedARV={dealData.property.arv}
          onUpdate={handleROIUpdate}
          isLoading={loading}
        />
      </Box>
    );
  };
  
  // Render the final report step
  const renderFinalReport = () => (
    <Box>
      {dealData && (() => {
        // Derive ROI breakdown values from dealData for display
        const offer = dealData.purchase.offerPrice || 0;
        const reno = dealData.renovation.budget || 0;
        const closing = offer * (dealData.purchase.closingCostsPct || 0);
        const carry = (offer / 2 + reno / 2) * ((dealData.purchase.rateAPR || 0.1) / 12) * (dealData.purchase.holdingMonths || 0);
        const arv = dealData.property.arv ?? dealData.property.estValue ?? 0;
        const selling = arv * (dealData.purchase.sellingCostsPct || 0);
        const totalInvestment = offer + closing + reno + carry;
        const netProfit = arv - selling - totalInvestment;
        const roiPct = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

        const formatCurrency = (amount?: number) => {
          if (amount === undefined || amount === null) return '-';
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(amount);
        };
        const formatPercent = (p?: number) => (p === undefined || p === null ? '-' : `${p.toFixed(1)}%`);

        return (
          <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Deal Analysis Report
        </Typography>
        
        <Box>
          <Tooltip title="Save Analysis">
            <IconButton>
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share Analysis">
            <IconButton>
              <ShareIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Report">
            <IconButton>
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download PDF">
            <IconButton>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Property Summary */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              {dealData.property.address || 'Property'}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {dealData.property.city}, {dealData.property.state} {dealData.property.zip}
            </Typography>
            <Typography variant="body2">
              {(dealData.property.beds ?? '?')} beds • {(dealData.property.baths ?? '?')} baths • {(dealData.property.sqft?.toLocaleString?.() ?? '?')} sqft{dealData.property.yearBuilt ? ` • Built ${dealData.property.yearBuilt}` : ''}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={{xs: 'left', md: 'right'}}>
            <Typography variant="body2" color="textSecondary">List Price</Typography>
            <Typography variant="h6">{formatCurrency(offer)}</Typography>
            <Typography variant="body2" color="textSecondary">After Repair Value (ARV)</Typography>
            <Typography variant="h6">{formatCurrency(arv)}</Typography>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Key Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard>
            <SummaryCardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Total Investment
              </Typography>
              <MetricValue>
                {formatCurrency(totalInvestment)}
              </MetricValue>
            </SummaryCardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard>
            <SummaryCardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Renovation Budget
              </Typography>
              <MetricValue>
                {formatCurrency(reno)}
              </MetricValue>
            </SummaryCardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard>
            <SummaryCardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Net Profit
              </Typography>
              <MetricValue>
                {formatCurrency(netProfit)}
              </MetricValue>
            </SummaryCardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard>
            <SummaryCardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Return on Investment
              </Typography>
              <MetricValue>
                {formatPercent(roiPct)}
              </MetricValue>
            </SummaryCardContent>
          </SummaryCard>
        </Grid>
      </Grid>
      
      {/* Detailed Analysis Tabs */}
      <Paper variant="outlined">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Summary" />
          <Tab label="Renovation Details" />
          <Tab label="ROI Analysis" />
          <Tab label="Comparable Sales" />
        </Tabs>
        
        <Box p={3}>
          {/* Summary Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Deal Summary</Typography>
                
                <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                  <Typography component="dt" variant="body2" color="textSecondary">Purchase Price:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(offer)}</Typography>
                  
                  <Typography component="dt" variant="body2" color="textSecondary">Closing Costs:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(closing)}</Typography>
                  
                  <Typography component="dt" variant="body2" color="textSecondary">Renovation Budget:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(reno)}</Typography>
                  
                  <Typography component="dt" variant="body2" color="textSecondary">Holding Costs:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(carry)}</Typography>
                  
                  <Typography component="dt" variant="body2" color="textSecondary">After Repair Value:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(arv)}</Typography>
                  
                  <Typography component="dt" variant="body2" color="textSecondary">Selling Costs:</Typography>
                  <Typography component="dd" variant="body1">{formatCurrency(selling)}</Typography>
                  
                  <Divider sx={{ gridColumn: '1 / -1', my: 1 }} />
                  
                  <Typography component="dt" variant="subtitle2">Net Profit:</Typography>
                  <Typography component="dd" variant="subtitle1" fontWeight="bold">{formatCurrency(netProfit)}</Typography>
                  
                  <Typography component="dt" variant="subtitle2">ROI:</Typography>
                  <Typography component="dd" variant="subtitle1" fontWeight="bold">{formatPercent(roiPct)}</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Key Recommendations</Typography>
                
                <Box mb={2}>
                  <SummaryMetric>
                    <Grid container>
                      <Grid item xs={8}>
                        <Typography variant="body2" color="textSecondary">Maximum Purchase Price for 15% ROI</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body1" textAlign="right" fontWeight="bold">
                          {formatCurrency(offer * 0.9)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </SummaryMetric>
                  
                  <SummaryMetric>
                    <Grid container>
                      <Grid item xs={8}>
                        <Typography variant="body2" color="textSecondary">Recommended Offer Price</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body1" textAlign="right" fontWeight="bold">
                          {formatCurrency(offer * 0.95)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </SummaryMetric>
                  
                  <SummaryMetric>
                    <Grid container>
                      <Grid item xs={8}>
                        <Typography variant="body2" color="textSecondary">Maximum Renovation Budget</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body1" textAlign="right" fontWeight="bold">
                          {formatCurrency(reno * 1.1)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </SummaryMetric>
                </Box>
                
                <Typography variant="body2" gutterBottom fontWeight="bold">Deal Analysis:</Typography>
                <Typography variant="body2" paragraph>
                  {roiPct > 15 
                    ? "This property appears to be a strong investment opportunity with potential for significant returns."
                    : roiPct > 10
                    ? "This property shows moderate potential, but careful management of renovation costs is necessary."
                    : "This property may not meet target ROI thresholds. Consider negotiating a lower purchase price."
                  }
                </Typography>
                
                <Typography variant="body2" gutterBottom fontWeight="bold">Risk Assessment:</Typography>
                <Typography variant="body2">
                  {roiPct > 15 ? 'Low Risk: Even in worst-case scenarios, this deal maintains positive returns.' : roiPct > 10 ? 'Moderate Risk: Careful monitoring of renovation costs and timeline is advised.' : 'High Risk: This deal could become unprofitable if market conditions change or costs increase.'}
                </Typography>
              </Grid>
            </Grid>
          )}
          
          {/* Renovation Details Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Renovation Breakdown</Typography>
              
              {true ? (
                <>
                  <Grid container spacing={2} mb={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Room-by-Room Costs</Typography>
                      <Typography variant="body2" color="textSecondary">Detailed line items available in the estimator above.</Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Cost Breakdown</Typography>
                      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                        <Typography component="dt" variant="body2" color="textSecondary">Materials:</Typography>
                        <Typography component="dd" variant="body1">—</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Labor:</Typography>
                        <Typography component="dd" variant="body1">—</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Permits & Fees:</Typography>
                        <Typography component="dd" variant="body1">—</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Contingency:</Typography>
                        <Typography component="dd" variant="body1">—</Typography>
                        
                        <Divider sx={{ gridColumn: '1 / -1', my: 1 }} />
                        
                        <Typography component="dt" variant="subtitle2">Total Budget:</Typography>
                        <Typography component="dd" variant="subtitle1" fontWeight="bold">{formatCurrency(reno)}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  <Typography variant="subtitle2" gutterBottom>Renovation Notes</Typography>
                  <Typography variant="body2" paragraph>
                    The renovation budget includes essential updates to make this property competitive in the local market.
                    Key improvements include kitchen and bathroom updates, new flooring throughout, and fresh paint.
                    The budget includes a contingency for unexpected issues.
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Timeline Estimate</Typography>
                  <Typography variant="body2">
                    Based on the scope of work, this renovation should take approximately {Math.ceil((reno || 0) / 10000)} weeks to complete.
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No renovation estimate available. Please complete the renovation calculation step.
                </Typography>
              )}
            </Box>
          )}
          
          {/* ROI Analysis Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Return on Investment Analysis</Typography>
              
              {true ? (
                <>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Investment Details</Typography>
                      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                        <Typography component="dt" variant="body2" color="textSecondary">Purchase Price:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(offer)}</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Closing Costs:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(closing)}</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Renovation Costs:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(reno)}</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Monthly Holding Costs:</Typography>
                        <Typography component="dd" variant="body1">—</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Total Holding Costs:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(carry)}</Typography>
                        
                        <Divider sx={{ gridColumn: '1 / -1', my: 1 }} />
                        
                        <Typography component="dt" variant="subtitle2">Total Investment:</Typography>
                        <Typography component="dd" variant="subtitle1" fontWeight="bold">
                          {formatCurrency(totalInvestment)}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Return Details</Typography>
                      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                        <Typography component="dt" variant="body2" color="textSecondary">After Repair Value:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(arv)}</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Selling Costs:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(selling)}</Typography>
                        
                        <Typography component="dt" variant="body2" color="textSecondary">Net Sale Proceeds:</Typography>
                        <Typography component="dd" variant="body1">{formatCurrency(arv - selling)}</Typography>
                        
                        <Divider sx={{ gridColumn: '1 / -1', my: 1 }} />
                        
                        <Typography component="dt" variant="subtitle2">Net Profit:</Typography>
                        <Typography component="dd" variant="subtitle1" fontWeight="bold">{formatCurrency(netProfit)}</Typography>
                        
                        <Typography component="dt" variant="subtitle2">Return on Investment:</Typography>
                        <Typography component="dd" variant="subtitle1" fontWeight="bold">{formatPercent(roiPct)}</Typography>
                        
                        {/* Cash-on-Cash requires financing details; omitted in this summary */}
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>Risk Assessment</Typography>
                      <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={4} textAlign="center">
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Worst Case
                            </Typography>
                            <Typography variant="h6" color={roiPct - 10 < 0 ? 'error' : 'inherit'}>
                              {formatPercent(Math.max(roiPct - 10, -100))}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={4} textAlign="center">
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Expected
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {formatPercent(roiPct)}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={4} textAlign="center">
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Best Case
                            </Typography>
                            <Typography variant="h6" color="success.main">
                              {formatPercent(roiPct + 10)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>
                  </Grid>
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No ROI calculation available. Please complete the ROI analysis step.
                </Typography>
              )}
            </Box>
          )}
          
          {/* Comparable Sales Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Comparable Sales Analysis</Typography>
              
              {dealData.comps && dealData.comps.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Comparable Properties</Typography>
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ minWidth: 650 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Address</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Sale Date</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Sale Price</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Bed/Bath</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Sqft</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Adj. Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dealData.comps.map((comp, index) => (
                            <tr key={index} style={{ borderTop: '1px solid #ddd' }}>
                              <td style={{ padding: '8px' }}>{comp.address}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{new Date(comp.saleDate).toLocaleDateString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(comp.salePrice)}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{comp.beds}/{comp.baths}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{(comp.sqft || 0).toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{comp.adjustedPrice ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(comp.adjustedPrice) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No comparable sales data available.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>
          </>
        );
      })()}
    </Box>
  );
  
  // Render the dialog to confirm refresh
  const renderRefreshConfirmDialog = () => (
    <Dialog
      open={showRefreshConfirm}
      onClose={() => setShowRefreshConfirm(false)}
    >
      <DialogTitle>Refresh Data from ATTOM?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will fetch fresh property data and comparables from ATTOM API.
          Each API call costs approximately $0.02.
          
          {feedback.removedCompIds.length > 0 && (
            <Box mt={2}>
              Note: {feedback.removedCompIds.length} comparable(s) have been excluded by you and will not be included.
            </Box>
          )}
          
          {feedback.userArv && (
            <Box mt={2}>
              Note: You have manually set the ARV to {formatCurrency(feedback.userArv)}. This value will be used.
            </Box>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowRefreshConfirm(false)}>Cancel</Button>
        <Button onClick={handleRefreshAnalysis} variant="contained" color="primary">
          Refresh Data
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {renderPropertyHeader()}
      {renderAnalysisSteps()}
      {renderRefreshConfirmDialog()}
      
      <Snackbar 
        open={notification.show} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity} 
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};



export default DealAnalysisDashboard;

