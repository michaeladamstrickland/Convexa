/**
 * @file Smoke test for PI2 CRM-Lite Stages.
 * @description Tests CRM stage management endpoints and validates responses.
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_crm_stages_smoke.md');
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

async function runCRMStagesSmokeTest() {
  console.log('Running PI2 CRM Stages Smoke Test...');
  let output = '# PI2 CRM Stages Smoke Test Report\n\n';
  let success = true;
  let testLeadId = null;

  try {
    output += `**Test Date:** ${new Date().toISOString()}\n`;
    output += `**Base URL:** ${BASE_URL}\n\n`;
    
    output += '## API Endpoint Tests\n\n';
    
    // Test CRM board view
    try {
      console.log('Testing CRM board API...');
      const response = await makeRequest(`${BASE_URL}/api/crm/board`);
      const data = await response.json();
      
      if (data.stages && typeof data.stages === 'object') {
        const stageCount = Object.keys(data.stages).length;
        const totalLeads = Object.values(data.stages).reduce((sum, stage) => sum + (stage?.length || 0), 0);
        
        output += `- ✅ **CRM Board**: Found ${stageCount} stages with ${totalLeads} total leads\n`;
        output += `  - Stages: ${Object.keys(data.stages).join(', ')}\n`;
        
        // Get a test lead ID from any stage
        for (const [stageName, leads] of Object.entries(data.stages)) {
          if (leads && leads.length > 0) {
            testLeadId = leads[0].id;
            output += `  - Test lead found: ${testLeadId} in stage "${stageName}"\n`;
            break;
          }
        }
      } else {
        output += `- ❌ **CRM Board**: Invalid response structure\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **CRM Board**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test stage transition (if we have a test lead)
    if (testLeadId) {
      try {
        console.log(`Testing stage transition for lead ${testLeadId}...`);
        const transitionPayload = {
          lead_id: testLeadId,
          stage: 'qualified',
          notes: 'Smoke test transition'
        };
        
        const response = await makeRequest(`${BASE_URL}/api/crm/stage`, {
          method: 'POST',
          body: JSON.stringify(transitionPayload)
        });
        
        const data = await response.json();
        
        if (data.success && data.lead_id === testLeadId) {
          output += `- ✅ **Stage Transition**: Successfully moved lead ${testLeadId} to "${data.new_stage}"\n`;
          output += `  - Previous stage: ${data.previous_stage}\n`;
          output += `  - Timeline event created: ${data.timeline_event_id ? 'Yes' : 'No'}\n`;
        } else {
          output += `- ❌ **Stage Transition**: Invalid response structure\n`;
          success = false;
        }
      } catch (error) {
        output += `- ❌ **Stage Transition**: Error - ${error.message}\n`;
        success = false;
      }
    } else {
      output += `- ⚠️ **Stage Transition**: Skipped (no test lead available)\n`;
    }
    
    // Test HTML page
    output += '\n## HTML Interface Test\n\n';
    try {
      console.log('Testing /ops/crm HTML page...');
      const response = await makeRequest(`${BASE_URL}/ops/crm`);
      const html = await response.text();
      
      if (html.includes('CRM Pipeline') && html.includes('stage-column') && html.includes('lead-card')) {
        output += '- ✅ **HTML Page**: Loads correctly with pipeline interface\n';
      } else {
        output += '- ❌ **HTML Page**: Missing expected content\n';
        success = false;
      }
    } catch (error) {
      output += `- ❌ **HTML Page**: Error - ${error.message}\n`;
      success = false;
    }
    
    output += `\n## Overall Status: ${success ? '✅ PASSED' : '❌ FAILED'}\n`;

  } catch (error) {
    console.error('Error during PI2 CRM Stages Smoke Test:', error);
    output += `\nError during test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, output);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runCRMStagesSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runCRMStagesSmokeTest;