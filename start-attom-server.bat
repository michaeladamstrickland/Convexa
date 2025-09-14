@echo off
REM Start the ATTOM API server

echo [94m===== Starting ATTOM API Server =====[0m

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [93mNode.js is not installed. Please install it and try again.[0m
    exit /b 1
)

REM Check for required files
if not exist "backend\attom-server.js" (
    echo [93mServer file not found: backend\attom-server.js[0m
    exit /b 1
)

REM Check for .env file with API keys
if not exist ".env" (
    echo [93mWarning: .env file not found. API keys may not be configured.[0m
) else (
    echo [92mLoaded environment variables from .env file[0m
    
    REM Extract and check for ATTOM API key
    for /f "tokens=*" %%a in (.env) do (
        set "%%a"
    )
    
    if "%ATTOM_API_KEY%"=="" (
        echo [93mWarning: ATTOM_API_KEY not found in .env file[0m
    ) else (
        set "key_start=%ATTOM_API_KEY:~0,3%"
        set "key_end=%ATTOM_API_KEY:~-3%"
        echo [92mATTOM API key configured: %key_start%...%key_end%[0m
    )
)

REM Start the server
echo [92mStarting ATTOM API Server...[0m
@echo off
echo ======================================================
echo Starting ATTOM API Server for FlipTracker
echo ======================================================
echo.
echo This server provides the ATTOM Property Data API endpoints
echo that the frontend needs to access real property data.
echo.
echo The server will run on port 5001 by default.
echo.
echo Make sure you have set up your ATTOM API key in .env file:
echo ATTOM_API_KEY=your_api_key_here
echo.
echo Press Ctrl+C to stop the server
echo.
echo Starting server...
echo ======================================================

cd backend
node attom-server.js
