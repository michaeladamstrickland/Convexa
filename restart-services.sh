#!/bin/bash
# This script restarts all FlipTracker services with proper configuration

echo "==================================================="
echo "FlipTracker Full Service Restart"
echo "==================================================="

# Stop any existing processes
echo "Stopping existing services..."
pkill -f "node attom-server.js" || echo "No ATTOM server running"
pkill -f "npm run dev" || echo "No frontend server running"
sleep 2

# Start ATTOM server
echo "Starting ATTOM server on port 5002..."
cd backend
node attom-server.js > attom-server.log 2>&1 &
ATTOM_PID=$!
cd ..

# Wait for ATTOM server to start
echo "Waiting for ATTOM server to initialize..."
sleep 3

# Start frontend server
echo "Starting frontend server on port 3000..."
cd frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "All services started."
echo ""
echo "IMPORTANT:" 
echo " - ATTOM API server running on port 5002 (PID: $ATTOM_PID)"
echo " - Frontend server running on port 3000 (PID: $FRONTEND_PID)"
echo " - Frontend is configured to proxy /api/attom requests to port 5002"
echo ""

sleep 2
echo "Opening browser to access the application..."
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000
elif command -v open > /dev/null; then
  open http://localhost:3000
else
  echo "Please open http://localhost:3000 in your browser"
fi

echo "Done."
