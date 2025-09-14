@echo off
REM Test the Lead Management API

echo Running Lead Management API Tests...

REM Ensure the server is running first (non-blocking)
start /b cmd /c "cd %~dp0 && node server/integrated-server.js"

REM Wait a moment for the server to start
echo Waiting for server to start...
timeout /t 3 /nobreak > nul

REM Run the tests
node test-lead-api.js

REM Store the test result
set TEST_RESULT=%ERRORLEVEL%

REM Clean up - kill the server process
taskkill /f /im node.exe /fi "WINDOWTITLE eq node server/integrated-server.js" > nul 2>&1

REM Return the test result
exit /b %TEST_RESULT%
