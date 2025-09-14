# Using ATTOM API in Your FlipTracker UI

This guide explains how to use the ATTOM Property Data API integration in your FlipTracker UI.

## Backend Server Setup

1. **Start the ATTOM API server**:
   ```bash
   # On Unix/Linux/Mac
   ./start-attom-server.sh
   
   # On Windows
   start-attom-server.bat
   ```

   The server will run on port 5002 by default and provide the following endpoints:
   - `GET /api/attom/property/address` - Search by property address
   - `GET /api/attom/property/zip` - Search by ZIP code
   - `GET /api/attom/property/:attomId` - Get property details by ATTOM ID
   - `GET /api/attom/property/:attomId/valuation` - Get property valuation by ATTOM ID

## Frontend Integration Options

### Option 1: Standalone Property Search Page

The `AttomPropertySearch` component provides a complete property search interface with:
- Address, ZIP code, and ATTOM ID search
- Property listing with basic details
- Detailed property information with valuation

#### How to integrate:

1. Import the component in your route file:
   ```jsx
   import AttomPropertySearch from '../components/AttomPropertySearch';
   
   // Add it to your routes
   <Route path="/property-search" element={<AttomPropertySearch />} />
   ```

2. Add a link to the property search in your navigation:
   ```jsx
   <Link to="/property-search">Property Search</Link>
   ```

### Option 2: Embed the Property Lookup in Existing Pages

The `AttomPropertyLookup` component is a simplified version that can be embedded in existing pages:

#### How to integrate:

1. Import the component where you need property lookup functionality:
   ```jsx
   import AttomPropertyLookup from '../components/AttomPropertyLookup';
   ```

2. Use the component in your page with callback functions:
   ```jsx
   // In your component
   const [selectedProperty, setSelectedProperty] = useState(null);
   
   // Later in your render function
   <AttomPropertyLookup 
     onPropertySelect={(property) => {
       setSelectedProperty(property);
       // Do something with the selected property
     }}
     onPropertyDataReceived={(properties) => {
       console.log('All properties:', properties);
       // Do something with all returned properties
     }}
   />
   
   {selectedProperty && (
     <div>
       <h3>Selected Property</h3>
       <p>Address: {selectedProperty.address}</p>
       <p>City: {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}</p>
       <p>Estimated Value: ${selectedProperty.estimatedValue?.toLocaleString() || 'N/A'}</p>
     </div>
   )}
   ```

## Using Real Property Data in Your Existing Interfaces

You can fetch real property data from the ATTOM API directly in your existing components:

```jsx
import axios from 'axios';

// In your component
const [property, setProperty] = useState(null);
const [loading, setLoading] = useState(false);

const fetchPropertyByAddress = async (address, city, state, zip) => {
  setLoading(true);
  try {
    const response = await axios.get('http://localhost:5002/api/attom/property/address', {
      params: { address, city, state, zip }
    });
    
    if (response.data.properties?.length > 0) {
      setProperty(response.data.properties[0]);
      return response.data.properties[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching property:', error);
    return null;
  } finally {
    setLoading(false);
  }
};

// Usage:
// fetchPropertyByAddress('123 Main St', 'Beverly Hills', 'CA', '90210')
//   .then(property => {
//     if (property) {
//       console.log('Found property:', property);
//     } else {
//       console.log('No property found');
//     }
//   });
```

## Available Property Data Fields

The ATTOM API provides rich property data that you can use in your UI:

### Basic Property Information:
- `attomId` - Unique property identifier
- `address` - Street address
- `city`, `state`, `zipCode` - Location information
- `latitude`, `longitude` - Coordinates for mapping
- `propertyType` - Type of property (Single Family, Multi Family, etc.)

### Property Characteristics:
- `yearBuilt` - Year the property was built
- `bedrooms`, `bathrooms` - Room counts
- `squareFeet` - Building size
- `lotSize` - Lot size
- `stories` - Number of stories
- `garage` - Garage information
- `pool` - Whether the property has a pool

### Valuation Data:
- `estimatedValue` - AVM (Automated Valuation Model) estimate
- `estimatedValueHigh`, `estimatedValueLow` - Value range
- `confidenceScore` - Confidence in the valuation
- `taxAssessedValue` - Tax assessment value
- `taxMarketValue` - Tax market value
- `lastSaleDate`, `lastSalePrice` - Last sale information
- `estimatedEquity` - Estimated equity based on last sale

### Owner Information:
- `ownerName` - Current owner's name
- `ownerOccupied` - Whether the owner lives in the property

## Example: Adding Property Data to Lead Details

Here's how you can add real property data to an existing lead details page:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, Typography, Button, CircularProgress } from '@mui/material';

const LeadDetailPage = ({ lead }) => {
  const [propertyData, setPropertyData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchPropertyData = async () => {
    if (!lead.propertyAddress) return;
    
    // Parse the address (assuming format: "123 Main St, City, State ZIP")
    const addressParts = lead.propertyAddress.split(',');
    if (addressParts.length < 2) return;
    
    const streetAddress = addressParts[0].trim();
    const cityStatePart = addressParts[1].trim();
    
    // Try to parse city, state, zip
    const cityStateMatch = cityStatePart.match(/([^,]+),?\s*([A-Z]{2})(?:\s+(\d{5}))?/);
    if (!cityStateMatch) return;
    
    const city = cityStateMatch[1]?.trim();
    const state = cityStateMatch[2]?.trim();
    const zip = cityStateMatch[3]?.trim();
    
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5002/api/attom/property/address', {
        params: { address: streetAddress, city, state, zip }
      });
      
      if (response.data.properties?.length > 0) {
        setPropertyData(response.data.properties[0]);
      }
    } catch (error) {
      console.error('Error fetching property data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* Existing lead details... */}
      <h1>{lead.propertyAddress}</h1>
      
      {/* Property data section */}
      <Card>
        <CardContent>
          <Typography variant="h6">
            Property Data
          </Typography>
          
          {!propertyData && !loading && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={fetchPropertyData}
            >
              Get Property Data
            </Button>
          )}
          
          {loading && <CircularProgress size={24} />}
          
          {propertyData && (
            <div>
              <Typography>
                <strong>Estimated Value:</strong> ${propertyData.estimatedValue?.toLocaleString() || 'N/A'}
              </Typography>
              
              <Typography>
                <strong>Year Built:</strong> {propertyData.yearBuilt || 'N/A'}
              </Typography>
              
              <Typography>
                <strong>Bedrooms:</strong> {propertyData.bedrooms || 'N/A'} | 
                <strong>Bathrooms:</strong> {propertyData.bathrooms || 'N/A'}
              </Typography>
              
              <Typography>
                <strong>Square Feet:</strong> {propertyData.squareFeet?.toLocaleString() || 'N/A'}
              </Typography>
              
              <Typography>
                <strong>Owner Name:</strong> {propertyData.ownerName || 'N/A'}
              </Typography>
              
              <Typography>
                <strong>Owner Occupied:</strong> {propertyData.ownerOccupied ? 'Yes' : 'No'}
              </Typography>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadDetailPage;
```

## Conclusion

The ATTOM API integration allows you to replace hard-coded property data with real, up-to-date information. This enhances your FlipTracker application with:

1. **Accurate property details** - Get verified information about properties
2. **Current market values** - Access estimated property values and tax information
3. **Owner information** - See current property owners and occupancy status

Start by integrating the provided components into your UI and customize them to match your application's design and functionality requirements.
