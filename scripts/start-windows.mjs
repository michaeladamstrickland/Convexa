// Windows-friendly server starter with authentication
// Bypasses cross-env issues by setting environment in Node.js directly

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Set environment variables directly (bypassing cross-env)
process.env.BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'staging';
process.env.BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || 'RockyDog456';
process.env.PORT = process.env.PORT || '5001';
process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(repoRoot, 'backend', 'data', 'convexa.db');
process.env.SKIP_TRACE_DEMO_MODE = process.env.SKIP_TRACE_DEMO_MODE || 'true';
process.env.SKIP_TRACE_PRIMARY_PROVIDER = process.env.SKIP_TRACE_PRIMARY_PROVIDER || 'batchdata';
process.env.SKIP_TRACE_FALLBACK_ENABLED = process.env.SKIP_TRACE_FALLBACK_ENABLED || 'false';

// Ensure DB directory exists
try {
  fs.mkdirSync(path.dirname(process.env.SQLITE_DB_PATH), { recursive: true });
} catch {}

console.log('[Windows Launcher] BASIC_AUTH_USER =', process.env.BASIC_AUTH_USER);
console.log('[Windows Launcher] BASIC_AUTH_PASS = ***');
console.log('[Windows Launcher] PORT =', process.env.PORT);
console.log('[Windows Launcher] SQLITE_DB_PATH =', process.env.SQLITE_DB_PATH);
console.log('[Windows Launcher] Starting integrated server...');

// Handle Windows SIGINT properly - but only if not in background mode
if (!process.env.BACKGROUND_MODE) {
  process.on('SIGINT', () => {
    console.log('\n[Windows Launcher] Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Windows Launcher] Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

// Import the integrated server (it self-starts)
const serverEntry = path.resolve(repoRoot, 'backend', 'integrated-server.js');
const serverUrl = pathToFileURL(serverEntry).href;
await import(serverUrl);