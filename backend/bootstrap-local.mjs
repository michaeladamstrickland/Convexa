import { pathToFileURL } from 'url';
import * as mod from './integrated-server.js';

const candidate =
  mod.app ??
  mod.default ??
  (typeof mod === 'function' ? mod() : null) ??
  null;

const port = process.env.PORT || 5001;

if (!candidate || !candidate.listen) {
  console.log('[bootstrap] Module loaded; no explicit app.listen() export detected.');
  console.log(`[bootstrap] Assuming integrated-server.js binds via side-effects. Holding process; expecting health on ${port} if bind occurs.`);
  setInterval(() => {}, 1 << 30);
} else {
  const server = candidate.listen(port, () => {
    console.log(`[bootstrap] BOOT OK on ${port}`);
  });
  server.on('error', (err) => {
    console.error('[bootstrap] listen error:', err);
    process.exit(1);
  });
}