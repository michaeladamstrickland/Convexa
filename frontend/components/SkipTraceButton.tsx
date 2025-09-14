import React, { useState } from 'react';
import axios from 'axios';
import { Button, Tooltip } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import CircularProgress from '@mui/material/CircularProgress';
import SkipTraceResultModal from './SkipTraceResultModal';

interface SkipTraceButtonProps {
  leadId: number;
  propertyAddress: string;
  onSkipTraceComplete?: (skipTraceData: any) => void;
  disabled?: boolean;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

const SkipTraceButton: React.FC<SkipTraceButtonProps> = ({
  leadId,
  propertyAddress,
  onSkipTraceComplete,
  disabled = false,
  variant = 'contained',
  size = 'medium',
  fullWidth = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipTraceResult, setSkipTraceResult] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSkipTrace = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/skip-trace', { leadId });
      setSkipTraceResult(response.data);
      setModalOpen(true);
      
      if (onSkipTraceComplete) {
        onSkipTraceComplete(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run skip trace');
      console.error('Skip trace error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <>
      <Tooltip title={disabled ? "Skip trace unavailable" : "Run skip trace to find owner contact information"}>
        <span>
          <Button
            variant={variant}
            color="info"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonSearchIcon />}
            onClick={handleSkipTrace}
            disabled={disabled || loading}
            size={size}
            fullWidth={fullWidth}
          >
            {loading ? 'Searching...' : 'Skip Trace'}
          </Button>
        </span>
      </Tooltip>
      
      {error && (
        <div style={{ color: 'red', marginTop: '5px', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}
      
      {skipTraceResult && (
        <SkipTraceResultModal
          open={modalOpen}
          onClose={handleCloseModal}
          skipTraceData={skipTraceResult}
          propertyAddress={propertyAddress}
        />
      )}
    </>
  );
};

export default SkipTraceButton;
