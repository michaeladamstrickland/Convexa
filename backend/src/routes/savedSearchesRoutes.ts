// Saved Searches API Routes
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Temporary in-memory storage until database is set up
let savedSearches = [
  {
    id: '1',
    name: 'High Value Properties',
    description: 'Properties over $500k in prime locations',
    filters: {
      minPrice: '500000',
      propertyType: 'SingleFamily'
    },
    createdAt: '2025-08-10T15:30:00.000Z',
    lastRun: '2025-09-05T10:15:00.000Z',
    resultCount: 24,
    isFavorite: true
  },
  {
    id: '2',
    name: 'Potential Flips',
    description: 'Older properties in emerging neighborhoods',
    filters: {
      maxPrice: '350000',
      yearBuiltBefore: '1990'
    },
    createdAt: '2025-08-15T09:45:00.000Z',
    lastRun: '2025-08-30T14:20:00.000Z',
    resultCount: 37,
    isFavorite: false
  },
  {
    id: '3',
    name: 'Large Family Homes',
    description: 'Homes with 4+ bedrooms for families',
    filters: {
      bedrooms: '4',
      propertyType: 'SingleFamily',
      squareFeetMin: '2000'
    },
    createdAt: '2025-08-23T11:20:00.000Z',
    lastRun: '2025-09-01T16:45:00.000Z',
    resultCount: 15,
    isFavorite: true
  }
];

// For simplicity in this example, we'll skip authentication
// In a real implementation, you would apply proper authentication middleware
// router.use(authenticate);

// GET /api/saved-searches - Get all saved searches
router.get('/', (req, res) => {
  res.json({
    success: true,
    searches: savedSearches
  });
});

// GET /api/saved-searches/:id - Get a specific saved search
router.get('/:id', (req, res) => {
  const search = savedSearches.find(s => s.id === req.params.id);
  
  if (!search) {
    return res.status(404).json({
      success: false,
      error: 'Saved search not found'
    });
  }
  
  res.json({
    success: true,
    search
  });
});

// POST /api/saved-searches - Create a new saved search
router.post('/', (req, res) => {
  const { name, description, filters } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Name is required'
    });
  }
  
  const newSearch = {
    id: uuidv4(),
    name,
    description: description || '',
    filters,
    createdAt: new Date().toISOString(),
    lastRun: new Date().toISOString(),
    resultCount: 0,
    isFavorite: false
  };
  
  savedSearches.push(newSearch);
  
  res.status(201).json({
    success: true,
    search: newSearch,
    message: 'Search saved successfully'
  });
});

// PUT /api/saved-searches/:id - Update a saved search
router.put('/:id', (req, res) => {
  const { name, description, filters } = req.body;
  const index = savedSearches.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Saved search not found'
    });
  }
  
  // Update the search
  savedSearches[index] = {
    ...savedSearches[index],
    name: name || savedSearches[index].name,
    description: description !== undefined ? description : savedSearches[index].description,
    filters: filters || savedSearches[index].filters,
  };
  
  res.json({
    success: true,
    search: savedSearches[index],
    message: 'Search updated successfully'
  });
});

// DELETE /api/saved-searches/:id - Delete a saved search
router.delete('/:id', (req, res) => {
  const index = savedSearches.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Saved search not found'
    });
  }
  
  savedSearches.splice(index, 1);
  
  res.json({
    success: true,
    message: 'Search deleted successfully'
  });
});

// PATCH /api/saved-searches/:id/favorite - Toggle favorite status
router.patch('/:id/favorite', (req, res) => {
  const { isFavorite } = req.body;
  const index = savedSearches.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Saved search not found'
    });
  }
  
  savedSearches[index].isFavorite = isFavorite !== undefined ? isFavorite : !savedSearches[index].isFavorite;
  
  res.json({
    success: true,
    search: savedSearches[index],
    message: `Search ${savedSearches[index].isFavorite ? 'marked as favorite' : 'removed from favorites'}`
  });
});

// POST /api/saved-searches/:id/execute - Execute a saved search
router.post('/:id/execute', (req, res) => {
  const search = savedSearches.find(s => s.id === req.params.id);
  
  if (!search) {
    return res.status(404).json({
      success: false,
      error: 'Saved search not found'
    });
  }
  
  // In a real implementation, we would execute the search using the stored filters
  // For now, we'll just update the lastRun timestamp and return mock results
  const index = savedSearches.findIndex(s => s.id === req.params.id);
  savedSearches[index].lastRun = new Date().toISOString();
  
  // Generate some random results
  const resultCount = Math.floor(Math.random() * 50) + 1;
  savedSearches[index].resultCount = resultCount;
  
  // Generate mock search results
  const mockResults = {
    count: resultCount,
    properties: Array.from({ length: resultCount }).map((_, i) => ({
      id: `prop-${i}`,
      address: `${1000 + i} Main St`,
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      price: 300000 + (i * 25000),
      bedrooms: Math.floor(Math.random() * 3) + 2,
      bathrooms: Math.floor(Math.random() * 2) + 1.5,
      sqft: 1500 + (i * 100),
      yearBuilt: 1980 + Math.floor(Math.random() * 40),
      propertyType: i % 3 === 0 ? 'SingleFamily' : (i % 3 === 1 ? 'Condo' : 'TownHouse')
    }))
  };
  
  res.json({
    success: true,
    results: mockResults,
    searchInfo: search,
    message: `Search executed successfully, found ${resultCount} properties`
  });
});

export default router;
