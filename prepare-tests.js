#!/usr/bin/env node

/**
 * Script to verify and fix test script imports before running
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}      SCRAPER TEST PREPARATION TOOL      ${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);

// Check for ts-node
try {
  console.log(`${colors.yellow}Checking for ts-node...${colors.reset}`);
  execSync('npx ts-node --version', { stdio: 'pipe' });
  console.log(`${colors.green}✓ ts-node is installed${colors.reset}`);
} catch (error) {
  console.log(`${colors.red}× ts-node is not installed${colors.reset}`);
  console.log(`${colors.yellow}Installing ts-node...${colors.reset}`);
  try {
    execSync('npm install -D ts-node', { stdio: 'inherit' });
    console.log(`${colors.green}✓ ts-node installed successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to install ts-node: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Get all test files
const testFiles = fs.readdirSync('.')
  .filter(file => file.startsWith('test-') && file.endsWith('.ts'));

console.log(`\n${colors.cyan}Found ${testFiles.length} test files:${colors.reset}`);
testFiles.forEach(file => console.log(`- ${file}`));

// Check for common import issues
console.log(`\n${colors.yellow}Checking import paths...${colors.reset}`);

const pathFixes = {
  './src/': './backend/src/',
  './backend/src/scrapers/zillowScraper': './backend/src/scrapers/zillowScraper.js',
  './backend/src/scrapers/auctionScraper': './backend/src/scrapers/auctionScraper.js',
  './backend/src/utils/logger': './backend/src/utils/logger.js',
  './backend/src/services/scheduler': './backend/src/services/scheduler.js'
};

let fixedFiles = 0;

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fileFixed = false;
  
  // Check for import path issues
  for (const [oldPath, newPath] of Object.entries(pathFixes)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(oldPath, 'g'), newPath);
      fileFixed = true;
    }
  }
  
  // Write fixed file if needed
  if (fileFixed) {
    fs.writeFileSync(file, content);
    console.log(`${colors.green}✓ Fixed import paths in ${file}${colors.reset}`);
    fixedFiles++;
  } else {
    console.log(`${colors.green}✓ No import path issues found in ${file}${colors.reset}`);
  }
}

console.log(`\n${colors.cyan}Import path check completed:${colors.reset}`);
console.log(`- ${fixedFiles} files fixed`);
console.log(`- ${testFiles.length - fixedFiles} files were already correct`);

console.log(`\n${colors.bright}${colors.green}All test files ready to run!${colors.reset}`);
console.log(`\n${colors.yellow}You can now run tests with:${colors.reset}`);
console.log(`${colors.cyan}  npm run test:all${colors.reset}       - Run all tests`);
console.log(`${colors.cyan}  npm run test:scraper${colors.reset}   - Run only scraper tests`);
console.log(`${colors.cyan}  npm run test:scheduler${colors.reset} - Run only scheduler tests`);
console.log(`${colors.cyan}  npm run test:api${colors.reset}       - Run only API tests`);
console.log(`${colors.cyan}  npm run test:websocket${colors.reset} - Run only WebSocket tests`);
