// PropertyScoreVisualization.jsx
// React component for visualizing property scores and insights

import React, { useState, useEffect } from 'react';
import { 
  Box,
  Card, 
  CardHeader, 
  CardContent,
  Typography,
  Grid,
  Divider,
  Tooltip,
  Stack
} from '@mui/material';
import { 
  PieChart,
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * Component for visualizing property score data
 */
const PropertyScoreVisualization = ({ 
  properties = [], 
  selectedProperty = null,
  scoringConfig = {}
}) => {
  // State for processed data
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [factorComparison, setFactorComparison] = useState([]);
  const [recommendationData, setRecommendationData] = useState([]);

  // Default colors for charts
  const defaultColors = {
    HOT: '#ff4d4d',
    WARM: '#ffaa00',
    LUKEWARM: '#ffdd00',
    COLD: '#aaaaaa',
    UNKNOWN: '#cccccc'
  };

  // Use provided colors or fall back to defaults
  const chartColors = {
    ...defaultColors,
    ...(scoringConfig?.colors || {})
  };

  // Process data when properties change
  useEffect(() => {
    if (properties && properties.length > 0) {
      processScoreDistribution();
      processFactorComparison();
      processRecommendationData();
    }
  }, [properties, selectedProperty]);

  // Process score distribution data
  const processScoreDistribution = () => {
    const distribution = {
      HOT: 0,
      WARM: 0,
      LUKEWARM: 0,
      COLD: 0,
      UNKNOWN: 0
    };

    // Count properties in each score category
    properties.forEach(property => {
      const classification = property.leadScore?.classification || 'UNKNOWN';
      distribution[classification] = (distribution[classification] || 0) + 1;
    });

    // Convert to array format for chart
    const data = Object.keys(distribution).map(key => ({
      name: key,
      value: distribution[key]
    })).filter(item => item.value > 0);

    setScoreDistribution(data);
  };

  // Process factor comparison data
  const processFactorComparison = () => {
    if (!selectedProperty || !selectedProperty.leadScore) {
      setFactorComparison([]);
      return;
    }

    // Find similar properties (same classification)
    const similarProperties = properties.filter(p => 
      p.id !== selectedProperty.id && 
      p.leadScore?.classification === selectedProperty.leadScore?.classification
    ).slice(0, 5);

    // Get all unique factors
    const allFactors = new Set();
    if (selectedProperty.leadScore?.factors) {
      selectedProperty.leadScore.factors.forEach(factor => allFactors.add(factor));
    }
    
    similarProperties.forEach(property => {
      if (property.leadScore?.factors) {
        property.leadScore.factors.forEach(factor => allFactors.add(factor));
      }
    });

    // Create comparison data
    const comparisonData = Array.from(allFactors).map(factor => {
      const data = {
        factor,
        selected: selectedProperty.leadScore?.factors?.includes(factor) ? 1 : 0,
      };

      // Add data for similar properties
      similarProperties.forEach((property, index) => {
        data[`similar${index + 1}`] = property.leadScore?.factors?.includes(factor) ? 1 : 0;
      });

      return data;
    });

    setFactorComparison(comparisonData);
  };

  // Process recommendation data
  const processRecommendationData = () => {
    if (!selectedProperty || !selectedProperty.leadScore) {
      setRecommendationData([]);
      return;
    }

    // Extract recommendations if they exist
    const recommendations = selectedProperty.leadScore?.recommendations || [];
    
    // Sort by score and get top 5
    const sortedRecommendations = recommendations
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    setRecommendationData(sortedRecommendations);
  };

  // Render empty state
  if (properties.length === 0) {
    return (
      <Card>
        <CardHeader title="Property Score Visualization" />
        <CardContent>
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="textSecondary">
              No property data available for visualization
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Custom tooltip for pie chart
  const PieChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box 
          sx={{ 
            bgcolor: 'background.paper', 
            p: 1, 
            border: '1px solid #ccc',
            borderRadius: 1
          }}
        >
          <Typography variant="body2">
            <strong>{payload[0].name}</strong>: {payload[0].value} properties
          </Typography>
          <Typography variant="body2">
            {((payload[0].value / properties.length) * 100).toFixed(1)}% of total
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader 
        title="Property Score Insights" 
        subheader={`Analyzing ${properties.length} properties`}
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          {/* Score Distribution Chart */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Lead Score Distribution
            </Typography>
            <Box sx={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={chartColors[entry.name] || defaultColors.UNKNOWN} 
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PieChartTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Factor Comparison Chart (shown when a property is selected) */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              {selectedProperty ? 'Factor Comparison' : 'Average Score by Category'}
            </Typography>
            <Box sx={{ height: 250 }}>
              {selectedProperty && factorComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={factorComparison}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 1]} tickCount={2} />
                    <YAxis 
                      dataKey="factor" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      width={80}
                    />
                    <RechartsTooltip />
                    <Bar 
                      dataKey="selected" 
                      name="Selected Property" 
                      fill={chartColors.HOT}
                    />
                    <Bar 
                      dataKey="similar1" 
                      name="Similar Property 1" 
                      fill={chartColors.WARM} 
                    />
                    <Bar 
                      dataKey="similar2" 
                      name="Similar Property 2" 
                      fill={chartColors.LUKEWARM} 
                    />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                // Show average scores when no property is selected
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        category: 'HOT',
                        average: properties
                          .filter(p => p.leadScore?.classification === 'HOT')
                          .reduce((sum, p) => sum + (p.leadScore?.totalScore || 0), 0) / 
                          Math.max(1, properties.filter(p => p.leadScore?.classification === 'HOT').length)
                      },
                      {
                        category: 'WARM',
                        average: properties
                          .filter(p => p.leadScore?.classification === 'WARM')
                          .reduce((sum, p) => sum + (p.leadScore?.totalScore || 0), 0) / 
                          Math.max(1, properties.filter(p => p.leadScore?.classification === 'WARM').length)
                      },
                      {
                        category: 'LUKEWARM',
                        average: properties
                          .filter(p => p.leadScore?.classification === 'LUKEWARM')
                          .reduce((sum, p) => sum + (p.leadScore?.totalScore || 0), 0) / 
                          Math.max(1, properties.filter(p => p.leadScore?.classification === 'LUKEWARM').length)
                      },
                      {
                        category: 'COLD',
                        average: properties
                          .filter(p => p.leadScore?.classification === 'COLD')
                          .reduce((sum, p) => sum + (p.leadScore?.totalScore || 0), 0) / 
                          Math.max(1, properties.filter(p => p.leadScore?.classification === 'COLD').length)
                      }
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis 
                      domain={[0, 100]}
                      label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
                    />
                    <RechartsTooltip formatter={(value) => value.toFixed(1)} />
                    <Bar 
                      dataKey="average" 
                      name="Average Score" 
                      fill="#8884d8"
                    >
                      {[
                        <Cell key="cell-hot" fill={chartColors.HOT} />,
                        <Cell key="cell-warm" fill={chartColors.WARM} />,
                        <Cell key="cell-lukewarm" fill={chartColors.LUKEWARM} />,
                        <Cell key="cell-cold" fill={chartColors.COLD} />
                      ]}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Grid>
          
          {/* Additional insights */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Key Insights
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Hot Lead Rate
                    </Typography>
                    <Typography variant="h4" color="error">
                      {properties.length > 0 
                        ? `${((properties.filter(p => p.leadScore?.classification === 'HOT').length / properties.length) * 100).toFixed(1)}%` 
                        : '0%'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {properties.filter(p => p.leadScore?.classification === 'HOT').length} out of {properties.length} properties
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Average Score
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {properties.length > 0 
                        ? (properties.reduce((sum, p) => sum + (p.leadScore?.totalScore || 0), 0) / properties.length).toFixed(1)
                        : '0.0'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Across all {properties.length} properties
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Distress Signal
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {(() => {
                        // Count frequency of each distress signal
                        const signalCount = {};
                        properties.forEach(property => {
                          if (property.distressSignals?.distressSignals) {
                            property.distressSignals.distressSignals.forEach(signal => {
                              signalCount[signal] = (signalCount[signal] || 0) + 1;
                            });
                          }
                        });
                        
                        // Find most frequent signal
                        let topSignal = 'None detected';
                        let maxCount = 0;
                        
                        Object.entries(signalCount).forEach(([signal, count]) => {
                          if (count > maxCount) {
                            maxCount = count;
                            topSignal = signal;
                          }
                        });
                        
                        return topSignal;
                      })()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Most common distress indicator
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
          
          {/* Selected property recommendations */}
          {selectedProperty && recommendationData.length > 0 && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Recommendations for {selectedProperty.address || 'Selected Property'}
              </Typography>
              
              <Stack spacing={1}>
                {recommendationData.map((rec, index) => (
                  <Box 
                    key={index}
                    sx={{ 
                      p: 1.5, 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      backgroundColor: 'background.paper'
                    }}
                  >
                    <Grid container spacing={1}>
                      <Grid item xs={12}>
                        <Typography variant="body1" fontWeight="medium">
                          {index + 1}. {rec.action || rec.recommendation}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Box 
                          sx={{ 
                            width: '100%',
                            height: 8,
                            bgcolor: 'grey.300',
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}
                        >
                          <Tooltip title={`Score: ${(rec.score * 100).toFixed(1)}%`}>
                            <Box
                              sx={{
                                width: `${rec.score * 100}%`,
                                height: '100%',
                                bgcolor: 'primary.main',
                              }}
                            />
                          </Tooltip>
                        </Box>
                      </Grid>
                      {rec.rationale && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary">
                            {rec.rationale}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default PropertyScoreVisualization;
