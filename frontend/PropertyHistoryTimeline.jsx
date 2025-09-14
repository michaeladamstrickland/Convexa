import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Divider
} from '@mui/material';
import {
  Home,
  TrendingUp,
  AccountBalance,
  Receipt,
  MonetizationOn,
  Timeline
} from '@mui/icons-material';
import { formatCurrency, formatDate } from './utils/formatters';

/**
 * Property history timeline component
 * Displays combined sales and tax history in a chronological timeline
 * 
 * @param {Object} props
 * @param {Array} props.salesHistory - Array of sales history records
 * @param {Array} props.taxHistory - Array of tax history records
 * @param {Object} props.property - Property details
 * @returns {JSX.Element}
 */
const PropertyHistoryTimeline = ({ salesHistory, taxHistory, property }) => {
  // If no history is available
  if ((!salesHistory || salesHistory.length === 0) && 
      (!taxHistory || taxHistory.length === 0)) {
    return (
      <Card elevation={2}>
        <CardHeader 
          title="Property History Timeline"
          avatar={<Timeline color="primary" />}
        />
        <CardContent>
          <Typography variant="body2" color="text.secondary" align="center">
            No history records are available for this property.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  
  // Combine sales and tax history into a unified timeline
  const createTimeline = () => {
    const timeline = [];
    
    // Process sales history
    if (salesHistory && salesHistory.length > 0) {
      salesHistory.forEach(sale => {
        timeline.push({
          type: 'sale',
          date: new Date(sale.saleDate),
          data: sale,
          icon: <MonetizationOn color="success" />,
          label: `Sale: ${formatCurrency(sale.saleAmount)}`,
          description: `Sold to ${sale.buyer || 'unknown buyer'}` +
            (sale.deed?.type ? ` via ${sale.deed.type}` : '')
        });
      });
    }
    
    // Process tax history
    if (taxHistory && taxHistory.length > 0) {
      taxHistory.forEach(tax => {
        timeline.push({
          type: 'tax',
          date: new Date(`${tax.year}-01-01`), // Default to Jan 1 of tax year
          data: tax,
          icon: <AccountBalance color="primary" />,
          label: `Tax Assessment: ${tax.year}`,
          description: `Assessed value: ${formatCurrency(tax.assessedValue)}, ` +
            `Market value: ${formatCurrency(tax.marketValue)}`
        });
      });
    }
    
    // Add property built date if available
    if (property?.yearBuilt) {
      timeline.push({
        type: 'built',
        date: new Date(`${property.yearBuilt}-01-01`),
        data: { year: property.yearBuilt },
        icon: <Home color="secondary" />,
        label: 'Property Built',
        description: `Construction completed in ${property.yearBuilt}`
      });
    }
    
    // Sort by date (newest first)
    timeline.sort((a, b) => b.date - a.date);
    
    return timeline;
  };
  
  const timeline = createTimeline();
  
  return (
    <Card elevation={2}>
      <CardHeader 
        title="Property History Timeline"
        avatar={<Timeline color="primary" />}
        subheader={`${timeline.length} historical records`}
      />
      <CardContent>
        <Stepper orientation="vertical" nonLinear>
          {timeline.map((event, index) => (
            <Step key={index} active={true}>
              <StepLabel icon={event.icon}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">{event.label}</Typography>
                  <Chip 
                    size="small" 
                    label={formatDate(event.date)}
                    color={event.type === 'sale' ? 'success' : event.type === 'built' ? 'secondary' : 'primary'}
                    variant="outlined"
                  />
                </Box>
              </StepLabel>
              <StepContent>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                  <Typography variant="body2" paragraph>
                    {event.description}
                  </Typography>
                  
                  {/* Sale details */}
                  {event.type === 'sale' && (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Sale Price:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(event.data.saleAmount)}
                        </Typography>
                      </Box>
                      {event.data.buyer && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Buyer:</Typography>
                          <Typography variant="body2">{event.data.buyer}</Typography>
                        </Box>
                      )}
                      {event.data.seller && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Seller:</Typography>
                          <Typography variant="body2">{event.data.seller}</Typography>
                        </Box>
                      )}
                      {event.data.deed?.type && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Deed Type:</Typography>
                          <Typography variant="body2">{event.data.deed.type}</Typography>
                        </Box>
                      )}
                      {event.data.lender && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Lender:</Typography>
                          <Typography variant="body2">{event.data.lender}</Typography>
                        </Box>
                      )}
                      {event.data.loanAmount && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Loan Amount:</Typography>
                          <Typography variant="body2">{formatCurrency(event.data.loanAmount)}</Typography>
                        </Box>
                      )}
                    </>
                  )}
                  
                  {/* Tax assessment details */}
                  {event.type === 'tax' && (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Tax Year:</Typography>
                        <Typography variant="body2" fontWeight="bold">{event.data.year}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Assessed Value:</Typography>
                        <Typography variant="body2">{formatCurrency(event.data.assessedValue)}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Market Value:</Typography>
                        <Typography variant="body2">{formatCurrency(event.data.marketValue)}</Typography>
                      </Box>
                      {event.data.improvementValue && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Improvement Value:</Typography>
                          <Typography variant="body2">{formatCurrency(event.data.improvementValue)}</Typography>
                        </Box>
                      )}
                      {event.data.landValue && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Land Value:</Typography>
                          <Typography variant="body2">{formatCurrency(event.data.landValue)}</Typography>
                        </Box>
                      )}
                      {event.data.taxAmount && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Tax Amount:</Typography>
                          <Typography variant="body2">{formatCurrency(event.data.taxAmount)}</Typography>
                        </Box>
                      )}
                    </>
                  )}
                  
                  {/* Built details */}
                  {event.type === 'built' && (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Year Built:</Typography>
                        <Typography variant="body2" fontWeight="bold">{event.data.year}</Typography>
                      </Box>
                      {property?.constructionType && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Construction Type:</Typography>
                          <Typography variant="body2">{property.constructionType}</Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Paper>
                
                {index < timeline.length - 1 && (
                  <Box sx={{ ml: 2, mb: 1 }}>
                    <Chip 
                      size="small"
                      label={`${Math.abs(
                        Math.round((timeline[index].date - timeline[index + 1].date) / 
                        (1000 * 60 * 60 * 24 * 365))
                      )} years`} 
                      color="default"
                    />
                  </Box>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
};

export default PropertyHistoryTimeline;
