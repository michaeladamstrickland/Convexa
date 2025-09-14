@echo off
REM This script restarts all FlipTracker services with proper configuration

echo ===================================================
echo FlipTracker Full Service Restart
echo ===================================================

REM Stop any existing processes
echo Stopping existing services...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *attom-server*" > nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *npm run dev*" > nul 2>&1
timeout /t 2 /nobreak > nul

REM Start ATTOM server
echo Starting ATTOM server on port 5002...
start "ATTOM Server" cmd /k "cd backend && node attom-server.js"

REM Wait for ATTOM server to start
echo Waiting for ATTOM server to initialize...
timeout /t 3 /nobreak > nul

REM Start frontend server
echo Starting frontend server on port 3000...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo All services started.
echo.
echo IMPORTANT: 
echo  - ATTOM API server running on port 5002
echo  - Frontend server running on port 3000
echo  - Frontend is configured to proxy /api/attom requests to port 5002
echo.

timeout /t 2 /nobreak > nul
echo Starting browser to access the application...
start http://localhost:3000

echo Done.
