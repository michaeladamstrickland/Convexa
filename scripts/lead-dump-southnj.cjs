/*
  LeadDump South New Jersey Harvest & Enrichment
  - Gathers candidates by ZIP from ATTOM proxy and unified search
  - Skip-traces each candidate via backend endpoints
  - Produces LeadDump_SouthNJ.csv at repo root
  - Prints top 10 rows to console

  Usage:
    node scripts/lead-dump-southnj.cjs
    node scripts/lead-dump-southnj.cjs 08108,08109,08030

  Env:
    API_BASE defaults to http://localhost:5001
    Max per-zip defaults to 40 (ATTOM + search combined, deduped)

  Behavior:
    - Continues on errors; inserts placeholders if keys/services are missing
    - Throttles skip-trace calls to avoid rate limits
*/

const fs = require('fs');
const path = require('path');

const API_ORIGIN = process.env.API_BASE || 'http://localhost:5001';
const API = (p) => `${API_ORIGIN}${p.startsWith('/') ? p : '/' + p}`;

const DEFAULT_ZIPS = [
  '08108','08109','08030','08059','08002','08102','08104',
  '08016','08065','08031','08105','08110','08096','08034','08035'
];

const MAX_PER_ZIP = parseInt(process.env.MAX_PER_ZIP || '40', 10);
const SKIPTRACE_DELAY_MS = parseInt(process.env.SKIPTRACE_DELAY_MS || '250', 10); // 4/s gentle rate
const GLOBAL_TIMEOUT_MS = parseInt(process.env.GLOBAL_TIMEOUT_MS || '1800000', 10); // 30 min cutoff

// Simple fetch with timeout and graceful error handling
async function http(method, url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const init = { method, headers: {}, signal: ctrl.signal };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    let json = null;
    if (ct.includes('application/json')) {
      try { json = JSON.parse(text); } catch {}
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(t);
  }
}

