// test-vite-frontend.js
// This script starts the frontend server with the updated proxy configuration

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, 'frontend');

console.log('Starting FlipTracker frontend with updated proxy configuration...');
console.log(`Frontend directory: ${frontendDir}`);

// Change to frontend directory and start the dev server
const child = exec('cd frontend && npm run dev', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error starting frontend server: ${error}`);
    return;
  }
  console.log(stdout);
  if (stderr) console.error(stderr);
});

child.stdout.on('data', (data) => {
  console.log(data);
});

child.stderr.on('data', (data) => {
  console.error(data);
});

console.log('Frontend server process started. Press Ctrl+C to stop.');
