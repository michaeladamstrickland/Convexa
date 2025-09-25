#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerReady(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return true;
            }
        } catch (error) {
            // Server not ready yet
        }
        await wait(500);
    }
    return false;
}

async function runAllPI1SmokeTests() {
    console.log('🚀 Starting PI1 smoke test suite...\n');
    
    // Start the server
    console.log('Starting integrated server...');
    const server = spawn('npm', ['run', 'server:integrated'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
    });
    
    let serverOutput = '';
    server.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        if (output.includes('running on port')) {
            console.log('✅ Server started successfully');
        }
    });
    
    server.stderr.on('data', (data) => {
        serverOutput += data.toString();
    });
    
    // Wait for server to be ready
    console.log('Waiting for server to be ready...');
    await wait(3000); // Initial wait
    
    const serverReady = await isServerReady('http://localhost:5001/health');
    if (!serverReady) {
        console.error('❌ Server failed to start within timeout');
        server.kill();
        process.exit(1);
    }
    
    console.log('✅ Server is ready, running smoke tests...\n');
    
    // Run the smoke tests
    const tests = [
        'pi1Campaigns.cjs',
        'pi1Grades.cjs', 
        'pi1DialOps.cjs'
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`Running ${test}...`);
        try {
            const testProcess = spawn('node', [`scripts/smoke/${test}`], {
                stdio: 'inherit',
                shell: true
            });
            
            await new Promise((resolve, reject) => {
                testProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`✅ ${test} completed successfully\n`);
                        results.push({ test, status: 'PASSED' });
                        resolve();
                    } else {
                        console.log(`❌ ${test} failed with exit code ${code}\n`);
                        results.push({ test, status: 'FAILED', code });
                        resolve(); // Continue with other tests
                    }
                });
                
                testProcess.on('error', (error) => {
                    console.log(`❌ ${test} failed with error: ${error.message}\n`);
                    results.push({ test, status: 'ERROR', error: error.message });
                    resolve();
                });
            });
        } catch (error) {
            console.log(`❌ ${test} failed: ${error.message}\n`);
            results.push({ test, status: 'ERROR', error: error.message });
        }
    }
    
    // Cleanup
    console.log('Shutting down server...');
    server.kill();
    await wait(1000);
    
    // Results summary
    console.log('\n📊 PI1 Smoke Test Results Summary:');
    console.log('=====================================');
    results.forEach(result => {
        const status = result.status === 'PASSED' ? '✅' : '❌';
        console.log(`${status} ${result.test}: ${result.status}`);
        if (result.code) console.log(`   Exit code: ${result.code}`);
        if (result.error) console.log(`   Error: ${result.error}`);
    });
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const total = results.length;
    
    console.log(`\nTotal: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All PI1 smoke tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed. Check the logs above.');
        process.exit(1);
    }
}

if (require.main === module) {
    runAllPI1SmokeTests().catch(error => {
        console.error('❌ Smoke test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllPI1SmokeTests };