#!/bin/bash
# ATTOM API Test Script

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== FlipTracker - ATTOM API Test =====${NC}"
echo "Testing ATTOM Property Data API connectivity and features..."
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
  
  # Display API configuration
  echo -e "${CYAN}Current API Configuration:${NC}"
  echo -e "ATTOM API Endpoint: ${CYAN}$ATTOM_API_ENDPOINT${NC}"
  echo -e "ATTOM API Key: ${CYAN}${ATTOM_API_KEY:0:3}...${ATTOM_API_KEY: -3}${NC}"
  echo ""
else
  echo -e "${YELLOW}WARNING: .env file not found!${NC}"
  exit 1
fi

# Check for required environment variables
if [ -z "$ATTOM_API_KEY" ]; then
  echo -e "${RED}ERROR: ATTOM_API_KEY environment variable is not set.${NC}"
  echo "Please check your .env file."
  exit 1
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

# Test Script
echo "Running ATTOM API tests..."
echo ""

# Create a temporary test script
cat > temp-attom-test.js << 'EOL'
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// ANSI color codes for prettier output
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

async function testAttomProperty() {
  console.log(`${COLORS.blue}===== Testing ATTOM Property Lookup =====${COLORS.reset}`);
  
  const apiKey = process.env.ATTOM_API_KEY;
  const baseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  
  console.log(`Using API URL: ${baseUrl}`);
  console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
  
  try {
    // Test 1: Property by Address
    console.log(`\n${COLORS.cyan}Test 1: Property Lookup by Address${COLORS.reset}`);
    const response1 = await axios({
      method: 'GET',
      url: `${baseUrl}/property/basicprofile`,
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json'
      },
      params: {
        postalcode: '90210',
        page: 1,
        pagesize: 1
      }
    });
    
    console.log(`${COLORS.green}✓ API call successful (Status: ${response1.status})${COLORS.reset}`);
    console.log(`Found ${response1.data.property.length} properties`);
    if (response1.data.property.length > 0) {
      const property = response1.data.property[0];
      console.log(`\nProperty details:`);
      console.log(`  Address: ${property.address.line1}`);
      console.log(`  City: ${property.address.locality}`);
      console.log(`  State: ${property.address.countrySubd}`);
      console.log(`  ZIP: ${property.address.postal1}`);
      console.log(`  ATTOM ID: ${property.identifier.attomId}`);
      
      // Save ATTOM ID for next test
      const attomId = property.identifier.attomId;
      
      // Test 2: Property by ATTOM ID
      console.log(`\n${COLORS.cyan}Test 2: Property Lookup by ATTOM ID${COLORS.reset}`);
      const response2 = await axios({
        method: 'GET',
        url: `${baseUrl}/property/detail`,
        headers: {
          'apikey': apiKey,
          'Accept': 'application/json'
        },
        params: {
          attomid: attomId
        }
      });
      
      console.log(`${COLORS.green}✓ API call successful (Status: ${response2.status})${COLORS.reset}`);
      if (response2.data.property && response2.data.property.length > 0) {
        const detailedProperty = response2.data.property[0];
        console.log(`\nDetailed property info:`);
        console.log(`  Year Built: ${detailedProperty.summary?.yearBuilt || 'N/A'}`);
        console.log(`  Bedrooms: ${detailedProperty.building?.rooms?.beds || 'N/A'}`);
        console.log(`  Bathrooms: ${detailedProperty.building?.rooms?.bathsFull || 'N/A'}`);
        console.log(`  Square Feet: ${detailedProperty.building?.size?.universalsize || 'N/A'}`);
        console.log(`  Lot Size: ${detailedProperty.lot?.lotsize1 || 'N/A'} ${detailedProperty.lot?.lotsize1unit || 'N/A'}`);
      }
      
      // Test 3: Property Valuation
      console.log(`\n${COLORS.cyan}Test 3: Property Valuation${COLORS.reset}`);
      const response3 = await axios({
        method: 'GET',
        url: `${baseUrl}/property/expandedprofile`,
        headers: {
          'apikey': apiKey,
          'Accept': 'application/json'
        },
        params: {
          attomid: attomId
        }
      });
      
      console.log(`${COLORS.green}✓ API call successful (Status: ${response3.status})${COLORS.reset}`);
      if (response3.data.property && response3.data.property.length > 0) {
        const valuationData = response3.data.property[0];
        console.log(`\nProperty valuation info:`);
        console.log(`  AVM Value: $${valuationData.avm?.amount?.value || 'N/A'}`);
        console.log(`  Last Sale Price: $${valuationData.sale?.amount?.saleamt || 'N/A'}`);
        console.log(`  Last Sale Date: ${valuationData.sale?.salesearchdate || 'N/A'}`);
        console.log(`  Tax Assessed Value: $${valuationData.assessment?.assessed?.assdttlvalue || 'N/A'}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${COLORS.red}✗ Error during ATTOM API test:${COLORS.reset}`);
    
    if (error.response) {
      console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`);
      console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data);
    } else {
      console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
    }
    
    return false;
  }
}

// Run the test
testAttomProperty()
  .then(success => {
    if (success) {
      console.log(`\n${COLORS.green}✓ All ATTOM API tests completed successfully!${COLORS.reset}`);
      console.log(`${COLORS.green}✓ The ATTOM API integration is working correctly.${COLORS.reset}`);
    } else {
      console.log(`\n${COLORS.red}✗ Some ATTOM API tests failed.${COLORS.reset}`);
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${COLORS.red}Unexpected error: ${error}${COLORS.reset}`);
    process.exit(1);
  });
EOL

# Run the temporary test script
node temp-attom-test.js
RESULT=$?

# Clean up the temporary file
rm temp-attom-test.js

# Display summary based on test results
if [ $RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ ATTOM API integration is working correctly!${NC}"
  echo ""
  echo -e "${GREEN}Next steps:${NC}"
  echo "1. Use the ATTOM client in your application"
  echo "2. Implement property search features"
  echo "3. Add property details pages with ATTOM data"
  echo ""
  echo "See ATTOM_BATCH_IMPLEMENTATION_GUIDE.md for detailed usage instructions."
else
  echo -e "${RED}✗ Some ATTOM API tests failed.${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting steps:${NC}"
  echo "1. Check API key is valid and active"
  echo "2. Verify API endpoint URL"
  echo "3. Check for rate limiting or usage restrictions"
  echo ""
  echo "For assistance, contact ATTOM support: api@attomdata.com"
fi

exit $RESULT
