import React from 'react';
import { Card, CardContent, Typography, Box, Paper } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import MoneyIcon from '@mui/icons-material/Money';
import PieChart from '@mui/icons-material/PieChart';

interface SkipTraceDashboardWidgetProps {
  stats: {
    totalSkipTraces: number;
    successfulSkipTraces: number;
    contactsFound: number;
    emailsFound: number;
    phonesFound: number;
    totalCost: number;
    dailyQuotaRemaining: number;
    dailyQuotaTotal: number;
  };
}

const SkipTraceDashboardWidget: React.FC<SkipTraceDashboardWidgetProps> = ({ stats }) => {
  // Calculate success rate percentage
  const successRate = stats.totalSkipTraces > 0 
    ? Math.round((stats.successfulSkipTraces / stats.totalSkipTraces) * 100) 
    : 0;

  // Calculate quota usage percentage
  const quotaUsage = stats.dailyQuotaTotal > 0 
    ? Math.round(((stats.dailyQuotaTotal - stats.dailyQuotaRemaining) / stats.dailyQuotaTotal) * 100)
    : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Skip Trace Analytics
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={2}>
          <Box flex="1 1 45%" minWidth="250px">
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <PersonIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Contact Success</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="h6">
                  {stats.successfulSkipTraces}/{stats.totalSkipTraces}
                </Typography>
                <Typography 
                  variant="h6" 
                  color={successRate >= 70 ? 'success.main' : successRate >= 40 ? 'warning.main' : 'error.main'}
                >
                  {successRate}%
                </Typography>
              </Box>
            </Paper>
          </Box>

          <Box flex="1 1 45%" minWidth="250px">
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <MoneyIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Total Cost</Typography>
              </Box>
              <Typography variant="h6">
                ${stats.totalCost.toFixed(2)}
              </Typography>
            </Paper>
          </Box>

          <Box flex="1 1 100%">
            <Paper elevation={1} sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" mb={1}>
                <PieChart color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Daily Quota</Typography>
              </Box>
              <Box display="flex" alignItems="center">
                <Box 
                  sx={{ 
                    width: '100%', 
                    height: 10, 
                    bgcolor: 'grey.300', 
                    borderRadius: 5,
                    overflow: 'hidden'
                  }}
                >
                  <Box 
                    sx={{ 
                      width: `${quotaUsage}%`, 
                      height: '100%', 
                      bgcolor: quotaUsage > 90 ? 'error.main' : quotaUsage > 70 ? 'warning.main' : 'success.main',
                      transition: 'width 1s ease-in-out'
                    }} 
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1, minWidth: 80 }}>
                  {stats.dailyQuotaRemaining}/{stats.dailyQuotaTotal}
                </Typography>
              </Box>
            </Paper>
          </Box>

          <Box flex="1 1 30%" minWidth="200px">
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Box display="flex" flexDirection="column" alignItems="center">
                <PersonIcon color="info" fontSize="large" />
                <Typography variant="h6" mt={1}>
                  {stats.contactsFound}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contacts Found
                </Typography>
              </Box>
            </Paper>
          </Box>

          <Box flex="1 1 30%" minWidth="200px">
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Box display="flex" flexDirection="column" alignItems="center">
                <PhoneIcon color="info" fontSize="large" />
                <Typography variant="h6" mt={1}>
                  {stats.phonesFound}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Phone Numbers
                </Typography>
              </Box>
            </Paper>
          </Box>

          <Box flex="1 1 30%" minWidth="200px">
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Box display="flex" flexDirection="column" alignItems="center">
                <EmailIcon color="info" fontSize="large" />
                <Typography variant="h6" mt={1}>
                  {stats.emailsFound}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email Addresses
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SkipTraceDashboardWidget;
