@echo off
echo 🚀 STARTING LEADFLOW AI INTEGRATED SERVER
echo ========================================

cd /d "%~dp0server"

echo 📊 Features:
echo ✅ Lead Management System
echo ✅ ATTOM Property Data API
echo ✅ Property Search & ZIP Code Lookup
echo ✅ Complete Database Integration
echo.

echo 🎯 Starting server on http://localhost:5001
echo.

node integrated-server.js

pause
