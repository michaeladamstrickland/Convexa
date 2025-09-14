# ATTOM API Integration - Server Architecture Guide

## Overview

This document describes the server architecture for the ATTOM API integration within the FlipTracker application.

## Server Architecture

The application uses two separate server processes:

1. **Main Server** (Port 5001):
   - Handles user authentication, lead management, and most application features
   - Endpoints: `/api/leads`, `/api/favorites`, `/api/skiptrace`, etc.

2. **ATTOM API Server** (Port 5002):
   - Dedicated server for ATTOM Property Data API integration
   - Runs independently to avoid conflicts with the main server
   - Endpoints: `/api/attom/*`

## Connection Details

- **ATTOM API Server**: http://localhost:5002
  - Status endpoint: http://localhost:5002/api/attom/status
  - Health check: http://localhost:5002/health
  - Property detail: http://localhost:5002/api/attom/property/:attomId/detail

- **Main Server**: http://localhost:5001
  - Leads API: http://localhost:5001/api/leads
  - Favorites API: http://localhost:5001/api/favorites
  - Skiptrace API: http://localhost:5001/api/skiptrace

## Frontend Configuration

Frontend components need to be configured to use the correct ports:
- ATTOM API requests should be directed to port 5002
- All other API requests should be directed to port 5001

Example:
```javascript
// API base URLs
const ATTOM_API_URL = 'http://localhost:5002/api/attom'; // ATTOM server
const LEADS_API_URL = 'http://localhost:5001/api/leads'; // Main server
```

## Starting the Servers

1. Start the main server:
```bash
cd backend
npm run dev
```

2. Start the ATTOM server (in a separate terminal):
```bash
cd backend
node attom-server.js
```

## Common Issues

1. **Connection Refused Errors**: Make sure both servers are running and you're using the correct port
2. **Port Conflicts**: If port 5001 or 5002 is already in use, you may need to modify the port in the server files

## Debugging

- Check if both servers are running by visiting the health check endpoints
- Confirm the API URLs in your frontend components are using the correct ports
- Look for CORS errors if calling the APIs from a different origin
