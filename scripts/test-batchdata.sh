#!/bin/bash
# Test script for BatchData Skip Trace API

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}BatchData Skip Trace API Test${NC}"
echo "==============================="

# Verify .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found.${NC}"
  echo "Please create a .env file with BATCHDATA_API_KEY and BATCHDATA_API_URL."
  exit 1
fi

# Load API key from .env file
BATCHDATA_API_KEY=$(grep BATCHDATA_API_KEY .env | cut -d '=' -f2)
BATCHDATA_API_URL=$(grep BATCHDATA_API_URL .env | cut -d '=' -f2 || echo "https://api.batchdata.com/api")

# Check if API key is available
if [ -z "$BATCHDATA_API_KEY" ]; then
  echo -e "${RED}Error: BATCHDATA_API_KEY not found in .env file.${NC}"
  exit 1
fi

echo "API URL: $BATCHDATA_API_URL"
echo "API Key: ${BATCHDATA_API_KEY:0:5}... (truncated for security)"
echo ""

# Test data
NAME="John Smith"
ADDRESS="123 Main St"
CITY="Beverly Hills"
STATE="CA"
ZIP="90210"

echo "Testing skip trace lookup with:"
echo "Name: $NAME"
echo "Address: $ADDRESS, $CITY, $STATE $ZIP"
echo ""

# Call the API
echo -e "${YELLOW}Sending API request...${NC}"
RESPONSE=$(curl -s -X POST "$BATCHDATA_API_URL/v1/property/owner/contact" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $BATCHDATA_API_KEY" \
  -d "{\"name\": \"$NAME\", \"address\": \"$ADDRESS\", \"city\": \"$CITY\", \"state\": \"$STATE\", \"zip\": \"$ZIP\"}")

# Check if response contains error
if echo "$RESPONSE" | grep -q "error"; then
  echo -e "${RED}API Error:${NC}"
  echo "$RESPONSE" | jq -r .error
  exit 1
fi

# Display results
echo -e "${GREEN}API Response:${NC}"
echo "$RESPONSE" | jq .

# Count phones and emails
PHONES=$(echo "$RESPONSE" | jq '.phones | length')
EMAILS=$(echo "$RESPONSE" | jq '.emails | length')

echo ""
echo -e "${GREEN}Summary:${NC}"
echo "Found $PHONES phone number(s) and $EMAILS email(s)"
echo ""

# Check if integrated with our API
echo -e "${YELLOW}Testing integration with our API...${NC}"
echo "Creating a test lead..."

# Create a test lead via our API
LEAD_RESPONSE=$(curl -s -X POST "http://localhost:5001/api/zip-search-new/add-lead" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"$ADDRESS, $CITY, $STATE $ZIP\", \"owner_name\": \"$NAME\", \"source_type\": \"test\"}")

LEAD_ID=$(echo "$LEAD_RESPONSE" | jq -r .leadId)

if [ "$LEAD_ID" == "null" ]; then
  echo -e "${RED}Failed to create test lead.${NC}"
  echo "$LEAD_RESPONSE"
  exit 1
fi

echo -e "${GREEN}Test lead created with ID: $LEAD_ID${NC}"

# Test skip trace API
echo "Calling skip trace API..."
SKIPTRACE_RESPONSE=$(curl -s -X POST "http://localhost:5001/api/leads/$LEAD_ID/skiptrace" \
  -H "Content-Type: application/json")

echo -e "${GREEN}Skip Trace API Response:${NC}"
echo "$SKIPTRACE_RESPONSE" | jq .

echo ""
echo -e "${GREEN}Test completed.${NC}"
