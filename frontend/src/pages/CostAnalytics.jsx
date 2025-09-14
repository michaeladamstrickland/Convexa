import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  CircularProgress, 
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// API URLs
const API_URLS = {
  summary: '/api/costs/summary',
  analytics: '/api/costs/analytics'
};

// Cost card component
const CostCard = ({ title, amount, subtitle }) => {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          ${amount.toFixed(2)}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Pie chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const CostAnalytics = () => {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dateRange, setDateRange] = useState('all');

  // Fetch cost data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query params for date filtering
      let queryParams = '';
      if (dateRange !== 'all') {
        if (startDate) {
          queryParams += `startDate=${startDate.toISOString().split('T')[0]}`;
        }
        if (endDate) {
          queryParams += `${queryParams ? '&' : ''}endDate=${endDate.toISOString().split('T')[0]}`;
        }
      }
      
      // Fetch summary data
      const summaryRes = await fetch(`${API_URLS.summary}${queryParams ? '?' + queryParams : ''}`);
      if (!summaryRes.ok) throw new Error('Failed to fetch cost summary');
      const summaryData = await summaryRes.json();
      
      // Fetch analytics data
      const analyticsRes = await fetch(`${API_URLS.analytics}${queryParams ? '?' + queryParams : ''}`);
      if (!analyticsRes.ok) throw new Error('Failed to fetch cost analytics');
      const analyticsData = await analyticsRes.json();
      
      setSummary(summaryData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching cost data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle date range preset selection
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    
    const now = new Date();
    let start = null;
    let end = null;
    
    switch (range) {
      case 'today':
        start = new Date(now);
        end = new Date(now);
        break;
      case 'yesterday':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        break;
      case '7days':
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case '30days':
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'custom':
        // Keep current selection
        break;
      case 'all':
      default:
        start = null;
        end = null;
        break;
    }
    
    setStartDate(start);
    setEndDate(end);
  };
  
  // Apply filter
  const applyFilter = () => {
    fetchData();
  };

  // Format data for charts
  const prepareApiCostData = () => {
    if (!analytics?.apiCosts) return [];
    return analytics.apiCosts.map(item => ({
      name: item.apiType,
      value: Number(item.totalCost) / 100, // convert cents to dollars
      calls: Number(item.callCount)
    }));
  };

  const prepareLeadSourceData = () => {
    if (!analytics?.leadCosts) return [];
    return analytics.leadCosts.map(item => ({
      name: item.leadSource,
      value: Number(item.totalCost) / 100, // convert cents to dollars
      leads: Number(item.leadCount),
      avgCost: Number(item.averageCost) / 100 // convert cents to dollars
    }));
  };

  const prepareDailyTrendData = () => {
    if (!analytics?.dailyCosts) return [];
    return analytics.dailyCosts.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      cost: Number(item.dailyCost) / 100, // convert cents to dollars
      calls: Number(item.apiCalls)
    }));
  };
  
  // Fetch data on initial load
  useEffect(() => {
    fetchData();
  }, []);

  // Authentication is now handled at App level
  
  if (loading && !summary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !summary) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Cost Analytics
      </Typography>
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                label="Date Range"
                onChange={(e) => handleDateRangeChange(e.target.value)}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="7days">Last 7 Days</MenuItem>
                <MenuItem value="30days">Last 30 Days</MenuItem>
                <MenuItem value="thisMonth">This Month</MenuItem>
                <MenuItem value="lastMonth">Last Month</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {dateRange === 'custom' && (
            <>
              <Grid xs={12} sm={3}>
                <TextField
                  type="date"
                  label="Start Date"
                  value={startDate ? startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid xs={12} sm={3}>
                <TextField
                  type="date"
                  label="End Date"
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </>
          )}
          
          <Grid item>
            <Button 
              variant="contained" 
              onClick={applyFilter}
              disabled={dateRange === 'custom' && (!startDate || !endDate)}
            >
              Apply
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Cost Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={4}>
          <CostCard 
            title="Total Cost" 
            amount={(summary?.totalCost || 0) / 100}
            subtitle={`From ${summary?.period?.start} to ${summary?.period?.end}`}
          />
        </Grid>
        <Grid xs={12} sm={4}>
          <CostCard 
            title="API Costs" 
            amount={(summary?.apiCosts || 0) / 100}
            subtitle="All API calls and services"
          />
        </Grid>
        <Grid xs={12} sm={4}>
          <CostCard 
            title="Lead Acquisition" 
            amount={(summary?.leadCosts || 0) / 100}
            subtitle="Skip tracing and data enrichment"
          />
        </Grid>
      </Grid>

      {/* Loading indicator for analytics */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
          <CircularProgress />
        </Box>
      )}
      
      {/* Error message for analytics */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading analytics: {error}
        </Alert>
      )}

      {analytics && !loading && (
        <>
          {/* Charts and Tables */}
          <Grid container spacing={3}>
            {/* API Costs Chart */}
            <Grid xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  API Cost Distribution
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareApiCostData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareApiCostData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            
            {/* Lead Source Costs Chart */}
            <Grid xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Lead Acquisition Costs
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareLeadSourceData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareLeadSourceData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            
            {/* Daily Trend Chart */}
            <Grid xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Cost Trend
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={prepareDailyTrendData()}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip formatter={(value, name) => [
                        name === 'cost' ? `$${value.toFixed(2)}` : value,
                        name === 'cost' ? 'Cost' : 'API Calls'
                      ]} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="cost" name="Cost" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="calls" name="API Calls" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            
            {/* API Costs Table */}
            <Grid xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  API Costs Detail
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>API Type</TableCell>
                        <TableCell align="right">Calls</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="right">Avg. Cost/Call</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.apiCosts && analytics.apiCosts.map((row) => (
                        <TableRow key={row.apiType}>
                          <TableCell component="th" scope="row">
                            {row.apiType}
                          </TableCell>
                          <TableCell align="right">{row.callCount}</TableCell>
                          <TableCell align="right">${(row.totalCost / 100).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            ${(row.totalCost / row.callCount / 100).toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            
            {/* Lead Source Costs Table */}
            <Grid xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Lead Source Cost Detail
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Lead Source</TableCell>
                        <TableCell align="right">Leads</TableCell>
                        <TableCell align="right">Total Cost</TableCell>
                        <TableCell align="right">Avg. Cost/Lead</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.leadCosts && analytics.leadCosts.map((row) => (
                        <TableRow key={row.leadSource}>
                          <TableCell component="th" scope="row">
                            {row.leadSource}
                          </TableCell>
                          <TableCell align="right">{row.leadCount}</TableCell>
                          <TableCell align="right">${(row.totalCost / 100).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            ${(row.averageCost / 100).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            
            {/* Conversion Costs Table */}
            <Grid xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cost per Conversion (by Lead Status)
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Lead Count</TableCell>
                        <TableCell align="right">Total Cost</TableCell>
                        <TableCell align="right">Cost per Lead</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.conversionCosts && analytics.conversionCosts.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell component="th" scope="row">
                            {row.status}
                          </TableCell>
                          <TableCell align="right">{row.leadCount}</TableCell>
                          <TableCell align="right">${(row.totalCost / 100).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            ${(row.costPerLead / 100).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default CostAnalytics;

