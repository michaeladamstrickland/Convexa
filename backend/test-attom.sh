#!/bin/bash
# Test script for ATTOM API server

echo "Testing ATTOM API server..."

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:5002/health)
if [ $? -ne 0 ]; then
    echo "Error connecting to health endpoint"
    exit 1
fi

echo "Health response: $HEALTH_RESPONSE"

# Test property detail endpoint
echo "Testing property detail endpoint..."
PROPERTY_RESPONSE=$(curl -s http://localhost:5002/api/attom/property/42116/detail)
if [ $? -ne 0 ]; then
    echo "Error connecting to property detail endpoint"
    exit 1
fi

echo "Property response received. First 300 characters:"
echo "${PROPERTY_RESPONSE:0:300}..."

echo "Tests complete"
