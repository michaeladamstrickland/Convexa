#!/usr/bin/env node

/**
 * Master test script that runs all the test scripts in sequence
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define color codes for better output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Run a test script with proper output formatting
 */
function runTest(scriptName, args = []) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, scriptName);
    console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}RUNNING: ${scriptName}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);
    
    // Use ts-node to run the TypeScript files
    const child = spawn('npx', ['ts-node', scriptPath, ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n${colors.bright}${colors.green}✓ ${scriptName} completed successfully${colors.reset}`);
      } else {
        console.log(`\n${colors.bright}${colors.red}✗ ${scriptName} failed with code ${code}${colors.reset}`);
      }
      resolve(code);
    });
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log(`\n${colors.bright}${colors.magenta}===== SCRAPER SYSTEM TEST SUITE =====\n${colors.reset}`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  const cleanup = args.includes('--cleanup');
  
  // Add cleanup flag to API tests if requested
  const apiArgs = cleanup ? ['--cleanup'] : [];
  
  let exitCode = 0;

  try {
    if (runAll || args.includes('--scrapers')) {
      exitCode += await runTest('test-scrapers.ts');
    }
    
    if (runAll || args.includes('--scheduler')) {
      exitCode += await runTest('test-scheduler.ts');
    }
    
    if (runAll || args.includes('--api')) {
      exitCode += await runTest('test-api-endpoints.ts', apiArgs);
    }
    
    if (runAll || args.includes('--websocket')) {
      exitCode += await runTest('test-websocket.ts');
    }
    
    if (exitCode === 0) {
      console.log(`\n${colors.bright}${colors.green}===== ALL TESTS PASSED SUCCESSFULLY =====\n${colors.reset}`);
    } else {
      console.log(`\n${colors.bright}${colors.red}===== SOME TESTS FAILED (Errors: ${exitCode}) =====\n${colors.reset}`);
    }
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}Error running tests: ${error}${colors.reset}\n`);
    process.exit(1);
  }
}

// Run the test suite
runAllTests().catch(console.error);
