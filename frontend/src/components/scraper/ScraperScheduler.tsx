import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Chip,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  Add as AddIcon,
  Delete as DeleteIcon, 
  Edit as EditIcon,
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon 
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { scraperApi } from '../../services/scraperApi';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const validationSchema = yup.object({
  name: yup.string().required('Schedule name is required'),
  scraperType: yup.string().required('Scraper type is required'),
  cronExpression: yup.string().required('Schedule is required'),
  locations: yup.array().min(1, 'At least one location is required'),
  maxPages: yup.number().min(1, 'Min pages should be at least 1').max(20, 'Max pages should not exceed 20'),
});

const scraperTypes = [
  { value: 'zillow_fsbo', label: 'Zillow For Sale By Owner' },
  { value: 'auction_com', label: 'Auction.com' },
];

export const ScraperScheduler = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [runningJob, setRunningJob] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: '',
      scraperType: 'zillow_fsbo',
      cronExpression: '0 0 * * *', // Daily at midnight
      locations: [],
      maxPages: 3,
      isActive: true,
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        const config = {
          locations: values.locations,
          maxPages: values.maxPages,
        };
        
        if (editingSchedule) {
          // Update existing schedule
          await scraperApi.updateSchedule(
            editingSchedule.id,
            {
              name: values.name,
              cronExpression: values.cronExpression,
              config,
              isActive: values.isActive,
            }
          );
          toast.success('Schedule updated successfully');
        } else {
          // Create new schedule
          await scraperApi.createSchedule({
            name: values.name,
            scraperType: values.scraperType,
            cronExpression: values.cronExpression,
            config,
          });
          toast.success('Schedule created successfully');
        }
        
        setDialogOpen(false);
        setEditingSchedule(null);
        fetchSchedules();
      } catch (error) {
        console.error('Error saving schedule:', error);
        toast.error('Failed to save schedule');
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await scraperApi.getSchedules();
      setSchedules(response.data.schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (schedule = null) => {
    if (schedule) {
      const config = JSON.parse(schedule.config);
      formik.setValues({
        name: schedule.name,
        scraperType: schedule.scraperType,
        cronExpression: schedule.cronExpression,
        locations: config.locations || [],
        maxPages: config.maxPages || 3,
        isActive: schedule.isActive,
      });
      setEditingSchedule(schedule);
    } else {
      formik.resetForm();
      setEditingSchedule(null);
    }
    setDialogOpen(true);
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        setLoading(true);
        await scraperApi.deleteSchedule(id);
        toast.success('Schedule deleted successfully');
        fetchSchedules();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        toast.error('Failed to delete schedule');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRunSchedule = async (id) => {
    try {
      setRunningJob(true);
      await scraperApi.runSchedule(id);
      toast.success('Schedule job started successfully');
      fetchSchedules();
    } catch (error) {
      console.error('Error running schedule:', error);
      toast.error('Failed to run schedule');
    } finally {
      setRunningJob(false);
    }
  };

  const addLocation = () => {
    const locationInput = document.getElementById('location-input');
    const location = locationInput.value.trim();
    
    if (location) {
      formik.setFieldValue('locations', [...formik.values.locations, location]);
      locationInput.value = '';
    }
  };

  const removeLocation = (index) => {
    const updatedLocations = [...formik.values.locations];
    updatedLocations.splice(index, 1);
    formik.setFieldValue('locations', updatedLocations);
  };

  const getScraperTypeLabel = (type) => {
    const scraperType = scraperTypes.find(st => st.value === type);
    return scraperType ? scraperType.label : type;
  };

  const formatCronDescription = (cron) => {
    const parts = cron.split(' ');
    
    if (parts.length !== 5) return 'Invalid cron expression';
    
    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];
    
    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return 'Daily at midnight';
    } else if (minute === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour}:00`;
    } else if (dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
      return `Weekly on Sunday at ${hour}:${minute === '0' ? '00' : minute}`;
    } else if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
      return `Monthly on the 1st at ${hour}:${minute === '0' ? '00' : minute}`;
    } else {
      return cron;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Schedule Name',
      flex: 1,
      renderCell: (params) => (
        <Box>
          <Typography variant="body1">{params.row.name}</Typography>
          <Typography variant="caption" color="textSecondary">
            {getScraperTypeLabel(params.row.scraperType)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'cronExpression',
      headerName: 'Schedule',
      flex: 1,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{formatCronDescription(params.row.cronExpression)}</Typography>
          <Typography variant="caption" color="textSecondary">{params.row.cronExpression}</Typography>
        </Box>
      ),
    },
    {
      field: 'nextRunAt',
      headerName: 'Next Run',
      flex: 1,
      valueFormatter: (params) => {
        return params.value ? format(new Date(params.value), 'MMM d, yyyy h:mm a') : 'Not scheduled';
      },
    },
    {
      field: 'lastRunAt',
      headerName: 'Last Run',
      flex: 1,
      valueFormatter: (params) => {
        return params.value ? format(new Date(params.value), 'MMM d, yyyy h:mm a') : 'Never run';
      },
    },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.isActive ? 'Active' : 'Inactive'}
          color={params.row.isActive ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Run now">
            <IconButton
              size="small"
              onClick={() => handleRunSchedule(params.row.id)}
              disabled={runningJob}
            >
              <RunIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(params.row)}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteSchedule(params.row.id)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ScheduleIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Schedule Management</Typography>
          </Box>
          <Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchSchedules}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Schedule
            </Button>
          </Box>
        </Box>
        
        {loading && <LinearProgress />}
        
        <DataGrid
          rows={schedules}
          columns={columns}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 5 },
            },
          }}
        />
      </CardContent>
      
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={formik.handleSubmit}>
          <DialogTitle>
            {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="name"
                  name="name"
                  label="Schedule Name"
                  variant="outlined"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={Boolean(editingSchedule)}>
                  <InputLabel id="scraper-type-label">Scraper Type</InputLabel>
                  <Select
                    labelId="scraper-type-label"
                    id="scraperType"
                    name="scraperType"
                    value={formik.values.scraperType}
                    onChange={formik.handleChange}
                    label="Scraper Type"
                  >
                    {scraperTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="cronExpression"
                  name="cronExpression"
                  label="Cron Expression"
                  variant="outlined"
                  value={formik.values.cronExpression}
                  onChange={formik.handleChange}
                  error={formik.touched.cronExpression && Boolean(formik.errors.cronExpression)}
                  helperText={
                    (formik.touched.cronExpression && formik.errors.cronExpression) ||
                    'Format: minute hour day_of_month month day_of_week'
                  }
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="maxPages"
                  name="maxPages"
                  label="Max Pages to Scrape"
                  type="number"
                  variant="outlined"
                  value={formik.values.maxPages}
                  onChange={formik.handleChange}
                  error={formik.touched.maxPages && Boolean(formik.errors.maxPages)}
                  helperText={formik.touched.maxPages && formik.errors.maxPages}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>Locations</Typography>
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <TextField
                    id="location-input"
                    label="Add Location (ZIP, City, State)"
                    variant="outlined"
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    sx={{ ml: 2 }}
                    onClick={addLocation}
                  >
                    Add
                  </Button>
                </Box>
                
                {formik.touched.locations && Boolean(formik.errors.locations) && (
                  <Typography color="error" variant="caption">
                    {formik.errors.locations}
                  </Typography>
                )}
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {formik.values.locations.map((location, index) => (
                    <Chip
                      key={index}
                      label={location}
                      onDelete={() => removeLocation(index)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Card>
  );
};
