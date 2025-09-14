import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Tabs, 
  Tab, 
  Grid, 
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Slider,
  TextField,
  Button,
  Divider,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { v4 as uuidv4 } from 'uuid';
import { RenoLineItem } from '../../../shared/types/deal';

// Types
interface RenovationCalculatorProps {
  initialLineItems?: RenoLineItem[];
  initialBudget?: number;
  propertyData: {
    zipCode: string;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
  };
  onUpdate: (renovation: { 
    budget: number; 
    lineItems: RenoLineItem[] 
  }) => void;
  isLoading?: boolean;
}

interface RenovationEstimate {
  roomBreakdown: Record<string, number>;
  materialsCost: number;
  laborCost: number;
  permitsCost: number;
  contingency: number;
  totalCost: number;
}

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}));

const StyledSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.primary.main,
  height: 8,
  '& .MuiSlider-track': {
    border: 'none',
  },
  '& .MuiSlider-thumb': {
    height: 24,
    width: 24,
    backgroundColor: '#fff',
    border: '2px solid currentColor',
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: '0 0 0 8px rgba(25, 118, 210, 0.16)',
    },
  },
}));

const CostDisplay = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  marginTop: theme.spacing(2),
}));

// Main component
const RenovationCalculator: React.FC<RenovationCalculatorProps> = ({
  initialLineItems = [],
  initialBudget = 0,
  propertyData,
  onUpdate,
  isLoading = false
}) => {
  // State for renovation selections
  const [kitchenReno, setKitchenReno] = useState<'none' | 'basic' | 'mid' | 'luxury'>('none');
  const [bathroomReno, setBathroomReno] = useState<'none' | 'basic' | 'mid' | 'luxury'>('none');
  const [bedroomReno, setBedroomReno] = useState<'none' | 'basic' | 'mid' | 'luxury'>('none');
  const [livingSpaceReno, setLivingSpaceReno] = useState<'none' | 'basic' | 'mid' | 'luxury'>('none');
  
  const [lineItems, setLineItems] = useState<RenoLineItem[]>(initialLineItems);
  const [currentLineItem, setCurrentLineItem] = useState<RenoLineItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [extraFeatures, setExtraFeatures] = useState<Record<string, boolean>>({
    roof: false,
    hvac: false,
    plumbing: false,
    electrical: false,
    windows: false,
    flooring: false,
    painting: true,
    landscaping: false,
    deck: false
  });
  
  const [isDIY, setIsDIY] = useState(false);
  const [contingencyPercent, setContingencyPercent] = useState(10);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Mocked estimate data for UI development
  const [estimatedCosts, setEstimatedCosts] = useState<RenovationEstimate>({
    roomBreakdown: {},
    materialsCost: 0,
    laborCost: 0,
    permitsCost: 0,
    contingency: 0,
    totalCost: 0
  });
  
  // Initialize line items from the quick selection if none provided
  useEffect(() => {
    if (initialLineItems.length === 0) {
      generateLineItemsFromQuickOptions();
    }
  }, []);
  
  // Calculate costs when selections change
  useEffect(() => {
    calculateCosts();
  }, [
    kitchenReno, 
    bathroomReno, 
    bedroomReno, 
    livingSpaceReno, 
    extraFeatures,
    isDIY,
    contingencyPercent,
    lineItems
  ]);
  
  // Handle tab changes
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };
  
  // Handle extra features changes
  const handleExtraFeatureChange = (feature: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setExtraFeatures({
      ...extraFeatures,
      [feature]: event.target.checked
    });
  };
  
  // Convert quick selection options to line items
  const generateLineItemsFromQuickOptions = () => {
    const newLineItems: RenoLineItem[] = [];
    
    // Kitchen
    if (kitchenReno !== 'none') {
      let kitchenCost = 0;
      let quality = '';
      switch (kitchenReno) {
        case 'basic':
          kitchenCost = 10000;
          quality = 'Basic';
          break;
        case 'mid':
          kitchenCost = 25000;
          quality = 'Mid-range';
          break;
        case 'luxury':
          kitchenCost = 50000;
          quality = 'Luxury';
          break;
      }
      
      newLineItems.push({
        id: uuidv4(),
        category: 'Interior',
        name: `${quality} Kitchen Renovation`,
        qty: 1,
        unit: 'ea',
        unitCost: kitchenCost,
        subtotal: kitchenCost,
        notes: `Complete ${quality.toLowerCase()} kitchen renovation`
      });
    }
    
    // Bathrooms
    if (bathroomReno !== 'none') {
      let bathroomUnitCost = 0;
      let quality = '';
      switch (bathroomReno) {
        case 'basic':
          bathroomUnitCost = 5000;
          quality = 'Basic';
          break;
        case 'mid':
          bathroomUnitCost = 12000;
          quality = 'Mid-range';
          break;
        case 'luxury':
          bathroomUnitCost = 25000;
          quality = 'Luxury';
          break;
      }
      
      newLineItems.push({
        id: uuidv4(),
        category: 'Interior',
        name: `${quality} Bathroom Renovation`,
        qty: propertyData.bathrooms,
        unit: 'ea',
        unitCost: bathroomUnitCost,
        subtotal: bathroomUnitCost * propertyData.bathrooms,
        notes: `${quality} renovation for ${propertyData.bathrooms} bathroom(s)`
      });
    }
    
    // Bedrooms
    if (bedroomReno !== 'none') {
      let bedroomUnitCost = 0;
      let quality = '';
      switch (bedroomReno) {
        case 'basic':
          bedroomUnitCost = 3000;
          quality = 'Basic';
          break;
        case 'mid':
          bedroomUnitCost = 7500;
          quality = 'Mid-range';
          break;
        case 'luxury':
          bedroomUnitCost = 15000;
          quality = 'Luxury';
          break;
      }
      
      newLineItems.push({
        id: uuidv4(),
        category: 'Interior',
        name: `${quality} Bedroom Renovation`,
        qty: propertyData.bedrooms,
        unit: 'ea',
        unitCost: bedroomUnitCost,
        subtotal: bedroomUnitCost * propertyData.bedrooms,
        notes: `${quality} renovation for ${propertyData.bedrooms} bedroom(s)`
      });
    }
    
    // Living Space
    if (livingSpaceReno !== 'none') {
      let livingSpaceCost = 0;
      let quality = '';
      switch (livingSpaceReno) {
        case 'basic':
          livingSpaceCost = 5000;
          quality = 'Basic';
          break;
        case 'mid':
          livingSpaceCost = 12000;
          quality = 'Mid-range';
          break;
        case 'luxury':
          livingSpaceCost = 20000;
          quality = 'Luxury';
          break;
      }
      
      newLineItems.push({
        id: uuidv4(),
        category: 'Interior',
        name: `${quality} Living Space Renovation`,
        qty: 1,
        unit: 'ea',
        unitCost: livingSpaceCost,
        subtotal: livingSpaceCost,
        notes: `${quality} renovation for living spaces`
      });
    }
    
    // Extra features
    const featureCosts = {
      roof: { cost: 15000, name: 'New Roof', category: 'Exterior' as const },
      hvac: { cost: 8000, name: 'HVAC System', category: 'Systems' as const },
      plumbing: { cost: 12000, name: 'Plumbing Updates', category: 'Systems' as const },
      electrical: { cost: 10000, name: 'Electrical Updates', category: 'Systems' as const },
      windows: { cost: 8000, name: 'New Windows', category: 'Exterior' as const },
      flooring: { cost: 7000, name: 'New Flooring', category: 'Interior' as const },
      painting: { cost: 5000, name: 'Interior Painting', category: 'Interior' as const },
      landscaping: { cost: 8000, name: 'Landscaping', category: 'Exterior' as const },
      deck: { cost: 12000, name: 'Deck/Patio', category: 'Exterior' as const }
    };
    
    Object.entries(extraFeatures).forEach(([feature, isSelected]) => {
      if (isSelected && feature in featureCosts) {
        const featureInfo = featureCosts[feature as keyof typeof featureCosts];
        newLineItems.push({
          id: uuidv4(),
          category: featureInfo.category,
          name: featureInfo.name,
          qty: 1,
          unit: 'ea',
          unitCost: featureInfo.cost,
          subtotal: featureInfo.cost
        });
      }
    });
    
    // Add contingency
    const subtotal = newLineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const contingencyAmount = subtotal * (contingencyPercent / 100);
    
    newLineItems.push({
      id: uuidv4(),
      category: 'Contingency',
      name: `Contingency (${contingencyPercent}%)`,
      qty: 1,
      unit: 'ea',
      unitCost: contingencyAmount,
      subtotal: contingencyAmount,
      notes: 'Budget for unexpected costs'
    });
    
    setLineItems(newLineItems);
    return newLineItems;
  };
  
  // Handle adding/editing line item
  const handleLineItemDialogOpen = (item?: RenoLineItem) => {
    if (item) {
      setCurrentLineItem({ ...item });
    } else {
      setCurrentLineItem({
        id: uuidv4(),
        category: 'Interior',
        name: '',
        qty: 1,
        unit: 'ea',
        unitCost: 0,
        subtotal: 0
      });
    }
    setDialogOpen(true);
  };
  
  const handleLineItemDialogClose = () => {
    setDialogOpen(false);
    setCurrentLineItem(null);
  };
  
  const handleLineItemSave = () => {
    if (!currentLineItem) return;
    
    const updatedLineItem = {
      ...currentLineItem,
      subtotal: currentLineItem.qty * currentLineItem.unitCost
    };
    
    const updatedLineItems = lineItems.some(item => item.id === updatedLineItem.id)
      ? lineItems.map(item => item.id === updatedLineItem.id ? updatedLineItem : item)
      : [...lineItems, updatedLineItem];
    
    setLineItems(updatedLineItems);
    setDialogOpen(false);
    setCurrentLineItem(null);
  };
  
  const handleLineItemDelete = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  // Calculate renovation costs
  const calculateCosts = async () => {
    try {
      // Calculate total from line items
      const totalCost = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      // Room-specific costs for display only
      const roomBreakdown: Record<string, number> = {};
      
      // Group line items by category for display
      lineItems.forEach(item => {
        const category = item.name.toLowerCase().includes('kitchen') ? 'Kitchen' :
                        item.name.toLowerCase().includes('bathroom') ? 'Bathrooms' :
                        item.name.toLowerCase().includes('bedroom') ? 'Bedrooms' :
                        item.name.toLowerCase().includes('living') ? 'Living Spaces' :
                        item.category;
                        
        roomBreakdown[category] = (roomBreakdown[category] || 0) + item.subtotal;
      });
      
      // Calculate rough splits for display
      const materialsCost = totalCost * 0.4;
      const laborCost = isDIY ? 
        totalCost * 0.15 : // DIY - only 15% labor cost for specialists
        totalCost * 0.5;   // Full labor cost
      const permitsCost = totalCost * 0.1;
      
      // Find contingency line item
      const contingencyItems = lineItems.filter(item => 
        item.category === 'Contingency' || item.name.toLowerCase().includes('contingency')
      );
      
      const contingency = contingencyItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      const estimate = {
        roomBreakdown,
        materialsCost,
        laborCost,
        permitsCost,
        contingency,
        totalCost
      };
      
      setEstimatedCosts(estimate);
      onUpdate({
        budget: totalCost,
        lineItems: lineItems
      });
    } catch (error) {
      console.error('Error calculating renovation costs:', error);
    }
  };
  
  // Render quality option buttons
  const renderQualityOptions = (
    value: 'none' | 'basic' | 'mid' | 'luxury',
    onChange: (value: 'none' | 'basic' | 'mid' | 'luxury') => void
  ) => (
    <RadioGroup row value={value} onChange={(e) => onChange(e.target.value as any)}>
      <FormControlLabel value="none" control={<Radio />} label="None" />
      <FormControlLabel value="basic" control={<Radio />} label="Basic" />
      <FormControlLabel value="mid" control={<Radio />} label="Mid-Range" />
      <FormControlLabel value="luxury" control={<Radio />} label="Luxury" />
    </RadioGroup>
  );
  
  // Render rooms tab
  const renderRoomsTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Room Renovations
      </Typography>
      
      <Grid container spacing={3}>
        <Grid xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Kitchen</FormLabel>
            {renderQualityOptions(kitchenReno, setKitchenReno)}
          </FormControl>
        </Grid>
        
        <Grid xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Bathrooms ({propertyData.bathrooms})</FormLabel>
            {renderQualityOptions(bathroomReno, setBathroomReno)}
          </FormControl>
        </Grid>
        
        <Grid xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Bedrooms ({propertyData.bedrooms})</FormLabel>
            {renderQualityOptions(bedroomReno, setBedroomReno)}
          </FormControl>
        </Grid>
        
        <Grid xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Living Spaces</FormLabel>
            {renderQualityOptions(livingSpaceReno, setLivingSpaceReno)}
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
  
  // Render features tab
  const renderFeaturesTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Additional Features
      </Typography>
      
      <Grid container spacing={3}>
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.roof} 
                onChange={handleExtraFeatureChange('roof')} 
              />
            }
            label="New Roof"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.hvac} 
                onChange={handleExtraFeatureChange('hvac')} 
              />
            }
            label="HVAC System"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.plumbing} 
                onChange={handleExtraFeatureChange('plumbing')} 
              />
            }
            label="Plumbing Updates"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.electrical} 
                onChange={handleExtraFeatureChange('electrical')} 
              />
            }
            label="Electrical Updates"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.windows} 
                onChange={handleExtraFeatureChange('windows')} 
              />
            }
            label="New Windows"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.flooring} 
                onChange={handleExtraFeatureChange('flooring')} 
              />
            }
            label="New Flooring"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.painting} 
                onChange={handleExtraFeatureChange('painting')} 
              />
            }
            label="Interior Painting"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.landscaping} 
                onChange={handleExtraFeatureChange('landscaping')} 
              />
            }
            label="Landscaping"
          />
        </Grid>
        
        <Grid xs={6}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={extraFeatures.deck} 
                onChange={handleExtraFeatureChange('deck')} 
              />
            }
            label="Deck/Patio"
          />
        </Grid>
      </Grid>
    </Box>
  );
  
  // Render options tab
  const renderOptionsTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Options & Settings
      </Typography>
      
      <Grid container spacing={3}>
        <Grid xs={12}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={isDIY} 
                onChange={(e) => setIsDIY(e.target.checked)} 
              />
            }
            label="DIY (I will do most of the work myself)"
          />
          
          <Typography variant="body2" color="textSecondary">
            Select this if you plan to do most of the labor yourself. This reduces labor costs by 70%.
          </Typography>
        </Grid>
        
        <Grid xs={12}>
          <Typography gutterBottom>
            Contingency: {contingencyPercent}%
          </Typography>
          <StyledSlider
            value={contingencyPercent}
            onChange={(_e, value) => setContingencyPercent(value as number)}
            step={1}
            marks={[
              { value: 0, label: '0%' },
              { value: 10, label: '10%' },
              { value: 20, label: '20%' },
              { value: 30, label: '30%' },
            ]}
            min={0}
            max={30}
          />
          <Typography variant="body2" color="textSecondary">
            Contingency budget for unexpected costs. Industry standard is 10-20%.
          </Typography>
        </Grid>
        
        <Grid xs={12}>
          <FormControl fullWidth>
            <FormLabel>ZIP Code</FormLabel>
            <TextField
              value={propertyData.zipCode}
              disabled
              size="small"
              helperText="Regional cost adjustments are applied based on location"
            />
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Render line items table
  const renderLineItemsTable = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Category</TableCell>
            <TableCell>Item</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Unit</TableCell>
            <TableCell align="right">Cost/Unit</TableCell>
            <TableCell align="right">Subtotal</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.category}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell align="right">{item.qty}</TableCell>
              <TableCell align="right">{item.unit}</TableCell>
              <TableCell align="right">{formatCurrency(item.unitCost)}</TableCell>
              <TableCell align="right">{formatCurrency(item.subtotal)}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => handleLineItemDialogOpen(item)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleLineItemDelete(item.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Line item dialog
  const renderLineItemDialog = () => (
    <Dialog open={dialogOpen} onClose={handleLineItemDialogClose}>
      <DialogTitle>
        {currentLineItem && currentLineItem.id ? 'Edit Item' : 'Add Item'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid xs={12}>
            <FormControl fullWidth>
              <FormLabel>Category</FormLabel>
              <Select
                value={currentLineItem?.category || 'Interior'}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, category: e.target.value as any } : null
                )}
                size="small"
              >
                <MenuItem value="Exterior">Exterior</MenuItem>
                <MenuItem value="Interior">Interior</MenuItem>
                <MenuItem value="Systems">Systems</MenuItem>
                <MenuItem value="Contingency">Contingency</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid xs={12}>
            <FormControl fullWidth>
              <FormLabel>Name</FormLabel>
              <TextField 
                value={currentLineItem?.name || ''}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, name: e.target.value } : null
                )}
                size="small"
              />
            </FormControl>
          </Grid>
          
          <Grid xs={6}>
            <FormControl fullWidth>
              <FormLabel>Quantity</FormLabel>
              <TextField
                type="number"
                value={currentLineItem?.qty || 1}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, qty: parseFloat(e.target.value) || 0 } : null
                )}
                size="small"
              />
            </FormControl>
          </Grid>
          
          <Grid xs={6}>
            <FormControl fullWidth>
              <FormLabel>Unit</FormLabel>
              <Select
                value={currentLineItem?.unit || 'ea'}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, unit: e.target.value as any } : null
                )}
                size="small"
              >
                <MenuItem value="ea">Each</MenuItem>
                <MenuItem value="sqft">Sq Ft</MenuItem>
                <MenuItem value="lf">Linear Ft</MenuItem>
                <MenuItem value="day">Day</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid xs={12}>
            <FormControl fullWidth>
              <FormLabel>Cost per Unit</FormLabel>
              <TextField
                type="number"
                value={currentLineItem?.unitCost || 0}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, unitCost: parseFloat(e.target.value) || 0 } : null
                )}
                size="small"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </FormControl>
          </Grid>
          
          <Grid xs={12}>
            <FormControl fullWidth>
              <FormLabel>Notes (optional)</FormLabel>
              <TextField
                multiline
                rows={2}
                value={currentLineItem?.notes || ''}
                onChange={(e) => setCurrentLineItem(prev => 
                  prev ? { ...prev, notes: e.target.value } : null
                )}
                size="small"
              />
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleLineItemDialogClose}>Cancel</Button>
        <Button 
          onClick={handleLineItemSave} 
          variant="contained"
          disabled={!currentLineItem || !currentLineItem.name}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <StyledCard>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Renovation Cost Estimator
          </Typography>
          
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={currentTab}
              onChange={handleTabChange}
              aria-label="renovation calculator tabs"
              variant="fullWidth"
            >
              <Tab label="Line Items" />
              <Tab label="Quick Selection" />
              <Tab label="Options" />
            </Tabs>
          </Box>
          
          {currentTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">Renovation Line Items</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleLineItemDialogOpen()}
                >
                  Add Item
                </Button>
              </Box>
              
              {lineItems.length > 0 ? renderLineItemsTable() : (
                <Paper 
                  variant="outlined" 
                  sx={{ p: 3, textAlign: 'center', backgroundColor: 'background.default' }}
                >
                  <Typography color="textSecondary">
                    No renovation items yet. Add items manually or use the quick selection tab.
                  </Typography>
                </Paper>
              )}
            </Box>
          )}
          
          {currentTab === 1 && (
            <>
              {renderRoomsTab()}
              {renderFeaturesTab()}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="contained" 
                  onClick={generateLineItemsFromQuickOptions}
                >
                  Generate Line Items
                </Button>
              </Box>
            </>
          )}
          
          {currentTab === 2 && renderOptionsTab()}
        </CardContent>
      </StyledCard>
      
      <StyledCard>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Cost Estimate
          </Typography>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Grid container spacing={2}>
                {Object.entries(estimatedCosts.roomBreakdown).map(([room, cost]) => (
                  <Grid xs={6} key={room}>
                    <Typography variant="body2">
                      {room}: {formatCurrency(cost)}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <Typography variant="body2">
                    Materials: {formatCurrency(estimatedCosts.materialsCost)}
                  </Typography>
                </Grid>
                <Grid xs={6}>
                  <Typography variant="body2">
                    Labor: {formatCurrency(estimatedCosts.laborCost)}
                    {isDIY && " (DIY Discount Applied)"}
                  </Typography>
                </Grid>
                <Grid xs={6}>
                  <Typography variant="body2">
                    Permits & Fees: {formatCurrency(estimatedCosts.permitsCost)}
                  </Typography>
                </Grid>
                <Grid xs={6}>
                  <Typography variant="body2">
                    Contingency: {formatCurrency(estimatedCosts.contingency)}
                  </Typography>
                </Grid>
              </Grid>
              
              <CostDisplay>
                <Typography variant="h5" align="center">
                  Total Estimated Cost: {formatCurrency(estimatedCosts.totalCost)}
                </Typography>
              </CostDisplay>
            </>
          )}
        </CardContent>
      </StyledCard>
      
      {renderLineItemDialog()}
    </Box>
  );
};

export default RenovationCalculator;

