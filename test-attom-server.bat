@echo off
REM Enhanced ATTOM API Server Test Tool

echo ===================================================
echo FlipTracker ATTOM API Server Test Tool (Updated)
echo ===================================================
echo.

REM Get command line argument for test type
set TEST_TYPE=%1
if "%TEST_TYPE%"=="" set TEST_TYPE=restart

REM Check server status function
:check_server
echo Checking server status...
curl -s -o nul -w "Main server (port 5001): %{http_code}\n" http://localhost:5001/health 2>nul
curl -s -o nul -w "ATTOM server (port 5002): %{http_code}\n" http://localhost:5002/health 2>nul
echo.
goto :eof

REM Handle different test types
if "%TEST_TYPE%"=="restart" ('
  call :restart_server
  goto :end
)

if "%TEST_TYPE%"=="status" (
  call :check_server
  goto :end
)

if "%TEST_TYPE%"=="health" (
  echo Testing ATTOM server health...
  curl http://localhost:5002/health
  echo.
  goto :end
)

if "%TEST_TYPE%"=="property" (
  set PROPERTY_ID=%2
  if "%PROPERTY_ID%"=="" set PROPERTY_ID=42116
  echo Testing property detail for ID %PROPERTY_ID%...
  cd backend
  node check-na-values.js %PROPERTY_ID%
  goto :end
)

if "%TEST_TYPE%"=="quality" (
  set PROPERTY_ID=%2
  if "%PROPERTY_ID%"=="" set PROPERTY_ID=42116
  echo Running property data quality check for ID %PROPERTY_ID%...
  cd backend
  node check-na-values.js %PROPERTY_ID%
  goto :end
)

if "%TEST_TYPE%"=="frontend" (
  echo Opening frontend test page...
  start "" "frontend\attom-test.html"
  goto :end
)

REM If we get here, show usage
echo Unknown test type: %TEST_TYPE%
echo Available options:
echo   restart  - Restart the ATTOM server
echo   status   - Check server status
echo   health   - Test the health endpoint
echo   property - Test property detail endpoint (optional: specify property ID)
echo   quality  - Run property data quality check (optional: specify property ID)
echo   frontend - Open the frontend test page
echo.
echo Example usage:
echo   test-attom-server.bat property 42117
echo   test-attom-server.bat health
echo   test-attom-server.bat restart
goto :end

REM Restart server function
:restart_server
echo Stopping any existing ATTOM API servers...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *attom-server.js*" > nul 2>&1 || echo No ATTOM server running

echo Starting ATTOM API server...
echo Current directory: %cd%

REM Change to backend directory
cd backend

REM Start the server
start "ATTOM API Server" cmd /k "node attom-server.js"

echo.
echo Server started in new window.
echo ATTOM API Server will run on port 5002
echo.
echo Waiting for server to initialize (5 seconds)...
timeout /t 5 /nobreak > nul

echo Testing API server status...
curl -s http://localhost:5002/api/attom/status

echo.
echo.
echo Testing property detail endpoint...
REM Use a property ID from your database
curl -s http://localhost:5002/api/attom/property/42116/detail > test-response.json

echo.
echo Response saved to backend\test-response.json
echo.
echo IMPORTANT: Frontend components must connect to port 5002 for ATTOM API
echo and port 5001 for the main application server.
echo.
echo Server is running in separate window. Close that window to stop the server.
echo.
goto :eof

:end
echo.
echo Done.
