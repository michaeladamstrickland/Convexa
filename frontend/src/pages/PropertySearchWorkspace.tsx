import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Drawer,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel
} from '@mui/material';
import MuiGrid from '@mui/material/Grid';

import {
  Search,
  Save,
  Delete,
  FilterList,
  Add,
  Close,
  Menu as MenuIcon,
  Star,
  StarBorder,
  FileDownload,
  Map
} from '@mui/icons-material';

import PropertyMapView from '../components/PropertyMapView';
import { AttomPropertyService } from '../services/AttomPropertyService';
import { LeadService } from '../services/leadService';
import SavedSearchesAPI, { SavedSearch as APISavedSearch } from '../services/SavedSearchesAPI';

// Alias Grid as any to smooth over MUI Grid typing differences
const Grid: any = (MuiGrid as unknown) as any;

// Saved searches are handled through SavedSearchesAPI (shared axios client)

const PropertySearchWorkspace = () => {
  // Define types for our data structures
interface PropertyFilter {
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  bathrooms: string;
  propertyType: string;
  yearBuiltAfter: string;
  yearBuiltBefore: string;
  squareFeetMin: string;
  squareFeetMax: string;
  zipCode: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  radius: number;
  polygon: Array<{lat: number, lng: number}> | null;
  ownerOccupied?: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  description: string;
  filters: PropertyFilter;
  createdAt: string;
  lastRun: string;
  resultCount: number;
  isFavorite: boolean;
}

interface PropertyResult {
  attomId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  ownerName?: string;
  ownerOccupied?: boolean;
  estimatedValue?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

// State for workspace
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({ open: false, message: '', severity: 'success' });
  
  // State for filters
  const [filters, setFilters] = useState<PropertyFilter>({
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: '',
    propertyType: '',
    yearBuiltAfter: '',
    yearBuiltBefore: '',
    squareFeetMin: '',
    squareFeetMax: '',
    zipCode: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
    radius: 1,
    polygon: null
  });
  
  // State for property search results
  const [searchResults, setSearchResults] = useState<PropertyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Property service is used via static methods
  
  // Load saved searches on component mount
  useEffect(() => {
    loadSavedSearches();
  }, []);
  
  // Handle tab change
  // Tabs have been removed from this workspace; no-op retained for potential future use
  // const handleTabChange = (_event: any, _newValue: number) => {};
  
  // Toggle drawer
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  // Load saved searches
  const loadSavedSearches = async () => {
    setLoading(true);
    try {
      const apiSearches = await SavedSearchesAPI.getSavedSearches();
      const mapped: SavedSearch[] = (apiSearches as APISavedSearch[]).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        filters: s.filters as any,
        createdAt: s.createdAt,
        lastRun: s.lastRun,
        resultCount: s.resultCount,
        isFavorite: s.isFavorite,
      }));
      setSavedSearches(mapped);
    } catch (error) {
      console.error('Error loading saved searches:', error);
      setNotification({ open: true, message: 'Failed to load saved searches', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle save search
  const handleSaveSearch = async () => {
    if (!searchName) {
      setNotification({ open: true, message: 'Search name is required', severity: 'warning' });
      return;
    }
    try {
      const created = await SavedSearchesAPI.createSavedSearch({
        name: searchName,
        description: searchDescription,
        filters,
      });
      setSavedSearches([
        ...savedSearches,
        {
          id: created.id,
          name: created.name,
          description: created.description,
          filters: created.filters as any,
          createdAt: created.createdAt,
          lastRun: created.lastRun,
          resultCount: created.resultCount,
          isFavorite: created.isFavorite,
        },
      ]);
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
      setNotification({ open: true, message: 'Search saved successfully', severity: 'success' });
    } catch (e) {
      setNotification({ open: true, message: 'Failed to save search', severity: 'error' });
    }
  };
  
  // Handle filter change
  const handleFilterChange = (event: any) => {
    const { name, value } = event.target as { name?: string; value: unknown };
    if (name) {
      setFilters({ ...filters, [name]: value });
    }
  };
  
  // Perform real-time property search
  const performPropertySearch = async () => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await AttomPropertyService.searchProperties({
        ...filters,
        // Service expects polygon undefined rather than null
        polygon: filters.polygon ?? undefined,
      } as any);
      setSearchResults(response.properties);
      
      // Update result count in selected search if applicable
      if (selectedSearch) {
        const updatedSearch: SavedSearch = {
          ...selectedSearch,
          lastRun: new Date().toISOString(),
          resultCount: response.properties.length
        };
        setSelectedSearch(updatedSearch);
        
        // Update in saved searches list
        setSavedSearches(savedSearches.map(search => 
          search.id === selectedSearch.id ? updatedSearch : search
        ));
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      setSearchError(error instanceof Error ? error.message : 'An error occurred during property search');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Export search results to CSV
  const exportSearchResults = async () => {
    try {
      setLoading(true);
      
      // Generate CSV data
      const csvData = AttomPropertyService.exportToCSV(searchResults);
      
      // Download the CSV file
      AttomPropertyService.downloadCSV(
        csvData, 
        `property-search-${new Date().toISOString().split('T')[0]}.csv`
      );
      
      setNotification({
        open: true,
        message: 'Export successful',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error exporting search results:', error);
      setNotification({
        open: true,
        message: 'Failed to export search results',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle map search (with polygon, radius, etc.)
  const handleMapSearch = async (mapSearchParams: Partial<PropertyFilter>) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // Combine existing filters with map search parameters
  const searchFilters = {
        ...filters,
        ...mapSearchParams
      };
      
      // Update filters state
      setFilters(searchFilters);
      
      // Perform the search
      const response = await AttomPropertyService.searchProperties({
        ...searchFilters,
        polygon: searchFilters.polygon ?? undefined,
      } as any);
      setSearchResults(response.properties);
    } catch (error) {
      console.error('Error searching properties by map:', error);
      setSearchError(error instanceof Error ? error.message : 'An error occurred during map-based search');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Toggle between list and map view
  const toggleViewMode = () => {
    setViewMode(viewMode === 'list' ? 'map' : 'list');
  };
  
  // Handle select saved search
  const handleSelectSearch = (search: SavedSearch) => {
    setSelectedSearch(search);
    setFilters(search.filters);
  };
  
  // Handle delete saved search
  const handleDeleteSearch = async (searchId: string) => {
    try {
      await SavedSearchesAPI.deleteSavedSearch(searchId);
      setSavedSearches(savedSearches.filter(search => search.id !== searchId));
      if (selectedSearch && selectedSearch.id === searchId) {
        setSelectedSearch(null);
      }
      setNotification({ open: true, message: 'Search deleted successfully', severity: 'success' });
    } catch (e) {
      setNotification({ open: true, message: 'Failed to delete search', severity: 'error' });
    }
  };
  
  // Toggle favorite status
  const handleToggleFavorite = async (searchId: string) => {
    const target = savedSearches.find(s => s.id === searchId);
    const next = !target?.isFavorite;
    setSavedSearches(savedSearches.map(s => s.id === searchId ? { ...s, isFavorite: next } : s));
    try {
      await SavedSearchesAPI.toggleFavoriteStatus(searchId, next);
    } catch (e) {
      // revert on error
      setSavedSearches(savedSearches.map(s => s.id === searchId ? { ...s, isFavorite: !next } : s));
    }
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  // Render saved searches list
  const renderSavedSearchesList = () => {
    if (savedSearches.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No saved searches yet
          </Typography>
          <Button 
            variant="text" 
            startIcon={<Add />} 
            onClick={() => setSaveDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Create your first search
          </Button>
        </Box>
      );
    }
    
    return (
      <List>
        {savedSearches.map(search => (
          <ListItem
            key={search.id}
            disablePadding
            sx={{ mb: 1, pl: 0, pr: 0 }}
          >
            <ListItemButton
              selected={!!(selectedSearch && selectedSearch.id === search.id)}
              onClick={() => handleSelectSearch(search)}
              sx={{
                borderLeft: search.isFavorite ? '3px solid #1976d2' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              <ListItemText
                primary={
                  <Typography component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    {search.name}
                    {search.resultCount > 0 && (
                      <Chip
                        label={search.resultCount}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                }
                secondary={
                  <Typography component="span" variant="body2">
                    <Typography component="span" variant="caption" display="block">
                      {search.description}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      Last run: {new Date(search.lastRun).toLocaleDateString()}
                    </Typography>
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="toggle favorite"
                  onClick={() => handleToggleFavorite(search.id)}
                >
                  {search.isFavorite ? <Star color="primary" /> : <StarBorder />}
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteSearch(search.id)}
                >
                  <Delete />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  };
  
  return (
    <Box sx={{ display: 'flex' }}>
      {/* Drawer for saved searches */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            top: 64, // Adjust based on your layout
            height: 'calc(100% - 64px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
          <Typography variant="h6">Saved Searches</Typography>
          <IconButton onClick={toggleDrawer}>
            <Close />
          </IconButton>
        </Box>
        <Divider />
        {renderSavedSearchesList()}
        <Box sx={{ p: 2 }}>
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            fullWidth
            onClick={() => setSaveDialogOpen(true)}
          >
            New Search
          </Button>
        </Box>
      </Drawer>
      
      {/* Main content */}
      <Box sx={{ flexGrow: 1, ml: drawerOpen ? '320px' : 0, transition: 'margin 0.2s' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Property Search Workspace
            </Typography>
            <Button 
              startIcon={<Save />} 
              color="primary"
              onClick={() => setSaveDialogOpen(true)}
            >
              Save Search
            </Button>
            <Button 
              startIcon={<FilterList />} 
              color="primary"
            >
              Filters
            </Button>
          </Toolbar>
        </AppBar>
        
        {/* Filter bar */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Property Filters
                </Typography>
                <Box>
                  {searchResults.length > 0 && (
                    <Button
                      startIcon={<FileDownload />}
                      onClick={exportSearchResults}
                      sx={{ mr: 1 }}
                      disabled={loading}
                    >
                      Export Results
                    </Button>
                  )}
                  <Button
                    startIcon={<Map />}
                    color={viewMode === 'map' ? 'secondary' : 'primary'}
                    sx={{ mr: 1 }}
                    onClick={toggleViewMode}
                  >
                    {viewMode === 'map' ? 'List View' : 'Map View'}
                  </Button>
                </Box>
              </Box>
            </Grid>
            
            {/* Basic Filters - First Row */}
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                name="minPrice"
                label="Min Price"
                type="number"
                fullWidth
                size="small"
                value={filters.minPrice}
                onChange={handleFilterChange}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                name="maxPrice"
                label="Max Price"
                type="number"
                fullWidth
                size="small"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                name="bedrooms"
                label="Beds"
                type="number"
                fullWidth
                size="small"
                value={filters.bedrooms}
                onChange={handleFilterChange}
                InputProps={{ inputProps: { min: 0, max: 10 } }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                name="bathrooms"
                label="Baths"
                type="number"
                fullWidth
                size="small"
                value={filters.bathrooms}
                onChange={handleFilterChange}
                InputProps={{ inputProps: { min: 0, max: 10, step: 0.5 } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Property Type</InputLabel>
                <Select
                  name="propertyType"
                  value={filters.propertyType}
                  onChange={handleFilterChange}
                  label="Property Type"
                >
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="SingleFamily">Single Family</MenuItem>
                  <MenuItem value="Condo">Condo</MenuItem>
                  <MenuItem value="TownHouse">Town House</MenuItem>
                  <MenuItem value="MultiFamily">Multi-Family</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button 
                variant="contained" 
                color="primary" 
                fullWidth
                onClick={performPropertySearch}
                disabled={isSearching}
                startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <Search />}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </Grid>
            
            {/* Advanced Filters - Second Row */}
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                name="yearBuiltAfter"
                label="Built After"
                type="number"
                fullWidth
                size="small"
                value={filters.yearBuiltAfter}
                onChange={handleFilterChange}
                InputProps={{ inputProps: { min: 1800, max: new Date().getFullYear() } }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                name="yearBuiltBefore"
                label="Built Before"
                type="number"
                fullWidth
                size="small"
                value={filters.yearBuiltBefore}
                onChange={handleFilterChange}
                InputProps={{ inputProps: { min: 1800, max: new Date().getFullYear() } }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                name="squareFeetMin"
                label="Min Sq Ft"
                type="number"
                fullWidth
                size="small"
                value={filters.squareFeetMin}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                name="squareFeetMax"
                label="Max Sq Ft"
                type="number"
                fullWidth
                size="small"
                value={filters.squareFeetMax}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                name="zipCode"
                label="ZIP Code"
                fullWidth
                size="small"
                value={filters.zipCode}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <FormControlLabel 
                control={
                  <Switch 
                    size="small"
                    checked={filters.ownerOccupied === true} 
                    onChange={(e) => setFilters({ 
                      ...filters, 
                      ownerOccupied: e.target.checked ? true : undefined 
                    })} 
                  />
                } 
                label="Owner Occupied" 
              />
            </Grid>
          </Grid>
          
          {/* Search Results Info */}
          {searchResults.length > 0 && !isSearching && (
            <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                Found <strong>{searchResults.length}</strong> properties matching your criteria
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date().toLocaleTimeString()}
              </Typography>
            </Box>
          )}
          
          {searchError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {searchError}
            </Alert>
          )}
        </Paper>
        
        {/* Main workspace content */}
        <Box sx={{ flexGrow: 1 }}>
          {/* Loading Indicator */}
          {isSearching && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', position: 'absolute', zIndex: 1000, left: 0, right: 0 }}>
              <Paper elevation={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography variant="body1">
                  Searching for properties...
                </Typography>
              </Paper>
            </Box>
          )}
          
          {/* Map View */}
          {viewMode === 'map' && (
            <Box sx={{ height: 'calc(100vh - 250px)', width: '100%' }}>
              <PropertyMapView
                properties={searchResults}
                isLoading={isSearching}
                onMapSearch={handleMapSearch}
                onPropertySelect={(property) => AttomPropertyService.getPropertyDetails(property.attomId)}
                filters={filters}
              />
            </Box>
          )}
          
          {/* List View */}
          {viewMode === 'list' && (
            <>
              {searchResults.length > 0 ? (
                <Grid container spacing={3}>
                  {searchResults.map((property) => (
                    <Grid item xs={12} md={6} key={property.attomId}>
                      <Card sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">
                            {property.address}
                          </Typography>
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => {/* Toggle favorite */}}
                          >
                            <StarBorder />
                          </IconButton>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {property.city}, {property.state} {property.zipCode}
                        </Typography>
                        
                        <Box sx={{ mt: 1 }}>
                          <Grid container spacing={1}>
                            <Grid item xs={4}>
                              <Typography variant="body2">
                                <strong>{property.bedrooms || 'N/A'}</strong> Beds
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2">
                                <strong>{property.bathrooms || 'N/A'}</strong> Baths
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2">
                                <strong>{property.squareFeet ? property.squareFeet.toLocaleString() : 'N/A'}</strong> Sq Ft
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                        
                        <Box sx={{ mt: 1, mb: 1 }}>
                          {property.propertyType && (
                            <Chip 
                              label={property.propertyType} 
                              size="small" 
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                          {property.yearBuilt && (
                            <Chip 
                              label={`Built ${property.yearBuilt}`} 
                              size="small" 
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                          {property.ownerOccupied !== undefined && (
                            <Chip 
                              label={property.ownerOccupied ? 'Owner Occupied' : 'Non-Owner Occupied'} 
                              size="small" 
                              color={property.ownerOccupied ? 'success' : 'default'}
                              sx={{ mb: 0.5 }}
                            />
                          )}
                        </Box>
                        
                        <Box sx={{ mt: 'auto', pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="h6" color="primary">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(property.estimatedValue || 0)}
                          </Typography>
                          
                          <Box>
                            <Button 
                              variant="outlined"
                              color="primary"
                              size="small"
                              onClick={() => AttomPropertyService.getPropertyDetails(property.attomId)}
                              sx={{ mr: 1 }}
                            >
                              View Details
                            </Button>
                            <Button 
                              variant="outlined"
                              color="secondary"
                              size="small"
                              onClick={async () => {
                                try {
                                  // Get detailed property information before creating lead
                                  const details = await AttomPropertyService.getPropertyDetails(property.attomId);
                                  // Create lead from property using the LeadService
                                  const lead = LeadService.createLeadFromProperty(details);
                                  await LeadService.createLead(lead);
                                  
                                  // Show success notification
                                  setNotification({
                                    open: true,
                                    message: 'Property saved as lead successfully',
                                    severity: 'success'
                                  });
                                } catch (error) {
                                  console.error('Error saving property as lead:', error);
                                  setNotification({
                                    open: true,
                                    message: 'Failed to save property as lead',
                                    severity: 'error'
                                  });
                                }
                              }}
                            >
                              Save as Lead
                            </Button>
                          </Box>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Enter search criteria and click Search to find properties
                  </Typography>
                  <Button 
                    variant="outlined" 
                    startIcon={<Search />}
                    onClick={performPropertySearch}
                  >
                    Start Searching
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
      
      {/* Save Search Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Search</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Search Name"
            fullWidth
            variant="outlined"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
          
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
            Filters to save:
          </Typography>
          <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
            <Grid container spacing={1}>
              {filters.minPrice && (
                <Grid item>
                  <Chip label={`Min price: $${filters.minPrice}`} />
                </Grid>
              )}
              {filters.maxPrice && (
                <Grid item>
                  <Chip label={`Max price: $${filters.maxPrice}`} />
                </Grid>
              )}
              {filters.bedrooms && (
                <Grid item>
                  <Chip label={`Beds: ${filters.bedrooms}+`} />
                </Grid>
              )}
              {filters.bathrooms && (
                <Grid item>
                  <Chip label={`Baths: ${filters.bathrooms}+`} />
                </Grid>
              )}
              {filters.propertyType && (
                <Grid item>
                  <Chip label={`Type: ${filters.propertyType}`} />
                </Grid>
              )}
              {!filters.minPrice && 
                !filters.maxPrice && 
                !filters.bedrooms && 
                !filters.bathrooms && 
                !filters.propertyType && (
                <Typography variant="body2" color="text.secondary">
                  No filters applied
                </Typography>
              )}
            </Grid>
          </Box>
          
          <FormControlLabel
            sx={{ mt: 2 }}
            control={<Switch defaultChecked />}
            label="Save current view configuration"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSearch} color="primary" variant="contained">
            Save Search
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertySearchWorkspace;
