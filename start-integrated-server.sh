#!/bin/bash

# Start the integrated server that includes both ZIP Search and ATTOM API
echo "Starting FlipTracker Integrated Server (ZIP Search + ATTOM API)..."
cd "$(dirname "$0")"
node backend/integrated-server.js
