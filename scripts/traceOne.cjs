#!/usr/bin/env node
// Trace one lead by address/owner via the integrated server

const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('port', { type: 'number', default: 6001 })
  .option('address', { type: 'string', demandOption: true })
  .option('owner', { type: 'string', demandOption: true })
  .option('force', { type: 'boolean', default: false })
  .option('no-fallback', { type: 'boolean', default: false })
  .help()
  .argv;

const BASE = `http://localhost:${argv.port}`;

async function findLeadByAddress(address) {
  const r = await axios.get(`${BASE}/api/zip-search-new/search`, { params: { query: address, limit: 10, page: 1 } });
  const leads = r.data && r.data.leads ? r.data.leads : [];
  return leads.find(l => (l.propertyAddress || '').toUpperCase() === address.toUpperCase());
}

async function ensureLead(address, owner) {
  const existing = await findLeadByAddress(address);
  if (existing) return existing.id;
  const body = { address, owner_name: owner, source_type: 'ad_hoc', motivation_score: 50, temperature_tag: 'warm' };
  const r = await axios.post(`${BASE}/api/zip-search-new/add-lead`, body);
  if (!r.data || !r.data.leadId) throw new Error('Failed to create lead');
  return r.data.leadId;
}

(async () => {
  try {
    const leadId = await ensureLead(argv.address, argv.owner);
    const params = new URLSearchParams();
    params.set('force', String(argv.force));
    params.set('fallback', String(!argv['no-fallback']));
    const r = await axios.post(`${BASE}/api/leads/${leadId}/skiptrace?${params}`);
    const d = r.data || {};
    const summary = {
      ok: !!d.success,
      leadId,
      cached: !!(d.data && d.data.cached),
      provider: d.data && d.data.provider,
      phones: (d.data && d.data.phones ? d.data.phones : []).length,
      emails: (d.data && d.data.emails ? d.data.emails : []).length
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    const data = e.response ? e.response.data : { error: e.message };
    console.error('ERROR', JSON.stringify(data));
    process.exit(1);
  }
})();
