import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  CircularProgress,
  Chip
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import axios from 'axios';

interface Lead {
  id: number;
  propertyAddress: string;
  ownerName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  hasSkipTrace?: boolean;
}

interface BulkSkipTraceModalProps {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onSkipTraceComplete: (updatedLeads: any[]) => void;
}

const BulkSkipTraceModal: React.FC<BulkSkipTraceModalProps> = ({
  open,
  onClose,
  leads,
  onSkipTraceComplete
}) => {
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Handler for selecting/deselecting all leads
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Filter out leads that already have skip trace data
      const newSelected = leads
        .filter(lead => !lead.hasSkipTrace)
        .map(lead => lead.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  // Handler for toggling selection of a single lead
  const handleSelectLead = (id: number) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: number[] = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, id];
    } else {
      newSelected = selected.filter(selectedId => selectedId !== id);
    }

    setSelected(newSelected);
  };

  // Check if a lead is selected
  const isSelected = (id: number) => selected.indexOf(id) !== -1;

  // Run skip trace for selected leads
  const handleRunSkipTrace = async () => {
    if (selected.length === 0) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await axios.post('/api/skip-trace/bulk', { leadIds: selected });
      setResults(response.data);
      onSkipTraceComplete(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run bulk skip trace');
      console.error('Bulk skip trace error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Bulk Skip Trace
        <Typography variant="subtitle2" color="text.secondary">
          Select leads to run skip trace
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="200px">
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Running skip trace on {selected.length} leads...
            </Typography>
          </Box>
        ) : results.length > 0 ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Skip Trace Results
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Property Address</TableCell>
                    <TableCell>Owner Name</TableCell>
                    <TableCell>Phone Number</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.leadId}>
                      <TableCell>{result.propertyAddress}</TableCell>
                      <TableCell>{result.ownerName || 'N/A'}</TableCell>
                      <TableCell>{result.phoneNumber || 'N/A'}</TableCell>
                      <TableCell>{result.emailAddress || 'N/A'}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <Chip label="Success" color="success" size="small" />
                        ) : (
                          <Chip label="Failed" color="error" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < leads.filter(lead => !lead.hasSkipTrace).length}
                      checked={leads.length > 0 && selected.length === leads.filter(lead => !lead.hasSkipTrace).length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Property Address</TableCell>
                  <TableCell>Owner Name</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Zip Code</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((lead) => {
                  const isItemSelected = isSelected(lead.id);
                  return (
                    <TableRow
                      hover
                      onClick={() => !lead.hasSkipTrace && handleSelectLead(lead.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={lead.id}
                      selected={isItemSelected}
                      sx={{ 
                        opacity: lead.hasSkipTrace ? 0.6 : 1,
                        pointerEvents: lead.hasSkipTrace ? 'none' : 'auto'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isItemSelected}
                          disabled={lead.hasSkipTrace}
                        />
                      </TableCell>
                      <TableCell>{lead.propertyAddress}</TableCell>
                      <TableCell>{lead.ownerName || 'Unknown'}</TableCell>
                      <TableCell>{lead.city || 'N/A'}</TableCell>
                      <TableCell>{lead.state || 'N/A'}</TableCell>
                      <TableCell>{lead.zipCode || 'N/A'}</TableCell>
                      <TableCell>
                        {lead.hasSkipTrace ? (
                          <Chip label="Completed" color="success" size="small" />
                        ) : (
                          <Chip label="No Data" color="default" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {results.length > 0 ? (
          <Button onClick={onClose} color="primary">
            Close
          </Button>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
              {selected.length} leads selected
            </Typography>
            <Button 
              onClick={onClose} 
              color="inherit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunSkipTrace}
              color="primary"
              variant="contained"
              disabled={selected.length === 0 || loading}
              startIcon={<PersonSearchIcon />}
            >
              Run Skip Trace
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkSkipTraceModal;
