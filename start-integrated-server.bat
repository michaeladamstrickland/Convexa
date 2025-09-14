@echo off

REM Start the integrated server that includes both ZIP Search and ATTOM API
echo Starting FlipTracker Integrated Server (ZIP Search + ATTOM API)...
cd /d "%~dp0"
node backend\integrated-server.js
