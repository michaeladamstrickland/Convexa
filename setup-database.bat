@echo off
REM Setup Lead Management System Database

echo Setting up FlipTracker Lead Management Database...

REM Ensure dependencies are installed
call npm install sqlite3 better-sqlite3 --save

REM Ensure the data directory exists
if not exist "data" mkdir data

REM Change to the server directory
cd "%~dp0server"

REM Run the database initialization
node database.js --init

echo.
echo ✅ Database setup complete!
echo ✅ You can now start the server with start-server.bat

pause
