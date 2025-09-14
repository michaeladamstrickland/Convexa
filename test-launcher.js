#!/usr/bin/env node

/**
 * LeadFlow AI Test Launcher
 * 
 * A convenient script to run test preparation and then execute the tests
 */
import { spawn } from 'child_process';
import readline from 'readline';

// Color codes for better output formatting
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

// ASCII art header
const header = `
${colors.cyan}╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ${colors.bright}${colors.yellow}█    ███  █  ██  ███  █   ███  █   █      █ █ ${colors.cyan}             ║
║  ${colors.bright}${colors.yellow}█    █ █  █  █ █ █ █  █   █ █  █   █      █ █ ${colors.cyan}             ║
║  ${colors.bright}${colors.yellow}█    █ █  █  █ █ █ █  █   █ █  █ █ █  █   █ █ ${colors.cyan}             ║
║  ${colors.bright}${colors.yellow}███  ███  █  ██  ███  ███ ███   █ █   █   █ █ ${colors.cyan}             ║
║                                                                ║
║                  ${colors.bright}${colors.green}S C R A P E R   T E S T S${colors.cyan}                    ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}
`;

console.log(header);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Display menu
function showMenu() {
  console.log(`${colors.cyan}Choose a test option:${colors.reset}`);
  console.log(`${colors.yellow}[1]${colors.reset} Run all tests`);
  console.log(`${colors.yellow}[2]${colors.reset} Run scraper tests only`);
  console.log(`${colors.yellow}[3]${colors.reset} Run scheduler tests only`);
  console.log(`${colors.yellow}[4]${colors.reset} Run API endpoint tests only`);
  console.log(`${colors.yellow}[5]${colors.reset} Run WebSocket tests only`);
  console.log(`${colors.yellow}[6]${colors.reset} Run all tests with cleanup`);
  console.log(`${colors.yellow}[p]${colors.reset} Prepare tests only`);
  console.log(`${colors.yellow}[q]${colors.reset} Quit`);
}

// Run a command with pretty output
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n${colors.bright}${colors.blue}Running: ${command} ${args.join(' ')}${colors.reset}\n`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n${colors.bright}${colors.green}Command completed successfully${colors.reset}\n`);
        resolve();
      } else {
        console.log(`\n${colors.bright}${colors.red}Command failed with code ${code}${colors.reset}\n`);
        reject(code);
      }
    });
  });
}

// Handle menu selection
async function handleSelection(choice) {
  try {
    // Always run prepare first
    await runCommand('node', ['prepare-tests.js']);
    
    switch (choice) {
      case '1':
        await runCommand('node', ['run-tests.js', '--all']);
        break;
      case '2':
        await runCommand('node', ['run-tests.js', '--scrapers']);
        break;
      case '3':
        await runCommand('node', ['run-tests.js', '--scheduler']);
        break;
      case '4':
        await runCommand('node', ['run-tests.js', '--api']);
        break;
      case '5':
        await runCommand('node', ['run-tests.js', '--websocket']);
        break;
      case '6':
        await runCommand('node', ['run-tests.js', '--all', '--cleanup']);
        break;
      case 'p':
        // Already ran prepare-tests.js
        break;
      case 'q':
        console.log(`${colors.green}Exiting...${colors.reset}`);
        rl.close();
        return;
      default:
        console.log(`${colors.red}Invalid option. Please try again.${colors.reset}`);
        break;
    }
  } catch (error) {
    console.error(`${colors.red}An error occurred: ${error}${colors.reset}`);
  }
  
  // Show menu again
  console.log('\n');
  showMenu();
  rl.question(`${colors.cyan}Enter your choice: ${colors.reset}`, handleSelection);
}

// Start the menu loop
showMenu();
rl.question(`${colors.cyan}Enter your choice: ${colors.reset}`, handleSelection);
