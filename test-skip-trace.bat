@echo off
echo ===================================
echo FlipTracker Skip Trace Test Script
echo ===================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Error: Node.js is not installed or not in PATH
  exit /b 1
)

:: Check if data directory exists, create if not
if not exist ".\data" (
  echo Creating data directory...
  mkdir ".\data"
)

:: Setup database schema first
echo Setting up database schema...
node setup-skip-trace-db.js

:: Run the test script
echo Running skip trace test...
node test-skip-trace.js

echo.
if %ERRORLEVEL% equ 0 (
  echo Test completed successfully!
) else (
  echo Test failed with exit code %ERRORLEVEL%
)

pause
