@echo off
echo Running FlipTracker Integration Tests...
echo.

rem Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Error: Node.js is not installed or not in the PATH.
  echo Please install Node.js from https://nodejs.org/
  exit /b 1
)

rem Check for .env file
if not exist ".env" (
  echo Warning: No .env file found. Creating a template .env file...
  echo # Database > .env
  echo DATABASE_URL="file:./dev.db" >> .env
  echo. >> .env
  echo # API Keys >> .env
  echo ATTOM_API_KEY=your_attom_api_key_here >> .env
  echo BATCH_SKIP_TRACING_API_KEY=your_batchdata_api_key_here >> .env
  echo WHITEPAGES_PRO_API_KEY=your_whitepages_api_key_here  # Optional >> .env
  echo. >> .env
  echo # Feature Flags >> .env
  echo FEATURE_ATTOM_PROPERTY_DATA=true >> .env
  echo FEATURE_SKIPTRACE_BATCHDATA=true >> .env
  echo FEATURE_SKIPTRACE_FALLBACK=true >> .env
  echo.
  echo Please edit the .env file with your API keys before running the tests.
  echo Press any key to open the .env file in Notepad...
  pause >nul
  notepad .env
  echo.
  echo After saving the .env file, run this script again.
  exit /b 1
)

rem Run the integration test script
echo Starting integration tests...
node run-integration-tests.js

echo.
if %ERRORLEVEL% NEQ 0 (
  echo Tests completed with errors.
) else (
  echo Tests completed successfully.
)

echo.
echo For more detailed testing instructions, see:
echo - QUICK_START_TESTING.md
echo - QA_TESTING_INSTRUCTIONS.md
echo - TECHNICAL_TESTING_GUIDE.md
echo.

pause
