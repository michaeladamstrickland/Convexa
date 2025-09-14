import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const ATTOM_BASE_URL = process.env.ATTOM_BASE_URL || "https://api.gateway.attomdata.com";
const ATTOM_API_KEY = process.env.ATTOM_API_KEY!;
const BATCH_BASE_URL = process.env.BATCH_BASE_URL || "https://api.batchdata.com";
const BATCH_API_KEY = process.env.BATCHDATA_API_KEY!;
const TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

const client = axios.create({
  timeout: TIMEOUT,
  headers: { "Accept": "application/json" },
  validateStatus: () => true,
});

async function testAttom() {
  console.log("\n===== TESTING ATTOM API =====");
  console.log(`Base URL: ${ATTOM_BASE_URL}`);
  console.log(`API Key: ${ATTOM_API_KEY.substring(0, 3)}...${ATTOM_API_KEY.substring(ATTOM_API_KEY.length - 3)}`);
  
  try {
    // First try a ping/status endpoint if available
    console.log("\n1. Testing ATTOM API connection...");
    const pingUrl = `${ATTOM_BASE_URL}/propertyapi/v1.0.0/property/basicprofile`;
    const pingRes = await client.get(pingUrl, { 
      headers: { apikey: ATTOM_API_KEY },
      params: { attomid: '1234567' }  
    });
    
    console.log(`Status: ${pingRes.status} ${pingRes.statusText}`);
    console.log("Response excerpt:");
    console.log(JSON.stringify(pingRes.data)?.slice(0, 400) + "...");
    
    // Then try a property search
    console.log("\n2. Testing ATTOM Property Search by ZIP...");
    const searchUrl = `${ATTOM_BASE_URL}/propertyapi/v1.0.0/property/address`;
    const searchRes = await client.get(searchUrl, { 
      headers: { apikey: ATTOM_API_KEY },
      params: {
        postalcode: "90210",
        page: 1,
        pagesize: 1
      }
    });
    
    console.log(`Status: ${searchRes.status} ${searchRes.statusText}`);
    console.log("Response excerpt:");
    console.log(JSON.stringify(searchRes.data)?.slice(0, 400) + "...");
    
    if (pingRes.status >= 400 && searchRes.status >= 400) {
      throw new Error(`ATTOM API failed with status: ${pingRes.status}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ ATTOM API Test Failed: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

async function testBatch() {
  console.log("\n===== TESTING BATCHDATA API =====");
  console.log(`Base URL: ${BATCH_BASE_URL}`);
  console.log(`API Key: ${BATCH_API_KEY.substring(0, 3)}...${BATCH_API_KEY.substring(BATCH_API_KEY.length - 3)}`);
  
  try {
    console.log("\nTesting BatchData Skip Trace API...");
    const url = `${BATCH_BASE_URL}/api/v1/property/skip`;
    const payload = { 
      address: "123 Main St", 
      city: "Beverly Hills", 
      state: "CA", 
      zip: "90210" 
    };
    
    const res = await client.post(url, payload, { 
      headers: { 
        "X-API-Key": BATCH_API_KEY, 
        "Content-Type": "application/json" 
      } 
    });
    
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log("Response excerpt:");
    console.log(JSON.stringify(res.data)?.slice(0, 400) + "...");
    
    if (res.status >= 400) {
      throw new Error(`BatchData API failed with status: ${res.status}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ BatchData API Test Failed: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

// Run tests with detailed diagnostic output
(async () => {
  console.log("🔍 RUNNING API SMOKE TESTS");
  console.log("=======================");
  
  let attomSuccess = false;
  let batchSuccess = false;
  
  try {
    console.log("\n🔄 Testing ATTOM API...");
    attomSuccess = await testAttom();
    
    console.log("\n🔄 Testing BatchData API...");
    batchSuccess = await testBatch();
    
    console.log("\n=======================");
    console.log("📊 SMOKE TEST RESULTS:");
    console.log(`ATTOM API: ${attomSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`BatchData API: ${batchSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (attomSuccess && batchSuccess) {
      console.log("\n✅ All API smoke tests passed!");
      process.exit(0);
    } else {
      console.error("\n⚠️ Some API tests failed. Please check the logs above for details.");
      process.exit(1);
    }
  } catch (e: any) {
    console.error("\n❌ Unexpected error in smoke tests:", e?.message);
    console.error("=======================");
    console.log("📊 SMOKE TEST RESULTS:");
    console.log(`ATTOM API: ${attomSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`BatchData API: ${batchSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    process.exit(1);
  }
})();
