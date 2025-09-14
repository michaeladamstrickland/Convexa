import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  Switch,
  Slider,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoIcon from '@mui/icons-material/Info';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

import { DealAnalysis, computeRoi } from '../../../shared/types/deal';

// Types
interface ROICalculatorProps {
  initialData?: {
    offerPrice: number;
    closingCostsPct: number;
    holdingMonths: number;
    rateAPR?: number;
    sellingCostsPct: number;
  };
  propertyData: {
    purchasePrice: number;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt?: number;
    estValue?: number;
    arv?: number;
  };
  renovationCost: number;
  projectedARV?: number;
  onUpdate: (purchase: {
    offerPrice: number;
    closingCostsPct: number;
    holdingMonths: number;
    rateAPR?: number;
    sellingCostsPct: number;
  }) => void;
  isLoading?: boolean;
}

interface ROICalculation {
  purchasePrice: number;
  closingCosts: number;
  renovationCosts: number;
  holdingCosts: {
    monthly: number;
    total: number;
  };
  projectedARV: number;
  sellingCosts: number;
  netProfit: number;
  roi: number;
  cashOnCashReturn?: number;
  timelineImpact: {
    bestCase: number;
    expected: number;
    worstCase: number;
  };
}

interface Scenario {
  name: string;
  roi: number;
  profit: number;
  investment: number;
  financing?: {
    downPayment: number;
    loanAmount: number;
    monthlyPayment: number;
  };
}

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}));

const ResultBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  marginTop: theme.spacing(2),
}));

