# FlipTracker - Real ATTOM API Integration

## Setup Instructions

### Prerequisites
- Node.js 18 or higher
- An ATTOM API Key (required for real data)

### Configuration Steps

1. **Set up your API keys**

   Edit the `.env` file in the `backend` directory and add your ATTOM API key:
   ```
   ATTOM_API_KEY="your_actual_api_key_here"
   ATTOM_API_ENDPOINT="https://api.gateway.attomdata.com/propertyapi/v1.0.0"
   ```

2. **Disable mock data in frontend**

   We've already disabled mock data by setting `MOCK_ENABLED = false` in `frontend/src/services/AttomPropertyService.ts`. This ensures the frontend will only use real data from the API.

3. **Start the backend server**

   Use one of the following methods to start the backend server:

   **For Windows users:**
   ```
   ./start-backend-cjs.bat
   ```

   **For Linux/Mac users:**
   ```
   chmod +x start-backend-cjs.sh
   ./start-backend-cjs.sh
   ```

4. **Start the frontend application**

   In a separate terminal, navigate to the frontend directory and start the development server:
   ```
   cd frontend
   npm run dev
   ```

5. **Test the connection**

   - Open your browser and navigate to `http://localhost:5001/health` to verify the backend server is running
   - Visit `http://localhost:5001/api/attom/status` to check if your ATTOM API key is properly configured

## Troubleshooting

### Backend Server Won't Start
- Check if you have the required database file in the correct location
- Verify that there are no conflicting processes using port 5001
- Make sure all dependencies are installed with `npm install` in the backend directory

### API Calls Failing
- Confirm your ATTOM API key is valid and correctly entered in the `.env` file
- Check if you have reached your API request limits with ATTOM
- Look for any network connectivity issues

### Frontend Still Using Mock Data
- Make sure the backend server is running
- Verify that `MOCK_ENABLED` is set to `false` in `AttomPropertyService.ts`
- Check browser console for any network errors
- Try clearing your browser cache

## Working with the ATTOM API

The ATTOM Property Data API provides comprehensive property data including:
- Property details and characteristics
- Owner information
- Valuation data
- Tax assessment information
- Sales history

Each API call consumes credits, so use them wisely. The system has been designed to make efficient use of the API by:
- Caching results where possible
- Only making necessary API calls
- Combining multiple data points in single requests when possible

## Important Notes

1. **API Costs**: Each call to the ATTOM API will cost credits. Monitor your usage to avoid unexpected charges.

2. **Production Use**: Before deploying to production, ensure you have appropriate error handling, logging, and monitoring in place.

3. **Data Privacy**: Be aware of privacy regulations when handling property owner information.

4. **Mock Data**: When the API is unavailable (e.g., during development without API keys), the system can still function with mock data by setting `MOCK_ENABLED = true` in the frontend service.
