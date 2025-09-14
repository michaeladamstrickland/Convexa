#!/bin/bash
# Restart and test ATTOM API server

echo "====== ATTOM API Server Restart and Test ======"
echo "Stopping any existing Node.js servers..."

# Find and kill any existing Node.js processes running the server
if [[ "$OSTYPE" == "darwin"* || "$OSTYPE" == "linux-gnu"* ]]; then
  # macOS or Linux
  pkill -f "node.*server.js" || echo "No server running"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # Windows with Git Bash or similar
  taskkill //F //IM node.exe //FI "WINDOWTITLE eq *server.js*" > /dev/null 2>&1 || echo "No server running"
fi

echo "Starting ATTOM API server..."
echo "Current directory: $(pwd)"

# Change to backend directory
cd backend

# Start the server in the background
node attom-server.js &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for server to initialize (5 seconds)..."
sleep 5

echo "Testing API server status..."
curl -s http://localhost:5002/api/attom/status

echo -e "\n\nTesting property detail endpoint..."
# Use a property ID from your database
curl -s http://localhost:5002/api/attom/property/42116/detail > test-response.json

echo -e "\nResponse saved to backend/test-response.json"
echo -e "\nServer is running. Press Ctrl+C to stop."

# Keep script running until Ctrl+C
wait $SERVER_PID
