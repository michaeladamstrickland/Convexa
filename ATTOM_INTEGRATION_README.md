# ATTOM Integration Instructions

This guide will help you properly set up and use the ATTOM property data integration in FlipTracker.

## Setup Instructions

1. **Configure the API key**
   
   Copy the `.env.example` file to `.env` in the `backend` directory:
   ```
   cp backend/.env.example backend/.env
   ```

   Edit the `.env` file and add your ATTOM API key:
   ```
   ATTOM_API_KEY="your_api_key_here"
   ```

2. **Start the ATTOM API server**

   The ATTOM API runs on a separate server. Start it with:
   ```
   # Windows
   start-attom-server.bat
   
   # Mac/Linux
   ./start-attom-server.sh
   ```
   
   This will start the server on port 5002.

3. **Verify the API is working**

   Visit [http://localhost:5002/api/attom/status](http://localhost:5002/api/attom/status) to check if the API is properly configured.

## Using Property Data Features

Once the API is set up, you can access enhanced property data through:

1. **Enhanced Property Search**
   
   Navigate to the Enhanced Property Search page at `/enhanced-search` to search for properties.

2. **Property Detail View**
   
   Click on any property from search results to view the enhanced property details.

## Troubleshooting

If property data isn't showing:

1. **Check the ATTOM API server**
   
   Make sure the ATTOM API server is running by visiting [http://localhost:5002/health](http://localhost:5002/health)

2. **Verify API key configuration**
   
   Confirm your API key is properly set in the `.env` file and doesn't have extra quotes or spaces.

3. **Check browser console**
   
   Look for API errors in the browser developer console.

4. **API request limits**
   
   Be aware that the ATTOM API has request limits. If you've exceeded your quota, data may not be available.

## Default Data Behavior

If the API is unavailable or returns incomplete data, the application will display default placeholder data to demonstrate the UI functionality. This is by design to allow for demonstration purposes.
