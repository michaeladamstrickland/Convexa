#!/bin/bash
# ATTOM API Server Test Script for bash

echo "====== ATTOM API Server Test ======"
echo "Checking if server is running..."

# Test server status
status_response=$(curl -s http://localhost:5002/api/attom/status || echo "Server not responding")
echo "Server status: $status_response"

if [[ "$status_response" != *"Server not responding"* ]]; then
  echo "Server is running!"
  
  # Test property detail endpoint with a sample property ID
  echo "Testing property detail endpoint..."
  test_property_id="42116"
  
  echo "Fetching property details for ID: $test_property_id"
  curl -s http://localhost:5002/api/attom/property/$test_property_id/detail > test-response.json
  
  echo "Response saved to test-response.json"
  
  # Check for success in the response
  if grep -q "success" test-response.json; then
    echo "✅ Property detail request successful!"
    
    # Look for N/A values in the response to see if our field mapping is working
    na_count=$(grep -o "N/A" test-response.json | wc -l)
    if [ $na_count -gt 0 ]; then
      echo "⚠️ Found $na_count N/A values in the response. Field mapping may need improvement."
    else
      echo "✅ No N/A values found! Field mapping appears to be working well."
    fi
  else
    echo "❌ Property detail request failed. Check server logs for details."
  fi
else
  echo "❌ Server is not running or not responding."
  echo "Try starting the server with:"
  echo "cd backend && node attom-server.js"
fi
