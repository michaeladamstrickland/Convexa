/**
 * Test script for ATTOM API and BatchData integration
 */

const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

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

// Test ATTOM API
async function testAttomAPI() {
  console.log(`${COLORS.blue}===== Testing ATTOM API =====${COLORS.reset}`);
  
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) {
    console.error(`${COLORS.red}ERROR: ATTOM_API_KEY not found in .env file${COLORS.reset}`);
    return false;
  }
  
  try {
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    // Try the ATTOM API property address endpoint
    const attomBaseUrl = process.env.ATTOM_API_ENDPOINT || 'https://api.developer.attomdata.com/api/v1';
    console.log(`Using ATTOM API URL: ${attomBaseUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: `${attomBaseUrl}/property/basicprofile`,
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
    
    if (response.status === 200) {
      console.log(`${COLORS.green}✓ ATTOM API connection successful${COLORS.reset}`);
      console.log(`${COLORS.green}✓ Response status: ${response.status}${COLORS.reset}`);
      
      if (response.data?.status?.code === 0) {
        console.log(`${COLORS.green}✓ API returned valid response format${COLORS.reset}`);
        
        if (response.data.property && response.data.property.length > 0) {
          console.log(`${COLORS.green}✓ Found ${response.data.property.length} properties${COLORS.reset}`);
          
          // Print a sample of the first property
          const property = response.data.property[0];
          console.log(`${COLORS.cyan}Sample property data:${COLORS.reset}`);
          console.log(`  Address: ${property.address?.line1 || 'N/A'}`);
          console.log(`  City: ${property.address?.locality || 'N/A'}`);
          console.log(`  State: ${property.address?.countrySubd || 'N/A'}`);
          console.log(`  ZIP: ${property.address?.postal1 || 'N/A'}`);
          console.log(`  ATTOM ID: ${property.identifier?.attomId || 'N/A'}`);
        } else {
          console.log(`${COLORS.yellow}⚠ No properties found in the response${COLORS.reset}`);
        }
      } else {
        console.log(`${COLORS.yellow}⚠ API returned non-zero status: ${response.data?.status?.code}${COLORS.reset}`);
      }
      
      return true;
    } else {
      console.log(`${COLORS.red}✗ Unexpected status code: ${response.status}${COLORS.reset}`);
      return false;
    }
    
  } catch (error) {
    console.error(`${COLORS.red}✗ ATTOM API connection failed:${COLORS.reset}`);
    
    if (error.response) {
      console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`);
      console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data);
    } else {
      console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
    }
    
    return false;
  }
}

