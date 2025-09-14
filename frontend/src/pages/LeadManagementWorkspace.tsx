// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Link } from 'react-router-dom';
import {
  Add,
  Search,
  FilterList,
  Sort,
  Edit,
  Delete,
  Phone,
  Email,
  CalendarToday,
  Notes,
  Refresh,
  GetApp,
  Send,
  Home,
  ArrowBack,
  Chat,
  Person,
  AttachMoney,
  OpenInNew
} from '@mui/icons-material';

import { LeadService, Lead, LeadFilter, Communication } from '../services/leadService';
import CrmActivityTimeline from '../components/crm/CrmActivityTimeline';
import { useCrmActivity } from '../hooks/useCrmActivity';
import { CrmComposerModal, SkipTraceButton } from '../components';

// Communication form component
const CommunicationForm: React.FC<{ leadId: string; onComplete?: () => void }> = ({ leadId, onComplete }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('phone');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await LeadService.addCommunication(leadId, {
        leadId,
        date,
        method,
        notes,
        outcome
      });
      
      setDate(new Date().toISOString().split('T')[0]);
      setMethod('phone');
      setNotes('');
      setOutcome('');
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error adding communication:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
  <Grid xs={12} sm={6}>
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>
  <Grid xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Method</InputLabel>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              label="Method"
              required
            >
              <MenuItem value="phone">Phone Call</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="text">Text Message</MenuItem>
              <MenuItem value="inperson">In-Person</MenuItem>
              <MenuItem value="mail">Direct Mail</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Grid>
  <Grid xs={12}>
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the communication..."
          />
        </Grid>
  <Grid xs={12}>
          <TextField
            fullWidth
            label="Outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Result of the communication..."
          />
        </Grid>
  <Grid xs={12}>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
            fullWidth
          >
            {isSubmitting ? 'Saving...' : 'Add Communication'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

// Lead detail view component
const LeadDetailView: React.FC<{ lead: Lead; onClose: () => void; onRefresh: (id: string) => void }> = ({ lead, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ ...lead });
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const crm = useCrmActivity(lead.id);
  const [composerOpen, setComposerOpen] = useState(false);
  
  useEffect(() => {
    setEditData({ ...lead });
  }, [lead]);
  
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  const handleSaveChanges = async () => {
    try {
      await LeadService.updateLead(lead.id!, editData);
      setEditMode(false);
      setSnackbarMessage('Lead updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      if (onRefresh) {
        onRefresh(lead.id!);
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      setSnackbarMessage('Failed to update lead');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  // Format currency
  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const getStatusChipColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'new') return 'info';
    if (statusLower === 'contacted') return 'primary';
    if (statusLower === 'negotiating') return 'warning';
    if (statusLower === 'under contract') return 'secondary';
    if (statusLower === 'closed') return 'success';
    if (statusLower === 'dead') return 'error';
    return 'default';
  };
  
  return (
    <Box sx={{ mt: 2 }}>
      {/* Header Actions */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onClose}
        >
          Back to Leads
        </Button>
        
        <Box>
          {editMode ? (
            <>
              <Button
                variant="outlined"
                onClick={() => setEditMode(false)}
                sx={{ mr: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveChanges}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => setEditMode(true)}
                sx={{ mr: 1 }}
              >
                Edit Lead
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Phone />}
                onClick={() => setCommunicationDialogOpen(true)}
              >
                Add Communication
              </Button>
            </>
          )}
        </Box>
      </Box>
      
      {/* Lead Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h5" gutterBottom>
                {editMode ? (
                  <TextField
                    value={editData.address}
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                    variant="standard"
                    fullWidth
                  />
                ) : (
                  lead.address
                )}
              </Typography>
              <Typography variant="subtitle1">
                {editMode ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      value={editData.city}
                      onChange={(e) => setEditData({...editData, city: e.target.value})}
                      variant="standard"
                      size="small"
                      label="City"
                    />
                    <TextField
                      value={editData.state}
                      onChange={(e) => setEditData({...editData, state: e.target.value})}
                      variant="standard"
                      size="small"
                      label="State"
                    />
                    <TextField
                      value={editData.zipCode}
                      onChange={(e) => setEditData({...editData, zipCode: e.target.value})}
                      variant="standard"
                      size="small"
                      label="ZIP"
                    />
                  </Box>
                ) : (
                  `${lead.city}, ${lead.state} ${lead.zipCode}`
                )}
              </Typography>
            </Box>
            
            <Box>
              {editMode ? (
                <FormControl fullWidth variant="standard" sx={{ mb: 2, minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editData.status}
                    onChange={(e) => setEditData({...editData, status: e.target.value})}
                  >
                    <MenuItem value="New">New</MenuItem>
                    <MenuItem value="Contacted">Contacted</MenuItem>
                    <MenuItem value="Negotiating">Negotiating</MenuItem>
                    <MenuItem value="Under Contract">Under Contract</MenuItem>
                    <MenuItem value="Closed">Closed</MenuItem>
                    <MenuItem value="Dead">Dead</MenuItem>
                  </Select>
                </FormControl>
              ) : (
                <Chip 
                  label={lead.status} 
                  color={getStatusChipColor(lead.status)}
                  sx={{ fontWeight: 'bold' }}
                />
              )}
              
              <Typography 
                variant="h6" 
                color="primary" 
                align="right"
                sx={{ mt: 1 }}
              >
                {editMode ? (
                  <TextField
                    value={editData.estimatedValue || ''}
                    onChange={(e) => setEditData({...editData, estimatedValue: parseFloat(e.target.value) || 0})}
                    variant="standard"
                    type="number"
                    InputProps={{
                      startAdornment: '$',
                    }}
                  />
                ) : (
                  formatCurrency(lead.estimatedValue)
                )}
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid xs={12} sm={4} md={3}>
              <Typography variant="body2" color="text.secondary">Owner</Typography>
              <Typography variant="body1">
                {editMode ? (
                  <TextField
                    value={editData.ownerName}
                    onChange={(e) => setEditData({...editData, ownerName: e.target.value})}
                    variant="standard"
                    fullWidth
                  />
                ) : (
                  lead.ownerName || 'Unknown'
                )}
              </Typography>
            </Grid>
            
            <Grid xs={12} sm={4} md={3}>
              <Typography variant="body2" color="text.secondary">Property Type</Typography>
              <Typography variant="body1">
                {editMode ? (
                  <TextField
                    value={editData.propertyType || ''}
                    onChange={(e) => setEditData({...editData, propertyType: e.target.value})}
                    variant="standard"
                    fullWidth
                  />
                ) : (
                  lead.propertyType || 'N/A'
                )}
              </Typography>
            </Grid>
            
            <Grid xs={12} sm={4} md={2}>
              <Typography variant="body2" color="text.secondary">Last Sale Price</Typography>
              <Typography variant="body1">
                {editMode ? (
                  <TextField
                    value={editData.lastSalePrice || ''}
                    onChange={(e) => setEditData({...editData, lastSalePrice: parseFloat(e.target.value) || 0})}
                    variant="standard"
                    type="number"
                    InputProps={{
                      startAdornment: '$',
                    }}
                  />
                ) : (
                  formatCurrency(lead.lastSalePrice)
                )}
              </Typography>
            </Grid>
            
            <Grid xs={12} sm={4} md={2}>
              <Typography variant="body2" color="text.secondary">Source</Typography>
              <Typography variant="body1">
                {editMode ? (
                  <TextField
                    value={editData.leadSource}
                    onChange={(e) => setEditData({...editData, leadSource: e.target.value})}
                    variant="standard"
                    fullWidth
                  />
                ) : (
                  lead.leadSource
                )}
              </Typography>
            </Grid>
            
            <Grid xs={12} sm={4} md={2}>
              <Typography variant="body2" color="text.secondary">Last Contact</Typography>
              <Typography variant="body1">
                {formatDate(lead.lastContact)}
              </Typography>
            </Grid>
          </Grid>
          
          {lead.tags && lead.tags.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {lead.tags.map((tag: string) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
      
      {/* Tabs Section */}
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="lead details tabs">
            <Tab label="Communication History" />
            <Tab label="Property Details" />
            <Tab label="Notes & Follow-up" />
            <Tab label="CRM" />
          </Tabs>
        </Box>
        
        {/* Communication History Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => setCommunicationDialogOpen(true)}
            >
              Add Communication
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Outcome</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lead.communication && lead.communication.length > 0 ? (
                  lead.communication.map((comm: Communication) => (
                    <TableRow key={comm.id}>
                      <TableCell>{formatDate(comm.date)}</TableCell>
                      <TableCell>
                        {comm.method === 'phone' && <Phone fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {comm.method === 'email' && <Email fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {comm.method === 'text' && <Chat fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {comm.method === 'inperson' && <Person fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {comm.method === 'mail' && <Email fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {comm.method}
                      </TableCell>
                      <TableCell>{comm.notes}</TableCell>
                      <TableCell>{comm.outcome}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No communication history found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* CRM Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">CRM Activity</Typography>
            <Button variant="outlined" onClick={() => setComposerOpen(true)}>+ Add Activity</Button>
          </Box>
          <CrmActivityTimeline activities={crm.data || []} isLoading={crm.isLoading} error={crm.error} />
          {composerOpen && (
            <CrmComposerModal
              leadId={lead.id!}
              onClose={() => setComposerOpen(false)}
              onCreated={() => {
                setComposerOpen(false);
                crm.refetch();
              }}
            />
          )}
        </TabPanel>
        
        {/* Property Details Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Home sx={{ mr: 1, verticalAlign: 'top' }} />
                    Property Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Property Type</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.propertyType || ''}
                            onChange={(e) => setEditData({...editData, propertyType: e.target.value})}
                            variant="standard"
                            fullWidth
                          />
                        ) : (
                          lead.propertyType || 'N/A'
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Year Built</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.yearBuilt || ''}
                            onChange={(e) => setEditData({...editData, yearBuilt: parseInt(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                          />
                        ) : (
                          lead.yearBuilt || 'N/A'
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Square Feet</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.squareFeet || ''}
                            onChange={(e) => setEditData({...editData, squareFeet: parseInt(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                          />
                        ) : (
                          lead.squareFeet ? lead.squareFeet.toLocaleString() : 'N/A'
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Bedrooms</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.bedrooms || ''}
                            onChange={(e) => setEditData({...editData, bedrooms: parseInt(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                          />
                        ) : (
                          lead.bedrooms || 'N/A'
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Bathrooms</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.bathrooms || ''}
                            onChange={(e) => setEditData({...editData, bathrooms: parseInt(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                          />
                        ) : (
                          lead.bathrooms || 'N/A'
                        )}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AttachMoney sx={{ mr: 1, verticalAlign: 'top' }} />
                    Financial Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Estimated Value</Typography>
                      <Typography variant="body1" color="primary" sx={{ fontWeight: 'medium' }}>
                        {editMode ? (
                          <TextField
                            value={editData.estimatedValue || ''}
                            onChange={(e) => setEditData({...editData, estimatedValue: parseFloat(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                            InputProps={{
                              startAdornment: '$',
                            }}
                          />
                        ) : (
                          formatCurrency(lead.estimatedValue)
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Last Sale Price</Typography>
                      <Typography variant="body1">
                        {editMode ? (
                          <TextField
                            value={editData.lastSalePrice || ''}
                            onChange={(e) => setEditData({...editData, lastSalePrice: parseFloat(e.target.value) || 0})}
                            variant="standard"
                            type="number"
                            InputProps={{
                              startAdornment: '$',
                            }}
                          />
                        ) : (
                          formatCurrency(lead.lastSalePrice)
                        )}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={12}>
                      <Typography variant="body2" color="text.secondary">Estimated Equity</Typography>
                      <Typography 
                        variant="body1" 
                        color={(lead.estimatedValue && lead.lastSalePrice && lead.estimatedValue > lead.lastSalePrice) ? 'success.main' : 'text.primary'}
                      >
                        {lead.estimatedValue && lead.lastSalePrice ? 
                          formatCurrency(lead.estimatedValue - lead.lastSalePrice) : 'N/A'}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={12}>
                      <Button
                        variant="outlined"
                        startIcon={<OpenInNew />}
                        href={`https://maps.google.com/?q=${encodeURIComponent(lead.address + ', ' + lead.city + ', ' + lead.state + ' ' + lead.zipCode)}`}
                        target="_blank"
                        sx={{ mt: 2 }}
                      >
                        View on Map
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Notes & Follow-up Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Notes sx={{ mr: 1, verticalAlign: 'top' }} />
                    Notes
                  </Typography>
                  
                  {editMode ? (
                    <TextField
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({...editData, notes: e.target.value})}
                      variant="outlined"
                      multiline
                      rows={6}
                      fullWidth
                      placeholder="Enter notes about this lead..."
                    />
                  ) : (
                    <Typography variant="body1" paragraph>
                      {lead.notes || 'No notes available for this lead.'}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <CalendarToday sx={{ mr: 1, verticalAlign: 'top' }} />
                    Follow-up
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid xs={12}>
                      <Typography variant="body2" color="text.secondary">Next Follow-up Date</Typography>
                      {editMode ? (
                        <TextField
                          type="date"
                          value={editData.nextFollowUp?.split('T')[0] || ''}
                          onChange={(e) => setEditData({...editData, nextFollowUp: e.target.value})}
                          variant="standard"
                          fullWidth
                          InputLabelProps={{
                            shrink: true,
                          }}
                        />
                      ) : (
                        <Typography variant="body1">
                          {lead.nextFollowUp ? formatDate(lead.nextFollowUp) : 'No follow-up scheduled'}
                        </Typography>
                      )}
                    </Grid>
                    
                    <Grid xs={12}>
                      <Typography variant="body2" color="text.secondary">Last Contact</Typography>
                      <Typography variant="body1">
                        {formatDate(lead.lastContact)}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={12}>
                      <Typography variant="body2" color="text.secondary">Lead Created</Typography>
                      <Typography variant="body1">
                        {formatDate(lead.createdAt)}
                      </Typography>
                    </Grid>
                    
                    <Grid xs={12}>
                      <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Tags</InputLabel>
                        <Select
                          multiple
                          value={editData.tags || []}
                          onChange={(e) => setEditData({...editData, tags: e.target.value as string[]})}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as string[]).map((value) => (
                                <Chip key={value} label={value} size="small" />
                              ))}
                            </Box>
                          )}
                          disabled={!editMode}
                        >
                          {['Motivated Seller', 'Cash Buyer', 'Rehab', 'Rental', 'Wholesale', 'Absentee Owner', 'Vacant', 'Inherited', 'Urgent', 'High Equity', 'Pre-Foreclosure'].map((tag) => (
                            <MenuItem key={tag} value={tag}>
                              {tag}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
      
      {/* Communication Dialog */}
      <Dialog
        open={communicationDialogOpen}
        onClose={() => setCommunicationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Communication</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <CommunicationForm 
              leadId={lead.id!} 
              onComplete={() => {
                setCommunicationDialogOpen(false);
                setSnackbarMessage('Communication added successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                if (onRefresh) {
                  onRefresh(lead.id!);
                }
              }} 
            />
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// TabPanel component for tab content
function TabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Main LeadManagementWorkspace component
const LeadManagementWorkspace: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<LeadFilter>({});
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [listComposerLeadId, setListComposerLeadId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchLeads();
    fetchLeadStatuses();
  }, []);
  
  useEffect(() => {
    if (selectedLead) {
      fetchLeadDetails(selectedLead.id!);
    }
  }, [selectedLead?.id]);
  
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LeadService.getLeads(filters);
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError('Failed to load leads. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchLeadDetails = async (leadId: string) => {
    try {
      const leadDetails = await LeadService.getLeadById(leadId);
      setSelectedLead(leadDetails);
    } catch (error) {
      console.error('Error fetching lead details:', error);
      setSnackbarMessage('Failed to load lead details');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const fetchLeadStatuses = async () => {
    try {
      const statuses = await LeadService.getLeadStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  };
  
  const handleFilterChange = (newFilters: LeadFilter) => {
    setFilters(newFilters);
    setFilterDialogOpen(false);
    fetchLeads();
  };
  
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  const handleSearch = () => {
    // Apply the search query as a filter
    if (searchQuery) {
      fetchLeads();
    }
  };
  
  const handleDeleteLead = async (leadId: string) => {
    try {
      await LeadService.deleteLead(leadId);
      setSnackbarMessage('Lead deleted successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      setSnackbarMessage('Failed to delete lead');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  // Format currency
  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const getStatusChipColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'new') return 'info';
    if (statusLower === 'contacted') return 'primary';
    if (statusLower === 'negotiating') return 'warning';
    if (statusLower === 'under contract') return 'secondary';
    if (statusLower === 'closed') return 'success';
    if (statusLower === 'dead') return 'error';
    return 'default';
  };
  
  const handleExport = () => {
    const csv = LeadService.exportToCSV(leads);
    LeadService.downloadCSV(csv);
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Lead Management
      </Typography>
      
      {/* Action Bar */}
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <TextField
          label="Search Leads"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ flexGrow: 1 }}
          InputProps={{
            endAdornment: (
              <IconButton size="small" onClick={handleSearch}>
                <Search />
              </IconButton>
            )
          }}
        />
        
        <Button
          variant="outlined"
          startIcon={<FilterList />}
          onClick={() => setFilterDialogOpen(true)}
        >
          Filters
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<Sort />}
        >
          Sort
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchLeads}
        >
          Refresh
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<GetApp />}
          onClick={handleExport}
        >
          Export
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Lead List / Detail View */}
      <Box sx={{ mb: 4 }}>
        {selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onRefresh={fetchLeadDetails}
          />
        ) : (
          <>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Address</TableCell>
                        <TableCell>Owner</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Est. Value
                            <IconButton size="small" onClick={() => handleSortChange('estimatedValue')}>
                              <Sort fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Last Contact
                            <IconButton size="small" onClick={() => handleSortChange('lastContact')}>
                              <Sort fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leads.length > 0 ? (
                        leads.map((lead) => (
                          <TableRow 
                            key={lead.id}
                            hover
                            onClick={() => setSelectedLead(lead)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {lead.address}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {lead.city}, {lead.state} {lead.zipCode}
                              </Typography>
                            </TableCell>
                            <TableCell>{lead.ownerName}</TableCell>
                            <TableCell>{formatCurrency(lead.estimatedValue)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={lead.status} 
                                size="small"
                                color={getStatusChipColor(lead.status)}
                              />
                            </TableCell>
                            <TableCell>
                              {lead.lastContact ? formatDate(lead.lastContact) : 'Never'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }} onClick={(e)=>e.stopPropagation()}>
                                {/* Skip Trace */}
                                <SkipTraceButton leadId={lead.id!} />

                                {/* Add Note (CRM) */}
                                <Button size="small" variant="text" onClick={() => setListComposerLeadId(lead.id!)}>
                                  Add Note
                                </Button>

                                {/* View Detail */}
                                <Button size="small" variant="text" component={Link as any} to={`/leads/${lead.id}`} onClick={(e)=>e.stopPropagation()}>
                                  View Detail
                                </Button>

                                {/* Edit (inline) */}
                                <IconButton 
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLead(lead);
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Are you sure you want to delete this lead?')) {
                                      handleDeleteLead(lead.id!);
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body1" sx={{ py: 3 }}>
                              No leads found. Try adjusting your filters or adding new leads.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </Box>

      {/* List-level CRM Composer */}
      {listComposerLeadId && (
        <CrmComposerModal
          leadId={listComposerLeadId}
          onClose={() => setListComposerLeadId(null)}
          onCreated={() => {
            setListComposerLeadId(null);
            // If the created note is for the currently selected lead, refresh its details; else refresh list
            if (selectedLead && selectedLead.id === listComposerLeadId) {
              fetchLeadDetails(selectedLead.id!);
            } else {
              fetchLeads();
            }
          }}
        />
      )}
      
      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Filter Leads</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={filters.status || []}
                  onChange={(e) => setFilters({...filters, status: e.target.value as string[]})}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Min Value"
                type="number"
                value={filters.minValue || ''}
                onChange={(e) => setFilters({...filters, minValue: e.target.value ? parseInt(e.target.value) : undefined})}
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>
            
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Value"
                type="number"
                value={filters.maxValue || ''}
                onChange={(e) => setFilters({...filters, maxValue: e.target.value ? parseInt(e.target.value) : undefined})}
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>
            
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="City"
                value={filters.city || ''}
                onChange={(e) => setFilters({...filters, city: e.target.value})}
              />
            </Grid>
            
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="State"
                value={filters.state || ''}
                onChange={(e) => setFilters({...filters, state: e.target.value})}
              />
            </Grid>
            
            <Grid xs={12}>
              <FormControl fullWidth>
                <InputLabel>Lead Source</InputLabel>
                <Select
                  multiple
                  value={filters.leadSource || []}
                  onChange={(e) => setFilters({...filters, leadSource: e.target.value as string[]})}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="Property Search">Property Search</MenuItem>
                  <MenuItem value="Direct Mail">Direct Mail</MenuItem>
                  <MenuItem value="Cold Call">Cold Call</MenuItem>
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setFilters({});
              setFilterDialogOpen(false);
              fetchLeads();
            }}
          >
            Clear Filters
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleFilterChange(filters)}
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LeadManagementWorkspace;
