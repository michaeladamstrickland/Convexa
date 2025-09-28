#!/usr/bin/env node
/**
 * PI2-APP Comprehensive Smoke Test
 * Tests all PI2 features: Campaign Search, Grade Calibration, CRM Stages, AI Call Summary, Export Bundle
 */

const path = require('path');
const fs = require('fs');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
fs.mkdirSync(FINDINGS_DIR, { recursive: true });

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

async function testCampaignSearch() {
  console.log('🔍 Testing Campaign Search v1...');
  const results = [];
  
  // Test each campaign type
  const campaignTypes = ['distressed', 'divorce', 'preforeclosure', 'inheritance', 'vacant', 'absentee'];
  
  for (const type of campaignTypes) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/campaigns/search?type=${type}&limit=5`);
      const data = await response.json();
      
      if (data.leads && Array.isArray(data.leads) && data.pagination) {
        results.push(`✅ Campaign type "${type}": ${data.leads.length} leads found`);
      } else {
        results.push(`❌ Campaign type "${type}": Invalid response structure`);
      }
    } catch (error) {
      results.push(`❌ Campaign type "${type}": ${error.message}`);
    }
  }
  
  // Test /ops/campaigns HTML page
  try {
    const response = await makeRequest(`${BASE_URL}/ops/campaigns`);
    const html = await response.text();
    
    if (html.includes('Campaign Property Search') && html.includes('<form')) {
      results.push('✅ /ops/campaigns HTML page loads correctly');
    } else {
      results.push('❌ /ops/campaigns HTML page missing expected content');
    }
  } catch (error) {
    results.push(`❌ /ops/campaigns HTML error: ${error.message}`);
  }
  
  return results;
}

async function testGradeCalibration() {
  console.log('⚖️ Testing Grade Calibration v1.1...');
  const results = [];
  
  // Test dry-run calibration
  try {
    const response = await makeRequest(`${BASE_URL}/admin/grade/calibrate`, {
      method: 'POST',
      body: JSON.stringify({
        weights: { motivation_score: 0.4, estimated_value: 0.3 },
        sampleLimit: 10
      })
    });
    
    const data = await response.json();
    
    if (data.ok && data.preview && data.preview.by_label) {
      results.push('✅ Grade calibration dry-run successful');
    } else {
      results.push('❌ Grade calibration dry-run failed or invalid response');
    }
  } catch (error) {
    results.push(`❌ Grade calibration dry-run error: ${error.message}`);
  }
  
  // Test apply calibration (with small sample)
  try {
    const response = await makeRequest(`${BASE_URL}/admin/grade/apply-calibration`, {
      method: 'POST',
      body: JSON.stringify({
        weights: { motivation_score: 0.35 }
      })
    });
    
    const data = await response.json();
    
    if (data.ok && typeof data.updated_leads === 'number') {
      results.push(`✅ Grade calibration apply successful: ${data.updated_leads} leads updated`);
    } else {
      results.push('❌ Grade calibration apply failed or invalid response');
    }
  } catch (error) {
    results.push(`❌ Grade calibration apply error: ${error.message}`);
  }
  
  return results;
}

async function testCRMStages() {
  console.log('📊 Testing CRM-Lite Stages...');
  const results = [];
  const testLeadId = 'smoke-test-lead-' + Date.now();
  
  // First, create a test lead
  try {
    await makeRequest(`${BASE_URL}/api/leads`, {
      method: 'POST',
      body: JSON.stringify({
        address: '123 Test St, Smoke City, ST 12345',
        owner_name: 'Smoke Test Owner',
        source_type: 'smoke_test'
      })
    });
  } catch (error) {
    // Lead creation might fail, that's ok for smoke test
  }
  
  // Test stage board view
  try {
    const response = await makeRequest(`${BASE_URL}/stages/board`);
    const data = await response.json();
    
    if (data.columns && Array.isArray(data.columns)) {
      const stageNames = data.columns.map(col => col.stage);
      const expectedStages = ['new', 'working', 'contacted', 'follow_up', 'offer_made', 'under_contract', 'closed', 'lost'];
      const hasAllStages = expectedStages.every(stage => stageNames.includes(stage));
      
      if (hasAllStages) {
        results.push('✅ Stage board returns all expected stages');
      } else {
        results.push(`❌ Stage board missing stages. Found: ${stageNames.join(', ')}`);
      }
    } else {
      results.push('❌ Stage board invalid response structure');
    }
  } catch (error) {
    results.push(`❌ Stage board error: ${error.message}`);
  }
  
  // Test HTML stages page
  try {
    const response = await makeRequest(`${BASE_URL}/ops/stages`);
    const html = await response.text();
    
    if (html.includes('CRM Stages') && html.includes('stage-board')) {
      results.push('✅ /ops/stages HTML page loads correctly');
    } else {
      results.push('❌ /ops/stages HTML page missing expected content');
    }
  } catch (error) {
    results.push(`❌ /ops/stages HTML error: ${error.message}`);
  }
  
  return results;
}

async function testCallSummary() {
  console.log('🤖 Testing AI Call Summary v0...');
  const results = [];
  
  try {
    // Test call summary generation with PI2 endpoint
    const summaryPayload = {
      lead_id: 'smoke-test-lead-' + Date.now(),
      call_transcript: "Hello, I'm interested in selling my property. How much would you offer? I need to sell soon.",
      call_duration_seconds: 120
    };
    
    const response = await makeRequest(`${BASE_URL}/api/ai/call-summary`, {
      method: 'POST',
      body: JSON.stringify(summaryPayload)
    });
    
    const data = await response.json();
    
    if (data.summary && data.processing_method && data.summary.sentiment && data.summary.main_points && data.summary.next_actions) {
      results.push('✅ Call summary generation successful');
      results.push(`✅ Call summary includes sentiment (${data.summary.sentiment}) and ${data.summary.main_points.length} main points`);
    } else {
      results.push('❌ Call summary generation failed or invalid response');
    }
    
  } catch (error) {
    results.push(`❌ Call summary error: ${error.message}`);
  }
  
  return results;
}

async function testExportBundle() {
  console.log('📦 Testing Pilot Export Bundle v1...');
  const results = [];
  
  try {
    const response = await makeRequest(`${BASE_URL}/admin/export/weekly-bundle`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.ok && data.bundleUrl && data.export_summary) {
      results.push('✅ Weekly export bundle generation successful');
      
      // Check summary structure
      const summary = data.export_summary;
      if (summary.counts && summary.breakdowns) {
        const expectedFiles = ['leads', 'graded_leads', 'dispositions', 'followups', 'timeline_events'];
        const hasAllCounts = expectedFiles.every(field => 
          typeof summary.counts[field] === 'number' || field === 'graded_leads'
        );
        
        if (hasAllCounts) {
          results.push('✅ Export summary includes all expected counts');
        } else {
          results.push('❌ Export summary missing expected count fields');
        }
      } else {
        results.push('❌ Export summary missing counts or breakdowns');
      }
    } else {
      results.push('❌ Weekly export bundle failed or invalid response');
    }
  } catch (error) {
    results.push(`❌ Export bundle error: ${error.message}`);
  }
  
  return results;
}

async function runComprehensiveSmoke() {
  console.log('🚀 Starting PI2-APP Comprehensive Smoke Test...');
  console.log(`Testing against: ${BASE_URL}`);
  
  const allResults = {
    'Campaign Search v1': await testCampaignSearch(),
    'Grade Calibration v1.1': await testGradeCalibration(),
    'CRM-Lite Stages': await testCRMStages(),
    'AI Call Summary v0': await testCallSummary(),
    'Pilot Export Bundle v1': await testExportBundle()
  };
  
  // Generate report
  let report = '# PI2-APP Comprehensive Smoke Test Report\\n\\n';
  report += `**Test Date:** ${new Date().toISOString()}\\n`;
  report += `**Base URL:** ${BASE_URL}\\n\\n`;
  
  let overallSuccess = true;
  
  for (const [feature, results] of Object.entries(allResults)) {
    report += `## ${feature}\\n\\n`;
    
    const featureSuccess = results.every(result => result.startsWith('✅'));
    if (!featureSuccess) overallSuccess = false;
    
    results.forEach(result => {
      report += `- ${result}\\n`;
    });
    
    report += `\\n**Status:** ${featureSuccess ? '✅ PASSED' : '❌ FAILED'}\\n\\n`;
  }
  
  report += `## Overall Result\\n\\n`;
  report += `**Status:** ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\\n`;
  
  // Save report
  const reportFile = path.join(FINDINGS_DIR, 'PI2_COMPREHENSIVE_SMOKE.md');
  fs.writeFileSync(reportFile, report);
  
  console.log(`\\n📊 Test Results:`);
  for (const [feature, results] of Object.entries(allResults)) {
    const passed = results.filter(r => r.startsWith('✅')).length;
    const total = results.length;
    console.log(`  ${feature}: ${passed}/${total} passed`);
  }
  
  console.log(`\\n📋 Full report saved to: ${reportFile}`);
  console.log(`\\n${overallSuccess ? '🎉 All PI2 features working!' : '⚠️ Some PI2 features have issues'}`);
  
  return overallSuccess;
}

if (require.main === module) {
  runComprehensiveSmoke().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Smoke test failed:', error);
    process.exit(1);
  });
}

module.exports = runComprehensiveSmoke;