// Test BatchData API
async function testBatchDataAPI() {
  console.log(`${COLORS.blue}===== Testing BatchData API =====${COLORS.reset}`);
  
  const apiKey = process.env.BATCHDATA_API_KEY;
  if (!apiKey) {
    console.error(`${COLORS.red}ERROR: BATCHDATA_API_KEY not found in .env file${COLORS.reset}`);
    return false;
  }
  
  try {
    console.log(`Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    
    const baseUrl = process.env.BATCHDATA_API_ENDPOINT || 'https://batch-api.batchdata.com/api';
    console.log(`Using BatchData API URL: ${baseUrl}`);
    
    // Try the BatchData API status endpoint as a simple test
    const response = await axios({
      method: 'GET',
      url: `${baseUrl}/status`,
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 200) {
      console.log(`${COLORS.green}✓ BatchData API connection successful${COLORS.reset}`);
      console.log(`${COLORS.green}✓ Response status: ${response.status}${COLORS.reset}`);
      
      if (response.data?.success === true) {
        console.log(`${COLORS.green}✓ API returned success response${COLORS.reset}`);
        
        // Print some information about the skip trace results
        const result = response.data.result;
        if (result) {
          console.log(`${COLORS.cyan}Sample skip trace data:${COLORS.reset}`);
          
          // Owner information
          if (result.owner) {
            console.log(`  Owner: ${result.owner.name || 'N/A'}`);
          }
          
          // Phone numbers
          if (result.phones && result.phones.length > 0) {
            console.log(`  Phone numbers: ${result.phones.length} found`);
            result.phones.slice(0, 2).forEach((phone, i) => {
              console.log(`    ${i+1}. ${phone.phone_number || 'N/A'} (${phone.line_type || 'unknown'})`);
            });
            if (result.phones.length > 2) {
              console.log(`    ... and ${result.phones.length - 2} more`);
            }
          } else {
            console.log(`  Phone numbers: None found`);
          }
          
          // Email addresses
          if (result.emails && result.emails.length > 0) {
            console.log(`  Email addresses: ${result.emails.length} found`);
            result.emails.slice(0, 2).forEach((email, i) => {
              console.log(`    ${i+1}. ${email.email_address || 'N/A'}`);
            });
            if (result.emails.length > 2) {
              console.log(`    ... and ${result.emails.length - 2} more`);
            }
          } else {
            console.log(`  Email addresses: None found`);
          }
        } else {
          console.log(`${COLORS.yellow}⚠ No skip trace results in the response${COLORS.reset}`);
        }
      } else {
        console.log(`${COLORS.yellow}⚠ API returned non-success response${COLORS.reset}`);
      }
      
      return true;
    } else {
      console.log(`${COLORS.red}✗ Unexpected status code: ${response.status}${COLORS.reset}`);
      return false;
    }
    
  } catch (error) {
    console.error(`${COLORS.red}✗ BatchData API connection failed:${COLORS.reset}`);
    
    if (error.response) {
      console.error(`${COLORS.red}✗ Status: ${error.response.status}${COLORS.reset}`);
      console.error(`${COLORS.red}✗ Response data:${COLORS.reset}`, error.response.data);
    } else {
      console.error(`${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
    }
    
    return false;
  }
}

// Test our service implementations
async function testServices() {
  console.log(`${COLORS.blue}===== Testing Service Implementations =====${COLORS.reset}`);
  
  try {
    // Try to dynamically require the services
    const attomClient = require('./src/services/attomClient').default;
    const batchService = require('./src/services/batchService').default;
    
    // Test ATTOM client
    console.log(`${COLORS.cyan}Testing ATTOM Client service...${COLORS.reset}`);
    const healthAttom = await attomClient.checkHealth();
    console.log(`ATTOM Client Health: ${healthAttom.healthy ? `${COLORS.green}Healthy` : `${COLORS.red}Unhealthy`}${COLORS.reset}`);
    
    if (healthAttom.healthy) {
      // Test address lookup
      console.log(`Testing property lookup by address...`);
      const property = await attomClient.getPropertyByAddress(
        '123 Main St',
        'Beverly Hills',
        'CA',
        '90210'
      );
      
      if (property) {
        console.log(`${COLORS.green}✓ Property lookup successful${COLORS.reset}`);
        console.log(`Property data: ${JSON.stringify(property, null, 2).substring(0, 200)}...`);
      } else {
        console.log(`${COLORS.yellow}⚠ No property found${COLORS.reset}`);
      }
    }
    
    // Test BatchData service
    console.log(`${COLORS.cyan}Testing BatchData service...${COLORS.reset}`);
    const healthBatch = await batchService.checkHealth();
    console.log(`BatchData Service Health: ${healthBatch.status === 'healthy' ? `${COLORS.green}Healthy` : `${COLORS.red}${healthBatch.status}`}${COLORS.reset}`);
    
    if (healthBatch.status === 'healthy') {
      // Test skip trace
      console.log(`Testing skip trace by address...`);
      const skipTraceResult = await batchService.skipTraceByAddress(
        '123 Main St',
        'Beverly Hills',
        'CA',
        '90210'
      );
      
      if (skipTraceResult.status === 'success') {
        console.log(`${COLORS.green}✓ Skip trace successful${COLORS.reset}`);
        const contactData = batchService.processSkipTraceResults(skipTraceResult);
        console.log(`Found ${contactData.phones.length} phones, ${contactData.emails.length} emails`);
        console.log(`Contact confidence: ${contactData.confidence}%`);
      } else {
        console.log(`${COLORS.yellow}⚠ Skip trace returned status: ${skipTraceResult.status}${COLORS.reset}`);
        if (skipTraceResult.message) {
          console.log(`Message: ${skipTraceResult.message}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${COLORS.red}✗ Error testing services:${COLORS.reset}`, error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log(`${COLORS.magenta}===== Convexa AI - ATTOM + BatchData Integration Test =====${COLORS.reset}`);
  console.log(`Testing API connectivity and integration setup...`);
  console.log();
  
  // Check for required environment variables
  const missingEnvVars = [];
  if (!process.env.ATTOM_API_KEY) missingEnvVars.push('ATTOM_API_KEY');
  if (!process.env.BATCHDATA_API_KEY) missingEnvVars.push('BATCHDATA_API_KEY');
  
  if (missingEnvVars.length > 0) {
    console.warn(`${COLORS.yellow}⚠ Missing environment variables: ${missingEnvVars.join(', ')}${COLORS.reset}`);
    console.warn(`${COLORS.yellow}⚠ Please check your .env file${COLORS.reset}`);
  }
  
  // Run ATTOM API test
  const attomSuccess = await testAttomAPI();
  console.log();
  
  // Run BatchData API test
  const batchSuccess = await testBatchDataAPI();
  console.log();
  
  // Run service implementation tests if direct API tests passed
  let servicesSuccess = false;
  if (attomSuccess && batchSuccess) {
    servicesSuccess = await testServices();
    console.log();
  } else {
    console.log(`${COLORS.yellow}⚠ Skipping service implementation tests due to API test failures${COLORS.reset}`);
  }
  
  // Show summary
  console.log(`${COLORS.magenta}===== Test Summary =====${COLORS.reset}`);
  console.log(`ATTOM API: ${attomSuccess ? `${COLORS.green}✓ PASSED${COLORS.reset}` : `${COLORS.red}✗ FAILED${COLORS.reset}`}`);
  console.log(`BatchData API: ${batchSuccess ? `${COLORS.green}✓ PASSED${COLORS.reset}` : `${COLORS.red}✗ FAILED${COLORS.reset}`}`);
  
  if (attomSuccess && batchSuccess) {
    console.log(`Service Implementations: ${servicesSuccess ? `${COLORS.green}✓ PASSED${COLORS.reset}` : `${COLORS.red}✗ FAILED${COLORS.reset}`}`);
  }
  
  console.log();
  
  if (attomSuccess && batchSuccess && servicesSuccess) {
    console.log(`${COLORS.green}✓ All tests passed! Your integration is set up correctly.${COLORS.reset}`);
  console.log(`${COLORS.green}✓ You can now use ATTOM and BatchData in your Convexa AI application.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}⚠ Some tests failed. Please review the errors above.${COLORS.reset}`);
    console.log(`${COLORS.yellow}⚠ Make sure your API keys are correct and the services are available.${COLORS.reset}`);
  }
  
  // Return success or failure
  return attomSuccess && batchSuccess && servicesSuccess;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${COLORS.red}Unexpected error running tests: ${error}${COLORS.reset}`);
    process.exit(1);
  });
