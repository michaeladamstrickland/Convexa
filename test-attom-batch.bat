@echo off
REM Test script for ATTOM API and BatchData integration

echo ===== LeadFlow AI - ATTOM + BatchData Integration Test =====
echo Testing API connectivity and integration setup...
echo.

REM Check for required environment variables
if "%ATTOM_API_KEY%"=="" (
  echo WARNING: ATTOM_API_KEY environment variable is not set.
  echo Please check your .env file.
)

if "%BATCHDATA_API_KEY%"=="" (
  echo WARNING: BATCHDATA_API_KEY environment variable is not set.
  echo Please check your .env file.
)

REM Run the test script
node test-attom-batch.js

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Test failed. Please review the errors above.
  exit /b %ERRORLEVEL%
) else (
  echo.
  echo All tests passed! Your integration is set up correctly.
)
