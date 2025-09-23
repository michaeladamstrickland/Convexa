#!/usr/bin/env node
const fetch = require('node-fetch');

const BASE = process.argv[2] || process.env.BASE || 'http://localhost:5001';

(async () => {
  const r1 = await fetch(`${BASE}/ops/leads`);
  const ok1 = r1.ok && ((r1.headers.get('content-type')||'').includes('text/html'));
  const r2 = await fetch(`${BASE}/admin/artifacts`);
  const ok2 = r2.status === 200 || r2.status === 401; // 401 is acceptable if Basic Auth enabled
  if (ok1 && ok2) {
    console.log('UI smoke OK');
    process.exit(0);
  } else {
    console.log('UI smoke FAILED', { ops: ok1, artifacts: ok2 });
    process.exit(1);
  }
})().catch(e => { console.error('uiSmoke error', e); process.exit(1); });
