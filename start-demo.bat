@echo off
REM LeadFlow AI Master Platform - Windows Startup Script
REM Starts both backend demo server and React frontend

echo 🚀 Starting LeadFlow AI Master Platform...
echo 📊 Superior to PropStream, BatchLeads ^& REsimpli
echo ⚡ 26 Premium APIs • AI-Powered Analysis • $1.57/search
echo.

REM Set environment variables for demo
set LEADFLOW_TIER=professional
set DAILY_BUDGET_LIMIT=150
set DEMO_PORT=5001
set NODE_ENV=development

echo 📦 Checking dependencies...

REM Check backend dependencies
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install
)
cd ..

REM Check frontend dependencies  
cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
    
    REM Install additional dependencies for demo
    npm install lucide-react axios
    
    REM Install Tailwind CSS if not present
    npm install -D tailwindcss postcss autoprefixer @tailwindcss/forms
    npx tailwindcss init -p
)
cd ..

echo.
echo 🔧 Starting Backend Demo Server...
cd backend

REM Start demo server
start "LeadFlow Backend" cmd /k "npm run dev"

echo ✅ Backend starting on http://localhost:5001
cd ..

REM Wait for backend to start
timeout /t 3 /nobreak > nul

echo.
echo 🎨 Starting React Frontend...
cd frontend

REM Start React app
start "LeadFlow Frontend" cmd /k "npm start"

echo ✅ Frontend starting on http://localhost:3000
cd ..

REM Wait for frontend to start
timeout /t 5 /nobreak > nul

echo.
echo 🎉 LeadFlow AI Master Platform is now running!
echo.
echo 📱 Frontend (React): http://localhost:3000
echo 🔧 Backend (API): http://localhost:5001  
echo ❤️  Health Check: http://localhost:5001/health
echo 📊 System Status: http://localhost:5001/api/system/status
echo.
echo 🎯 Features Available:
echo   • Ultimate Search (All 26 APIs)
echo   • Probate Lead Mining
echo   • Foreclosure Tracking  
echo   • High Equity Analysis
echo   • AI-Powered Scoring
echo   • Contact Information
echo   • CSV Export
echo.
echo Superior to PropStream/BatchLeads/REsimpli with 26 data sources!
echo.
echo Press any key to stop all services...
pause > nul

echo.
echo 🛑 Shutting down LeadFlow AI Platform...

REM Kill processes on our ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a 2>nul

echo ✅ LeadFlow AI Platform shutdown complete
pause
