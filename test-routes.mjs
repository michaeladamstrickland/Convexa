#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('Starting route inventory...');
console.log('Current dir:', process.cwd());

const serverPath = './backend/integrated-server.js';
console.log('Server path exists:', fs.existsSync(serverPath));

if (fs.existsSync(serverPath)) {
  const content = fs.readFileSync(serverPath, 'utf8');
  console.log('File size:', content.length, 'bytes');
  
  // Simple regex test
  const routeRegex = /app\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  let count = 0;
  while ((match = routeRegex.exec(content)) !== null && count < 10) {
    console.log(`Found route: ${match[1].toUpperCase()} ${match[2]}`);
    count++;
  }
  console.log(`Found ${count}+ routes`);
} else {
  console.log('Server file not found!');
}

console.log('Script completed.');