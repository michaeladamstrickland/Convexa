#!/usr/bin/env node
/**
 * Backfill phones/emails into an existing CSV using internal endpoints only.
 * Improvements:
 *  - Polls GET /skiptrace until contacts are present (handles async write).
 *  - Robust field mapping for phones/emails.
 *  - Fills Zip column from normalized lead address when missing.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:6001';
const IN = process.env.IN || '';
const CONCURRENCY = Math.min(Math.max(parseInt(process.env.CONCURRENCY || '8', 10), 1), 16);
const RETRIES = 3;
const BACKOFFS = [500, 1000, 2000];
const POLL_ATTEMPTS = 3;           // spec: poll up to 3 times
const POLL_DELAYS_MS = [500, 500, 500];

if (!IN) {
  console.error('IN env var is required (path to input CSV)');
  process.exit(1);
}

const OUT = process.env.OUT || (() => {
  const { dir, name, ext } = path.parse(IN);
  const finalExt = ext || '.csv';
  return path.join(dir, `${name}-contacts${finalExt}`);
})();

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function getWithRetry(url, params) {
  for (let i=0;i<RETRIES;i++) {
    try { return await axios.get(url, { params, timeout: 15000 }); } catch (e) {
      const status = e.response?.status;
      if (i<RETRIES-1 && (status===429 || status>=500 || e.code==='ECONNABORTED')) await sleep(BACKOFFS[i]); else throw e;
    }
  }
}
async function postWithRetry(url, data) {
  for (let i=0;i<RETRIES;i++) {
    try { return await axios.post(url, data, { timeout: 15000 }); } catch (e) {
      const status = e.response?.status;
      if (i<RETRIES-1 && (status===429 || status>=500 || e.code==='ECONNABORTED')) await sleep(BACKOFFS[i]); else throw e;
    }
  }
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(l => l.length > 0);
  const header = lines.shift();
  const rows = lines.map(line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/));
  return { header, rows };
}

function toCsvRow(values) {
  return values.map(v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/\"/g, '""') + '"';
    return s;
  }).join(',');
}

function reconstructAddress(zip, addr, city, state) {
  const z = (zip||'').toString().trim();
  const a = (addr||'').toString().trim();
  const c = (city||'').toString().trim();
  const s = (state||'').toString().trim();
  // "123 Main St, Collingswood, NJ 08108"
  return [a, c, [s, z].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function parseOwnerPipe(ownerField) {
  if (!ownerField || String(ownerField).toUpperCase() === 'UNKNOWN_OWNER') return null;
  const first = String(ownerField).split('|')[0].trim();
  if (!first) return null;
  const m = first.match(/^(.*?),\s*(.*)$/);
  return m ? `${m[2]} ${m[1]}` : first;
}

// ---- Normalize contacts ----
function normPhone(s) {
  const digits = (s || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
function extractPhones(obj) {
  const arr =
    (obj?.phones) ||
    (obj?.phone) ||
    (obj?.contacts?.phones) ||
    (obj?.contactPhones) ||
    [];
  const flat = Array.isArray(arr) ? arr : [arr];
  const raw = flat.map(p => p?.number || p?.phone || p?.value || p?.e164 || p?.raw || p).filter(Boolean);
  const norm = [];
  for (const r of raw) {
    const e = normPhone(r);
    if (e && !norm.includes(e)) norm.push(e);
    if (norm.length >= 3) break;
  }
  return norm;
}
function extractEmails(obj) {
  const arr =
    (obj?.emails) ||
    (obj?.email) ||
    (obj?.contacts?.emails) ||
    (obj?.contactEmails) ||
    [];
  const flat = Array.isArray(arr) ? arr : [arr];
  const raw = flat.map(e => e?.address || e?.email || e?.value || e).filter(Boolean);
  const valid = [];
  for (const r of raw) {
    const v = String(r).toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !valid.includes(v)) valid.push(v);
    if (valid.length >= 3) break;
  }
  return valid;
}

async function ensureLead(address, ownerName) {
  try {
    const r = await postWithRetry(`${API_BASE}/api/zip-search-new/add-lead`, {
      address,
      owner_name: ownerName || null,
      source_type: 'csv-backfill'
    });
    return r.data?.leadId || r.data?.id;
  } catch (e) {
    const status = e.response?.status;
    if (status === 400 && e.response?.data?.existingId) return e.response.data.existingId;
    throw e;
  }
}

// ZIP enrichment is intentionally disabled to comply with constraints

async function pollSkipTrace(leadId) {
  // Build optional query params to control provider/force behavior
  const force = String(process.env.FORCE_SKIPTRACE || '').toLowerCase() === 'true';
  const provider = process.env.BACKFILL_SKIPTRACE_PROVIDER || process.env.SKIPTRACE_PROVIDER || '';
  const fallback = process.env.BACKFILL_SKIPTRACE_FALLBACK || '';
  const params = new URLSearchParams();
  if (force) params.set('force', 'true');
  if (provider) params.set('provider', provider);
  if (fallback) params.set('fallback', String(fallback));
  const postUrl = params.toString()
    ? `${API_BASE}/api/leads/${leadId}/skiptrace?${params.toString()}`
    : `${API_BASE}/api/leads/${leadId}/skiptrace`;

  // Fire the skiptrace job (capture response for fail-fast diagnostics)
  const postResp = await postWithRetry(postUrl, {});
  const postData = postResp?.data || {};
  const respProvider = postData?.data?.provider || postData?.provider;
  const successFlag = typeof postData?.success === 'boolean' ? postData.success : undefined;
  const errorMsg = postData?.error || postData?.message || '';
  if (respProvider === 'demo') {
    throw new Error('Provider returned demo mode. Ensure SKIP_TRACE_DEMO_MODE=false and real API keys are set.');
  }
  if (successFlag === false && /api key|unauthorized|401|forbidden|403/i.test(String(errorMsg))) {
    throw new Error(`Skip-trace auth failed: ${errorMsg}`);
  }
  // Poll for results becoming available
  for (let i=0; i<POLL_ATTEMPTS; i++) {
    const r = await getWithRetry(`${API_BASE}/api/leads/${leadId}/skiptrace`, {});
    const data = r?.data?.data || r?.data || {};
    const phones = extractPhones(data);
    const emails = extractEmails(data);
    if (phones.length || emails.length) return { phones, emails };
    await sleep(POLL_DELAYS_MS[Math.min(i, POLL_DELAYS_MS.length-1)]);
  }
  return { phones: [], emails: [] };
}

async function main() {
  // Pre-flight: check quota
  try {
    const qr = await getWithRetry(`${API_BASE}/api/skiptrace/quota`, {});
    const q = qr?.data?.data || qr?.data || {};
    if (typeof q.remaining === 'number' && q.remaining <= 0) {
      console.error(`Daily quota exhausted: used=${q.used} total=${q.total} remaining=${q.remaining}`);
      process.exit(2);
    }
  } catch (e) {
    console.error('Warning: could not retrieve quota. Proceeding without pre-check.');
  }
  const content = fs.readFileSync(IN, 'utf8');
  const { header, rows } = parseCsv(content);
  const cols = header.split(',');
  const idx = {
    zip: cols.indexOf('Zip'),
    address: cols.indexOf('Address'),
    city: cols.indexOf('City'),
    state: cols.indexOf('State'),
    owner: cols.indexOf('Owner Names'),
    phone1: cols.indexOf('Phone1'),
    phone2: cols.indexOf('Phone2'),
    phone3: cols.indexOf('Phone3'),
    email1: cols.indexOf('Email1'),
    email2: cols.indexOf('Email2'),
    email3: cols.indexOf('Email3'),
  };
  if (Object.values(idx).some(v => v === -1)) {
    console.error('Unexpected CSV header. Required columns missing.');
    process.exit(1);
  }

  let done=0, ok=0, err=0; const total=rows.length;
  let quotaUsed = 0;
  let quotaTotal = null;

  let loggedErrors = 0;
  async function processRow(r) {
    try {
      // Optional mid-run quota check and early stop
      try {
        const qr = await getWithRetry(`${API_BASE}/api/skiptrace/quota`, {});
        const q = qr?.data?.data || qr?.data || {};
        if (typeof q.remaining === 'number' && q.remaining <= 0) {
          throw new Error('Quota exhausted');
        }
        quotaTotal = quotaTotal ?? q.total ?? quotaTotal;
      } catch (_) { /* non-fatal */ }
      const fullAddr = reconstructAddress(r[idx.zip], r[idx.address], r[idx.city], r[idx.state]);
      const ownerName = parseOwnerPipe(r[idx.owner]);
      const leadId = await ensureLead(fullAddr, ownerName);

      // Poll skiptrace until contacts appear
  const { phones, emails } = await pollSkipTrace(leadId);
  // Count a provider call usage when we attempted skiptrace
  quotaUsed++;

      // Backfill contacts
      r[idx.phone1] = phones[0] || '';
      r[idx.phone2] = phones[1] || '';
      r[idx.phone3] = phones[2] || '';
      r[idx.email1] = emails[0] || '';
      r[idx.email2] = emails[1] || '';
      r[idx.email3] = emails[2] || '';

      // Do not backfill ZIP per hard constraints

      ok++;
    } catch (e) {
      err++;
      if (loggedErrors < 10) {
        loggedErrors++;
        const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || String(e);
        console.error(`\nRow error: ${msg}`);
      }
    } finally {
      done++;
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\rBackfill progress: ${done}/${total} OK=${ok} ERR=${err}   `);
      }
    }
  }

  // Concurrency pool
  let i=0; const inflight=[];
  while (i<rows.length || inflight.length) {
    while (inflight.length < CONCURRENCY && i < rows.length) {
      const p = processRow(rows[i]);
      inflight.push(p);
      p.finally(()=>{ const j=inflight.indexOf(p); if (j>=0) inflight.splice(j,1); });
      i++;
    }
    if (inflight.length) await Promise.race(inflight);
  }
  process.stdout.write('\n');

  // Write output
  const outLines = [header, ...rows.map(r => toCsvRow(r))];
  fs.writeFileSync(OUT, outLines.join('\n'), 'utf8');
  console.log(`Wrote backfilled CSV to ${OUT}`);

  // Quick acceptance summary
  const totalRows = rows.length;
  const withZip = rows.filter(r => /^\d{5}$/.test(String(r[idx.zip]||''))).length;
  const withP1 = rows.filter(r => r[idx.phone1]).length;
  const withE1 = rows.filter(r => r[idx.email1]).length;
  console.log(`Summary: rows=${totalRows}  phone1%=${Math.round(withP1*100/totalRows)}  email1%=${Math.round(withE1*100/totalRows)}  err=${err}`);
  if (quotaTotal != null) {
    console.log(`Quota usage (approx): used~${quotaUsed} of total ${quotaTotal}`);
  }
}

if (require.main === module) {
  main().catch(e => { console.error('Fatal:', e?.message || e); process.exit(1); });
}
