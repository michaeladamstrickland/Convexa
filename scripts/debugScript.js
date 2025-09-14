/**
 * debugScript.js
 * This script helps debug the ML initialization process
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Debug script running...');
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`__dirname: ${__dirname}`);
  
  // Try to import mlConfig
  console.log('Attempting to import mlConfig...');
  import('../config/mlConfig.js')
    .then(module => {
      console.log('Successfully imported mlConfig');
      console.log('mlConfig contents:', JSON.stringify(module.default, null, 2));
    })
    .catch(err => {
      console.error('Failed to import mlConfig:', err);
    });
  
  // Check if logger.js exists
  const loggerPath = path.join(__dirname, '../utils/logger.js');
  console.log(`Checking if logger exists at: ${loggerPath}`);
  console.log(`Logger exists: ${fs.existsSync(loggerPath)}`);
  
  // Check directory structure
  const dirs = [
    '../logs',
    '../models',
    '../data',
    '../utils',
    '../config',
    '../services'
  ];
  
  console.log('Checking directory structure:');
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    console.log(`${dir}: ${fs.existsSync(fullPath) ? 'exists' : 'missing'}`);
  });
  
} catch (error) {
  console.error('Debug script error:', error);
}
