/**
 * @file Smoke test for PI2 Export Bundle v1.
 * @description Tests export bundle generation and validates CSV file outputs.
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_export_bundle_smoke.md');
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

async function runExportBundleSmokeTest() {
  console.log('Running PI2 Export Bundle Smoke Test...');
  let output = '# PI2 Export Bundle Smoke Test Report\n\n';
  let success = true;

  try {
    output += `**Test Date:** ${new Date().toISOString()}\n`;
    output += `**Base URL:** ${BASE_URL}\n\n`;
    
    output += '## API Endpoint Tests\n\n';
    
    // Test export bundle generation
    try {
      console.log('Testing export bundle generation...');
      const exportPayload = {
        filters: {
          grade: ['A', 'B'],
          stage: ['new', 'qualified'],
          date_range: {
            start: '2024-01-01',
            end: '2024-12-31'
          }
        },
        include_timeline: true
      };
      
      const response = await makeRequest(`${BASE_URL}/api/export/bundle`, {
        method: 'POST',
        body: JSON.stringify(exportPayload)
      });
      
      const data = await response.json();
      
      if (data.bundle_id && data.files && Array.isArray(data.files)) {
        output += `- ✅ **Export Bundle**: Generated bundle ${data.bundle_id}\n`;
        output += `  - Files: ${data.files.length} CSV files\n`;
        output += `  - Bundle expires: ${data.expires_at}\n`;
        
        // Check expected files
        const expectedFiles = ['leads.csv', 'properties.csv', 'contacts.csv', 'timeline.csv', 'metrics.csv', 'manifest.csv'];
        const actualFiles = data.files.map(f => f.filename);
        
        for (const expectedFile of expectedFiles) {
          if (actualFiles.includes(expectedFile)) {
            output += `  - ✅ ${expectedFile}: Present\n`;
          } else {
            output += `  - ❌ ${expectedFile}: Missing\n`;
            success = false;
          }
        }
        
        // Test downloading one CSV file
        if (data.files.length > 0) {
          const testFile = data.files[0];
          try {
            console.log(`Testing download of ${testFile.filename}...`);
            const downloadResponse = await makeRequest(testFile.signed_url);
            const csvContent = await downloadResponse.text();
            
            if (csvContent.includes('id') || csvContent.includes('ID')) {
              output += `  - ✅ ${testFile.filename}: Downloaded successfully (${csvContent.length} chars)\n`;
            } else {
              output += `  - ⚠️ ${testFile.filename}: Downloaded but no headers detected\n`;
            }
          } catch (downloadError) {
            output += `  - ❌ ${testFile.filename}: Download failed - ${downloadError.message}\n`;
            success = false;
          }
        }
      } else {
        output += `- ❌ **Export Bundle**: Invalid response structure\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **Export Bundle**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test with minimal filters
    try {
      console.log('Testing export with minimal filters...');
      const minimalPayload = {
        filters: {},
        include_timeline: false
      };
      
      const response = await makeRequest(`${BASE_URL}/api/export/bundle`, {
        method: 'POST',
        body: JSON.stringify(minimalPayload)
      });
      
      const data = await response.json();
      
      if (data.bundle_id && data.files) {
        output += `- ✅ **Minimal Export**: Generated bundle with ${data.files.length} files\n`;
      } else {
        output += `- ❌ **Minimal Export**: Invalid response\n`;
        success = false;
      }
    } catch (error) {
      output += `- ❌ **Minimal Export**: Error - ${error.message}\n`;
      success = false;
    }
    
    // Test HTML page
    output += '\n## HTML Interface Test\n\n';
    try {
      console.log('Testing /ops/export HTML page...');
      const response = await makeRequest(`${BASE_URL}/ops/export`);
      const html = await response.text();
      
      if (html.includes('Export Bundle') && html.includes('filters') && html.includes('include_timeline')) {
        output += '- ✅ **HTML Page**: Loads correctly with export controls\n';
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
    console.error('Error during PI2 Export Bundle Smoke Test:', error);
    output += `\nError during test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, output);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runExportBundleSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runExportBundleSmokeTest;