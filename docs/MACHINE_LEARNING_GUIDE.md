# Machine Learning Integration Guide

This guide explains how to use the machine learning components integrated into the Convexa AI system.

## Overview

The Convexa AI machine learning integration provides the following capabilities:

1. **Property Value Estimation**: Predicts the market value of properties
2. **Distress Signal Detection**: Identifies signs of property distress
3. **Lead Scoring**: Evaluates and ranks leads based on potential
4. **Contact Strategy Recommendations**: Suggests the best ways to contact property owners

## Components

### Backend Components

- `MLClient.js` - Core client for connecting to ML models
- `MLPredictionService.js` - Service for processing properties and generating predictions
- `mlApiRoutes.js` - Express API routes for ML functionality
- `initializeMLModels.js` - Script to set up and configure ML models

### Frontend Components

- `MLPredictionPanel.jsx` - React component for displaying ML predictions
- `PropertyScoreVisualization.jsx` - Component for visualizing property scores
- `useMachineLearning.js` - React hook for interacting with ML services

## Setup Instructions

### 1. Initialize ML Models

Run the initialization script to set up the ML models:

```bash
node scripts/initializeMLModels.js
```

This will:
- Create necessary directories
- Download pre-trained models (if configured)
- Set up local model configurations

### 2. Integrate API Routes

In your main Express application, integrate the ML API routes:

```javascript
const express = require('express');
const integrateMLRoutes = require('./scripts/integrateMLRoutes');

const app = express();

// Setup other middleware and routes...

// Integrate ML routes
integrateMLRoutes(app, {
  apiPrefix: '/api/ml',
  db: yourDatabaseConnection
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 3. Test Integration

Run the test script to verify the ML integration:

```bash
node scripts/testMLIntegration.js
```

## Using ML Components in React

### Property Predictions

```jsx
import React, { useState, useEffect } from 'react';
import MLPredictionPanel from './ui/MLPredictionPanel';
import useMachineLearning from './hooks/useMachineLearning';

const PropertyDetails = ({ property }) => {
  const { 
    processProperty, 
    loading, 
    error 
  } = useMachineLearning();
  const [mlData, setMlData] = useState(null);

  useEffect(() => {
    if (property?.id) {
      const loadPredictions = async () => {
        try {
          const result = await processProperty(property);
          setMlData(result);
        } catch (err) {
          console.error('Failed to load predictions:', err);
        }
      };
      
      loadPredictions();
    }
  }, [property?.id]);

  return (
    <div>
      <h2>Property Details</h2>
      
      {/* Property details */}
      <div>
        <h3>{property.address}</h3>
        <p>Beds: {property.bedrooms} | Baths: {property.bathrooms}</p>
        <p>Square Feet: {property.squareFeet}</p>
      </div>
      
      {/* ML Predictions */}
      <MLPredictionPanel 
        propertyData={property} 
        onRefresh={(updatedData) => setMlData(updatedData)}
      />
    </div>
  );
};
```

### Score Visualization

```jsx
import React, { useState, useEffect } from 'react';
import PropertyScoreVisualization from './ui/PropertyScoreVisualization';
import useMachineLearning from './hooks/useMachineLearning';

const DashboardPage = () => {
  const { processBatch, loading } = useMachineLearning();
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);

  useEffect(() => {
    // Load properties from API
    const loadProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const data = await response.json();
        
        // Process properties through ML
        const processedProperties = await processBatch(data);
        setProperties(processedProperties);
      } catch (err) {
        console.error('Failed to load properties:', err);
      }
    };
    
    loadProperties();
  }, []);

  return (
    <div>
      <h1>Property Dashboard</h1>
      
      {loading && <p>Loading property data...</p>}
      
      <PropertyScoreVisualization 
        properties={properties}
        selectedProperty={selectedProperty}
      />
      
      {/* Property selection and other dashboard elements */}
    </div>
  );
};
```

## API Endpoints

The following API endpoints are available:

### GET /api/ml/status
- Returns the current status of the ML service

### POST /api/ml/process-property
- Process a property through ML models
- Request body: `{ property: { /* property data */ } }`

### POST /api/ml/process-batch
- Process multiple properties in a batch
- Request body: `{ properties: [/* array of property data */] }`

### GET /api/ml/properties/:id/predictions
- Get predictions for a specific property

### POST /api/ml/properties/:id/predictions/refresh
- Refresh predictions for a specific property

### POST /api/ml/properties/:id/contact-strategy
- Generate contact strategy for a property

### POST /api/ml/feedback
- Submit feedback about prediction accuracy
- Request body: `{ propertyId, feedbackType, actualValue, predictedValue, rating }`

## Configuration

The ML integration can be configured by editing the `config/mlConfig.cjs` file. Key configuration options:

- `apiKey`: API key for accessing ML services
- `modelEndpoints`: URLs for ML model endpoints
- `useRateLimiting`: Enable/disable rate limiting
- `useModelCache`: Enable/disable model caching
- `logging`: Logging configuration

## Troubleshooting

### ML Service Unavailable
If the ML service is unavailable, the system will operate in fallback mode:
1. Check that the ML service is running
2. Verify network connectivity
3. Check API key configuration

### Model Errors
If models fail to load or make predictions:
1. Run the initialization script again
2. Check the log files in the `logs` directory
3. Ensure model files exist in the `models` directory

## Extending the ML Integration

To add new ML capabilities:

1. Add new endpoints in `mlApiRoutes.js`
2. Add corresponding methods in `MLClient.js` and `MLPredictionService.js`
3. Create or update UI components to display the new ML insights
4. Update the integration tests in `testMLIntegration.js`
