@echo off
REM Start the integrated server and frontend in development mode
REM This script starts both the backend API and the frontend React app

echo [94m浜様様様様様様様様様様様様様様様様様様様様様様様様様様様様様融[0m
echo [94m�                 [92mFlipTracker Startup Script[94m               �[0m
echo [94m藩様様様様様様様様様様様様様様様様様様様様様様様様様様様様様夕[0m

REM Check for required tools
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [91mError: Node.js is required but not installed.[0m
  exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [91mError: npm is required but not installed.[0m
  exit /b 1
)

REM Check if .env file exists
if not exist .env (
  echo [93mWarning: .env file not found. Creating a sample one...[0m
  (
    echo # FlipTracker Environment Variables
    echo PORT=5001
    echo NODE_ENV=development
    echo.
    echo # ATTOM API Configuration
    echo ATTOM_API_KEY=your_attom_api_key_here
    echo ATTOM_API_ENDPOINT=https://api.gateway.attomdata.com/propertyapi/v1.0.0
    echo.
    echo # BatchData (using their documented endpoint^)
    echo BATCHDATA_API_KEY=your_batchdata_api_key_here
    echo BATCHDATA_API_URL=https://api.batchdata.com/api
    echo SKIP_TRACE_DAILY_QUOTA=100
    echo.
    echo # Database Configuration
    echo DATABASE_URL=./prisma/dev.db
  ) > .env
  echo [92mSample .env file created. Please edit with your actual API keys.[0m
)

echo.
echo [93mStarting servers in separate windows...[0m

REM Start the backend server in a new window
start "FlipTracker Backend" cmd /c "echo [92mStarting backend server...[0m && node backend/integrated-server.js"

REM Wait a moment to let the backend start
timeout /t 3 >nul

REM Start the frontend development server in a new window
start "FlipTracker Frontend" cmd /c "echo [92mStarting frontend server...[0m && cd frontend && npm run dev"

echo.
echo [92m様様様様様様様様様様様様様様様様様様様様様様様様様様様様様様様[0m
echo [92mFlipTracker is running![0m
echo [93mBackend:[0m http://localhost:5001
echo [93mFrontend:[0m http://localhost:3000
echo [92m様様様様様様様様様様様様様様様様様様様様様様様様様様様様様様様[0m
echo.
echo Close the terminal windows when you want to stop the servers.

REM Keep the main window open
pause > nul
