// Cross-platform launcher for backend/integrated-server.js
// Sets safe defaults and respects existing env. Useful on Windows where setting env inline is clunky.

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Respect existing env; otherwise set pragmatic defaults
if (!process.env.PORT) process.env.PORT = '5001';
if (!process.env.SQLITE_DB_PATH) process.env.SQLITE_DB_PATH = path.join(repoRoot, 'backend', 'data', 'convexa.db');
if (process.env.SKIP_TRACE_DEMO_MODE == null) process.env.SKIP_TRACE_DEMO_MODE = 'true';
if (!process.env.SKIP_TRACE_PRIMARY_PROVIDER) process.env.SKIP_TRACE_PRIMARY_PROVIDER = 'batchdata';
if (process.env.SKIP_TRACE_FALLBACK_ENABLED == null) process.env.SKIP_TRACE_FALLBACK_ENABLED = 'false';
// Set basic auth defaults for development/staging only if not explicitly set (including empty string)
if (process.env.BASIC_AUTH_USER === undefined) process.env.BASIC_AUTH_USER = 'staging';
if (process.env.BASIC_AUTH_PASS === undefined) process.env.BASIC_AUTH_PASS = 'RockyDog456';

// Ensure DB directory exists
try {
  fs.mkdirSync(path.dirname(process.env.SQLITE_DB_PATH), { recursive: true });
} catch {}

console.log('[Launcher] PORT =', process.env.PORT);
console.log('[Launcher] SQLITE_DB_PATH =', process.env.SQLITE_DB_PATH);
console.log('[Launcher] BASIC_AUTH_USER =', process.env.BASIC_AUTH_USER);
console.log('[Launcher] BASIC_AUTH_PASS = ***');
console.log('[Launcher] SKIP_TRACE_DEMO_MODE =', process.env.SKIP_TRACE_DEMO_MODE);
console.log('[Launcher] SKIP_TRACE_PRIMARY_PROVIDER =', process.env.SKIP_TRACE_PRIMARY_PROVIDER);
console.log('[Launcher] SKIP_TRACE_FALLBACK_ENABLED =', process.env.SKIP_TRACE_FALLBACK_ENABLED);

// Import the integrated server and explicitly start it
const serverEntry = path.resolve(repoRoot, 'backend', 'integrated-server.js');
const serverUrl = pathToFileURL(serverEntry).href;
const { startServer } = await import(serverUrl);

// Start the server
await startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
