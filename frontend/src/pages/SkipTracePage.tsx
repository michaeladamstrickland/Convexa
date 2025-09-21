import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { api } from '../api/client';
import {
  Box,
  Button,
  Card,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tabs,
  Tab
} from '@mui/material';
import MuiGrid from '@mui/material/Grid';
import { Search, PersonSearch, AccountCircle, AttachMoney, BarChart } from '@mui/icons-material';

// Use shared API client base (http://localhost:5001/api by default)
const API_BASE_URL = api.defaults.baseURL?.replace(/\/$/, '') || 'http://localhost:5001/api';

interface SkipTraceQuotaData {
  daily: {
    total: number;
    used: number;
    remaining: number;
  };
  monthly: {
    total: number;
    used: number;
    remaining: number;
  };
  lastUpdated: string;
}

interface SkipTraceCostData {
  totalCost: number;
  totalCount: number;
  averageCost: number;
  dailyCosts: {
    date: string;
    cost: number;
    count: number;
  }[];
  dateRange: {
    start: string;
    end: string;
  };
}

const Grid: any = (MuiGrid as unknown) as any;

const SkipTracePage = () => {
  // State for tabs
  const [activeTab, setActiveTab] = useState(0);
  
  // State for quota and cost data
  const [quotaData, setQuotaData] = useState<SkipTraceQuotaData | null>(null);
  const [costData, setCostData] = useState<SkipTraceCostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load quota data on component mount
  useEffect(() => {
    loadQuotaData();
    loadCostData();
  }, []);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Load quota data
  const loadQuotaData = async () => {
    setLoading(true);
    try {
  const response = await axios.get(`${API_BASE_URL}/skiptrace/quota`);
      setQuotaData(response.data.data);
      setError(null);
    } catch (error) {
      console.error('Error loading skip trace quota:', error);
      setError('Failed to load skip trace quota data');
    } finally {
      setLoading(false);
    }
  };
  
  // Load cost data
  const loadCostData = async () => {
    setLoading(true);
    try {
      // Default to last 30 days
  const response = await axios.get(`${API_BASE_URL}/skiptrace/analytics`);
      setCostData(response.data.data);
      setError(null);
    } catch (error) {
      console.error('Error loading skip trace cost data:', error);
      setError('Failed to load skip trace cost data');
    } finally {
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Skip Trace Management
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Search for contact information for property owners and track skip trace costs
      </Typography>
      
      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        sx={{ mb: 3 }}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab 
          icon={<PersonSearch />} 
          label="Skip Trace Dashboard" 
          id="tab-0"
          aria-controls="tabpanel-0"
        />
        <Tab 
          icon={<AttachMoney />} 
          label="Cost Analytics" 
          id="tab-1"
          aria-controls="tabpanel-1"
        />
        <Tab 
          icon={<BarChart />} 
          label="Usage Reports" 
          id="tab-2"
          aria-controls="tabpanel-2"
        />
      </Tabs>
      
      {/* Skip Trace Dashboard */}
      <Box hidden={activeTab !== 0} id="tabpanel-0" aria-labelledby="tab-0">
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
  <Grid container spacing={3}>
          {/* Quota Card */}
          <Grid xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Skip Trace Quota
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : quotaData ? (
                <>
                  <Typography variant="body1" gutterBottom>
                    Daily Usage:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <div 
                      style={{ 
                        width: '100%', 
                        height: '10px', 
                        backgroundColor: '#e0e0e0',
                        borderRadius: '5px'
                      }}
                    >
                      <div 
                        style={{ 
                          width: `${(quotaData.daily.used / quotaData.daily.total) * 100}%`, 
                          height: '10px',
                          backgroundColor: '#1976d2',
                          borderRadius: '5px'
                        }}
                      ></div>
                    </div>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption">
                        Used: {quotaData.daily.used}/{quotaData.daily.total}
                      </Typography>
                      <Typography variant="caption">
                        Remaining: {quotaData.daily.remaining}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Typography variant="body1" gutterBottom>
                    Monthly Usage:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <div 
                      style={{ 
                        width: '100%', 
                        height: '10px', 
                        backgroundColor: '#e0e0e0',
                        borderRadius: '5px'
                      }}
                    >
                      <div 
                        style={{ 
                          width: `${(quotaData.monthly.used / quotaData.monthly.total) * 100}%`, 
                          height: '10px',
                          backgroundColor: '#1976d2',
                          borderRadius: '5px'
                        }}
                      ></div>
                    </div>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption">
                        Used: {quotaData.monthly.used}/{quotaData.monthly.total}
                      </Typography>
                      <Typography variant="caption">
                        Remaining: {quotaData.monthly.remaining}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {new Date(quotaData.lastUpdated).toLocaleString()}
                  </Typography>
                </>
              ) : (
                <Alert severity="info">No quota data available</Alert>
              )}
              
              <Button 
                variant="outlined" 
                sx={{ mt: 2 }} 
                onClick={loadQuotaData}
                disabled={loading}
              >
                Refresh Quota
              </Button>
            </Paper>
          </Grid>
          
          {/* Quick Actions */}
          <Grid xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                  variant="contained" 
                  startIcon={<PersonSearch />}
                  fullWidth
                  sx={{ py: 1.5 }}
                  href="/search"
                >
                  Search & Skip Trace Leads
                </Button>
                
                <Button 
                  variant="outlined" 
                  startIcon={<AccountCircle />}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Skip Trace a Single Owner
                </Button>
                
                <Divider sx={{ my: 1 }} />
                
                <Button 
                  variant="outlined" 
                  startIcon={<AttachMoney />}
                  fullWidth
                  onClick={() => setActiveTab(1)}
                  sx={{ py: 1.5 }}
                >
                  View Cost Analytics
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
        
        {/* Recent Activity */}
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Skip Trace Activity
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Lead ID</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No recent activity found
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
      
      {/* Cost Analytics */}
      <Box hidden={activeTab !== 1} id="tabpanel-1" aria-labelledby="tab-1">
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
  <Grid container spacing={3}>
          {/* Summary Card */}
          <Grid xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Cost Summary
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : costData ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" color="primary">
                      {formatCurrency(costData.totalCost)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total cost for {costData.dateRange.start} to {costData.dateRange.end}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body2">
                    <strong>Total Skip Traces:</strong> {costData.totalCount}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Average Cost per Skip Trace:</strong> {formatCurrency(costData.averageCost)}
                  </Typography>
                </>
              ) : (
                <Alert severity="info">No cost data available</Alert>
              )}
              
              <Button 
                variant="outlined" 
                sx={{ mt: 2 }} 
                onClick={loadCostData}
                disabled={loading}
              >
                Refresh Data
              </Button>
            </Paper>
          </Grid>
          
          {/* Daily Cost Table */}
          <Grid xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Daily Cost Breakdown
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : costData && costData.dailyCosts && costData.dailyCosts.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Skip Traces</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="right">Avg. Cost</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {costData.dailyCosts.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                          <TableCell align="right">{day.count}</TableCell>
                          <TableCell align="right">{formatCurrency(day.cost)}</TableCell>
                          <TableCell align="right">
                            {day.count > 0 ? formatCurrency(day.cost / day.count) : '$0.00'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No daily cost data available</Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
      
      {/* Usage Reports */}
      <Box hidden={activeTab !== 2} id="tabpanel-2" aria-labelledby="tab-2">
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Skip Trace Usage Reports
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            Advanced usage reports are coming soon. This feature will provide detailed insights into your skip trace usage patterns, conversion rates, and ROI metrics.
          </Alert>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Button variant="contained">Generate Usage Report</Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default SkipTracePage;
