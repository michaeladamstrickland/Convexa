#!/bin/bash

# Script to run the server and test API routes

echo "Starting the server..."
cd "$(dirname "$0")"
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Run API tests
echo "Running API tests..."
npx node test-api-routes.js

# Kill the server
echo "Stopping server..."
kill $SERVER_PID

echo "Done!"
