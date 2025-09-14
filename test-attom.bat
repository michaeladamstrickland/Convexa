@echo off
REM ATTOM API Test Script

echo [94m===== FlipTracker - ATTOM API Test =====[0m
echo Testing ATTOM Property Data API connectivity and features...
echo.

REM Load environment variables from .env file
if exist .env (
  echo Loading environment variables from .env file...
  for /f "tokens=*" %%a in (.env) do (
    set "%%a"
  )
  
  REM Display API configuration
  echo [36mCurrent API Configuration:[0m
  echo ATTOM API Endpoint: [36m%ATTOM_API_ENDPOINT%[0m
  echo ATTOM API Key: [36m%ATTOM_API_KEY:~0,3%...%ATTOM_API_KEY:~-3%[0m
  echo.
) else (
  echo [93mWARNING: .env file not found![0m
  exit /b 1
)

REM Check for required environment variables
if "%ATTOM_API_KEY%"=="" (
  echo [91mERROR: ATTOM_API_KEY environment variable is not set.[0m
  echo Please check your .env file.
  exit /b 1
)

REM Ensure Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [91mERROR: Node.js is required but not installed.[0m
  exit /b 1
)

REM Test Script
echo Running ATTOM API tests...
echo.

REM Create a temporary test script
echo const axios = require('axios'); > temp-attom-test.js
echo const dotenv = require('dotenv'); >> temp-attom-test.js
echo dotenv.config(); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo // ANSI color codes for prettier output >> temp-attom-test.js
echo const COLORS = { >> temp-attom-test.js
echo   reset: "\x1b[0m", >> temp-attom-test.js
echo   red: "\x1b[31m", >> temp-attom-test.js
echo   green: "\x1b[32m", >> temp-attom-test.js
echo   yellow: "\x1b[33m", >> temp-attom-test.js
echo   blue: "\x1b[34m", >> temp-attom-test.js
echo   magenta: "\x1b[35m", >> temp-attom-test.js
echo   cyan: "\x1b[36m" >> temp-attom-test.js
echo }; >> temp-attom-test.js
echo. >> temp-attom-test.js
echo async function testAttomProperty() { >> temp-attom-test.js
echo   console.log(`${COLORS.blue}===== Testing ATTOM Property Lookup =====${COLORS.reset}`); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo   const apiKey = process.env.ATTOM_API_KEY; >> temp-attom-test.js
echo   const baseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'; >> temp-attom-test.js
echo. >> temp-attom-test.js
echo   console.log(`Using API URL: ${baseUrl}`); >> temp-attom-test.js
echo   console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo   try { >> temp-attom-test.js
echo     // Test 1: Property by Address >> temp-attom-test.js
echo     console.log(`\n${COLORS.cyan}Test 1: Property Lookup by Address${COLORS.reset}`); >> temp-attom-test.js
echo     const response1 = await axios({ >> temp-attom-test.js
echo       method: 'GET', >> temp-attom-test.js
echo       url: `${baseUrl}/property/basicprofile`, >> temp-attom-test.js
echo       headers: { >> temp-attom-test.js
echo         'apikey': apiKey, >> temp-attom-test.js
echo         'Accept': 'application/json' >> temp-attom-test.js
echo       }, >> temp-attom-test.js
echo       params: { >> temp-attom-test.js
echo         postalcode: '90210', >> temp-attom-test.js
echo         page: 1, >> temp-attom-test.js
echo         pagesize: 1 >> temp-attom-test.js
echo       } >> temp-attom-test.js
echo     }); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo     console.log(`${COLORS.green}✓ API call successful (Status: ${response1.status})${COLORS.reset}`); >> temp-attom-test.js
echo     console.log(`Found ${response1.data.property.length} properties`); >> temp-attom-test.js
echo     if (response1.data.property.length ^> 0) { >> temp-attom-test.js
echo       const property = response1.data.property[0]; >> temp-attom-test.js
echo       console.log(`\nProperty details:`); >> temp-attom-test.js
echo       console.log(`  Address: ${property.address.line1}`); >> temp-attom-test.js
echo       console.log(`  City: ${property.address.locality}`); >> temp-attom-test.js
echo       console.log(`  State: ${property.address.countrySubd}`); >> temp-attom-test.js
echo       console.log(`  ZIP: ${property.address.postal1}`); >> temp-attom-test.js
echo       console.log(`  ATTOM ID: ${property.identifier.attomId}`); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo       // Save ATTOM ID for next test >> temp-attom-test.js
echo       const attomId = property.identifier.attomId; >> temp-attom-test.js
echo. >> temp-attom-test.js
echo       // Test 2: Property by ATTOM ID >> temp-attom-test.js
echo       console.log(`\n${COLORS.cyan}Test 2: Property Lookup by ATTOM ID${COLORS.reset}`); >> temp-attom-test.js
echo       const response2 = await axios({ >> temp-attom-test.js
echo         method: 'GET', >> temp-attom-test.js
echo         url: `${baseUrl}/property/detail`, >> temp-attom-test.js
echo         headers: { >> temp-attom-test.js
echo           'apikey': apiKey, >> temp-attom-test.js
echo           'Accept': 'application/json' >> temp-attom-test.js
echo         }, >> temp-attom-test.js
echo         params: { >> temp-attom-test.js
echo           attomid: attomId >> temp-attom-test.js
echo         } >> temp-attom-test.js
echo       }); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo       console.log(`${COLORS.green}✓ API call successful (Status: ${response2.status})${COLORS.reset}`); >> temp-attom-test.js
echo       if (response2.data.property ^&^& response2.data.property.length ^> 0) { >> temp-attom-test.js
echo         const detailedProperty = response2.data.property[0]; >> temp-attom-test.js
echo         console.log(`\nDetailed property info:`); >> temp-attom-test.js
echo         console.log(`  Year Built: ${detailedProperty.summary?.yearBuilt || 'N/A'}`); >> temp-attom-test.js
echo         console.log(`  Bedrooms: ${detailedProperty.building?.rooms?.beds || 'N/A'}`); >> temp-attom-test.js
echo         console.log(`  Bathrooms: ${detailedProperty.building?.rooms?.bathsFull || 'N/A'}`); >> temp-attom-test.js
echo         console.log(`  Square Feet: ${detailedProperty.building?.size?.universalsize || 'N/A'}`); >> temp-attom-test.js
echo         console.log(`  Lot Size: ${detailedProperty.lot?.lotsize1 || 'N/A'} ${detailedProperty.lot?.lotsize1unit || 'N/A'}`); >> temp-attom-test.js
echo       } >> temp-attom-test.js
echo     } >> temp-attom-test.js
echo. >> temp-attom-test.js
echo     return true; >> temp-attom-test.js
echo   } catch (error) { >> temp-attom-test.js
echo     console.error(`${COLORS.red}✗ Error during ATTOM API test:${COLORS.reset}`); >> temp-attom-test.js
echo. >> temp-attom-test.js
echo     if (error.response) { >> temp-attom-test.js
echo       console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`); >> temp-attom-test.js
echo       console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data); >> temp-attom-test.js
echo     } else { >> temp-attom-test.js
echo       console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`); >> temp-attom-test.js
echo     } >> temp-attom-test.js
echo. >> temp-attom-test.js
echo     return false; >> temp-attom-test.js
echo   } >> temp-attom-test.js
echo } >> temp-attom-test.js
echo. >> temp-attom-test.js
echo // Run the test >> temp-attom-test.js
echo testAttomProperty() >> temp-attom-test.js
echo   .then(success =^> { >> temp-attom-test.js
echo     if (success) { >> temp-attom-test.js
echo       console.log(`\n${COLORS.green}✓ All ATTOM API tests completed successfully!${COLORS.reset}`); >> temp-attom-test.js
echo       console.log(`${COLORS.green}✓ The ATTOM API integration is working correctly.${COLORS.reset}`); >> temp-attom-test.js
echo     } else { >> temp-attom-test.js
echo       console.log(`\n${COLORS.red}✗ Some ATTOM API tests failed.${COLORS.reset}`); >> temp-attom-test.js
echo     } >> temp-attom-test.js
echo     process.exit(success ? 0 : 1); >> temp-attom-test.js
echo   }) >> temp-attom-test.js
echo   .catch(error =^> { >> temp-attom-test.js
echo     console.error(`${COLORS.red}Unexpected error: ${error}${COLORS.reset}`); >> temp-attom-test.js
echo     process.exit(1); >> temp-attom-test.js
echo   }); >> temp-attom-test.js

REM Run the temporary test script
node temp-attom-test.js
set RESULT=%ERRORLEVEL%

REM Clean up the temporary file
del temp-attom-test.js

REM Display summary based on test results
if %RESULT% equ 0 (
  echo [92m✓ ATTOM API integration is working correctly![0m
  echo.
  echo [92mNext steps:[0m
  echo 1. Use the ATTOM client in your application
  echo 2. Implement property search features
  echo 3. Add property details pages with ATTOM data
  echo.
  echo See ATTOM_BATCH_IMPLEMENTATION_GUIDE.md for detailed usage instructions.
) else (
  echo [91m✗ Some ATTOM API tests failed.[0m
  echo.
  echo [93mTroubleshooting steps:[0m
  echo 1. Check API key is valid and active
  echo 2. Verify API endpoint URL
  echo 3. Check for rate limiting or usage restrictions
  echo.
  echo For assistance, contact ATTOM support: api@attomdata.com
)

exit /b %RESULT%
