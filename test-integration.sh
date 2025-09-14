#!/bin/bash
# Integration test script for ATTOM and BatchData APIs

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== FlipTracker - ATTOM + BatchData Integration Test =====${NC}"
echo "Testing API connectivity and integration..."
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
  echo -e "${CYAN}Current API Configuration:${NC}"
  echo -e "ATTOM API Endpoint: ${CYAN}$ATTOM_API_ENDPOINT${NC}"
  echo -e "ATTOM API Key: ${CYAN}${ATTOM_API_KEY:0:3}...${ATTOM_API_KEY: -3}${NC}"
  echo -e "BatchData API Endpoint: ${CYAN}$BATCHDATA_API_ENDPOINT${NC}"
  echo -e "BatchData API Key: ${CYAN}${BATCHDATA_API_KEY:0:3}...${BATCHDATA_API_KEY: -3}${NC}"
  echo ""
else
  echo -e "${YELLOW}WARNING: .env file not found!${NC}"
fi

# Check for required environment variables
if [ -z "$ATTOM_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: ATTOM_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

if [ -z "$BATCHDATA_API_KEY" ]; then
  echo -e "${YELLOW}WARNING: BATCHDATA_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Ensure Node.js is installed
if ! command_exists node; then
  echo -e "${RED}ERROR: Node.js is required but not installed.${NC}"
  exit 1
fi

# Run the API test script
echo "Running API connectivity tests..."
node test-attom-batch.js

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}API tests failed. Please check the errors above.${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting steps:${NC}"
  echo "1. Verify API keys in your .env file"
  echo "2. Check API endpoint URLs in the services"
  echo "3. Try using a different test property address"
  echo "4. Check if the APIs require additional headers"
  echo ""
  echo -e "${YELLOW}For ATTOM API:${NC}"
  echo "- Documentation: https://api.developer.attomdata.com/docs"
  echo "- Support Email: api@attomdata.com"
  echo ""
  echo -e "${YELLOW}For BatchData API:${NC}"
  echo "- Documentation: https://batchdata.com/api-docs/"
  echo "- Support Email: support@batchdata.com"
  echo ""
  echo "After resolving the API issues, rerun this script to verify connectivity."
else
  echo -e "${GREEN}All API tests passed!${NC}"
  
  # Check if integration is working with the live API
  echo ""
  echo "Testing the services with real property data..."
  node -e "
    const attomClient = require('./src/services/attomClient').default;
    const batchService = require('./src/services/batchService').default;
    
    async function testIntegration() {
      try {
        console.log('Testing ATTOM property lookup...');
        const property = await attomClient.getPropertyByAddress(
          '1600 Pennsylvania Ave',
          'Washington',
          'DC',
          '20500'
        );
        
        if (property) {
          console.log('\x1b[32m✓ ATTOM property lookup successful!\x1b[0m');
          console.log('Property details:', JSON.stringify(property, null, 2).substring(0, 300) + '...');
          
          console.log('\nTesting BatchData skip trace...');
          const skipTraceResult = await batchService.skipTraceByAddress(
            property.propertyAddress,
            property.city,
            property.state,
            property.zipCode
          );
          
          if (skipTraceResult.status === 'success') {
            console.log('\x1b[32m✓ BatchData skip trace successful!\x1b[0m');
            const contactData = batchService.processSkipTraceResults(skipTraceResult);
            console.log('Contact data:', JSON.stringify(contactData, null, 2));
          } else {
            console.log('\x1b[33m⚠ Skip trace returned status: ' + skipTraceResult.status + '\x1b[0m');
            if (skipTraceResult.message) {
              console.log('Message:', skipTraceResult.message);
            }
          }
        } else {
          console.log('\x1b[33m⚠ No property found\x1b[0m');
        }
      } catch (error) {
        console.error('\x1b[31m✗ Error during integration test:\x1b[0m', error.message);
      }
    }
    
    testIntegration();
  "
  
  echo ""
  echo -e "${GREEN}Integration setup complete!${NC}"
  echo "Next steps:"
  echo "1. Integrate with your search service"
  echo "2. Add skip trace functionality to lead details page"
  echo "3. Create frontend components for user interaction"
  echo ""
  echo "See ATTOM_BATCH_IMPLEMENTATION_GUIDE.md for detailed usage instructions."
fi
