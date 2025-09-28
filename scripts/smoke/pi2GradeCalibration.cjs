/**
 * @file Smoke test for PI2 Grade Calibration v1.1.
 * @description Tests grade calibration endpoints and validates responses.
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_grade_calibration_smoke.md');
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

async function runGradeCalibrationSmokeTest() {
  console.log('Running PI2 Grade Calibration Smoke Test...');
  let output = '# PI2 Grade Calibration Smoke Test Report\n\n';
  let success = true;

  try {
    output += `**Test Date:** ${new Date().toISOString()}\n`;
    output += `**Base URL:** ${BASE_URL}\n\n`;
    
    output += '## API Endpoint Tests\n\n';
    
    // Test dry-run calibration
    try {
      console.log('Testing grade calibration dry-run...');
      const dryRunPayload = {
        factor: 1.2,
        weights: {
          "value": 0.35,
          "distress_score": 0.25,
          "market_tier": 0.40
        }
      };
      
      const response = await makeRequest(`${BASE_URL}/api/grade/calibrate?dry_run=true`, {
        method: 'POST',
        body: JSON.stringify(dryRunPayload)
      });
      
      const data = await response.json();
      
      if (data.preview && Array.isArray(data.preview) && data.config) {
        output += `- ✅ **Dry Run**: Found ${data.preview.length} grade previews\n`;
        output += `  - Config: factor=${data.config.factor}, weights provided\n`;
        
        // Check preview structure
        if (data.preview[0] && data.preview[0].lead_id && data.preview[0].current_grade && data.preview[0].new_grade) {
          output += `  - Preview structure: Valid (lead_id, current_grade, new_grade)\n`;
        }
      } else {
        output += `- ❌ **Dry Run**: Invalid response structure\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **Dry Run**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test actual calibration (smaller factor to be safe)
    try {
      console.log('Testing actual grade calibration...');
      const calibrationPayload = {
        factor: 1.1,
        weights: {
          "value": 0.4,
          "distress_score": 0.3,
          "market_tier": 0.3
        }
      };
      
      const response = await makeRequest(`${BASE_URL}/api/grade/calibrate`, {
        method: 'POST',
        body: JSON.stringify(calibrationPayload)
      });
      
      const data = await response.json();
      
      if (typeof data.updated === 'number' && data.config) {
        output += `- ✅ **Apply Calibration**: Updated ${data.updated} leads\n`;
        output += `  - Config applied: factor=${data.config.factor}\n`;
      } else {
        output += `- ❌ **Apply Calibration**: Invalid response structure\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **Apply Calibration**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test HTML page
    output += '\n## HTML Interface Test\n\n';
    try {
      console.log('Testing /ops/grade-calibration HTML page...');
      const response = await makeRequest(`${BASE_URL}/ops/grade-calibration`);
      const html = await response.text();
      
      if (html.includes('Grade Calibration') && html.includes('factor') && html.includes('weights')) {
        output += '- ✅ **HTML Page**: Loads correctly with calibration controls\n';
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
    console.error('Error during PI2 Grade Calibration Smoke Test:', error);
    output += `\nError during test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, output);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runGradeCalibrationSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runGradeCalibrationSmokeTest;