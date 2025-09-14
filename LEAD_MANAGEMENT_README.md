# LeadFlow AI Lead Management System

## Overview
The Lead Management System is a core component of the LeadFlow AI application that allows real estate investors to effectively track, manage, and communicate with potential property leads. This system integrates with the ATTOM Property Data API to provide comprehensive property information and streamline the lead generation process.

## Features

### Lead Management
- **Lead Dashboard**: View all leads in a sortable, filterable table
- **Lead Details**: Track comprehensive information about each lead
- **Communication Tracking**: Log and track all communications with leads
- **Tag System**: Categorize leads with custom tags
- **Status Tracking**: Follow leads through the sales pipeline
- **Notes & Tasks**: Add notes and set follow-up tasks for each lead
- **Lead Export**: Export lead data to CSV for external use

### Property Integration
- **Convert Properties to Leads**: Convert property search results directly to leads
- **ATTOM Data Integration**: Access comprehensive property data
- **Property Details**: View detailed property information including tax history, valuation, and owner data

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- NPM or Yarn
- SQLite

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-repo/leadflow-ai.git
   cd leadflow-ai
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with:
   ```
   ATTOM_API_KEY=your_attom_api_key
   ATTOM_API_ENDPOINT=https://api.gateway.attomdata.com/propertyapi/v1.0.0
   DATABASE_PATH=./data/leadflow.sqlite
   ```

4. **Initialize the Database**
   ```bash
   mkdir -p data
   node server/database.js
   ```

5. **Start the Server**
   - On Windows: Run `start-server.bat`
   - On Unix/Mac: Run `./start-server.sh`

6. **Access the Application**
   - The server runs on http://localhost:5001
   - API endpoints are available at:
     - `/api/leads` - Lead management endpoints
     - `/api/attom/property/*` - Property data endpoints

## API Endpoints

### Lead Management

- `GET /api/leads` - Get all leads with optional filtering
- `GET /api/leads/:id` - Get a specific lead by ID
- `POST /api/leads` - Create a new lead
- `PUT /api/leads/:id` - Update an existing lead
- `DELETE /api/leads/:id` - Delete a lead
- `POST /api/leads/:id/communications` - Add communication to a lead
- `GET /api/leads/:id/communications` - Get communications for a lead
- `POST /api/leads/:id/tags` - Add tags to a lead
- `DELETE /api/leads/:id/tags/:tagId` - Remove a tag from a lead
- `GET /api/leads/export` - Export leads to CSV

### ATTOM Property API

- `GET /api/attom/property/address` - Search for a property by address
- `GET /api/attom/property/zip` - Search for properties in a ZIP code
- `GET /api/attom/property/:attomId/detail` - Get detailed property information
- `GET /api/attom/property/:attomId/owner` - Get property owner information
- `GET /api/attom/property/:attomId/valuation` - Get property valuation data
- `GET /api/attom/property/:attomId/taxhistory` - Get property tax history

## Frontend Integration

The lead management system integrates with the existing FlipTracker frontend through:

1. **LeadManagementWorkspace.tsx** - Main workspace component for managing leads
2. **LeadService.ts** - Service for interacting with the lead API endpoints
3. **PropertySearchWorkspace.tsx** - Updated to include "Save as Lead" functionality

## Database Schema

The lead management system uses an SQLite database with the following structure:

- `leads` - Main lead information
- `lead_communications` - Communication history with leads
- `lead_tags` - Tags for categorizing leads
- `lead_notes` - Notes and additional information about leads
- `lead_tasks` - Follow-up tasks for leads

## Contributing

When contributing to the lead management system, please follow these guidelines:

1. Use TypeScript for all frontend components
2. Follow RESTful API design patterns for backend endpoints
3. Document all API endpoints and major components
4. Write tests for new features
5. Follow the existing code style and structure

## License

This project is licensed under the MIT License - see the LICENSE file for details.
