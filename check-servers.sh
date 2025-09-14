#!/bin/bash
# Server status check script

echo "===== CHECKING SERVER STATUS ====="

# Check main server (port 5001)
echo -e "\n1. Checking main server (port 5001)..."
MAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/health || echo "offline")

if [ "$MAIN_STATUS" == "200" ]; then
  echo "✅ Main server is running on port 5001"
else
  echo "❌ Main server is not running (status: $MAIN_STATUS)"
  echo "   Try starting it with: cd backend && npm run dev"
fi

# Check ATTOM API server (port 5002)
echo -e "\n2. Checking ATTOM API server (port 5002)..."
ATTOM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/health || echo "offline")

if [ "$ATTOM_STATUS" == "200" ]; then
  echo "✅ ATTOM API server is running on port 5002"
  
  # If ATTOM server is running, check a sample property
  echo -e "\n3. Testing ATTOM property API..."
  TEST_PROPERTY_ID="42116"
  PROPERTY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/attom/property/$TEST_PROPERTY_ID/detail || echo "offline")
  
  if [ "$PROPERTY_STATUS" == "200" ]; then
    echo "✅ Property API is working"
    echo "   Sample property available at: http://localhost:5002/api/attom/property/$TEST_PROPERTY_ID/detail"
  else
    echo "❌ Property API returned status: $PROPERTY_STATUS"
    echo "   There may be an issue with the ATTOM API key or configuration"
  fi
else
  echo "❌ ATTOM API server is not running (status: $ATTOM_STATUS)"
  echo "   Try starting it with: cd backend && node attom-server.js"
fi

echo -e "\n===== SERVER CHECK COMPLETE ====="
