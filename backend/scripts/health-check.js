#!/usr/bin/env node

/**
 * LeadFlow AI Backend Health Check Script
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🔧 Starting LeadFlow AI health check...\n');

// Start the backend server
const backend = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: 'pipe',
  shell: true
});

let serverStarted = false;
let healthCheckPassed = false;

// Monitor backend output
backend.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📝 Backend output:', output);
  
  if (output.includes('Leadflow AI Backend server running')) {
    serverStarted = true;
    console.log('✅ LeadFlow AI server started successfully!\n');
    
    // Wait a moment then test health endpoint
    setTimeout(testHealthEndpoint, 3000);
  }
});

backend.stderr.on('data', (data) => {
  const error = data.toString();
  console.error('❌ Backend error:', error);
  
  // Check for common issues
  if (error.includes('EADDRINUSE')) {
    console.log('💡 Port 5000 is already in use. Try stopping other servers first.');
  } else if (error.includes('MODULE_NOT_FOUND')) {
    console.log('💡 Missing dependencies. Run "npm install" first.');
  } else if (error.includes('Database')) {
    console.log('💡 Database connection issue. Check your DATABASE_URL in .env file.');
  } else if (error.includes('JWT_SECRET')) {
    console.log('💡 JWT configuration issue. Check your .env file.');
  }
});

// Test health endpoint using built-in http module
function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  
  const req = http.request('http://localhost:5000/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('✅ Health check response:', parsed);
        
        if (parsed.status === 'OK') {
          healthCheckPassed = true;
          console.log('🎉 LeadFlow AI is healthy and ready!\n');
          
          // Test security headers
          testSecurityHeaders(res);
        } else {
          console.log('⚠️ Health check returned unexpected status');
        }
      } catch (e) {
        console.log('⚠️ Could not parse response:', data);
      }
      
      finishTest();
    });
  });
  
  req.on('error', (err) => {
    console.error('❌ HTTP request failed:', err.message);
    finishTest();
  });
  
  req.setTimeout(5000, () => {
    console.log('⏰ Request timed out');
    req.destroy();
    finishTest();
  });
  
  req.end();
}

// Test security headers
function testSecurityHeaders(res) {
  console.log('🔒 Testing security headers...');
  
  const securityHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'strict-transport-security',
    'content-security-policy'
  ];
  
  securityHeaders.forEach(header => {
    if (res.headers[header]) {
      console.log(`✅ ${header}: ${res.headers[header]}`);
    } else {
      console.log(`⚠️ Missing security header: ${header}`);
    }
  });
}

function finishTest() {
  console.log('\n🏁 Health check complete!');
  console.log('📊 Summary:');
  console.log(`   Server Started: ${serverStarted ? '✅' : '❌'}`);
  console.log(`   Health Check: ${healthCheckPassed ? '✅' : '❌'}`);
  console.log('   Security Headers: Check output above\n');
  
  // Gracefully shut down
  setTimeout(() => {
    console.log('🛑 Shutting down test server...');
    backend.kill('SIGTERM');
    process.exit(0);
  }, 2000);
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Health check interrupted');
  backend.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill('SIGTERM');
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Health check timed out after 30 seconds');
  backend.kill('SIGTERM');
  process.exit(1);
}, 30000);
