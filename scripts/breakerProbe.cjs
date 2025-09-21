#!/usr/bin/env node
const axios = require('axios');

async function main() {
  const port = Number(process.env.PORT || 6017);
  const leadId = process.argv[2];
  if (!leadId) { console.error('Usage: node scripts/breakerProbe.cjs <leadId>'); process.exit(1); }
  const snap = (await axios.get(`http://localhost:${port}/admin/guardrails-state`)).data.data;
  const now = Date.now();
  const waitMs = Math.max(0, (snap.breaker.nextProbeAt || now) - now);
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs + 10));
  await axios.post(`http://localhost:${port}/api/leads/${encodeURIComponent(leadId)}/skiptrace?force=true`);
  const after = (await axios.get(`http://localhost:${port}/admin/guardrails-state`)).data;
  console.log(JSON.stringify(after, null, 2));
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
