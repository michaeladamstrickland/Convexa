import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Grid,
  TextField,
  Slider,
  Button,
  Box,
  Paper,
  InputAdornment,
  Divider,
  Alert,
  Stack,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  BarChart,
  Calculate,
  TrendingUp,
  ConstructionOutlined,
  HomeOutlined,
  MonetizationOnOutlined
} from '@mui/icons-material';
import { formatCurrency } from './utils/formatters';

/**
 * PropertySalePotentialCalculator component
 * Helps investors calculate potential profit and ROI for a property
 * 
 * @param {Object} props
 * @param {number} props.currentValue - Current property value
 * @param {number} props.lastSalePrice - Last sale price
 * @param {string} props.lastSaleDate - Last sale date
 * @param {number} props.yearBuilt - Year property was built
 * @param {number} props.squareFeet - Square footage
 * @param {number} props.bedrooms - Number of bedrooms
 * @param {number} props.bathrooms - Number of bathrooms
 * @returns {JSX.Element}
 */
const PropertySalePotentialCalculator = ({
  currentValue,
  lastSalePrice,
  lastSaleDate,
  yearBuilt,
  squareFeet,
  bedrooms,
  bathrooms
}) => {
  const [calculationType, setCalculationType] = useState('flip');
  const [purchasePrice, setPurchasePrice] = useState(currentValue ? Math.round(currentValue * 0.8) : 0);
  const [rehabBudget, setRehabBudget] = useState(currentValue ? Math.round(currentValue * 0.1) : 0);
  const [arv, setArv] = useState(currentValue ? Math.round(currentValue * 1.2) : 0);
  const [holdingCosts, setHoldingCosts] = useState(currentValue ? Math.round(currentValue * 0.02) : 0);
  const [sellingCosts, setSellingCosts] = useState(currentValue ? Math.round(currentValue * 0.06) : 0);
  const [rehabLevel, setRehabLevel] = useState('medium');
  const [monthlyRent, setMonthlyRent] = useState(currentValue ? Math.round(currentValue * 0.008) : 0);
  const [vacancy, setVacancy] = useState(5);
  const [managementFee, setManagementFee] = useState(8);
  const [maintenancePercent, setMaintenancePercent] = useState(5);
  const [propertyTaxes, setPropertyTaxes] = useState(currentValue ? Math.round(currentValue * 0.01) : 0);
  const [insurance, setInsurance] = useState(currentValue ? Math.round(currentValue * 0.005) : 0);
  const [downPaymentPercent, setDownPaymentPercent] = useState(25);
  const [interestRate, setInterestRate] = useState(4.5);
  const [loanTerm, setLoanTerm] = useState(30);
  
  // Results state
  const [results, setResults] = useState({
    profit: 0,
    roi: 0,
    costPerSqFt: 0,
    arvPerSqFt: 0,
    capRate: 0,
    cashFlow: 0,
    cashOnCash: 0,
    totalInvestment: 0
  });
  
  const handleCalculationTypeChange = (event, newType) => {
    if (newType !== null) {
      setCalculationType(newType);
    }
  };
  
  const handleRehabLevelChange = (event, newLevel) => {
    if (newLevel === null) {
      return;
    }
    
    setRehabLevel(newLevel);
    
    // Adjust rehab budget based on level
    const rehabCostPerSqFt = 
      newLevel === 'light' ? 15 :
      newLevel === 'medium' ? 30 :
      newLevel === 'heavy' ? 50 : 30;
    
    setRehabBudget(Math.round(squareFeet * rehabCostPerSqFt));
    
    // Adjust ARV based on rehab level
    const arvMultiplier = 
      newLevel === 'light' ? 1.1 :
      newLevel === 'medium' ? 1.2 :
      newLevel === 'heavy' ? 1.35 : 1.2;
    
    setArv(Math.round(currentValue * arvMultiplier));
  };
  
  // Calculate results whenever inputs change
  useEffect(() => {
    if (calculationType === 'flip') {
      // Fix & Flip calculations
      const totalCosts = purchasePrice + rehabBudget + holdingCosts + sellingCosts;
      const profit = arv - totalCosts;
      const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
      
      setResults({
        profit,
        roi,
        costPerSqFt: squareFeet ? rehabBudget / squareFeet : 0,
        arvPerSqFt: squareFeet ? arv / squareFeet : 0,
        totalInvestment: totalCosts
      });
    } else {
      // Rental calculations
      const yearlyRent = monthlyRent * 12;
      const vacancyLoss = yearlyRent * (vacancy / 100);
      const managementFees = yearlyRent * (managementFee / 100);
      const maintenanceCosts = yearlyRent * (maintenancePercent / 100);
      const annualExpenses = vacancyLoss + managementFees + maintenanceCosts + propertyTaxes + insurance;
      const netOperatingIncome = yearlyRent - annualExpenses;
      
      const downPayment = purchasePrice * (downPaymentPercent / 100);
      const loanAmount = purchasePrice - downPayment;
      const monthlyInterestRate = interestRate / 100 / 12;
      const numberOfPayments = loanTerm * 12;
      const monthlyMortgagePayment = loanAmount * 
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / 
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
      const annualMortgagePayment = monthlyMortgagePayment * 12;
      
      const cashFlow = netOperatingIncome - annualMortgagePayment;
      const capRate = purchasePrice > 0 ? (netOperatingIncome / purchasePrice) * 100 : 0;
      const totalInvestment = downPayment + rehabBudget;
      const cashOnCash = totalInvestment > 0 ? (cashFlow / totalInvestment) * 100 : 0;
      
      setResults({
        cashFlow,
        capRate,
        cashOnCash,
        roi: cashOnCash, // For rental, ROI is the cash on cash return
        profit: cashFlow, // Annual cash flow
        totalInvestment
      });
    }
  }, [
    calculationType, purchasePrice, rehabBudget, arv, holdingCosts, sellingCosts,
    monthlyRent, vacancy, managementFee, maintenancePercent, propertyTaxes, insurance,
    downPaymentPercent, interestRate, loanTerm, squareFeet
  ]);
  
  return (
    <Card elevation={2}>
      <CardHeader 
        title="Investment Potential Calculator" 
        avatar={<Calculate color="primary" />} 
      />
      <CardContent>
        {/* Calculation Type Toggle */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={calculationType}
            exclusive
            onChange={handleCalculationTypeChange}
            color="primary"
          >
            <ToggleButton value="flip">
              <TrendingUp sx={{ mr: 1 }} />
              Fix & Flip
            </ToggleButton>
            <ToggleButton value="rental">
              <HomeOutlined sx={{ mr: 1 }} />
              Rental Analysis
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Grid container spacing={3}>
          {/* Input Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                {calculationType === 'flip' ? 'Flip Analysis Inputs' : 'Rental Analysis Inputs'}
              </Typography>
              
              <Grid container spacing={2}>
                {/* Common inputs for both types */}
                <Grid item xs={12}>
                  <TextField
                    label="Purchase Price"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Rehab Budget"
                    value={rehabBudget}
                    onChange={(e) => setRehabBudget(Number(e.target.value))}
                    fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                
                {/* Rehab Level Selector (both types) */}
                <Grid item xs={12}>
                  <Typography variant="body2" gutterBottom>
                    Rehab Level
                  </Typography>
                  <ToggleButtonGroup
                    value={rehabLevel}
                    exclusive
                    onChange={handleRehabLevelChange}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="light">Light</ToggleButton>
                    <ToggleButton value="medium">Medium</ToggleButton>
                    <ToggleButton value="heavy">Heavy</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary">
                    {rehabLevel === 'light' && 'Cosmetic repairs only (paint, flooring, minor updates)'}
                    {rehabLevel === 'medium' && 'Moderate updates (kitchen, bathrooms, some systems)'}
                    {rehabLevel === 'heavy' && 'Major renovation (full gut, systems replacement, layout changes)'}
                  </Typography>
                </Grid>
                
                {/* Flip-specific inputs */}
                {calculationType === 'flip' && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="After Repair Value (ARV)"
                        value={arv}
                        onChange={(e) => setArv(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        label="Holding Costs"
                        value={holdingCosts}
                        onChange={(e) => setHoldingCosts(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        label="Selling Costs"
                        value={sellingCosts}
                        onChange={(e) => setSellingCosts(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                  </>
                )}
                
                {/* Rental-specific inputs */}
                {calculationType === 'rental' && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="Monthly Rent"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" gutterBottom>
                        Vacancy Rate: {vacancy}%
                      </Typography>
                      <Slider
                        value={vacancy}
                        min={0}
                        max={20}
                        step={1}
                        onChange={(_, value) => setVacancy(value)}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" gutterBottom>
                        Management Fee: {managementFee}%
                      </Typography>
                      <Slider
                        value={managementFee}
                        min={0}
                        max={15}
                        step={1}
                        onChange={(_, value) => setManagementFee(value)}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        label="Property Taxes (annual)"
                        value={propertyTaxes}
                        onChange={(e) => setPropertyTaxes(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        label="Insurance (annual)"
                        value={insurance}
                        onChange={(e) => setInsurance(Number(e.target.value))}
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" gutterBottom>
                        Down Payment: {downPaymentPercent}%
                      </Typography>
                      <Slider
                        value={downPaymentPercent}
                        min={5}
                        max={100}
                        step={5}
                        onChange={(_, value) => setDownPaymentPercent(value)}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" gutterBottom>
                        Interest Rate: {interestRate}%
                      </Typography>
                      <Slider
                        value={interestRate}
                        min={2}
                        max={10}
                        step={0.25}
                        onChange={(_, value) => setInterestRate(value)}
                        size="small"
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Paper>
          </Grid>
          
          {/* Results Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                {calculationType === 'flip' ? 'Flip Analysis Results' : 'Rental Analysis Results'}
              </Typography>
              
              <Stack spacing={2}>
                {/* Primary Result */}
                <Box sx={{ 
                  bgcolor: 'primary.light', 
                  p: 2, 
                  borderRadius: 1, 
                  textAlign: 'center' 
                }}>
                  <Typography variant="subtitle2">
                    {calculationType === 'flip' ? 'Potential Profit' : 'Annual Cash Flow'}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(results.profit)}
                  </Typography>
                  <Typography variant="subtitle1">
                    {calculationType === 'flip' ? 
                      `ROI: ${Math.round(results.roi)}%` : 
                      `Cash on Cash Return: ${Math.round(results.cashOnCash)}%`
                    }
                  </Typography>
                </Box>
                
                {/* Investment Details */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Investment Details
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Total Investment:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(results.totalInvestment)}
                      </Typography>
                    </Grid>
                    
                    {calculationType === 'flip' && (
                      <>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Rehab Cost per SqFt:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(results.costPerSqFt)}/sqft
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            ARV per SqFt:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(results.arvPerSqFt)}/sqft
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Purchase % of ARV:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {arv ? Math.round((purchasePrice / arv) * 100) : 0}%
                          </Typography>
                        </Grid>
                      </>
                    )}
                    
                    {calculationType === 'rental' && (
                      <>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Cap Rate:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {results.capRate.toFixed(2)}%
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Monthly Cash Flow:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(results.cashFlow / 12)}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Annual Gross Rent:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(monthlyRent * 12)}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Gross Rent Multiplier:
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" fontWeight="medium">
                            {monthlyRent > 0 ? (purchasePrice / (monthlyRent * 12)).toFixed(2) : 'N/A'}
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Box>
                
                {/* Investment Quality Indicator */}
                <Alert 
                  severity={
                    calculationType === 'flip' 
                      ? (results.roi >= 20 ? 'success' : results.roi >= 10 ? 'info' : 'warning')
                      : (results.cashOnCash >= 8 ? 'success' : results.cashOnCash >= 5 ? 'info' : 'warning')
                  }
                  icon={<BarChart />}
                >
                  {calculationType === 'flip' 
                    ? (results.roi >= 20 
                        ? 'Excellent flip potential! ROI exceeds 20%.'
                        : results.roi >= 10
                          ? 'Good flip potential with moderate ROI.'
                          : 'Low ROI. Consider negotiating a lower purchase price or reducing rehab costs.')
                    : (results.cashOnCash >= 8
                        ? 'Excellent rental potential! Cash on cash return exceeds 8%.'
                        : results.cashOnCash >= 5
                          ? 'Good rental potential with moderate returns.'
                          : 'Low cash flow. Consider negotiating a lower purchase price or higher rent.')
                  }
                </Alert>
                
                {/* Additional Tips */}
                <Box>
                  <Typography variant="subtitle2">
                    {calculationType === 'flip' ? 'Flip Tips' : 'Rental Tips'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {calculationType === 'flip' 
                      ? 'For maximum profitability, aim to purchase at no more than 70% of ARV minus repairs.'
                      : 'The 1% rule suggests monthly rent should be at least 1% of purchase price for good returns.'
                    }
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default PropertySalePotentialCalculator;
