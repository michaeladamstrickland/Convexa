# Property Search Interface Technical Specification

## Overview
The Property Search Interface is a critical MVP feature that allows users to efficiently find, filter, and view potential investment properties. This document outlines the technical specifications for completing this core feature.

## Features

### 1. Advanced Search Filters

#### Functionality
- Filter properties by multiple criteria simultaneously
- Save search configurations for later use
- Support for range-based numeric filters
- Quick filter presets for common searches

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface PropertySearchFilters {
    location: {
      zipCodes?: string[];
      cityNames?: string[];
      counties?: string[];
      radius?: {
        center: {
          lat: number;
          lng: number;
        };
        miles: number;
      };
    };
    propertyAttributes: {
      propertyType?: string[];
      bedrooms?: {min?: number; max?: number};
      bathrooms?: {min?: number; max?: number};
      squareFeet?: {min?: number; max?: number};
      yearBuilt?: {min?: number; max?: number};
      lotSize?: {min?: number; max?: number};
    };
    financials: {
      listPrice?: {min?: number; max?: number};
      estimatedARV?: {min?: number; max?: number};
      potentialEquity?: {min?: number; max?: number};
      capRate?: {min?: number; max?: number};
    };
    investmentCriteria: {
      maxRenovationBudget?: number;
      minPotentialROI?: number;
      propertyCondition?: string[];
    };
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }
  ```

- **API Endpoints**:
  - `POST /api/properties/search`
  - Request body includes all search filters
  - Returns paginated property results with metadata
  
- **Filter Persistence**:
  - Save filters to user preferences in database
  - Support for named search profiles
  - Quick load of previous searches

### 2. Search Results Display

#### Functionality
- Grid and list view options
- Map view with clustering for geographic visualization
- Quick sort options (price, ROI potential, etc.)
- Pagination with configurable page size

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface PropertySearchResult {
    properties: Property[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }
  
  interface Property {
    id: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      formattedAddress: string;
    };
    location: {
      latitude: number;
      longitude: number;
    };
    attributes: {
      propertyType: string;
      bedrooms: number;
      bathrooms: number;
      squareFeet: number;
      yearBuilt: number;
      lotSize: number;
    };
    financials: {
      listPrice: number;
      estimatedARV: number;
      potentialEquity: number;
      estimatedRehab: number;
      potentialROI: number;
    };
    media: {
      primaryImageUrl: string;
      imageUrls: string[];
    };
    marketData: {
      daysOnMarket: number;
      priceHistory: {
        date: string;
        price: number;
      }[];
      comparablesSummary: {
        count: number;
        avgPrice: number;
        pricePerSqFt: number;
      };
    };
  }
  ```

- **UI Components**:
  - PropertyCard component for grid view
  - PropertyRow component for list view
  - PropertyMap component for map view
  - Pagination controls
  - View toggle buttons

### 3. Property Detail View

#### Functionality
- Comprehensive property information display
- Photo gallery with large images
- Street view integration
- Property history timeline
- Comparable properties section
- Investment analysis summary

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface PropertyDetail extends Property {
    description: string;
    features: string[];
    propertyHistory: {
      event: string;
      date: string;
      price?: number;
      description?: string;
    }[];
    taxInfo: {
      taxAssessedValue: number;
      annualTaxAmount: number;
      taxYear: number;
    };
    schoolDistrict: {
      name: string;
      rating: number;
      schools: {
        name: string;
        type: string;
        rating: number;
        distance: number;
      }[];
    };
    neighborhood: {
      overview: string;
      walkScore: number;
      crimeRating: string;
      medianHomeValue: number;
      medianIncome: number;
    };
    investmentAnalysis: {
      suggestedRenovationBudget: number;
      estimatedARV: number;
      potentialProfit: number;
      estimatedROI: number;
      comparableSalesSummary: {
        count: number;
        avgPrice: number;
        pricePerSqFt: number;
        confidenceScore: number;
      };
    };
  }
  ```

- **API Endpoints**:
  - `GET /api/properties/:id`
  - Returns detailed property information
  - Includes investment analysis if available

- **UI Components**:
  - PropertyHeader with key information
  - ImageGallery with lightbox
  - PropertyTabs for organizing detailed information
  - StreetView integration
  - InvestmentSummary with key metrics
  - ActionButtons for saving, analyzing, etc.

## UI Components Hierarchy

```
PropertySearchPage
├── SearchFilters
│   ├── LocationFilter
│   ├── PropertyAttributesFilter
│   ├── FinancialsFilter
│   ├── InvestmentCriteriaFilter
│   └── SavedSearchesDropdown
├── ResultsViewToggle
├── SortControls
├── SearchResults
│   ├── GridView (PropertyCards)
│   ├── ListView (PropertyRows)
│   └── MapView (PropertyMarkers)
└── Pagination

PropertyDetailPage
├── PropertyHeader
├── ActionButtons
├── ImageGallery
├── PropertyTabs
│   ├── DetailsTab
│   ├── FinancialsTab
│   ├── NeighborhoodTab
│   ├── SchoolsTab
│   ├── TaxInfoTab
│   ├── HistoryTab
│   └── InvestmentAnalysisTab
└── ComparableProperties
```

## State Management

### Redux Slices
- **propertySearchSlice**: Manages search filters, results, and pagination state
- **propertyDetailSlice**: Manages detailed property information and related data
- **savedSearchesSlice**: Manages user's saved search configurations

### Key Actions
- `setSearchFilters`: Update search criteria
- `executeSearch`: Trigger API search with current filters
- `loadPropertyDetail`: Load detailed property information
- `saveSearch`: Save current search configuration
- `toggleFavoriteProperty`: Add/remove property from favorites

## Implementation Plan

### Phase 1: Search Filter UI
1. Implement filter components
2. Add filter validation
3. Create filter persistence mechanism

### Phase 2: Search Results Display
1. Build PropertyCard and PropertyRow components
2. Implement view toggle functionality
3. Add sorting and pagination

### Phase 3: Property Detail View
1. Create detail page layout and routing
2. Implement image gallery
3. Build property information tabs
4. Add investment analysis summary

### Phase 4: Integration & Optimization
1. Connect to backend API endpoints
2. Implement caching for frequent searches
3. Add loading states and error handling
4. Optimize for mobile responsiveness

## Success Criteria

1. Users can filter properties using multiple criteria simultaneously
2. Search results load within 2 seconds for typical queries
3. Property detail view provides comprehensive information
4. Users can save searches and favorite properties
5. UI is intuitive and responsive across devices
6. Map view correctly displays property locations with clustering
