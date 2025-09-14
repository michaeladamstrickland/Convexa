#!/bin/bash

echo "Starting ZIP Search Server..."

# Navigate to the backend directory
cd "$(dirname "$0")/backend"

# Start the server
node zip-search-server.js
