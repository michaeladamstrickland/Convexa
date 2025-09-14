import React from 'react';
import { Box, Typography } from '@mui/material';
import KanbanBoard from '../components/KanbanBoard';

const KanbanPage = () => {
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Lead Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Drag and drop leads between columns to update their status
        </Typography>
      </Box>
      
      <KanbanBoard />
    </Box>
  );
};

export default KanbanPage;
