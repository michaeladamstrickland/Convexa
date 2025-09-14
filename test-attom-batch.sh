#!/bin/bash

# Test script for ATTOM API and BatchData integration

# ANSI color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}===== LeadFlow AI - ATTOM + BatchData Integration Test =====${NC}"
echo "Testing API connectivity and integration setup..."
echo ""

# Check for required environment variables
if [ -z "$ATTOM_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: ATTOM_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

if [ -z "$BATCHDATA_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: BATCHDATA_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

# Run the test script
node test-attom-batch.js

if [ $? -ne 0 ]; then
  echo ""
  echo -e "${RED}Test failed. Please review the errors above.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}All tests passed! Your integration is set up correctly.${NC}"
fi
