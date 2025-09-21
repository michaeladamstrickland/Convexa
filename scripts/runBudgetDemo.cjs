#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function main() {
  const port = Number(process.env.PORT || 6021);
  const base = `http://localhost:${port}`;
  const outDir = 'tmp';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const add = async (address, owner) => {
    const r = await axios.post(`${base}/api/zip-search-new/add-lead`, { address, owner_name: owner, source_type: 'qa' });
    if (!r.data || !r.data.success) throw new Error('add-lead failed');
    return r.data.leadId;
  };
  const skip = async (id) => (await axios.post(`${base}/api/leads/${encodeURIComponent(id)}/skiptrace?force=true`)).data;
  const snap = async () => (await axios.get(`${base}/admin/guardrails-state`)).data;

  const id1 = await add('10 Budget Ln, Collingswood, NJ 08108', 'Budget One');
  const id2 = await add('11 Budget Ln, Collingswood, NJ 08108', 'Budget Two');
  const r1 = await skip(id1);
  const r2 = await skip(id2);
  const s = await snap();
  fs.writeFileSync(path.join(outDir, 'budget_call1.json'), JSON.stringify(r1, null, 2));
  fs.writeFileSync(path.join(outDir, 'budget_call2.json'), JSON.stringify(r2, null, 2));
  fs.writeFileSync('guardrails_state_budget_6021.json', JSON.stringify(s, null, 2));
  console.log(JSON.stringify({ success: true, id1, id2, call1: r1, call2: r2, snapshot: s }, null, 2));
}

main().catch(e => { console.error(JSON.stringify({ success:false, error: e && e.message || String(e) }, null, 2)); process.exit(1); });
