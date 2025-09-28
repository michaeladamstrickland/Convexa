/**
 * @file Smoke test for PI2 Campaign Search v1.
 * @description Tests campaign search endpoints and validates responses.
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_campaigns_smoke.md');
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5001';
const BASIC_AUTH = Buffer.from(`${process.env.BASIC_AUTH_USER || 'staging'}:${process.env.BASIC_AUTH_PASS || 'RockyDog456'}`).toString('base64');

async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${BASIC_AUTH}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok && options.expectError !== true) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return response;
}

async function runCampaignSmokeTest() {
  console.log('Running PI2 Campaign Search Smoke Test...');
  let output = '# PI2 Campaign Search Smoke Test Report\\n\\n';
  let success = true;

  try {
    output += `**Test Date:** ${new Date().toISOString()}\\n`;
    output += `**Base URL:** ${BASE_URL}\\n\\n`;
    
    // Test each campaign type
    const campaignTypes = ['distressed', 'divorce', 'preforeclosure', 'inheritance', 'vacant', 'absentee'];
    
    output += '## API Endpoint Tests\\n\\n';
    
    for (const type of campaignTypes) {
      try {
        console.log(`Testing campaign type: ${type}`);
        const response = await makeRequest(`${BASE_URL}/api/campaigns/search?type=${type}&limit=3`);
        const data = await response.json();
        
        if (data.leads && Array.isArray(data.leads) && data.pagination) {
          output += `- ✅ **${type}**: Found ${data.leads.length} leads, pagination present\\n`;
          
          // Check criteria_used field
          if (data.criteria_used && Array.isArray(data.criteria_used)) {
            output += `  - Criteria: ${data.criteria_used.join(', ')}\\n`;
          }
        } else {
          output += `- ❌ **${type}**: Invalid response structure\\n`;
          success = false;
        }
      } catch (error) {
        output += `- ❌ **${type}**: Error - ${error.message}\\n`;
        success = false;
      }
    }
    
    // Test invalid campaign type
    try {
      console.log('Testing invalid campaign type...');
      const response = await makeRequest(`${BASE_URL}/api/campaigns/search?type=invalid&limit=3`);
      const data = await response.json();
      
      if (data.leads) {
        output += '- ✅ **Invalid type**: Handled gracefully\\n';
      }
    } catch (error) {
      output += `- ⚠️ **Invalid type**: ${error.message}\\n`;
    }
    
    // Test HTML page
    output += '\\n## HTML Interface Test\\n\\n';
    try {
      console.log('Testing /ops/campaigns HTML page...');
      const response = await makeRequest(`${BASE_URL}/ops/campaigns`);
      const html = await response.text();
      
      if (html.includes('Campaign Property Search') && html.includes('<form') && html.includes('type=')) {
        output += '- ✅ **HTML Page**: Loads correctly with search form\\n';
      } else {
        output += '- ❌ **HTML Page**: Missing expected content\\n';
        success = false;
      }
    } catch (error) {
      output += `- ❌ **HTML Page**: Error - ${error.message}\\n`;
      success = false;
    }
    
    output += `\\n## Overall Status: ${success ? '✅ PASSED' : '❌ FAILED'}\\n`;

  } catch (error) {
    console.error('Error during PI2 Campaign Smoke Test:', error);
    output += `\\nError during test: ${error.message}\\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, output);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runCampaignSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runCampaignSmokeTest;
