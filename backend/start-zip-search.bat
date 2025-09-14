@echo off
:: Script to start the ZIP Search API server

echo 🚀 Starting ZIP Search API server...
cd /d "%~dp0"
node zip-search-server.js
