# Deal Analysis Engine Technical Specification

## Overview
The Deal Analysis Engine is the core analytical component of FlipTracker that enables investors to evaluate potential property investment opportunities. This document outlines the technical specifications for implementing and completing this MVP-critical feature.

## Features

### 1. Renovation Cost Estimator

#### Functionality
- Estimate renovation costs based on property attributes
- Allow customization of renovation scope
- Calculate both DIY and contractor pricing
- Support regional cost variations

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface RenovationCostModel {
    baseSquareFootCost: number;
    regionMultiplier: Record<string, number>;
    roomTypeCosts: {
      kitchen: { basic: number, mid: number, luxury: number };
      bathroom: { basic: number, mid: number, luxury: number };
      bedroom: { basic: number, mid: number, luxury: number };
      livingSpace: { basic: number, mid: number, luxury: number };
    };
    extraFeatures: Record<string, number>;
  }
  ```

- **Algorithm**:
  1. Calculate base renovation cost using square footage
  2. Apply regional multiplier based on ZIP code
  3. Add room-specific costs based on selections
  4. Apply contractor multiplier if not DIY
  5. Add contingency percentage

- **API Endpoints**:
  - `POST /api/analysis/renovation-estimate`
  - Request body includes property details and renovation selections
  - Returns itemized cost breakdown and total

### 2. ROI Calculator

#### Functionality
- Calculate potential ROI based on purchase price, renovation costs, and ARV
- Show cash-on-cash return for various financing scenarios
- Calculate holding costs and carrying costs
- Project timeline impact on returns

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface ROICalculation {
    purchasePrice: number;
    closingCosts: number;
    renovationCosts: number;
    holdingCosts: {
      monthly: number;
      total: number;
    };
    projectedARV: number;
    sellingCosts: number;
    netProfit: number;
    roi: number;
    cashOnCashReturn?: number;
    timelineImpact: {
      bestCase: number;
      expected: number;
      worstCase: number;
    };
  }
  ```

- **Algorithm**:
  1. Total Investment = Purchase Price + Closing Costs + Renovation Costs + Holding Costs
  2. Net Proceeds = Projected ARV - Selling Costs
  3. Net Profit = Net Proceeds - Total Investment
  4. ROI = (Net Profit / Total Investment) * 100
  5. For financed deals, calculate cash-on-cash using down payment instead of full purchase

- **API Endpoints**:
  - `POST /api/analysis/roi-calculation`
  - Request body includes all investment parameters
  - Returns complete ROI analysis with sensitivity analysis

### 3. Comparable Sales Analysis

#### Functionality
- Find comparable properties using ATTOM API
- Adjust comparables based on property features
- Calculate confidence score for the ARV estimate
- Visualize comparable property data

#### Technical Implementation
- **Data Structure**:
  ```typescript
  interface ComparableSale {
    propertyId: string;
    address: string;
    saleDate: Date;
    salePrice: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt: number;
    lotSize: number;
    adjustments: {
      feature: string;
      amount: number;
      reason: string;
    }[];
    adjustedValue: number;
    distanceFromTarget: number; // miles
    photoUrl?: string;
  }
  
  interface CompAnalysisResult {
    comparableSales: ComparableSale[];
    estimatedARV: number;
    confidenceScore: number; // 0-100
    adjustmentExplanations: string[];
  }
  ```

- **Algorithm**:
  1. Query ATTOM API for recent sales within 0.5 miles
  2. Filter by similar property characteristics (beds, baths, sq ft)
  3. Apply adjustments for differences in features
  4. Calculate weighted average based on similarity score
  5. Generate confidence score based on number and quality of comps

- **API Endpoints**:
  - `GET /api/analysis/comparable-sales?propertyId=123&count=5`
  - Returns comparable sales with adjustments and ARV calculation

## UI Components

### 1. Deal Analysis Dashboard
- Main interface for all deal analysis features
- Tabs for different analysis types
- Save/load deal scenarios

### 2. Renovation Calculator UI
- Room-by-room renovation selection
- Quality level toggles (economy, standard, luxury)
- DIY vs. contractor toggle
- Dynamic cost updating

### 3. ROI Projection Visualizer
- Chart showing investment timeline
- Toggle for different financing scenarios
- Sensitivity analysis sliders
- Export to PDF functionality

### 4. Comparable Sales Viewer
- Map view of comparable properties
- Table with sortable columns
- Adjustment explanations
- Photo gallery of comparable properties

## Dependencies

1. **ATTOM API Integration**
   - Property data retrieval
   - Comparable sales search

2. **Data Normalization**
   - Address standardization
   - Property feature normalization

3. **Frontend Framework**
   - React components for analysis UI
   - Chart.js for visualizations

## Implementation Plan

### Phase 1: Core Calculation Logic
1. Implement renovation cost models
2. Build ROI calculation functions
3. Create comparable sales algorithm

### Phase 2: API Layer
1. Create endpoints for all analysis features
2. Implement caching for common calculations
3. Add input validation and error handling

### Phase 3: UI Components
1. Build renovation calculator interface
2. Implement ROI visualization components
3. Create comparable sales viewer

### Phase 4: Integration & Testing
1. Connect frontend and backend
2. Comprehensive testing with real property data
3. Performance optimization for large datasets

## Success Criteria

1. Users can accurately estimate renovation costs within 10% of actual costs
2. ROI calculations match spreadsheet models used by real investors
3. Comparable sales analysis finds relevant properties and makes appropriate adjustments
4. UI is intuitive and allows for quick scenario analysis
5. All calculations complete in under 3 seconds