function normalizeAddressStr(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[\s,.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOneLineAddress(oneLine) {
  if (!oneLine || typeof oneLine !== 'string') return { address: '', city: '', state: '', zip: '' };
  // naive parse: "123 Main St, City, ST 12345"
  const parts = oneLine.split(',');
  const line1 = parts[0]?.trim() || '';
  const city = (parts[1] || '').trim();
  const tail = (parts[2] || '').trim(); // "ST 12345"
  const m = tail.match(/([A-Z]{2})\s+(\d{5})/i);
  const state = m ? m[1].toUpperCase() : '';
  const zip = m ? m[2] : '';
  return { address: line1, city, state, zip };
}

function pick(val, fallback='') { return (val === null || val === undefined) ? fallback : val; }

function extractFromAttomItem(item) {
  try {
    const a = item?.address || {};
    const oneLine = a.oneLine || a.OneLine || '';
    const parsed = parseOneLineAddress(oneLine);
    const address = parsed.address || a.line1 || a.Line1 || '';
    const city = parsed.city || a.city || a.City || '';
    const state = parsed.state || a.state || a.State || '';
    const zip = parsed.zip || a.postal1 || a.postalCode || a.PostalCode || '';
    // Sales
    const sale = item?.sale || item?.lastSale || {};
    const lastSaleDate = sale.saleDate || sale.sale_date || sale.date || '';
    const lastSalePrice = sale.amount || sale.amountSalePrice || sale.price || '';
    // AVM
    const avm = item?.avm?.amount?.value || item?.valuation?.avm?.amount?.value || item?.valuation?.avm || '';
    return { address, city, state, zip, lastSaleDate, lastSalePrice, currentAVM: avm };
  } catch {
    return { address: '', city: '', state: '', zip: '', lastSaleDate: '', lastSalePrice: '', currentAVM: '' };
  }
}

function extractFromLead(lead) {
  const address = pick(lead?.propertyAddress, '') || pick(lead?.address, '');
  // best-effort parse if one-line
  const parsed = parseOneLineAddress(address);
  const city = lead?.city || parsed.city;
  const state = lead?.state || parsed.state;
  const zip = lead?.zipCode || lead?.zip || parsed.zip;
  const ownerName = lead?.ownerName || lead?.owner_name || '';
  const distress = [];
  if (lead?.foreclosure_stage) distress.push('preforeclosure');
  if (typeof lead?.vacancy_months === 'number' && lead.vacancy_months > 0) distress.push('vacancy');
  if (typeof lead?.tax_debt === 'number' && lead.tax_debt > 0) distress.push('tax_delinquency');
  return {
    address: parsed.address || address,
    city: city || '',
    state: state || '',
    zip: zip || '',
    ownerName,
    distressFlags: distress.join(';')
  };
}

function yearsSince(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.floor(years).toString();
}

function toCsvRow(vals) {
  return vals.map(v => {
    const s = v === undefined || v === null ? '' : String(v);
    // escape CSV
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(',');
}

async function fetchAttomZip(zip) {
  const url = API(`/api/attom/property/address?postalcode=${encodeURIComponent(zip)}`);
  const r = await http('GET', url);
  if (!r.ok) return [];
  const data = r.json || {};
  // try some common shapes
  const arr = Array.isArray(data) ? data
    : Array.isArray(data.properties) ? data.properties
    : Array.isArray(data.property) ? data.property
    : Array.isArray(data.data) ? data.data
    : [];
  return arr.slice(0, MAX_PER_ZIP);
}

async function fetchSearchZip(zip) {
  const url = API(`/api/search?zipCode=${encodeURIComponent(zip)}&limit=${MAX_PER_ZIP}`);
  const r = await http('GET', url);
  if (!r.ok) return [];
  const data = r.json || {};
  // common shapes: { results: [] } or array
  const arr = Array.isArray(data) ? data
    : Array.isArray(data.results) ? data.results
    : Array.isArray(data.leads) ? data.leads
    : Array.isArray(data.data) ? data.data
    : [];
  return arr.slice(0, MAX_PER_ZIP);
}

async function skipTraceCandidate(candidate) {
  // Prefer leadId if present
  if (candidate.leadId) {
    const r = await http('POST', API('/api/skip-trace'), { leadId: candidate.leadId, respectQuietHours: false });
    if (r.ok && r.json) return r.json;
  }
  // Else by address payload
  if (candidate.address && candidate.city && candidate.state && candidate.zip) {
    const r = await http('POST', API('/api/skip-trace'), {
      address: candidate.address,
      city: candidate.city,
      state: candidate.state,
      zipCode: candidate.zip,
      respectQuietHours: false
    });
    if (r.ok && r.json) return r.json;
  }
  // Fallback
  return {
    leadId: candidate.leadId || 'unknown',
    providersTried: [],
    cost: 0,
    contacts: { phones: [], emails: [] },
    compliance: { quietHours: false }
  };
}

async function main() {
  const startTs = Date.now();
  const zipArg = (process.argv[2] || '').trim();
  const zips = zipArg ? zipArg.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ZIPS.slice();
  console.log(`Lead dump starting. API: ${API_ORIGIN} | ZIPs: ${zips.join(', ')}`);

  // Verify server basic health if available
  const health = await http('GET', API('/health'));
  if (!health.ok) {
    console.warn('Warning: /health unreachable; proceeding anyway with placeholders where needed.');
  }

  // aggregate candidates per ZIP (deduped by normalized address)
  const candidates = new Map(); // key: normalized address -> candidate
  for (const zip of zips) {
    // ATTOM slice
    const attom = await fetchAttomZip(zip);
    for (const it of attom) {
      const f = extractFromAttomItem(it);
      const norm = normalizeAddressStr(`${f.address}, ${f.city}, ${f.state} ${f.zip}`);
      if (!norm) continue;
      const existing = candidates.get(norm) || {};
      candidates.set(norm, {
        zip: f.zip || zip,
        address: f.address,
        city: f.city,
        state: f.state,
        leadId: existing.leadId || null,
        ownerName: existing.ownerName || '',
        lastSaleDate: f.lastSaleDate || existing.lastSaleDate || '',
        lastSalePrice: f.lastSalePrice || existing.lastSalePrice || '',
        currentAVM: f.currentAVM || existing.currentAVM || '',
        mortgageBalance: existing.mortgageBalance || '', // not available; placeholder
        ownershipYears: yearsSince(f.lastSaleDate || existing.lastSaleDate || ''),
        distressFlags: existing.distressFlags || ''
      });
      if ((Date.now() - startTs) > GLOBAL_TIMEOUT_MS) break;
    }

    if ((Date.now() - startTs) > GLOBAL_TIMEOUT_MS) break;

    // Unified search slice
    const search = await fetchSearchZip(zip);
    for (const lead of search) {
      const f = extractFromLead(lead);
      const norm = normalizeAddressStr(`${f.address}, ${f.city}, ${f.state} ${f.zip || zip}`);
      if (!norm) continue;
      const existing = candidates.get(norm) || {};
      candidates.set(norm, {
        zip: f.zip || zip,
        address: f.address || existing.address || '',
        city: f.city || existing.city || '',
        state: f.state || existing.state || '',
        leadId: existing.leadId || lead?.id || lead?.leadId || null,
        ownerName: f.ownerName || existing.ownerName || '',
        lastSaleDate: existing.lastSaleDate || '',
        lastSalePrice: existing.lastSalePrice || '',
        currentAVM: existing.currentAVM || '',
        mortgageBalance: existing.mortgageBalance || '', // placeholder
        ownershipYears: existing.ownershipYears || '',
        distressFlags: [existing.distressFlags, f.distressFlags].filter(Boolean).join(';')
      });
      if ((Date.now() - startTs) > GLOBAL_TIMEOUT_MS) break;
    }

    if ((Date.now() - startTs) > GLOBAL_TIMEOUT_MS) {
      console.warn('Global timeout reached; proceeding with collected candidates.');
      break;
    }
  }

  // Skip-trace each candidate (throttled)
  const rows = [];
  const headers = [
    'Zip','Address','City','State','Owner Name(s)','Owner Contact Info',
    'Last Sale Date','Last Sale Price','Current AVM','Mortgage Balance','Ownership Years','Distress Flags'
  ];
  rows.push(headers);

  const entries = Array.from(candidates.values());
  for (let i = 0; i < entries.length; i++) {
    const c = entries[i];
    // Delay to respect rate limiting
    if (i > 0) {
      await new Promise(r => setTimeout(r, SKIPTRACE_DELAY_MS));
    }
    let st = null;
    try {
      st = await skipTraceCandidate(c);
    } catch {}
    const phones = Array.isArray(st?.contacts?.phones) ? st.contacts.phones.map(p => p.value).filter(Boolean) : [];
    const emails = Array.isArray(st?.contacts?.emails) ? st.contacts.emails.map(e => e.value).filter(Boolean) : [];
    const contactInfo = [...phones, ...emails].join(';');

    const row = [
      c.zip || '',
      c.address || '',
      c.city || '',
      c.state || '',
      c.ownerName || '',
      contactInfo,
      c.lastSaleDate || '',
      c.lastSalePrice || '',
      c.currentAVM || '',
      c.mortgageBalance || '',
      c.ownershipYears || '',
      c.distressFlags || ''
    ];
    rows.push(row);
  }

  // Write CSV to repo root
  const outPath = path.join(process.cwd(), 'LeadDump_SouthNJ.csv');
  const csv = rows.map(r => toCsvRow(r)).join('\n');
  fs.writeFileSync(outPath, csv, 'utf8');

  // Print top 10 rows
  const preview = rows.slice(0, 11).map(r => toCsvRow(r)).join('\n');
  console.log('--- LeadDump_SouthNJ.csv (preview top 10 rows) ---');
  console.log(preview);
  console.log(`\nSaved ${rows.length - 1} rows to ${outPath}`);
}

main().catch(err => {
  console.error('Lead dump failed:', err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
