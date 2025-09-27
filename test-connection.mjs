#!/usr/bin/env node

// Simple connection test for localhost:5001
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testServerConnection() {
  console.log('🚀 Starting server in detached mode...');
  
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
    // Test health endpoint
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:5001/health');
    const healthText = await healthResponse.text();
    console.log('✅ Health check:', healthResponse.status, healthText);
    
    // Test admin endpoint with auth
    console.log('🔐 Testing admin artifacts endpoint with auth...');
    const adminResponse = await fetch('http://localhost:5001/admin/artifacts', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('staging:RockyDog456').toString('base64')
      }
    });
    const adminText = await adminResponse.text();
    console.log('✅ Admin endpoint:', adminResponse.status, adminText.substring(0, 200));
    
    // Run actual CSV import test
    console.log('📊 Testing CSV import...');
    await testCsvImport();
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  } finally {
    console.log('🛑 Killing server...');
    server.kill('SIGTERM');
  }
}

async function testCsvImport() {
  const FormData = await import('form-data');
  const fs = await import('fs');
  
  // Create test CSV content and save to file
  const csvContent = 'Name,Email,Phone\nJohn Doe,john@example.com,555-1234\nJane Smith,jane@example.com,555-5678';
  const tempFile = 'temp-test.csv';
  fs.writeFileSync(tempFile, csvContent);
  
  try {
    // Create form data with file stream
    const form = new FormData.default();
    form.append('file', fs.createReadStream(tempFile), {
      filename: 'test.csv',
      contentType: 'text/csv'
    });
    
    // Test preview mode first
    console.log('📋 Testing CSV preview mode...');
    const previewResponse = await fetch('http://localhost:5001/admin/import/csv?mode=preview', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('staging:RockyDog456').toString('base64'),
        ...form.getHeaders()
      },
      body: form
    });
    
    const previewResult = await previewResponse.text();
    console.log('📋 CSV Preview Response:', previewResponse.status, previewResult.substring(0, 300));
    
    if (previewResponse.ok) {
      // Test commit mode
      console.log('� Testing CSV commit mode...');
      const form2 = new FormData.default();
      form2.append('file', fs.createReadStream(tempFile), {
        filename: 'test.csv',
        contentType: 'text/csv'
      });
      
      const commitResponse = await fetch('http://localhost:5001/admin/import/csv?mode=commit', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('staging:RockyDog456').toString('base64'),
          ...form2.getHeaders()
        },
        body: form2
      });
      
      const commitResult = await commitResponse.text();
      console.log('💾 CSV Commit Response:', commitResponse.status, commitResult.substring(0, 300));
    }
    
  } catch (error) {
    console.error('❌ CSV Import failed:', error.message);
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {}
  }
}

testServerConnection().catch(console.error);