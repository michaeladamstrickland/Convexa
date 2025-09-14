#!/bin/bash

# Run the improved ATTOM API server
cd "$(dirname "$0")"
echo "Starting improved ATTOM API server..."
node backend/attom-server-fixed.js
