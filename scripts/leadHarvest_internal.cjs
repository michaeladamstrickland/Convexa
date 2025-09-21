#!/usr/bin/env node
/**
 * Lead Harvester (Internal-only)
 * - Harvest candidates via GET /api/zip-search-new/search
 * - NO ATTOM CALLS
 * - Score/select 500–1000
 * - Create leads and POST /api/leads/{id}/skiptrace in batches
 * - Export CSV with phones/emails
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Config
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:6001';
const BASE_ZIPS = (process.env.BASE_ZIPS || '08108,08107,08106,08033,08002,08003,08034,08035,08052,08057')
  .split(',').map(z => z.trim()).filter(Boolean);
const EXPAND_ZIPS = (process.env.EXPAND_ZIPS || '08059,08065,08077,08109,08049,08078')
  .split(',').map(z => z.trim()).filter(Boolean);
let MIN_LEADS = parseInt(process.env.MIN_LEADS || '500', 10);
let MAX_LEADS = parseInt(process.env.MAX_LEADS || '1000', 10);
if (isNaN(MIN_LEADS) || isNaN(MAX_LEADS) || MIN_LEADS > MAX_LEADS) { MIN_LEADS = 500; MAX_LEADS = 1000; }
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '50', 10);
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '15000', 10);
const POST_TIMEOUT = parseInt(process.env.POST_TIMEOUT || '15000', 10);
const CONCURRENCY = Math.min(Math.max(parseInt(process.env.CONCURRENCY || '8', 10), 5), 10);
const RETRIES = 3;
const BACKOFFS = [500, 1000, 2000];

const OUT = (() => {
  const now = new Date();
  const ts = now.toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const fname = `LeadDump_SouthNJ_${ts}.csv`;
  return path.resolve(process.cwd(), fname);
})();

// Helpers
const http = axios.create({ timeout: FETCH_TIMEOUT });

function normalizeAddress(addr) {
  if (!addr) return '';
  let s = String(addr).toUpperCase().trim();
  s = s.replace(/\./g, '').replace(/\s+/g, ' ');
  // crude suffix normalization
  s = s.replace(/\bSTREET\b/g, 'ST').replace(/\bST\b/g, 'ST')
       .replace(/\bAVENUE\b/g, 'AVE').replace(/\bAVE\b/g, 'AVE')
       .replace(/\bBOULEVARD\b/g, 'BLVD').replace(/\bTERRACE\b/g, 'TER')
       .replace(/\bROAD\b/g, 'RD').replace(/\bDRIVE\b/g, 'DR');
  return s;
}

function parseCityStateZip(address) {
  if (!address) return { city: '', state: '', zip: '' };
  const parts = String(address).split(',').map(s => s.trim());
  const city = parts[1] || '';
  const stateZip = parts[2] || '';
  const m = stateZip.match(/([A-Z]{2})\s*(\d{5})/);
  return { city, state: m ? m[1] : '', zip: m ? m[2] : '' };
}

function scoreCandidate(c) {
  let score = 50; // neutral base
  // suspected ABSENTEE if explicitly flagged (rare in internal data) -> +15
  if (c.absenteeInd === true || c.absenteeInd === 'Y') score += 15;
  // prefer vacancy (proxy for distress) -> +10
  if (c.isVacant) score += 10;
  // prefer single-family indicators if available
  const pt = (c.propertyType || c.propclass || c.propsubtype || c.propIndicator || '').toString().toUpperCase();
  if (pt.includes('SFR') || pt.includes('SINGLE') || pt === '10' || pt.includes('TOWN')) score += 10;
  // older year built -> + up to 10
  const yb = parseInt(c.yearbuilt || c.yearBuilt || '0', 10);
  if (yb && yb < 1975) score += 10; else if (yb && yb < 1990) score += 5;
  // long ownership if we have proxy lastModified far in past
  const lm = c.lastModified ? new Date(c.lastModified) : null;
  if (lm) {
    const years = (Date.now() - lm.getTime()) / (1000*60*60*24*365);
    if (years > 10) score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

async function getWithRetry(url, params, timeout = FETCH_TIMEOUT) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const res = await http.get(url, { params, timeout });
      return res;
    } catch (e) {
      const status = e.response?.status;
      if (attempt < RETRIES - 1 && (e.code === 'ECONNABORTED' || !status || status >= 500)) {
        await new Promise(r => setTimeout(r, BACKOFFS[attempt] + Math.floor(Math.random()*200)));
        continue;
      }
      throw e;
    }
  }
}

async function postWithRetry(url, data, timeout = POST_TIMEOUT) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const res = await http.post(url, data, { timeout });
      return res;
    } catch (e) {
      const status = e.response?.status;
      if (attempt < RETRIES - 1 && (status === 429 || status >= 500 || e.code === 'ECONNABORTED')) {
        await new Promise(r => setTimeout(r, BACKOFFS[attempt] + Math.floor(Math.random()*300)));
        continue;
      }
      throw e;
    }
  }
}

async function fetchZipCandidates(zip) {
  let page = 1; const pageSize = PAGE_SIZE; let total = 0; let results = [];
  while (true) {
    const params = { zipCode: zip, limit: pageSize, page };
    const url = `${API_BASE}/api/zip-search-new/search`;
    const res = await getWithRetry(url, params);
    const data = res.data;
    const leads = data?.leads || [];
    if (!leads.length) break;
    for (const lead of leads) {
      results.push({
        address: lead.propertyAddress,
        ownerName: lead.ownerName,
        isVacant: !!lead.isVacant,
        source: lead.source,
        raw: lead
      });
    }
    total += leads.length;
    page += 1;
    const pages = data?.pagination?.pages || 0;
    if (pages && page > pages) break;
  }
  return results;
}

async function harvestAll() {
  const zips = [...BASE_ZIPS];
  const unique = new Map(); // key: normalized address, val: candidate
  const tried = new Set();
  let pagesFetched = 0;
  const zipStats = [];

  async function processZip(zip) {
    tried.add(zip);
    const cands = await fetchZipCandidates(zip);
    pagesFetched += Math.ceil(cands.length / PAGE_SIZE);
    let added = 0;
    for (const c of cands) {
      const norm = normalizeAddress(c.address);
      if (!norm) continue;
      if (!unique.has(norm)) {
        const meta = {
          ...c,
          normalized: norm,
        };
        meta.score = scoreCandidate(meta);
        unique.set(norm, meta);
        added++;
      }
    }
    zipStats.push({ zip, harvested: cands.length, uniqueAdded: added });
  }

  for (const zip of zips) {
    await processZip(zip);
  }

  // expand if needed
  let expIdx = 0;
  while (unique.size < MIN_LEADS && expIdx < EXPAND_ZIPS.length) {
    await processZip(EXPAND_ZIPS[expIdx++]);
  }

  console.log(`Harvested candidates: ${unique.size} (unique)`);
  return { candidates: Array.from(unique.values()), pagesFetched, zipStats, triedZips: Array.from(tried) };
}

function toCsvRow(values) {
  return values.map(v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(',');
}

function ownerToPipe(lastFirstList) {
  if (!lastFirstList || !lastFirstList.length) return '';
  return lastFirstList.join('|');
}

function splitOwnerName(name) {
  if (!name) return [];
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return [parts[0]];
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  return [`${last}, ${first}`];
}

async function skipTraceLead(address, ownerName) {
  // Create lead first
  const payload = {
    address,
    owner_name: ownerName || null,
    source_type: 'internal-zip-search'
  };
  let leadId = null;
  try {
    const res = await postWithRetry(`${API_BASE}/api/zip-search-new/add-lead`, payload);
    leadId = res.data.leadId;
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    if (status === 400 && data?.existingId) {
      leadId = data.existingId;
    } else {
      throw e;
    }
  }

  // Skip-trace
  await postWithRetry(`${API_BASE}/api/leads/${leadId}/skiptrace`, {});
  // Fetch normalized phones/emails
  const r2 = await getWithRetry(`${API_BASE}/api/leads/${leadId}/skiptrace`, {});
  const info = r2.data?.data || {};
  const phones = (info.phones || []).map(p => p.number).filter(Boolean);
  const emails = (info.emails || []).map(e => (e.address || '').toLowerCase()).filter(Boolean);
  return { leadId, phones, emails };
}

async function runBatches(selected) {
  let done = 0, ok = 0, err = 0;
  const results = new Map();
  const start = Date.now();
  const pool = [];
  let totalLatencyMs = 0;
  let latencySamples = 0;

  async function worker(item) {
    try {
      const t0 = Date.now();
      const st = await skipTraceLead(item.address, item.ownerName);
      const dt = Date.now() - t0;
      totalLatencyMs += dt;
      latencySamples += 1;
      results.set(item.normalized, st);
      ok++;
    } catch (e) {
      err++;
    } finally {
      done++;
      if (done % 10 === 0 || done === selected.length) {
        const elapsed = Math.round((Date.now() - start)/1000);
        process.stdout.write(`\rSkip-trace progress: ${done}/${selected.length} OK=${ok} ERR=${err}  t=${elapsed}s   `);
      }
    }
  }

  let idx = 0;
  while (idx < selected.length || pool.length) {
    while (pool.length < CONCURRENCY && idx < selected.length) {
      const p = worker(selected[idx++]);
      pool.push(p);
      p.finally(() => {
        const i = pool.indexOf(p);
        if (i >= 0) pool.splice(i, 1);
      });
    }
    if (pool.length) await Promise.race(pool);
  }

  process.stdout.write('\n');
  const avgLatencyMs = latencySamples > 0 ? Math.round(totalLatencyMs / latencySamples) : 0;
  return { results, ok, err, avgLatencyMs };
}

async function main() {
  console.log('ATTOM disabled. Using internal search only.');
  const startedAt = Date.now();
  const { candidates, pagesFetched, zipStats, triedZips } = await harvestAll();
  console.log(`ZIPs searched: ${triedZips.join(', ')}`);
  console.log(`Pages fetched: ${pagesFetched}`);

  if (candidates.length < MIN_LEADS) {
    console.warn(`Insufficient candidates after expansion: ${candidates.length} < ${MIN_LEADS}. Stopping.`);
  }

  // Select top N
  const sorted = candidates.sort((a,b) => b.score - a.score);
  const targetN = Math.max(MIN_LEADS, Math.min(MAX_LEADS, sorted.length));
  const selected = sorted.slice(0, targetN);
  console.log(`Selected for skip-trace: ${selected.length} (target 500–1000)`);

  // Run skip-trace batches
  const { results, ok, err, avgLatencyMs } = await runBatches(selected);

  // Prepare CSV
  const header = [
    'Zip','Address','City','State','Owner Names',
    'Phone1','Phone2','Phone3','Email1','Email2','Email3',
    'Last Sale Date','Last Sale Price','AVM','Mortgage Balance','Years Owned','Distress Flags','Score'
  ];
  const rows = [toCsvRow(header)];

  for (const item of selected) {
    const { city, state, zip } = parseCityStateZip(item.address);
    const ownerList = splitOwnerName(item.ownerName);
    const key = item.normalized;
    const st = results.get(key) || { phones: [], emails: [] };
    const phones = (st.phones || []).slice(0,3);
    const emails = (st.emails || []).slice(0,3);
    const flags = [];
    if (item.isVacant) flags.push('VACANT');
    if (ownerList.length === 0) flags.push('UNKNOWN_OWNER');
    if (!flags.length) flags.push('UNKNOWN');
    rows.push(toCsvRow([
      zip,
      String(item.address || '').split(',')[0] || '',
      city,
      state,
      ownerToPipe(ownerList),
      phones[0] || '',
      phones[1] || '',
      phones[2] || '',
      (emails[0] || '').toLowerCase(),
      (emails[1] || '').toLowerCase(),
      (emails[2] || '').toLowerCase(),
      '', '', '', '', '',
      flags.join('|'),
      item.score
    ]));
  }

  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');

  // Preview first 10
  console.log('\nPreview:');
  for (let i = 1; i <= Math.min(10, rows.length-1); i++) {
    console.log(rows[i]);
  }

  const elapsed = Math.round((Date.now() - startedAt)/1000);
  console.log('\nRun summary:');
  console.log(` - ZIPs searched: ${triedZips.length}`);
  console.log(` - Pages fetched: ${pagesFetched}`);
  console.log(` - Unique candidates: ${candidates.length}`);
  console.log(` - Selected: ${selected.length}`);
  console.log(` - Skip-trace OK=${ok} ERR=${err}`);
  console.log(` - Provider avg latency: ${avgLatencyMs} ms`);
  console.log(` - Output: ${OUT}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err?.message || err);
    process.exit(1);
  });
}