const TabPanel = (props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`roi-tabpanel-${index}`}
      aria-labelledby={`roi-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Main component
const ROICalculator: React.FC<ROICalculatorProps> = ({
  initialData,
  propertyData,
  renovationCost,
  projectedARV,
  onUpdate,
  isLoading = false
}) => {
  // State
  const [useFinancing, setUseFinancing] = useState(initialData?.rateAPR !== undefined);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(initialData?.rateAPR ?? 7.5);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [holdingPeriodMonths, setHoldingPeriodMonths] = useState(initialData?.holdingMonths ?? 6);
  const [monthlyHoldingCost, setMonthlyHoldingCost] = useState(0);
  const [calculatedARV, setCalculatedARV] = useState(projectedARV || propertyData.arv || 0);
  const [sellingCostPercent, setSellingCostPercent] = useState(initialData?.sellingCostsPct ? initialData.sellingCostsPct * 100 : 8);
  const [closingCostPercent, setClosingCostPercent] = useState(initialData?.closingCostsPct ? initialData.closingCostsPct * 100 : 3);
  const [offerPrice, setOfferPrice] = useState(initialData?.offerPrice ?? propertyData.purchasePrice);
  const [currentTab, setCurrentTab] = useState(0);
  
  // ROI results
  const [roiResult, setRoiResult] = useState<ROICalculation>({
    purchasePrice: propertyData.purchasePrice,
    closingCosts: 0,
    renovationCosts: renovationCost,
    holdingCosts: {
      monthly: 0,
      total: 0
    },
    projectedARV: projectedARV || 0,
    sellingCosts: 0,
    netProfit: 0,
    roi: 0,
    timelineImpact: {
      bestCase: 0,
      expected: 0,
      worstCase: 0
    }
  });
  
  // Scenarios for comparison
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  
  // Initialize monthly holding cost based on property price
  useEffect(() => {
    setMonthlyHoldingCost(offerPrice * 0.005); // Default to 0.5% of purchase price
    
    // If no ARV is provided, estimate one (30% over purchase + reno)
    if (!projectedARV && !propertyData.arv) {
      setCalculatedARV(offerPrice * 1.3 + renovationCost);
    }
  }, [offerPrice, renovationCost, projectedARV, propertyData.arv]);
  
  // Update parent component when values change
  useEffect(() => {
    onUpdate({
      offerPrice,
      closingCostsPct: closingCostPercent / 100,
      holdingMonths: holdingPeriodMonths,
      rateAPR: useFinancing ? interestRate / 100 : undefined,
      sellingCostsPct: sellingCostPercent / 100
    });
  }, [
    offerPrice,
    closingCostPercent,
    holdingPeriodMonths,
    useFinancing,
    interestRate,
    sellingCostPercent
  ]);
  
  // Calculate ROI when inputs change
  useEffect(() => {
    calculateROI();
  }, [
    offerPrice,
    renovationCost,
    calculatedARV,
    useFinancing,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    holdingPeriodMonths,
    monthlyHoldingCost,
    sellingCostPercent,
    closingCostPercent,
  ]);
  
  // Handle tab changes
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };
  
  // Calculate mortgage payment
  const calculateMonthlyMortgagePayment = (
    loanAmount: number, 
    rate: number, 
    termYears: number
  ): number => {
    const monthlyRate = rate / 100 / 12;
    const payments = termYears * 12;
    
    return loanAmount * (
      monthlyRate * Math.pow(1 + monthlyRate, payments)
    ) / (
      Math.pow(1 + monthlyRate, payments) - 1
    );
  };
  
  // Calculate ROI
  const calculateROI = () => {
    try {
      // Use shared utility function
      const apr = useFinancing ? interestRate / 100 : 0;
      const closingCosts = offerPrice * (closingCostPercent / 100);
      
      // Calculate financing details if using financing
      let totalInvestment = offerPrice + closingCosts + renovationCost;
      let cashInvested = totalInvestment;
      let monthlyPayment = 0;
      
      if (useFinancing) {
        const downPayment = offerPrice * (downPaymentPercent / 100);
        const loanAmount = offerPrice - downPayment;
        monthlyPayment = calculateMonthlyMortgagePayment(loanAmount, interestRate, loanTermYears);
        
        // Cash invested is now down payment + closing + renovation
        cashInvested = downPayment + closingCosts + renovationCost;
      }
      
      // Calculate holding costs
      const totalMonthlyHolding = useFinancing ? 
        monthlyPayment + monthlyHoldingCost : 
        monthlyHoldingCost;
      
      const totalHoldingCosts = totalMonthlyHolding * holdingPeriodMonths;
      
      // Add holding costs to investments
      totalInvestment += totalHoldingCosts;
      cashInvested += totalHoldingCosts;
      
      // Calculate selling costs
      const sellingCosts = calculatedARV * (sellingCostPercent / 100);
      
      // Calculate profit
      const netProceeds = calculatedARV - sellingCosts;
      
      let netProfit = netProceeds - totalInvestment;
      if (useFinancing) {
        // Adjust for loan payoff
        const loanAmount = offerPrice * (1 - downPaymentPercent / 100);
        netProfit = netProceeds - cashInvested - loanAmount;
      }
      
      // Calculate ROI using our utility function for verification
      const roiUtilResult = computeRoi(
        calculatedARV,
        offerPrice,
        renovationCost,
        closingCostPercent / 100,
        sellingCostPercent / 100,
        holdingPeriodMonths,
        apr
      );
      
      // Use the calculated results but keep our detailed calculations for the UI
      const roi = (netProfit / (useFinancing ? cashInvested : totalInvestment)) * 100;
      
      // Calculate best and worst case scenarios
      const bestCaseARV = calculatedARV * 1.1; // 10% better than expected
      const worstCaseARV = calculatedARV * 0.9; // 10% worse than expected
      
      const bestCaseProfit = bestCaseARV - sellingCostPercent/100*bestCaseARV - totalInvestment;
      const worstCaseProfit = worstCaseARV - sellingCostPercent/100*worstCaseARV - totalInvestment;
      
      const bestCaseROI = (bestCaseProfit / (useFinancing ? cashInvested : totalInvestment)) * 100;
      const worstCaseROI = (worstCaseProfit / (useFinancing ? cashInvested : totalInvestment)) * 100;
      
      const result: ROICalculation = {
        purchasePrice: offerPrice,
        closingCosts,
        renovationCosts: renovationCost,
        holdingCosts: {
          monthly: totalMonthlyHolding,
          total: totalHoldingCosts
        },
        projectedARV: calculatedARV,
        sellingCosts,
        netProfit,
        roi,
        timelineImpact: {
          bestCase: bestCaseROI,
          expected: roi,
          worstCase: worstCaseROI
        }
      };
      
      if (useFinancing) {
        result.cashOnCashReturn = roi;
      }
      
      setRoiResult(result);
      
      // Create scenarios for comparison
      generateScenarios();
    } catch (error) {
      console.error('Error calculating ROI:', error);
    }
  };
  
  // Generate different investment scenarios for comparison
  const generateScenarios = () => {
    // All cash scenario
    const cashScenario: Scenario = {
      name: "All Cash",
      roi: 0,
      profit: 0,
      investment: offerPrice + (offerPrice * (closingCostPercent / 100)) + renovationCost
    };
    
    // Calculate profit and ROI
    const cashSellingCosts = calculatedARV * (sellingCostPercent / 100);
    cashScenario.profit = calculatedARV - cashSellingCosts - cashScenario.investment - (monthlyHoldingCost * holdingPeriodMonths);
    cashScenario.roi = (cashScenario.profit / cashScenario.investment) * 100;
    
    // Conventional financing scenario (20% down)
    const conventionalScenario: Scenario = {
      name: "20% Down",
      roi: 0,
      profit: 0,
      investment: 0,
      financing: {
        downPayment: offerPrice * 0.2,
        loanAmount: offerPrice * 0.8,
        monthlyPayment: calculateMonthlyMortgagePayment(offerPrice * 0.8, 7.5, 30)
      }
    };
    
    // Calculate conventional scenario investment
    conventionalScenario.investment = conventionalScenario.financing!.downPayment + 
      (offerPrice * (closingCostPercent / 100)) + 
      renovationCost;
    
    // Calculate profit and ROI
    const conventionalHoldingCosts = (conventionalScenario.financing!.monthlyPayment + monthlyHoldingCost) * holdingPeriodMonths;
    const conventionalSellingCosts = calculatedARV * (sellingCostPercent / 100);
    conventionalScenario.profit = calculatedARV - conventionalSellingCosts - conventionalScenario.financing!.loanAmount - conventionalScenario.investment - conventionalHoldingCosts;
    conventionalScenario.roi = (conventionalScenario.profit / conventionalScenario.investment) * 100;
    
    // Hard money scenario (15% down)
    const hardMoneyScenario: Scenario = {
      name: "Hard Money",
      roi: 0,
      profit: 0,
      investment: 0,
      financing: {
        downPayment: offerPrice * 0.15,
        loanAmount: offerPrice * 0.85,
        monthlyPayment: calculateMonthlyMortgagePayment(offerPrice * 0.85, 12, 1) // Hard money typically 12% interest
      }
    };
    
    // Calculate hard money scenario investment
    hardMoneyScenario.investment = hardMoneyScenario.financing!.downPayment + 
      (offerPrice * (closingCostPercent / 100)) + 
      renovationCost + 
      (offerPrice * 0.85 * 0.03); // 3 points
    
    // Calculate profit and ROI
    const hardMoneyHoldingCosts = (hardMoneyScenario.financing!.monthlyPayment + monthlyHoldingCost) * holdingPeriodMonths;
    const hardMoneySellingCosts = calculatedARV * (sellingCostPercent / 100);
    hardMoneyScenario.profit = calculatedARV - hardMoneySellingCosts - hardMoneyScenario.financing!.loanAmount - hardMoneyScenario.investment - hardMoneyHoldingCosts;
    hardMoneyScenario.roi = (hardMoneyScenario.profit / hardMoneyScenario.investment) * 100;
    
    setScenarios([cashScenario, conventionalScenario, hardMoneyScenario]);
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format percentage
  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };
  
  // Render basic inputs tab
  const renderBasicInputs = () => (
    <Grid container spacing={3}>
      <Grid xs={12} md={6}>
        <TextField
          label="Offer Price"
          fullWidth
          variant="outlined"
          type="number"
          value={offerPrice}
          onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Renovation Cost"
          fullWidth
          variant="outlined"
          type="number"
          value={renovationCost}
          InputProps={{
            readOnly: true,
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Projected ARV"
          fullWidth
          variant="outlined"
          type="number"
          value={calculatedARV}
          onChange={(e) => setCalculatedARV(parseFloat(e.target.value) || 0)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Closing Costs (%)"
          fullWidth
          variant="outlined"
          type="number"
          value={closingCostPercent}
          onChange={(e) => setClosingCostPercent(parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Selling Costs (%)"
          fullWidth
          variant="outlined"
          type="number"
          value={sellingCostPercent}
          onChange={(e) => setSellingCostPercent(parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Holding Period"
          fullWidth
          variant="outlined"
          type="number"
          value={holdingPeriodMonths}
          onChange={(e) => setHoldingPeriodMonths(parseInt(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">Months</InputAdornment>,
          }}
        />
      </Grid>
      
      <Grid xs={12} md={6}>
        <TextField
          label="Monthly Holding Cost"
          fullWidth
          variant="outlined"
          type="number"
          value={monthlyHoldingCost}
          onChange={(e) => setMonthlyHoldingCost(parseFloat(e.target.value) || 0)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
      </Grid>
    </Grid>
  );
  
  // Render financing tab
  const renderFinancingInputs = () => (
    <Grid container spacing={3}>
      <Grid xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={useFinancing}
              onChange={(e) => setUseFinancing(e.target.checked)}
              color="primary"
            />
          }
          label="Use Financing"
        />
      </Grid>
      
      {useFinancing && (
        <>
          <Grid xs={12} md={6}>
            <Typography gutterBottom>
              Down Payment: {downPaymentPercent}%
            </Typography>
            <Slider
              value={downPaymentPercent}
              onChange={(_e, value) => setDownPaymentPercent(value as number)}
              step={1}
              marks={[
                { value: 0, label: '0%' },
                { value: 20, label: '20%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
              min={0}
              max={100}
            />
          </Grid>
          
          <Grid xs={12} md={6}>
            <TextField
              label="Interest Rate"
              fullWidth
              variant="outlined"
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid xs={12} md={6}>
            <TextField
              label="Loan Term"
              fullWidth
              variant="outlined"
              type="number"
              value={loanTermYears}
              onChange={(e) => setLoanTermYears(parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">Years</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Financing Summary</Typography>
              <Typography variant="body2">
                Down Payment: {formatCurrency(propertyData.purchasePrice * downPaymentPercent / 100)}
              </Typography>
              <Typography variant="body2">
                Loan Amount: {formatCurrency(propertyData.purchasePrice * (1 - downPaymentPercent / 100))}
              </Typography>
              <Typography variant="body2">
                Monthly Payment: {formatCurrency(
                  calculateMonthlyMortgagePayment(
                    propertyData.purchasePrice * (1 - downPaymentPercent / 100),
                    interestRate,
                    loanTermYears
                  )
                )}
              </Typography>
            </Paper>
          </Grid>
        </>
      )}
    </Grid>
  );
  
  // Render scenario comparison tab
  const renderScenarioComparison = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Investment Scenario Comparison</Typography>
      
      <Grid container spacing={3}>
        <Grid xs={12} lg={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Return on Investment (ROI)</Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={scenarios}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                <RechartsTooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'ROI']} 
                />
                <Bar dataKey="roi" fill="#8884d8" name="ROI" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid xs={12} lg={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Cash Required vs Profit</Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={scenarios}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <RechartsTooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} 
                />
                <Bar dataKey="investment" fill="#82ca9d" name="Cash Required" />
                <Bar dataKey="profit" fill="#8884d8" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid xs={12}>
          <Paper variant="outlined" sx={{ p: 0 }}>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <Box sx={{ minWidth: 500 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Scenario</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Cash Required</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Profit</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>ROI</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Monthly Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario, index) => (
                      <tr key={index} style={{ borderTop: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{scenario.name}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(scenario.investment)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(scenario.profit)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPercent(scenario.roi)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{
                          scenario.financing ? 
                            formatCurrency(scenario.financing.monthlyPayment) : 
                            'N/A'
                        }</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
  
  // Render ROI sensitivity chart
  const renderSensitivityAnalysis = () => {
    // Generate data for ARV sensitivity
    const arvData = [];
    for (let i = -20; i <= 20; i += 5) {
      const arvAdjustment = 1 + (i / 100);
      const adjustedARV = calculatedARV * arvAdjustment;
      const adjustedProfit = adjustedARV - (adjustedARV * (sellingCostPercent / 100)) - roiResult.purchasePrice - roiResult.closingCosts - roiResult.renovationCosts - roiResult.holdingCosts.total;
      const adjustedROI = (adjustedProfit / (roiResult.purchasePrice + roiResult.closingCosts + roiResult.renovationCosts + roiResult.holdingCosts.total)) * 100;
      
      arvData.push({
        name: `${i > 0 ? '+' : ''}${i}%`,
        roi: adjustedROI
      });
    }
    
    // Generate data for purchase price sensitivity
    const purchaseData = [];
    for (let i = -10; i <= 10; i += 2) {
      const priceAdjustment = 1 + (i / 100);
      const adjustedPrice = roiResult.purchasePrice * priceAdjustment;
      const adjustedClosing = adjustedPrice * (closingCostPercent / 100);
      const adjustedHolding = adjustedPrice * 0.005 * holdingPeriodMonths;
      const adjustedProfit = calculatedARV - (calculatedARV * (sellingCostPercent / 100)) - adjustedPrice - adjustedClosing - roiResult.renovationCosts - adjustedHolding;
      const adjustedROI = (adjustedProfit / (adjustedPrice + adjustedClosing + roiResult.renovationCosts + adjustedHolding)) * 100;
      
      purchaseData.push({
        name: `${i > 0 ? '+' : ''}${i}%`,
        roi: adjustedROI
      });
    }
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Sensitivity Analysis</Typography>
        
        <Grid container spacing={3}>
          <Grid xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                ARV Impact on ROI
                <Tooltip title="Shows how changes in the After Repair Value impact your ROI">
                  <InfoIcon fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                </Tooltip>
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={arvData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'ROI']} />
                  <Line 
                    type="monotone" 
                    dataKey="roi" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                    name="ROI" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                Purchase Price Impact on ROI
                <Tooltip title="Shows how changes in the purchase price impact your ROI">
                  <InfoIcon fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                </Tooltip>
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={purchaseData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'ROI']} />
                  <Line 
                    type="monotone" 
                    dataKey="roi" 
                    stroke="#82ca9d" 
                    activeDot={{ r: 8 }} 
                    name="ROI" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Best/Worst Case Scenarios
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={4}>
                  <Box sx={{ p: 2, bgcolor: '#f8f8f8', borderRadius: 1, textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Worst Case
                    </Typography>
                    <Typography variant="h5" color="error">
                      {formatPercent(roiResult.timelineImpact.worstCase)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ROI
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={4}>
                  <Box sx={{ p: 2, bgcolor: '#f0f7ff', borderRadius: 1, textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Expected
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {formatPercent(roiResult.timelineImpact.expected)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ROI
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={4}>
                  <Box sx={{ p: 2, bgcolor: '#f8f8f8', borderRadius: 1, textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Best Case
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {formatPercent(roiResult.timelineImpact.bestCase)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ROI
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  return (
    <Box>
      <StyledCard>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            ROI Calculator
          </Typography>
          
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={currentTab}
              onChange={handleTabChange}
              aria-label="ROI calculator tabs"
            >
              <Tab label="Basic Inputs" />
              <Tab label="Financing" />
              <Tab label="Scenario Comparison" />
              <Tab label="Sensitivity Analysis" />
            </Tabs>
          </Box>
          
          <TabPanel value={currentTab} index={0}>
            {renderBasicInputs()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            {renderFinancingInputs()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            {renderScenarioComparison()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={3}>
            {renderSensitivityAnalysis()}
          </TabPanel>
        </CardContent>
      </StyledCard>
      
      <StyledCard>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ROI Summary
          </Typography>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Investment</Typography>
                  <Grid container spacing={1}>
                    <Grid xs={8}>
                      <Typography variant="body2">Purchase Price:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.purchasePrice)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2">Closing Costs ({closingCostPercent}%):</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.closingCosts)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2">Renovation Costs:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.renovationCosts)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2">Holding Costs ({holdingPeriodMonths} months):</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.holdingCosts.total)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2" fontWeight="bold">Total Investment:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" fontWeight="bold" align="right">
                        {formatCurrency(
                          roiResult.purchasePrice + 
                          roiResult.closingCosts + 
                          roiResult.renovationCosts + 
                          roiResult.holdingCosts.total
                        )}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              
              <Grid xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Return</Typography>
                  <Grid container spacing={1}>
                    <Grid xs={8}>
                      <Typography variant="body2">Projected ARV:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.projectedARV)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2">Selling Costs ({sellingCostPercent}%):</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" align="right">{formatCurrency(roiResult.sellingCosts)}</Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2" fontWeight="bold">Net Proceeds:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" fontWeight="bold" align="right">
                        {formatCurrency(roiResult.projectedARV - roiResult.sellingCosts)}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={8}>
                      <Typography variant="body2" fontWeight="bold">Net Profit:</Typography>
                    </Grid>
                    <Grid xs={4}>
                      <Typography variant="body2" fontWeight="bold" align="right">
                        {formatCurrency(roiResult.netProfit)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              
              <Grid xs={12}>
                <ResultBox>
                  <Grid container alignItems="center" justifyContent="center" spacing={3}>
                    <Grid xs={12} md={useFinancing ? 6 : 12} textAlign="center">
                      <Typography variant="subtitle2" color="text.secondary">
                        Return on Investment (ROI)
                      </Typography>
                      <Typography variant="h3" color={roiResult.roi > 0 ? 'primary' : 'error'}>
                        {formatPercent(roiResult.roi)}
                      </Typography>
                    </Grid>
                    
                    {useFinancing && (
                      <Grid xs={12} md={6} textAlign="center">
                        <Typography variant="subtitle2" color="text.secondary">
                          Cash-on-Cash Return
                        </Typography>
                        <Typography variant="h3" color={roiResult.cashOnCashReturn! > 0 ? 'primary' : 'error'}>
                          {formatPercent(roiResult.cashOnCashReturn!)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </ResultBox>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </StyledCard>
    </Box>
  );
};

export default ROICalculator;

