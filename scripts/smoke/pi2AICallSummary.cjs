/**
 * @file Smoke test for PI2 AI Call Summary v0.
 * @description Tests AI call summary generation endpoint and validates responses.
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_ai_call_summary_smoke.md');
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

async function runAICallSummarySmokeTest() {
  console.log('Running PI2 AI Call Summary Smoke Test...');
  let output = '# PI2 AI Call Summary Smoke Test Report\n\n';
  let success = true;

  try {
    output += `**Test Date:** ${new Date().toISOString()}\n`;
    output += `**Base URL:** ${BASE_URL}\n\n`;
    
    output += '## API Endpoint Tests\n\n';
    
    // Test AI call summary generation
    try {
      console.log('Testing AI call summary generation...');
      const summaryPayload = {
        lead_id: 'test-lead-123',
        call_transcript: 'Hello, this is John from Convexa. I am calling about your property at 123 Main Street. The owner mentioned they might be interested in selling. We discussed the current market conditions and potential timeline. The owner seems motivated but wants to think about it over the weekend.',
        call_duration_seconds: 180
      };
      
      const response = await makeRequest(`${BASE_URL}/api/ai/call-summary`, {
        method: 'POST',
        body: JSON.stringify(summaryPayload)
      });
      
      const data = await response.json();
      
      if (data.summary && data.summary.main_points && data.summary.sentiment && data.summary.next_actions) {
        output += `- ✅ **AI Summary Generation**: Generated summary successfully\n`;
        output += `  - Main points: ${data.summary.main_points.length} items\n`;
        output += `  - Sentiment: ${data.summary.sentiment}\n`;
        output += `  - Next actions: ${data.summary.next_actions.length} items\n`;
        output += `  - Processing method: ${data.processing_method}\n`;
        
        if (data.timeline_event_id) {
          output += `  - Timeline event created: ${data.timeline_event_id}\n`;
        }
      } else {
        output += `- ❌ **AI Summary Generation**: Invalid response structure\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **AI Summary Generation**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test with minimal transcript
    try {
      console.log('Testing with minimal transcript...');
      const minimalPayload = {
        lead_id: 'test-lead-456',
        call_transcript: 'Brief call, no answer.',
        call_duration_seconds: 10
      };
      
      const response = await makeRequest(`${BASE_URL}/api/ai/call-summary`, {
        method: 'POST',
        body: JSON.stringify(minimalPayload)
      });
      
      const data = await response.json();
      
      if (data.summary) {
        output += `- ✅ **Minimal Transcript**: Handled gracefully\n`;
        output += `  - Sentiment: ${data.summary.sentiment}\n`;
      } else {
        output += `- ❌ **Minimal Transcript**: Invalid response\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **Minimal Transcript**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test invalid input
    try {
      console.log('Testing invalid input...');
      const invalidPayload = {
        lead_id: '',
        call_transcript: '',
        call_duration_seconds: -1
      };
      
      const response = await makeRequest(`${BASE_URL}/api/ai/call-summary`, {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
        expectError: true
      });
      
      if (response.status === 400) {
        output += `- ✅ **Invalid Input**: Properly rejected with 400 error\n`;
      } else {
        output += `- ⚠️ **Invalid Input**: Unexpected response code ${response.status}\n`;
      }
    } catch (error) {
      output += `- ⚠️ **Invalid Input**: ${error.message}\n`;
    }
    
    // Test HTML page
    output += '\n## HTML Interface Test\n\n';
    try {
      console.log('Testing /ops/ai-call-summary HTML page...');
      const response = await makeRequest(`${BASE_URL}/ops/ai-call-summary`);
      const html = await response.text();
      
      if (html.includes('AI Call Summary') && html.includes('call_transcript') && html.includes('textarea')) {
        output += '- ✅ **HTML Page**: Loads correctly with call summary form\n';
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
    console.error('Error during PI2 AI Call Summary Smoke Test:', error);
    output += `\nError during test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, output);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runAICallSummarySmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runAICallSummarySmokeTest;