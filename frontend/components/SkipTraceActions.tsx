import React, { useState } from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BulkSkipTraceModal from './BulkSkipTraceModal';

interface SkipTraceActionsProps {
  leads: any[]; 
  onSkipTraceComplete: (updatedLeads: any[]) => void;
  disabled?: boolean;
}

const SkipTraceActions: React.FC<SkipTraceActionsProps> = ({
  leads,
  onSkipTraceComplete,
  disabled = false
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSkipTraceComplete = (results: any[]) => {
    onSkipTraceComplete(results);
  };

  // Count leads that don't have skip trace data
  const leadsWithoutSkipTrace = leads.filter(lead => !lead.hasSkipTrace).length;

  return (
    <Box>
      <Tooltip title={disabled || leadsWithoutSkipTrace === 0 ? 
        "No leads available for skip trace" : 
        `Run skip trace on ${leadsWithoutSkipTrace} leads`}>
        <span>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<GroupAddIcon />}
            onClick={handleOpenModal}
            disabled={disabled || leadsWithoutSkipTrace === 0}
            sx={{ mr: 1 }}
          >
            Bulk Skip Trace
          </Button>
        </span>
      </Tooltip>
      
      <BulkSkipTraceModal
        open={modalOpen}
        onClose={handleCloseModal}
        leads={leads}
        onSkipTraceComplete={handleSkipTraceComplete}
      />
    </Box>
  );
};

export default SkipTraceActions;
