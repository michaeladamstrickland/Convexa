import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  Chip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Phone as PhoneIcon, Email as EmailIcon, Home as HomeIcon } from '@mui/icons-material';

interface SkipTraceResultModalProps {
  open: boolean;
  onClose: () => void;
  skipTraceData: any;
  propertyAddress: string;
}

const SkipTraceResultModal: React.FC<SkipTraceResultModalProps> = ({
  open,
  onClose,
  skipTraceData,
  propertyAddress
}) => {
  // Helper function to check if a value exists
  const hasValue = (value: any) => value && value !== "" && value !== "null" && value !== "undefined";

  // Format phone number to (XXX) XXX-XXXX
  const formatPhone = (phone: string) => {
    if (!hasValue(phone)) return "";
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if we have 10 digits
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  // Check if we have meaningful contact data
  const hasContactInfo = skipTraceData && (
    hasValue(skipTraceData.phoneNumber) || 
    hasValue(skipTraceData.emailAddress) || 
    hasValue(skipTraceData.ownerName)
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Skip Trace Results
        <Typography variant="subtitle2" color="text.secondary">
          {propertyAddress}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {!skipTraceData && (
          <Typography color="error">
            No skip trace data available.
          </Typography>
        )}

        {skipTraceData && !hasContactInfo && (
          <Typography color="warning.main">
            No contact information found for this property owner.
          </Typography>
        )}

        {skipTraceData && hasContactInfo && (
          <Box>
            <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Owner Information
              </Typography>
              
              {hasValue(skipTraceData.ownerName) && (
                <Typography variant="body1" gutterBottom>
                  <strong>Name:</strong> {skipTraceData.ownerName}
                </Typography>
              )}
              
              <Box display="flex" flexDirection="column" gap={1} mt={2}>
                {hasValue(skipTraceData.phoneNumber) && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhoneIcon color="primary" />
                    <Typography>
                      {formatPhone(skipTraceData.phoneNumber)}
                    </Typography>
                    <Chip 
                      label={skipTraceData.phoneType || "Phone"} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  </Box>
                )}
                
                {hasValue(skipTraceData.emailAddress) && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon color="primary" />
                    <Typography>
                      {skipTraceData.emailAddress}
                    </Typography>
                  </Box>
                )}
                
                {hasValue(skipTraceData.mailingAddress) && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <HomeIcon color="primary" />
                    <Typography>
                      {skipTraceData.mailingAddress}
                    </Typography>
                    {skipTraceData.mailingAddress !== propertyAddress && (
                      <Chip 
                        label="Mailing Address" 
                        size="small" 
                        color="secondary" 
                        variant="outlined" 
                      />
                    )}
                  </Box>
                )}
              </Box>
            </Paper>

            {skipTraceData.additionalInfo && (
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Additional Information
                </Typography>
                <List dense>
                  {Object.entries(skipTraceData.additionalInfo).map(([key, value]) => {
                    if (value && String(value).trim() !== '') {
                      return (
                        <ListItem key={key}>
                          <ListItemText 
                            primary={<Typography><strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</strong></Typography>}
                            secondary={String(value)}
                          />
                        </ListItem>
                      );
                    }
                    return null;
                  })}
                </List>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SkipTraceResultModal;
