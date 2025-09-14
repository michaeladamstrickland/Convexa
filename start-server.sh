#!/bin/bash

# Start the integrated FlipTracker server with Lead Management

echo "Starting FlipTracker Integrated Server..."
echo "Press Ctrl+C to stop the server"

# Change to the server directory
cd "$(dirname "$0")/server"

# Run the server
node integrated-server.js
