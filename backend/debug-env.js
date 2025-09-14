// Debug script to check environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First, log the current directory
console.log(`Current directory: ${__dirname}`);

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
console.log(`Looking for .env file at: ${envPath}`);
console.log(`File exists: ${fs.existsSync(envPath)}`);

// Load environment variables
dotenv.config();

// Now log the API key
console.log(`ATTOM_API_KEY: ${process.env.ATTOM_API_KEY ? 'Set (starts with ' + process.env.ATTOM_API_KEY.substring(0, 3) + '...)' : 'Not set or empty'}`);
console.log(`ATTOM_API_KEY with quotes removed: ${process.env.ATTOM_API_KEY ? process.env.ATTOM_API_KEY.replace(/"/g, '') : 'Not set or empty'}`);

// Check if quotes are causing the issue
if (process.env.ATTOM_API_KEY && process.env.ATTOM_API_KEY.includes('"')) {
  console.log('WARNING: API key contains quotes, which might cause issues!');
}
