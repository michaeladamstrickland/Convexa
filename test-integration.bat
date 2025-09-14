@echo off
REM Integration test script for ATTOM and BatchData APIs

echo [94m===== FlipTracker - ATTOM + BatchData Integration Test =====[0m
echo Testing API connectivity and integration...
echo.

REM Load environment variables from .env file
if exist .env (
  echo Loading environment variables from .env file...
  for /f "tokens=*" %%a in (.env) do (
    set "%%a"
  )
) else (
  echo [93mWARNING: .env file not found![0m
)

REM Check for required environment variables
set ENV_ERROR=0

if "%ATTOM_API_KEY%"=="" (
  echo [93mWARNING: ATTOM_API_KEY environment variable is not set.[0m
  echo Please check your .env file.
  set ENV_ERROR=1
)

if "%BATCHDATA_API_KEY%"=="" (
  echo [93mWARNING: BATCHDATA_API_KEY environment variable is not set.[0m
  echo Please check your .env file.
  set ENV_ERROR=1
)

REM Ensure Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [91mERROR: Node.js is required but not installed.[0m
  exit /b 1
)

REM Run the API test script
echo Running API connectivity tests...
node test-attom-batch.js

if %ERRORLEVEL% neq 0 (
  echo [93mAPI tests failed. Please check the errors above.[0m
  echo.
  echo [93mTroubleshooting steps:[0m
  echo 1. Verify API keys in your .env file
  echo 2. Check API endpoint URLs in the services
  echo 3. Try using a different test property address
  echo 4. Check if the APIs require additional headers
  echo.
  echo [93mFor ATTOM API:[0m
  echo - Documentation: https://api.developer.attomdata.com/docs
  echo - Support Email: api@attomdata.com
  echo.
  echo [93mFor BatchData API:[0m
  echo - Documentation: https://batchdata.com/api-docs/
  echo - Support Email: support@batchdata.com
  echo.
  echo After resolving the API issues, rerun this script to verify connectivity.
) else (
  echo [92mAll API tests passed![0m
  
  REM Check if integration is working with the live API
  echo.
  echo Testing the services with real property data...
  node -e "const attomClient = require('./src/services/attomClient').default; const batchService = require('./src/services/batchService').default; async function testIntegration() { try { console.log('Testing ATTOM property lookup...'); const property = await attomClient.getPropertyByAddress('1600 Pennsylvania Ave', 'Washington', 'DC', '20500'); if (property) { console.log('\x1b[32m✓ ATTOM property lookup successful!\x1b[0m'); console.log('Property details:', JSON.stringify(property, null, 2).substring(0, 300) + '...'); console.log('\nTesting BatchData skip trace...'); const skipTraceResult = await batchService.skipTraceByAddress(property.propertyAddress, property.city, property.state, property.zipCode); if (skipTraceResult.status === 'success') { console.log('\x1b[32m✓ BatchData skip trace successful!\x1b[0m'); const contactData = batchService.processSkipTraceResults(skipTraceResult); console.log('Contact data:', JSON.stringify(contactData, null, 2)); } else { console.log('\x1b[33m⚠ Skip trace returned status: ' + skipTraceResult.status + '\x1b[0m'); if (skipTraceResult.message) { console.log('Message:', skipTraceResult.message); } } } else { console.log('\x1b[33m⚠ No property found\x1b[0m'); } } catch (error) { console.error('\x1b[31m✗ Error during integration test:\x1b[0m', error.message); } } testIntegration();"
  
  echo.
  echo [92mIntegration setup complete![0m
  echo Next steps:
  echo 1. Integrate with your search service
  echo 2. Add skip trace functionality to lead details page
  echo 3. Create frontend components for user interaction
  echo.
  echo See ATTOM_BATCH_IMPLEMENTATION_GUIDE.md for detailed usage instructions.
)
