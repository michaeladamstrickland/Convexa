#!/bin/bash

echo "Installing ZIP Search Server dependencies..."

# Navigate to the backend directory
cd "$(dirname "$0")"

# Install required packages
npm install express cors better-sqlite3

echo "Creating startup scripts..."

# Create Windows batch file
cat > start-zip-search.bat << EOF
@echo off
echo Starting ZIP Search Server...
cd backend
node zip-search-server.js
EOF

# Make the current script executable
chmod +x setup-zip-search.sh
chmod +x start-zip-search.sh

echo "Setup complete! You can now run the ZIP Search Server with:"
echo "  Windows: start-zip-search.bat"
echo "  Linux/Mac: ./start-zip-search.sh"
