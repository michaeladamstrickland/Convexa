# Frontend Integration Guide for ZIP Search API

This document provides guidance for integrating the new ZIP Search API with the frontend application.

## API Endpoints

The following endpoints are available in the new API:

### Health Check
- **GET /health**
  - Returns server status and database connection info
  - Response: `{ status: "ok", database: "connected", leads: 5, timestamp: "2025-09-06T..." }`

### Search with Filters
- **GET /api/zip-search-new/search**
  - Parameters:
    - `query` - General text search (address or owner name)
    - `minValue` - Minimum property value
    - `maxValue` - Maximum property value
    - `city` - City name filter
    - `state` - State name filter
    - `zipCode` - ZIP code filter
    - `propertyType` - Type of property
    - `source` - Source of the lead
    - `temperature` - Temperature tag (dead, warm, hot, on_fire)
    - `limit` - Results per page (default: 50)
    - `page` - Page number (default: 1)
  - Response:
    ```json
    {
      "leads": [
        {
          "id": "123",
          "propertyAddress": "123 Main St, City, State 12345",
          "ownerName": "John Doe",
          "phone": "555-123-4567",
          "email": "john@example.com",
          "estimatedValue": 350000,
          "equity": 75,
          "motivationScore": 85,
          "temperatureTag": "hot",
          "status": "active",
          "source": "zillow",
          "isProbate": false,
          "isVacant": true,
          "conditionScore": 70,
          "leadScore": 80,
          "createdAt": "2025-08-15T14:30:00.000Z",
          "updatedAt": "2025-09-01T10:15:00.000Z"
        }
        // More leads...
      ],
      "pagination": {
        "total": 120,
        "page": 1,
        "limit": 50,
        "pages": 3
      }
    }
    ```

### ZIP Code Search
- **POST /api/zip-search-new/search-zip**
  - Body: `{ "zipCode": "90210" }`
  - Response:
    ```json
    {
      "leadCount": 15,
      "zipCode": "90210",
      "leads": [
        {
          "id": "123",
          "propertyAddress": "123 Beverly Dr, Beverly Hills, CA 90210",
          "ownerName": "Jane Smith",
          "estimatedValue": 1200000,
          "equity": 60,
          "motivationScore": 72
        }
        // More leads...
      ]
    }
    ```

### Revenue Analytics
- **GET /api/zip-search-new/revenue-analytics**
  - Response:
    ```json
    {
      "analytics": {
        "totalLeads": 120,
        "totalEstimatedValue": 45000000,
        "avgMotivationScore": 65.5,
        "leadsBySource": [
          { "source": "zillow", "count": 50 },
          { "source": "probate", "count": 30 },
          { "source": "vacant", "count": 40 }
        ],
        "temperatureDistribution": [
          { "tag": "dead", "count": 20 },
          { "tag": "warm", "count": 35 },
          { "tag": "hot", "count": 45 },
          { "tag": "on_fire", "count": 20 }
        ],
        "potentialRevenue": 2250000
      }
    }
    ```

## Frontend Integration Steps

### 1. Update API Client

Update the API client in the frontend to use the new endpoints:

```typescript
// src/api/searchService.ts

const BASE_URL = 'http://localhost:5001';

export const searchService = {
  // General search with filters
  async searchLeads(params) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/api/zip-search-new/search?${queryString}`);
    return response.json();
  },

  // ZIP code search
  async searchByZip(zipCode) {
    const response = await fetch(`${BASE_URL}/api/zip-search-new/search-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ zipCode })
    });
    return response.json();
  },

  // Revenue analytics
  async getAnalytics() {
    const response = await fetch(`${BASE_URL}/api/zip-search-new/revenue-analytics`);
    return response.json();
  }
};
```

### 2. Update Search Components

Update the search components to use the new API client:

```jsx
// src/components/Search/SearchForm.jsx
import { useState } from 'react';
import { searchService } from '../../api/searchService';

export const SearchForm = ({ onSearchResults }) => {
  const [filters, setFilters] = useState({
    query: '',
    minValue: '',
    maxValue: '',
    zipCode: '',
    temperature: '',
    // Add other filters as needed
  });
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    try {
      const results = await searchService.searchLeads(filters);
      onSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      // Handle error state
    }
  };
  
  return (
    <form onSubmit={handleSearch}>
      {/* Form inputs for search filters */}
      <button type="submit">Search</button>
    </form>
  );
};
```

### 3. Update Results Display

Update the results display component to handle the new response format:

```jsx
// src/components/Search/ResultsList.jsx
export const ResultsList = ({ results }) => {
  const { leads, pagination } = results;
  
  return (
    <div>
      <h2>Search Results ({pagination?.total || 0} leads found)</h2>
      
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Owner</th>
            <th>Value</th>
            <th>Equity</th>
            <th>Temperature</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads?.map(lead => (
            <tr key={lead.id}>
              <td>{lead.propertyAddress}</td>
              <td>{lead.ownerName}</td>
              <td>${lead.estimatedValue?.toLocaleString()}</td>
              <td>{lead.equity}%</td>
              <td>
                <span className={`temperature-tag ${lead.temperatureTag}`}>
                  {lead.temperatureTag}
                </span>
              </td>
              <td>
                <button>View Details</button>
                <button>Skip Trace</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {pagination && (
        <div className="pagination">
          {/* Pagination controls */}
        </div>
      )}
    </div>
  );
};
```

### 4. Update Analytics Dashboard

Update the analytics dashboard to use the new revenue analytics endpoint:

```jsx
// src/components/Analytics/Dashboard.jsx
import { useState, useEffect } from 'react';
import { searchService } from '../../api/searchService';

export const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await searchService.getAnalytics();
        setAnalytics(data.analytics);
      } catch (error) {
        console.error('Analytics error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);
  
  if (loading) return <div>Loading analytics...</div>;
  
  return (
    <div className="analytics-dashboard">
      <div className="metric-card">
        <h3>Total Leads</h3>
        <div className="metric-value">{analytics?.totalLeads || 0}</div>
      </div>
      
      <div className="metric-card">
        <h3>Total Property Value</h3>
        <div className="metric-value">${analytics?.totalEstimatedValue?.toLocaleString() || 0}</div>
      </div>
      
      <div className="metric-card">
        <h3>Avg Motivation Score</h3>
        <div className="metric-value">{analytics?.avgMotivationScore?.toFixed(1) || 0}</div>
      </div>
      
      <div className="metric-card">
        <h3>Potential Revenue</h3>
        <div className="metric-value">${analytics?.potentialRevenue?.toLocaleString() || 0}</div>
      </div>
      
      {/* Charts for source and temperature distribution */}
    </div>
  );
};
```

## Testing Steps

1. Start the ZIP Search API server:
   ```bash
   cd C:/Projects/FlipTracker/FlipTracker/flip_tracker_full/leadflow_ai
   ./start-zip-search.sh  # or start-zip-search.bat on Windows
   ```

2. Start the frontend development server:
   ```bash
   cd C:/Projects/FlipTracker/FlipTracker/flip_tracker_full/leadflow_ai/frontend
   npm run dev
   ```

3. Test the following functionality:
   - Search form with various filters
   - ZIP code search
   - Pagination through results
   - Analytics dashboard

## Troubleshooting

- **CORS Issues**: If you encounter CORS errors, ensure the API server has CORS enabled correctly
- **Connection Refused**: Make sure the API server is running on port 5001
- **Data Format Errors**: Check the response structure matches what the frontend expects

## Next Steps

After successfully integrating the frontend with the new API:

1. Implement the lead temperature tag UI components
2. Add the skip trace functionality
3. Begin working on the CRM Kanban board
