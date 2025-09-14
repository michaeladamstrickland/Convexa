import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { toast } from 'react-toastify';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Grid,
  Chip,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  Add as AddIcon,
  NotificationsActive as HotIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

// Status columns for the Kanban board
const STATUSES = {
  NEW: { name: 'New Leads', color: '#e3f2fd' },
  CONTACTED: { name: 'Contacted', color: '#fff9c4' },
  NEGOTIATING: { name: 'Negotiating', color: '#ffecb3' },
  UNDER_CONTRACT: { name: 'Under Contract', color: '#c8e6c9' },
  CLOSED: { name: 'Closed', color: '#d1c4e9' },
};

const KanbanBoard = () => {
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [exportUrl, setExportUrl] = useState('/api/export/leads');

  // Fetch leads for Kanban board
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/kanban');
        if (response.data.success) {
          setColumns(response.data.columns);
        } else {
          toast.error('Failed to fetch leads');
        }
      } catch (error) {
        console.error('Error fetching Kanban board:', error);
        toast.error('Error fetching Kanban board');
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Fetch activity for a lead
  const fetchActivity = async (leadId) => {
    try {
      setActivityLoading(true);
      const response = await axios.get(`/api/kanban/leads/${leadId}/activity`);
      if (response.data.success) {
        setActivities(response.data.activities);
      } else {
        toast.error('Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Error fetching activity');
    } finally {
      setActivityLoading(false);
    }
  };

  // Open activity dialog
  const handleOpenActivity = (lead) => {
    setSelectedLead(lead);
    setActivityOpen(true);
    fetchActivity(lead.id);
  };

  // Close activity dialog
  const handleCloseActivity = () => {
    setActivityOpen(false);
    setSelectedLead(null);
    setActivities([]);
    setNoteText('');
  };

  // Add a note to a lead
  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.warning('Please enter a note');
      return;
    }

    try {
      setActivityLoading(true);
      const response = await axios.post(`/api/kanban/leads/${selectedLead.id}/note`, {
        text: noteText,
      });

      if (response.data.success) {
        toast.success('Note added');
        setNoteText('');
        fetchActivity(selectedLead.id); // Refresh activities
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Error adding note');
    } finally {
      setActivityLoading(false);
    }
  };

  // Handle drag and drop
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // Dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Find the source and destination columns
    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];

    // Find the lead being dragged
    const lead = sourceColumn.find((lead) => lead.id === draggableId);

    // If no change in status, just reorder within the column
    if (source.droppableId === destination.droppableId) {
      const newColumn = [...sourceColumn];
      newColumn.splice(source.index, 1);
      newColumn.splice(destination.index, 0, lead);
      
      setColumns({
        ...columns,
        [source.droppableId]: newColumn,
      });
      
      return;
    }

    // If status has changed, update on server
    try {
      const response = await axios.patch(`/api/kanban/leads/${lead.id}/status`, {
        status: destination.droppableId,
      });

      if (response.data.success) {
        // Remove from source column
        const newSourceColumn = [...sourceColumn];
        newSourceColumn.splice(source.index, 1);
        
        // Add to destination column
        const newDestColumn = [...destColumn];
        newDestColumn.splice(destination.index, 0, {
          ...lead,
          status: destination.droppableId,
        });
        
        // Update state
        setColumns({
          ...columns,
          [source.droppableId]: newSourceColumn,
          [destination.droppableId]: newDestColumn,
        });
        
        toast.success(`Lead moved to ${STATUSES[destination.droppableId].name}`);
      } else {
        toast.error('Failed to update lead status');
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Error updating lead status');
    }
  };

  // Generate export URL with current filters
  const handleExport = () => {
    // Open in new tab
    window.open(exportUrl, '_blank');
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Kanban Lead Board</Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddIcon />}
          onClick={handleExport}
        >
          Export to CSV
        </Button>
      </Box>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Grid container spacing={2}>
          {Object.keys(STATUSES).map((status) => (
            <Grid xs={12} sm={6} md={2.4} key={status}>
              <Paper
                sx={{
                  p: 1,
                  backgroundColor: STATUSES[status].color,
                  borderRadius: 2,
                  height: 'calc(100vh - 180px)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: 1,
                    mb: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="bold">
                    {STATUSES[status].name}
                  </Typography>
                  <Chip
                    label={columns[status]?.length || 0}
                    size="small"
                    color="primary"
                  />
                </Box>
                
                <Droppable droppableId={status}>
                  {(provided) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        flexGrow: 1,
                        overflowY: 'auto',
                      }}
                    >
                      {columns[status]?.map((lead, index) => (
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              sx={{
                                mb: 1,
                                boxShadow: snapshot.isDragging
                                  ? '0 5px 15px rgba(0,0,0,0.3)'
                                  : 'none',
                                transform: snapshot.isDragging
                                  ? 'rotate(3deg)'
                                  : 'none',
                                '&:hover': {
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                },
                              }}
                            >
                              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                <Box display="flex" justifyContent="space-between">
                                  <Typography variant="subtitle2" noWrap sx={{ maxWidth: '70%' }}>
                                    {lead.address}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenActivity(lead)}
                                  >
                                    <InfoIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                                
                                {lead.owner_name && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    {lead.owner_name}
                                  </Typography>
                                )}
                                
                                <Box display="flex" alignItems="center" mt={1} gap={0.5}>
                                  {lead.temperature_tag === 'HOT' && (
                                    <HotIcon fontSize="small" color="error" />
                                  )}
                                  
                                  {lead.best_phone && (
                                    <IconButton size="small" href={`tel:${lead.best_phone}`}>
                                      <PhoneIcon fontSize="small" color="primary" />
                                    </IconButton>
                                  )}
                                  
                                  {lead.best_email && (
                                    <IconButton size="small" href={`mailto:${lead.best_email}`}>
                                      <EmailIcon fontSize="small" color="primary" />
                                    </IconButton>
                                  )}
                                  
                                  {lead.ai_score && (
                                    <Chip
                                      label={`AI: ${lead.ai_score}`}
                                      size="small"
                                      color={lead.ai_score > 70 ? 'success' : lead.ai_score > 40 ? 'warning' : 'default'}
                                      sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                                
                                {lead.last_activity_at && (
                                  <Typography
                                    variant="caption"
                                    display="block"
                                    color="text.secondary"
                                    sx={{ mt: 0.5, fontSize: '0.65rem' }}
                                  >
                                    Updated {formatDistanceToNow(new Date(lead.last_activity_at))} ago
                                  </Typography>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {!columns[status]?.length && (
                        <Box
                          sx={{
                            p: 2,
                            textAlign: 'center',
                            color: 'text.secondary',
                            backgroundColor: 'rgba(255,255,255,0.6)',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2">No leads</Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </Droppable>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DragDropContext>
      
      {/* Activity/Notes Dialog */}
      <Dialog
        open={activityOpen}
        onClose={handleCloseActivity}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {selectedLead?.address}
            <IconButton edge="end" onClick={handleCloseActivity}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom>
              Add a Note
            </Typography>
            <TextField
              multiline
              rows={2}
              fullWidth
              variant="outlined"
              placeholder="Type your note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              InputProps={{
                endAdornment: (
                  <Button
                    onClick={handleAddNote}
                    disabled={activityLoading}
                    variant="contained"
                    size="small"
                  >
                    Add
                  </Button>
                ),
              }}
            />
          </Box>
          
          <Typography variant="subtitle1" gutterBottom>
            Activity History
          </Typography>
          
          {activityLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <List>
              {activities.length > 0 ? (
                activities.map((activity, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            {activity.type === 'note' ? (
                              activity.text
                            ) : activity.type === 'status_change' ? (
                              <>Status changed from <b>{activity.from}</b> to <b>{activity.to}</b></>
                            ) : (
                              activity.type
                            )}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(activity.at))} ago
                            {activity.by && ` by ${activity.by}`}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < activities.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="No activity recorded for this lead." />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActivity}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanBoard;

