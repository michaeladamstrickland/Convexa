# Convexa AI - Machine Learning Integration

This repository contains the machine learning integration components for the Convexa AI system. These components enable property valuation, distress signal detection, lead scoring, and contact strategy recommendations.

## Quick Start

1. **Setup:**
   ```bash
   npm install
   mkdir -p logs models data/prediction-cache test-results
   ```

2. **Start the Mock ML Server:**
   ```bash
   node scripts/mockMLServer.js
   ```

3. **Initialize ML Models:**
   ```bash
   node scripts/initializeMLModels.js
   ```

4. **Run Tests:**
   ```bash
   node scripts/testMLClient.js
   ```

5. **Start the Integration API Server:**
   ```bash
   node scripts/integrateMLAPI.js
   ```

6. **Start the Demo UI:**
   ```bash
   node scripts/demo-ui.js
   ```

7. **View the Demo:**
   Open your browser to [http://localhost:8080](http://localhost:8080)

## Components

### Backend Services
- **MLClient.js** - Core ML client for model interaction
- **MLPredictionService.js** - Property prediction service
- **mlApiRoutes.js** - API endpoints for ML functionality

### UI Components
- **MLPredictionPanel.jsx** - Display ML predictions for properties
- **PropertyScoreVisualization.jsx** - Visualize property scores
- **useMachineLearning.js** - React hook for ML integration

## Features

- **Property Value Estimation:** Predict market values for properties
- **Distress Signal Detection:** Identify properties with distress signals
- **Lead Scoring:** Score leads based on potential
- **Contact Strategy:** Get recommendations for contacting property owners
- **Profit Potential:** Calculate potential ROI for property investments

## Documentation

- [Machine Learning Guide](./docs/MACHINE_LEARNING_GUIDE.md) - Complete usage guide
- [API Documentation](./docs/API_DOCUMENTATION.md) - API endpoint details

## Configuration

Configuration settings are in `config/mlConfig.js` and include:
- Model endpoints
- API keys
- Caching settings
- Rate limiting options

## Integration Example

```javascript
// React component example
import React, { useState, useEffect } from 'react';
import MLPredictionPanel from '../components/MLPredictionPanel';
import useMachineLearning from '../hooks/useMachineLearning';
import PropertyScoreVisualization from '../components/PropertyScoreVisualization';

function PropertyDetails({ propertyId }) {
  const { processProperty, predictValue, predictDistress, loading } = useMachineLearning();
  const [property, setProperty] = useState(null);
  const [mlResults, setMlResults] = useState(null);

  useEffect(() => {
    // Load property and process through ML
    const loadProperty = async () => {
      const data = await fetchProperty(propertyId);
      setProperty(data);
      
      // Process with ML
      if (data) {
        try {
          // Option 1: Process everything at once
          const processed = await processProperty(data);
          setMlResults(processed);
          
          // Option 2: Or call specific predictors individually
          // const valueEstimate = await predictValue(data);
          // const distressSignals = await predictDistress(data);
          // setMlResults({ valueEstimate, distressSignals });
        } catch (error) {
          console.error("ML processing error:", error);
        }
      }
    };
    
    loadProperty();
  }, [propertyId, processProperty, predictValue, predictDistress]);

  return (
    <div className="property-details">
      {loading && <div className="loading-indicator">Processing property data...</div>}
      
      {property && (
        <>
          <h2>{property.address}</h2>
          <div className="property-info">
            <div className="basic-details">
              <p>Bedrooms: {property.bedrooms}</p>
              <p>Bathrooms: {property.bathrooms}</p>
              <p>Square Feet: {property.squareFeet}</p>
              <p>Year Built: {property.yearBuilt}</p>
            </div>
            
            {mlResults && (
              <div className="ml-results">
                <PropertyScoreVisualization 
                  valueEstimate={mlResults.valueEstimate?.estimatedValue}
                  distressScore={mlResults.distressSignals?.distressScore}
                  leadScore={mlResults.leadScore?.totalScore}
                />
                <MLPredictionPanel propertyData={mlResults} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

## License

Proprietary and Confidential - © 2025 FlipTracker
