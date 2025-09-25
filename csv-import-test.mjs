#!/usr/bin/env node

// CSV Import test using the working multipart approach
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function runCsvImportTest() {
  console.log('🚀 Starting server for CSV import test...');
  
  // Start server in completely detached mode
  const server = spawn('node', ['backend/integrated-server.js'], {
    env: {
      ...process.env,
      BASIC_AUTH_USER: 'staging',
      BASIC_AUTH_PASS: 'RockyDog456',
      PORT: '5001'
    },
    detached: true,
    stdio: 'pipe'
  });
  
  server.stdout.on('data', (data) => {
    console.log('Server:', data.toString().trim());
  });
  
  server.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString().trim());
  });
  
  // Wait for server to start
  console.log('⏱️  Waiting 5 seconds for server startup...');
  await setTimeout(5000);
  
  try {
    console.log('📊 Testing CSV import functionality...');
    await testCsvImport();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    console.log('🛑 Killing server...');
    server.kill('SIGTERM');
  }
}

async function testCsvImport() {
  // Create test CSV content
  const csvContent = 'Name,Email,Phone\nJohn Doe,john@example.com,555-1234\nJane Smith,jane@example.com,555-5678';
  const csvBuffer = Buffer.from(csvContent);
  
  // Helper to post multipart (based on working smoke test)
  async function postMultipart(url, buf) {
    const boundary = '----convexaimport' + Math.random().toString(16).slice(2);
    const bodyParts = [];
    bodyParts.push(`--${boundary}\r\n`);
    bodyParts.push('Content-Disposition: form-data; name="file"; filename="test.csv"\r\n');
    bodyParts.push('Content-Type: text/csv\r\n\r\n');
    bodyParts.push(buf);
    bodyParts.push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(bodyParts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': 'Basic ' + Buffer.from('staging:RockyDog456').toString('base64')
      },
      body
    });
    const text = await res.text();
    let json;
    try { 
      json = JSON.parse(text); 
    } catch { 
      return { status: res.status, text }; 
    }
    return { status: res.status, json, text };
  }
  
  try {
    // Test preview mode first
    console.log('📋 Testing CSV preview mode...');
    const previewResult = await postMultipart('http://localhost:5001/admin/import/csv?mode=preview', csvBuffer);
    console.log('📋 Preview Status:', previewResult.status);
    console.log('📋 Preview Result:', JSON.stringify(previewResult.json || previewResult.text, null, 2));
    
    if (previewResult.status === 200 && previewResult.json && previewResult.json.ok) {
      console.log('✅ Preview successful!');
      
      // Test commit mode
      console.log('💾 Testing CSV commit mode...');
      const commitResult = await postMultipart('http://localhost:5001/admin/import/csv?mode=commit', csvBuffer);
      console.log('💾 Commit Status:', commitResult.status);
      console.log('💾 Commit Result:', JSON.stringify(commitResult.json || commitResult.text, null, 2));
      
      if (commitResult.status === 200 && commitResult.json && commitResult.json.artifact) {
        console.log('✅ Commit successful!');
        console.log('🎯 Audit URL:', commitResult.json.artifact.auditUrl);
        
        // Test audit download
        console.log('📄 Testing audit download...');
        const auditResponse = await fetch(`http://localhost:5001${commitResult.json.artifact.auditUrl}`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from('staging:RockyDog456').toString('base64')
          }
        });
        const auditText = await auditResponse.text();
        console.log('📄 Audit Status:', auditResponse.status);
        console.log('📄 Audit Preview:', auditText.substring(0, 200) + '...');
        
        if (auditResponse.ok) {
          console.log('✅ Full CSV import workflow completed successfully!');
          console.log('🎉 All tests passed: Preview → Commit → Audit Download');
        }
      }
    } else {
      console.log('❌ Preview failed, stopping test');
    }
    
  } catch (error) {
    console.error('❌ CSV Import failed:', error.message);
  }
}

runCsvImportTest().catch(console.error);