#!/usr/bin/env node
/**
 * Lead Harvest Script for South NJ
 *
 * Usage: node scripts/leadHarvest.cjs
 *
 * Behavior:
 * - For a list of ZIP codes within ~30mi of Audubon, NJ, fetch properties from ATTOM and the unified search endpoint.
 * - Enrich each unique property via skip-trace.
 * - Output a CSV (LeadDump_SouthNJ.csv) at the repo root and print the first 10 rows to console.
 */

/* eslint-disable no-console */

(async () => {
  const fs = require('fs');
  const path = require('path');
  try {
    // Load env from repo root .env
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  } catch (_) {
    // dotenv is optional; continue if not installed
  }
  const axios = require('axios');

  const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5001'; // allow override for alternate port
  const REQUEST_TIMEOUT_MS = Number.isFinite(parseInt(process.env.REQUEST_TIMEOUT_MS, 10))
    ? parseInt(process.env.REQUEST_TIMEOUT_MS, 10)
    : 15000; // default timeout
  const PAGE_SIZE = Number.isFinite(parseInt(process.env.PAGE_SIZE, 10))
    ? Math.max(10, Math.min(100, parseInt(process.env.PAGE_SIZE, 10)))
    : 50; // pagination size for fetches (allow override)
  const DEFAULT_ZIPS = [
    '08108', '08109', '08030', '08059', '08002', '08102', '08104', '08016',
    '08065', '08031', '08105', '08110', '08096', '08034', '08035',
  ];
  const ZIP_CODES = process.env.HARVEST_ZIPS
    ? process.env.HARVEST_ZIPS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_ZIPS;

  // Optional auth support if backend uses token
  const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || process.env.AUTH_TOKEN || undefined;

  // Concurrency limits
  const ZIP_CONCURRENCY = Number.isFinite(parseInt(process.env.ZIP_CONCURRENCY, 10))
    ? parseInt(process.env.ZIP_CONCURRENCY, 10)
    : 2; // fetch per-zip endpoints concurrently (attom + search) but limit zips processed in parallel
  const SKIPTRACE_CONCURRENCY = Number.isFinite(parseInt(process.env.SKIPTRACE_CONCURRENCY, 10))
    ? parseInt(process.env.SKIPTRACE_CONCURRENCY, 10)
    : 4; // concurrent skip-trace calls
  const RETRY_MAX = Number.isFinite(parseInt(process.env.RETRY_MAX, 10)) ? parseInt(process.env.RETRY_MAX, 10) : 3;
  const RETRY_BACKOFF_MS = Number.isFinite(parseInt(process.env.RETRY_BACKOFF_MS, 10)) ? parseInt(process.env.RETRY_BACKOFF_MS, 10) : 1000;
  const PREVIEW_ROWS = Number.isFinite(parseInt(process.env.PREVIEW_ROWS, 10)) ? Math.max(1, parseInt(process.env.PREVIEW_ROWS, 10)) : 10;

  // Parse MAX_LEADS from env or CLI (--limit or --max-leads)
  function parseMaxLeads() {
    const envVal = process.env.MAX_LEADS || process.env.LIMIT;
    let val = envVal ? parseInt(envVal, 10) : NaN;
    if (!Number.isFinite(val) || val <= 0) {
      const arg = process.argv.find(a => /^--(limit|max-leads)(=|$)/i.test(a));
      if (arg) {
        const m = arg.match(/^(?:--limit|--max-leads)(?:=(\d+))?$/i);
        if (m && m[1]) val = parseInt(m[1], 10);
        else {
          // if provided as separate flags like --limit 1000
          const idx = process.argv.indexOf(arg);
          const next = process.argv[idx + 1];
          if (next && /^\d+$/.test(next)) val = parseInt(next, 10);
        }
      }
    }
    return Number.isFinite(val) && val > 0 ? val : 1000;
  }

  // Parse MIN_LEADS from env or CLI (--min-leads or --min)
  function parseMinLeads() {
    const envVal = process.env.MIN_LEADS || process.env.MIN;
    let val = envVal ? parseInt(envVal, 10) : NaN;
    if (!Number.isFinite(val) || val <= 0) {
      const arg = process.argv.find(a => /^--(min-leads|min)(=|$)/i.test(a));
      if (arg) {
        const m = arg.match(/^(?:--min-leads|--min)(?:=(\d+))?$/i);
        if (m && m[1]) val = parseInt(m[1], 10);
        else {
          const idx = process.argv.indexOf(arg);
          const next = process.argv[idx + 1];
          if (next && /^\d+$/.test(next)) val = parseInt(next, 10);
        }
      }
    }
    return Number.isFinite(val) && val > 0 ? val : 500;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchJSON(url, options = {}, label = 'request') {
    const method = (options.method || 'GET').toUpperCase();
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      (AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      options.headers || {}
    );
    try {
      const cfg = { headers, timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true };
      let res;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const data = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;
        res = await axios({ url, method, data, ...cfg });
      } else {
        res = await axios({ url, method, ...cfg });
      }

      if (!res || res.status < 200 || res.status >= 300) {
        const status = res ? res.status : 'NO_RESPONSE';
        const text = res && res.data ? (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)) : '';
        throw new Error(`${label} failed: ${status} ${text}`);
      }
      return res.data;
    } catch (err) {
      console.warn(`WARN: ${label} error for ${url}:`, err && err.message ? err.message : err);
      return null; // graceful: caller will interpret as missing data
    }
  }

  // Like fetchJSON but never throws on non-2xx; returns { status, data } or null on network error.
  async function requestRaw(url, { method = 'GET', body, headers = {} } = {}) {
    const finalHeaders = Object.assign(
      { 'Content-Type': 'application/json' },
      (AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      headers
    );
    try {
      const res = await axios({
        url,
        method,
        data: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        headers: finalHeaders,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });
      return { status: res.status, data: res.data };
    } catch (err) {
      console.warn(`WARN: requestRaw error for ${url}:`, err && err.message ? err.message : err);
      return null;
    }
  }

  function limitConcurrency(limit) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= limit || queue.length === 0) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve()
        .then(fn)
        .then((v) => { active--; resolve(v); next(); })
        .catch((e) => { active--; reject(e); next(); });
    };
    return function run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
    };
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // normalize() per requirements
  // - null/undefined -> ""
  // - arrays -> handled separately for phones/emails; otherwise JSON.stringify
  // - plain objects -> JSON.stringify
  // - primitives -> String(value)
  function normalize(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  function toCSVRow(values) {
    return values.map(normalize).map(csvEscape).join(',');
  }

  function parseDate(input) {
    if (!input) return null;
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  function parseMaybeYear(y) {
    const n = parseInt(y, 10);
    return Number.isFinite(n) ? n : null;
  }

  function yearsBetween(fromDate, toDate = new Date()) {
    if (!fromDate) return null;
    const diffMs = toDate - fromDate;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  }

  // Safe getters
  const get = (obj, pathArr, def) => {
    try {
      return pathArr.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? def;
    } catch { return def; }
  };

  function normalizeAddressParts(rec) {
    // Try to normalize from multiple possible shapes
    // ATTOM-style guesses
    let address = get(rec, ['address', 'line1']) || get(rec, ['address', 'oneLine']) || get(rec, ['address', 'street']) || get(rec, ['property', 'address', 'line1']);
    let city = get(rec, ['address', 'city']) || get(rec, ['address', 'locality']) || get(rec, ['property', 'address', 'city']);
    let state = get(rec, ['address', 'state']) || get(rec, ['address', 'region']) || get(rec, ['property', 'address', 'state']);
    let zip = get(rec, ['address', 'postal1']) || get(rec, ['address', 'postalcode']) || get(rec, ['property', 'address', 'postal1']) || get(rec, ['address', 'zip']) || get(rec, ['zip']);

    // Alternate shapes (unified search)
    address = address || (typeof rec.address === 'string' ? rec.address : undefined) || get(rec, ['street']) || get(rec, ['address1']) || get(rec, ['line1']) || get(rec, ['location', 'address']) || get(rec, ['property', 'location', 'address']);
    city = city || get(rec, ['cityName']) || get(rec, ['city']) || get(rec, ['location', 'city']);
    state = state || get(rec, ['stateCode']) || get(rec, ['state']) || get(rec, ['location', 'state']);
    zip = zip || get(rec, ['zipCode']) || get(rec, ['zipcode']) || get(rec, ['postalCode']) || get(rec, ['postal']);

    // Trim and normalize
    function clean(s) { return typeof s === 'string' ? s.trim() : s; }
    return {
      address: clean(address) || null,
      city: clean(city) || null,
      state: clean(state) || null,
      zipCode: clean(zip) || null,
    };
  }

  function propertyKey(parts) {
    const a = (parts.address || '').toUpperCase();
    const c = (parts.city || '').toUpperCase();
    const s = (parts.state || '').toUpperCase();
    const z = (parts.zipCode || '').toUpperCase();
    return `${a}|${c}|${s}|${z}`;
  }

  function mergeProperty(base, next) {
    // Prefer existing truthy fields; fill missing from next
    const out = { ...base };
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      if (out[k] === undefined || out[k] === null || out[k] === '' || (Array.isArray(out[k]) && out[k].length === 0)) {
        out[k] = v;
      }
    }
    return out;
  }

  function extractFromAttomRecord(rec) {
    const addr = normalizeAddressParts(rec);
    const attomId = rec.attomId || get(rec, ['identifier', 'attomId']) || get(rec, ['identifier', 'attomid']) || get(rec, ['property', 'identifier', 'attomId']) || get(rec, ['property', 'identifier', 'attomid']);
    // Map sale date and price with broader fallbacks (root and under property)
    const saleDate = get(rec, ['sale', 'saleTransDate'])
      || get(rec, ['sale', 'saleDate'])
      || get(rec, ['sale', 'salesearchdate'])
      || get(rec, ['lastSaleDate'])
      || get(rec, ['sale', 'lastSaleDate'])
      || get(rec, ['property', 'sale', 'saleTransDate'])
      || get(rec, ['property', 'sale', 'saleDate'])
      || get(rec, ['property', 'lastSaleDate'])
      || get(rec, ['property', 'sale', 'lastSaleDate'])
      || (Array.isArray(get(rec, ['saleHistory'])) && get(rec, ['saleHistory', 0, 'saleTransDate']))
      || (Array.isArray(get(rec, ['sales'])) && get(rec, ['sales', 0, 'saleDate']));
    const salePrice = get(rec, ['sale', 'amount', 'saleAmt'])
      || get(rec, ['sale', 'saleAmt'])
      || get(rec, ['lastSalePrice'])
      || get(rec, ['sale', 'amount', 'saleAmount'])
      || get(rec, ['property', 'sale', 'amount', 'saleAmt'])
      || get(rec, ['property', 'sale', 'saleAmt'])
      || get(rec, ['property', 'lastSalePrice'])
      || get(rec, ['property', 'sale', 'amount', 'saleAmount'])
      || (Array.isArray(get(rec, ['saleHistory'])) && get(rec, ['saleHistory', 0, 'saleAmt']))
      || (Array.isArray(get(rec, ['sales'])) && get(rec, ['sales', 0, 'saleAmount']));
    const avm = get(rec, ['avm', 'amount', 'value'])
      || get(rec, ['avm', 'value'])
      || get(rec, ['valuation', 'avm', 'value'])
      || get(rec, ['valuation', 'value'])
      || get(rec, ['property', 'avm', 'amount', 'value'])
      || get(rec, ['property', 'avm', 'value'])
      || get(rec, ['property', 'valuation', 'avm', 'value'])
      || get(rec, ['estimatedValue'])
      || get(rec, ['marketValue']);
    const mortgageBalance = get(rec, ['mortgage', 'balance'])
      || get(rec, ['mortgage', 'currentBalance'])
      || get(rec, ['liens', 'totalBalance'])
      || get(rec, ['property', 'mortgage', 'balance'])
      || get(rec, ['property', 'mortgage', 'currentBalance'])
      || get(rec, ['property', 'liens', 'totalBalance'])
      || get(rec, ['openLienBalance'])
      || get(rec, ['currentLoanBalance'])
      || get(rec, ['property', 'openLienBalance'])
      || get(rec, ['property', 'currentLoanBalance']);
    const distressFlags = [];
    if (get(rec, ['foreclosure', 'status']) || get(rec, ['foreclosureStatus'])
      || get(rec, ['property', 'foreclosure', 'status']) || get(rec, ['property', 'foreclosureStatus'])) distressFlags.push('foreclosure');
    if (get(rec, ['vacancy', 'isVacant']) === true || get(rec, ['vacancyStatus']) === 'Vacant'
      || get(rec, ['property', 'vacancy', 'isVacant']) === true || get(rec, ['property', 'vacancyStatus']) === 'Vacant') distressFlags.push('vacancy');
    if (get(rec, ['tax', 'delinquent']) === true || get(rec, ['taxDelinquent']) === true
      || get(rec, ['property', 'tax', 'delinquent']) === true || get(rec, ['property', 'taxDelinquent']) === true) distressFlags.push('tax-delinquent');
    const listingStatus = (get(rec, ['listingStatus']) || get(rec, ['property', 'listingStatus']) || '').toString().toLowerCase();
    if (['preforeclosure', 'auction', 'bankowned', 'bank-owned', 'reo'].includes(listingStatus)) {
      if (listingStatus === 'preforeclosure') distressFlags.push('preforeclosure');
      else if (listingStatus.includes('auction')) distressFlags.push('auction');
      else distressFlags.push('bankOwned');
    }
    const absenteeInd = get(rec, ['absenteeInd'])
      || get(rec, ['owner', 'absenteeInd'])
      || get(rec, ['property', 'absenteeInd']);

    // Extra helpful fields for scoring fallbacks
    const yearBuilt = get(rec, ['summary', 'yearBuilt']) || get(rec, ['building', 'summary', 'yearbuilt']) || get(rec, ['property', 'summary', 'yearBuilt']) || get(rec, ['yearBuilt']);
    const propertyType = get(rec, ['summary', 'proptype']) || get(rec, ['property', 'summary', 'proptype']) || get(rec, ['propertyType']) || get(rec, ['useCode']);
    const assessedTotal = get(rec, ['assessment', 'assessed', 'assdttlvalue']) || get(rec, ['assessment', 'assessedTotal']) || get(rec, ['assessedTotal']);
    const assessedValue = get(rec, ['assessment', 'assessed', 'assdland']) || get(rec, ['assessment', 'assessedValue']) || get(rec, ['assessedValue']);
    const marketValue = get(rec, ['assessment', 'market', 'mktttlvalue']) || get(rec, ['marketValue']);
    const vintageLastModified = get(rec, ['vintage', 'lastModified']) || get(rec, ['property', 'vintage', 'lastModified']);

    const ownerName = get(rec, ['ownerName']) || get(rec, ['owner', 'name']) || get(rec, ['property', 'ownerName']);
    return {
      ...addr,
      attomId: attomId || undefined,
      lastSaleDate: saleDate || null,
      lastSalePrice: salePrice || null,
      avm: avm || null,
      mortgageBalance: mortgageBalance || null,
      distressFlags: distressFlags,
      absenteeInd: absenteeInd ?? undefined,
      yearBuilt: parseMaybeYear(yearBuilt) || undefined,
      propertyType: propertyType || undefined,
      assessedTotal: assessedTotal || undefined,
      assessedValue: assessedValue || undefined,
      marketValue: marketValue || undefined,
      vintageLastModified: vintageLastModified || undefined,
      ownerNames: ownerName ? [String(ownerName)] : undefined,
    };
  }

  function extractFromUnifiedSearchRecord(rec) {
    const addr = normalizeAddressParts(rec);
  const saleDate = get(rec, ['lastSaleDate']) || get(rec, ['saleDate']) || get(rec, ['property', 'lastSaleDate']) || get(rec, ['property', 'saleDate']);
  const salePrice = get(rec, ['lastSalePrice']) || get(rec, ['salePrice']) || get(rec, ['property', 'lastSalePrice']) || get(rec, ['property', 'salePrice']);
    // Unified may include signals like preforeclosure
    const distressFlags = [];
    if (get(rec, ['preforeclosure']) === true || get(rec, ['foreclosure']) === true) distressFlags.push('foreclosure');
    if (get(rec, ['vacant']) === true) distressFlags.push('vacancy');
    if (get(rec, ['taxDelinquent']) === true) distressFlags.push('tax-delinquent');

    // Attempt to include value fields if present
    const avm = get(rec, ['avm', 'amount', 'value'])
      || get(rec, ['avm', 'value'])
      || get(rec, ['valuation', 'avm', 'value'])
      || get(rec, ['estimatedValue'])
      || get(rec, ['propertyValue'])
      || get(rec, ['marketValue'])
      || get(rec, ['property', 'avm', 'amount', 'value'])
      || get(rec, ['property', 'avm', 'value'])
      || get(rec, ['property', 'valuation', 'avm', 'value']);
    const mortgageBalance = get(rec, ['mortgageBalance'])
      || get(rec, ['mortgage', 'balance'])
      || get(rec, ['mortgage', 'currentBalance'])
      || get(rec, ['liens', 'totalBalance'])
      || get(rec, ['property', 'mortgage', 'balance'])
      || get(rec, ['property', 'mortgage', 'currentBalance'])
      || get(rec, ['property', 'liens', 'totalBalance']);

    const absenteeInd = get(rec, ['absenteeInd']) || get(rec, ['property', 'absenteeInd']);
    const yearBuilt = get(rec, ['yearBuilt']) || get(rec, ['property', 'yearBuilt']);
    const propertyType = get(rec, ['propertyType']) || get(rec, ['property', 'propertyType']);
    const assessedTotal = get(rec, ['assessedTotal']) || get(rec, ['property', 'assessedTotal']);
    const assessedValue = get(rec, ['assessedValue']) || get(rec, ['property', 'assessedValue']);
    const marketValue = get(rec, ['marketValue']) || get(rec, ['property', 'marketValue']);
    const vintageLastModified = get(rec, ['vintage', 'lastModified']) || get(rec, ['property', 'vintage', 'lastModified']);

    return {
      ...addr,
      lastSaleDate: saleDate || null,
      lastSalePrice: salePrice || null,
      avm: avm || null,
      mortgageBalance: mortgageBalance || null,
      distressFlags,
      absenteeInd: absenteeInd ?? undefined,
      yearBuilt: parseMaybeYear(yearBuilt) || undefined,
      propertyType: propertyType || undefined,
      assessedTotal: assessedTotal || undefined,
      assessedValue: assessedValue || undefined,
      marketValue: marketValue || undefined,
      vintageLastModified: vintageLastModified || undefined,
    };
  }

  // Helper to fetch paginated results for a given endpoint factory and extractor
  async function fetchAllPages({
    makeUrl,
    extractItems,
    label,
  }) {
    const all = [];
    let page = 1;
    let pagesFetched = 0;
    const maxPages = 200; // safety cap to avoid infinite loops
    while (page <= maxPages) {
      const url = makeUrl(page, PAGE_SIZE);
      const data = await fetchJSON(url, { method: 'GET' }, `${label} page ${page}`);
      const items = extractItems(data) || [];
      if (!Array.isArray(items) || items.length === 0) break;
      all.push(...items);
      pagesFetched++;
      if (items.length < PAGE_SIZE) break; // last page
      page++;
      await sleep(100); // gentle pacing
    }
    return { items: all, pagesFetched };
  }

  function pickOwnerFieldsFromSkiptrace(data) {
    if (!data) return { ownerNames: [], phones: [], emails: [] };

    const ownerNames = new Set();
    const phones = new Set();
    const emails = new Set();

    const maybePushName = (v) => {
      if (!v) return;
      const s = String(v).trim();
      if (s) ownerNames.add(s);
    };
    const maybePushPhone = (v) => {
      if (!v) return;
      const s = String(v).replace(/[^\d+]/g, '').trim();
      if (s) phones.add(s);
    };
    const maybePushEmail = (v) => {
      if (!v) return;
      const s = String(v).trim();
      if (s && /.+@.+\..+/.test(s)) emails.add(s);
    };

    // Common shapes
    const arraysToCheck = [
      data.owners,
      data.names,
      data.people,
      data.matches,
      data.results,
      data.contacts,
    ].filter(Boolean);

    for (const arr of arraysToCheck) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        maybePushName(item && (item.name || item.fullName || item.ownerName || item.firstName && item.lastName && `${item.firstName} ${item.lastName}`));
        // phones
        const ip = item && (item.phones || item.phoneNumbers || item.phone || item.contactPhones);
        if (Array.isArray(ip)) ip.forEach((p) => maybePushPhone(p.value || p.number || p.phone || p));
        else maybePushPhone(ip);
        // emails
        const ie = item && (item.emails || item.emailAddresses || item.email || item.contactEmails);
        if (Array.isArray(ie)) ie.forEach((e) => maybePushEmail(e.value || e.email || e));
        else maybePushEmail(ie);
      }
    }

    // Root-level direct fields
    maybePushName(data.owner || data.ownerName || data.name);
    const rp = data.phones || data.phoneNumbers;
    if (Array.isArray(rp)) rp.forEach((p) => maybePushPhone(p.value || p.number || p));
    const re = data.emails || data.emailAddresses;
    if (Array.isArray(re)) re.forEach((e) => maybePushEmail(e.value || e.email || e));

    return {
      ownerNames: Array.from(ownerNames),
      phones: Array.from(phones),
      emails: Array.from(emails),
    };
  }

  async function fetchZipData(zip) {
    // ATTOM by ZIP: /api/attom/property/zip?zip={zip}&page={n}&pageSize=50
    const { items: attomItems, pagesFetched: attomPages } = await fetchAllPages({
      makeUrl: (page, pageSize) => `${API_BASE}/api/attom/property/zip?zip=${encodeURIComponent(zip)}&page=${page}&pageSize=${pageSize}`,
      extractItems: (data) => Array.isArray(data?.properties) ? data.properties : (Array.isArray(data) ? data : []),
      label: `ATTOM zip ${zip}`,
    });

    // Unified search (fallback-aware): prefer /api/search?zip=..., otherwise /api/zip-search-new/search?zipCode=...&limit=...&offset=...
    let unifiedItems = [];
    let unifiedPages = 0;
    const firstTry = await fetchAllPages({
      makeUrl: (page, pageSize) => `${API_BASE}/api/search?zip=${encodeURIComponent(zip)}&page=${page}&pageSize=${pageSize}`,
      extractItems: (data) => Array.isArray(data?.leads) ? data.leads : (Array.isArray(data) ? data : []),
      label: `Unified search zip ${zip}`,
    });
    if (firstTry.items.length > 0) {
      unifiedItems = firstTry.items;
      unifiedPages = firstTry.pagesFetched;
    } else {
      const fallback = await fetchAllPages({
        makeUrl: (page, pageSize) => `${API_BASE}/api/zip-search-new/search?zipCode=${encodeURIComponent(zip)}&limit=${pageSize}&offset=${(page - 1) * pageSize}`,
        extractItems: (data) => Array.isArray(data?.leads) ? data.leads : (Array.isArray(data) ? data : []),
        label: `Unified search (fallback) zip ${zip}`,
      });
      unifiedItems = fallback.items;
      unifiedPages = fallback.pagesFetched;
    }

    const map = new Map();
    for (const rec of attomItems) {
      const ex = extractFromAttomRecord(rec);
      if (!ex.address || !ex.city || !ex.state) continue; // must have basics
      const key = propertyKey(ex);
      const prev = map.get(key) || {};
      map.set(key, mergeProperty(prev, ex));
    }
    for (const rec of unifiedItems) {
      const exBase = extractFromUnifiedSearchRecord(rec);
      // unified search uses propertyAddress and may include city/state separately in some shapes
      const address = rec.propertyAddress || exBase.address;
      const city = rec.city || exBase.city;
      const state = rec.state || exBase.state;
      const ex = { ...exBase, address, city, state };
      if (!ex.address || !ex.city || !ex.state) continue;
      const key = propertyKey(ex);
      const prev = map.get(key) || {};
      map.set(key, mergeProperty(prev, ex));
    }

    const results = Array.from(map.values()).map((p) => ({ ...p, zipCode: p.zipCode || zip }));
    return { results, pages: { attom: attomPages, unified: unifiedPages } };
  }

  // Scoring logic
  function isValidPhone(s) {
    if (!s) return false;
    const digits = String(s).replace(/\D/g, '');
    return digits.length >= 7; // lenient validity
  }

  function isValidEmail(s) {
    if (!s) return false;
    return /.+@.+\..+/.test(String(s));
  }

  function numify(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }

  function scoreLead(p, { includeContacts = true } = {}) {
    let score = 0;

    // 1) Distress signals (cap at +70)
    const flags = (Array.isArray(p.distressFlags) ? p.distressFlags : []).map(f => String(f).toLowerCase());
    let distress = 0;
    if (flags.includes('foreclosure') || flags.includes('preforeclosure') || flags.includes('auction') || flags.includes('bankowned') || flags.includes('bank_owned') || flags.includes('bankowned')) distress += 40;
    if (flags.includes('vacancy') || flags.includes('vacant')) distress += 30;
    if (flags.includes('tax-delinquent') || flags.includes('taxdelinquent') || flags.includes('tax_delinquent')) distress += 25;
    if (p.absenteeInd) distress += 10; // proxy distress
    score += Math.min(distress, 70);

    // 2) Ownership tenure
    const yrs = yearsBetween(parseDate(p.lastSaleDate));
    if (typeof yrs === 'number') {
      if (yrs > 20) score += 25;
      else if (yrs >= 11) score += 15;
      else if (yrs >= 5) score += 5;
    } else {
      // Fallbacks when lastSaleDate missing
      const yb = parseMaybeYear(p.yearBuilt);
      const typeStr = (p.propertyType || '').toString().toUpperCase();
      const isSFR = /SFR|SINGLE/.test(typeStr);
      if (yb && isSFR) {
        const age = (new Date().getFullYear()) - yb;
        if (age >= 40) score += 10;
      } else if (p.vintageLastModified) {
        const lm = parseDate(p.vintageLastModified);
        if (lm) {
          const yrsSince = yearsBetween(lm);
          if (yrsSince >= 10) score += 5;
        }
      }
    }

    // 3) Equity & value
    let avmNum = numify(p.avm);
    const mbNum = Number.isFinite(numify(p.mortgageBalance)) ? numify(p.mortgageBalance) : (Number.isFinite(numify(p.openLienBalance)) ? numify(p.openLienBalance) : (Number.isFinite(numify(p.currentLoanBalance)) ? numify(p.currentLoanBalance) : NaN));
    let usedProxy = false;
    if (!Number.isFinite(avmNum)) {
      const assessedTotal = numify(p.assessedTotal);
      const assessedValue = numify(p.assessedValue);
      const marketValue = numify(p.marketValue);
      if (Number.isFinite(assessedTotal)) { avmNum = assessedTotal * 1.2; usedProxy = true; }
      else if (Number.isFinite(assessedValue)) { avmNum = assessedValue * 1.2; usedProxy = true; }
      else if (Number.isFinite(marketValue)) { avmNum = marketValue; usedProxy = true; }
    }
    if (Number.isFinite(avmNum)) {
      const lowMortgage = !Number.isFinite(mbNum) || mbNum <= (0.3 * avmNum);
      if (lowMortgage) score += 20;
      if (avmNum < 250000) score += 15;
      else if (avmNum <= 500000) score += 10;
      else score += 5;
    }

    // 4) Sale history
    if (typeof yrs === 'number') {
      if (yrs > 20) score += 15;
      else if (yrs >= 10) score += 10;
    }

    // 5) Contactability (cap at +25)
    if (includeContacts) {
      let contact = 0;
      const phones = Array.isArray(p.phones) ? p.phones.filter(Boolean) : [];
      const validPhones = phones.filter(isValidPhone);
      if (validPhones.length >= 1) contact += 15;
      if (validPhones.length >= 2) contact += 5;
      const emails = Array.isArray(p.emails) ? p.emails.filter(isValidEmail) : [];
      if (emails.length >= 1) contact += 5;
      // Include owner names presence within the same cap
      const names = Array.isArray(p.ownerNames) ? p.ownerNames.filter(Boolean) : [];
      if (names.length > 0) contact += 5;
      score += Math.min(contact, 25);
    }

    return score;
  }

  function rankLeads(list, { includeContacts = true } = {}) {
    for (const p of list) {
      p.score = scoreLead(p, { includeContacts });
    }
    return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // Stage 1.5: Enrichment helpers
  async function fetchAttomDetailAny(attomId) {
    if (!attomId) return null;
    // Try detail endpoint first (as requested), then fallback to legacy detail and valuation
    const endpoints = [
      `${API_BASE}/api/attom/property/${encodeURIComponent(attomId)}/detail`,
      `${API_BASE}/api/attom/property/${encodeURIComponent(attomId)}`,
      `${API_BASE}/api/attom/property/${encodeURIComponent(attomId)}/valuation`,
    ];
    for (const url of endpoints) {
      const data = await fetchJSON(url, { method: 'GET' }, `ATTOM detail for ${attomId}`);
      if (data) return data;
    }
    return null;
  }

  async function enrichWithAttomDetail(p) {
    const attomId = p.attomId;
    if (!attomId) return { enriched: false };
    const had = {
      avm: Boolean(p.avm),
      lastSaleDate: Boolean(p.lastSaleDate),
      mortgageBalance: Boolean(p.mortgageBalance),
      distress: Array.isArray(p.distressFlags) && p.distressFlags.length > 0,
      absentee: Boolean(p.absenteeInd),
    };
    const res = await fetchAttomDetailAny(attomId);
    if (!res) return { enriched: false };

    // Normalize the record from various response shapes
    const rec = res.property || res.valuation || res.properties?.[0] || res;
    if (!rec || typeof rec !== 'object') return { enriched: false };

    const extracted = extractFromAttomRecord(rec);
    const before = { ...p };
    const merged = mergeProperty(p, extracted);
    // mutate original object
    Object.assign(p, merged);

    const now = {
      avm: Boolean(p.avm),
      lastSaleDate: Boolean(p.lastSaleDate),
      mortgageBalance: Boolean(p.mortgageBalance),
      distress: Array.isArray(p.distressFlags) && p.distressFlags.length > 0,
      absentee: Boolean(p.absenteeInd),
    };
    return {
      enriched: true,
      filled: {
        avm: !had.avm && now.avm,
        lastSaleDate: !had.lastSaleDate && now.lastSaleDate,
        mortgageBalance: !had.mortgageBalance && now.mortgageBalance,
        distress: !had.distress && now.distress,
        absentee: !had.absentee && now.absentee,
      }
    };
  }

  function jitter(ms) { return Math.floor(Math.random() * ms); }
  function shouldRetry(errOrStatus) {
    if (!errOrStatus) return false;
    if (typeof errOrStatus === 'number') return errOrStatus === 429 || errOrStatus >= 500;
    const msg = (errOrStatus.message || String(errOrStatus || '')).toLowerCase();
    return msg.includes('timeout') || msg.includes('network') || msg.includes('ecconnreset') || msg.includes('econnrefused');
  }

  async function skipTraceProperty(p) {
    // Integrated server flow: create a lead, then skiptrace by ID
    const addrStr = [p.address, p.city, p.state, p.zipCode].filter(Boolean).join(', ');
    // Use requestRaw so we can handle 400 duplicate with existingId
    let createRaw = null;
    for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
      createRaw = await requestRaw(
        `${API_BASE}/api/zip-search-new/add-lead`,
        {
          method: 'POST',
          body: {
            address: addrStr,
            owner_name: null,
            phone: null,
            email: null,
            estimated_value: p.avm || null,
            equity: null,
            motivation_score: 50,
            temperature_tag: 'WARM',
            source_type: 'attom',
            is_probate: false,
            is_vacant: false,
            condition_score: null,
            notes: null,
            status: 'NEW',
            attom_id: p.attomId || null,
          },
        }
      );
      if (!createRaw || shouldRetry(createRaw.status)) {
        if (attempt < RETRY_MAX) await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt - 1) + jitter(250));
        continue;
      }
      break;
    }

    let leadId = null;
    if (createRaw && createRaw.status >= 200 && createRaw.status < 300) {
      const cr = createRaw.data || {};
      leadId = cr.leadId || cr.id || null;
    } else if (createRaw && createRaw.status === 400) {
      const msg = createRaw.data || {};
      if (msg && msg.existingId) {
        leadId = msg.existingId;
      }
    }
    if (!leadId) {
      // Fall back: search existing lead by address
      const searchRes = await fetchJSON(
        `${API_BASE}/api/zip-search-new/search?query=${encodeURIComponent(addrStr)}&limit=5`,
        { method: 'GET' },
        `Lookup existing lead by address ${p.address}`
      );
      const existing = Array.isArray(searchRes?.leads) ? searchRes.leads.find(l => {
        const pa = (l.propertyAddress || '').trim().toUpperCase();
        return pa === addrStr.trim().toUpperCase();
      }) : null;
      leadId = existing ? existing.id : null;
      if (!leadId) return { ownerNames: [], phones: [], emails: [] };
    }

    let stRes = null;
    for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
      stRes = await fetchJSON(
        `${API_BASE}/api/leads/${encodeURIComponent(leadId)}/skiptrace`,
        { method: 'POST', body: JSON.stringify({}) },
        `Skip-trace lead ${leadId}`
      );
      if (!stRes) {
        if (attempt < RETRY_MAX) await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt - 1) + jitter(250));
        continue;
      }
      break;
    }

    // Normalize output to simple string arrays using robust picker
    const payload = stRes && (stRes.data || stRes);
    const picked = pickOwnerFieldsFromSkiptrace(payload || {});
    return picked;
  }

  function toOutputRow(p) {
    const yearsOwned = yearsBetween(parseDate(p.lastSaleDate));
    const flags = Array.isArray(p.distressFlags) && p.distressFlags.length > 0 ? p.distressFlags : '';

    // Prepare phones/emails: take first 3, pad with blanks
    const phones = Array.isArray(p.phones) ? p.phones.filter(Boolean).slice(0, 3) : [];
    while (phones.length < 3) phones.push('');
    const emails = Array.isArray(p.emails) ? p.emails.filter(Boolean).slice(0, 3) : [];
    while (emails.length < 3) emails.push('');

    const ownerNamesVal = Array.isArray(p.ownerNames) && p.ownerNames.length ? p.ownerNames : '';

    return [
      p.zipCode,
      p.address,
      p.city,
      p.state,
      ownerNamesVal,
      phones[0],
      phones[1],
      phones[2],
      emails[0],
      emails[1],
      emails[2],
      p.lastSaleDate,
      p.lastSalePrice,
      p.avm,
      p.mortgageBalance,
      yearsOwned,
      flags,
      p.score ?? 0,
    ];
  }

  async function main() {
    console.log('Starting Lead Harvest for South NJ...');
    console.log('ZIPs:', ZIP_CODES.join(', '));

    const runZip = limitConcurrency(ZIP_CONCURRENCY);
    const allProps = [];
    let totalPagesFetched = 0;
    let totalFetchedBeforeDedupe = 0;

    // Fetch property lists per ZIP with limited concurrency
    await Promise.all(
      ZIP_CODES.map((zip, idx) =>
        runZip(async () => {
          console.log(`[${idx + 1}/${ZIP_CODES.length}] Fetching properties for ZIP ${zip}...`);
          const { results, pages } = await fetchZipData(zip);
          const countBeforeDedupe = results.length;
          totalFetchedBeforeDedupe += countBeforeDedupe;
          const pagesCount = (pages.attom || 0) + (pages.unified || 0);
          totalPagesFetched += pagesCount;

          // Deduplicate within this ZIP before pushing to global (to reduce memory churn)
          const zipMap = new Map();
          for (const p of results) {
            const key = propertyKey(p);
            const prev = zipMap.get(key);
            zipMap.set(key, prev ? mergeProperty(prev, p) : p);
          }
          const zipUnique = Array.from(zipMap.values());
          console.log(`ZIP ${zip}: fetched ${countBeforeDedupe} properties across ${pagesCount} pages; unique ${zipUnique.length}`);
          allProps.push(...zipUnique);
          // small delay to be polite
          await sleep(300);
        })
      )
    );

    // Deduplicate across zips
    const dedupMap = new Map();
    for (const p of allProps) {
      const key = propertyKey(p);
      const prev = dedupMap.get(key);
      dedupMap.set(key, prev ? mergeProperty(prev, p) : p);
    }
    const uniqueProps = Array.from(dedupMap.values());
  console.log(`Total fetched across all ZIPs before dedupe: ${totalFetchedBeforeDedupe} (pages: ${totalPagesFetched})`);
  console.log(`Total unique properties across all ZIPs: ${uniqueProps.length}`);

    // Stage 1: Preliminary ranking without contacts
    rankLeads(uniqueProps, { includeContacts: false });

    // Stage 1.5: ATTOM detail enrichment for top prelim leads
    const ENRICH_LIMIT = Number.isFinite(parseInt(process.env.ENRICH_LIMIT, 10))
      ? parseInt(process.env.ENRICH_LIMIT, 10)
      : 500;
    const prelimForEnrichment = uniqueProps.slice(0, Math.min(ENRICH_LIMIT, uniqueProps.length));
    const candidates = prelimForEnrichment.filter((p) => p.attomId && (!p.avm || !p.lastSaleDate || !p.mortgageBalance || !(Array.isArray(p.distressFlags) && p.distressFlags.length > 0)));
    if (candidates.length > 0) {
      console.log(`Stage 1.5: Enriching ${candidates.length}/${prelimForEnrichment.length} top prelim leads with ATTOM detail (ENRICH_LIMIT=${ENRICH_LIMIT})...`);
      const runEnrich = limitConcurrency(3);
      let done = 0;
      let stats = { avm: 0, lastSaleDate: 0, mortgageBalance: 0, distress: 0, absentee: 0 };
      await Promise.all(
        candidates.map((p) =>
          runEnrich(async () => {
            const r = await enrichWithAttomDetail(p);
            if (r && r.enriched && r.filled) {
              if (r.filled.avm) stats.avm++;
              if (r.filled.lastSaleDate) stats.lastSaleDate++;
              if (r.filled.mortgageBalance) stats.mortgageBalance++;
              if (r.filled.distress) stats.distress++;
              if (r.filled.absentee) stats.absentee++;
            }
            done++;
            if (done % 25 === 0 || done === candidates.length) {
              console.log(`  Enriched ${done}/${candidates.length} with ATTOM detail...`);
            }
          })
        )
      );
      console.log(`Enriched ${candidates.length}/${prelimForEnrichment.length} with ATTOM detail. Filled -> AVM: +${stats.avm}, LastSaleDate: +${stats.lastSaleDate}, MortgageBalance: +${stats.mortgageBalance}, Distress: +${stats.distress}, Absentee: +${stats.absentee}`);
      // Re-rank after enrichment (still without contacts)
      rankLeads(uniqueProps, { includeContacts: false });
    } else {
      console.log(`Stage 1.5: No candidates needed enrichment (ENRICH_LIMIT=${ENRICH_LIMIT}).`);
    }

    // Select prelimTop AFTER enrichment ranking using MIN/MAX constraints
    const MIN_LEADS = parseMinLeads();
    const MAX_LEADS = parseMaxLeads();
    if (MIN_LEADS > MAX_LEADS) {
      console.warn(`WARN: MIN_LEADS (${MIN_LEADS}) is greater than MAX_LEADS (${MAX_LEADS}); selection will be capped at MAX_LEADS.`);
    }
    const available = uniqueProps.length;
    let selectedCount;
    if (available < MIN_LEADS) {
      console.warn(`WARN: Only ${available} properties available after dedupe and scoring; below MIN_LEADS ${MIN_LEADS}. Selecting all available.`);
      selectedCount = available;
    } else {
      selectedCount = Math.max(MIN_LEADS, Math.min(MAX_LEADS, available));
    }
    const prelimTop = uniqueProps.slice(0, selectedCount);
    console.log(`Scored ${available} unique properties across ${ZIP_CODES.length} ZIPs; selected ${prelimTop.length} for skip-trace (min=${MIN_LEADS}, max=${MAX_LEADS}).`);

    // Stage 2: Skip-trace only the prelimTop
    const runSkip = limitConcurrency(SKIPTRACE_CONCURRENCY);
    let processed = 0;
    await Promise.all(
      prelimTop.map((p) =>
        runSkip(async () => {
          const st = await skipTraceProperty(p);
          p.ownerNames = st.ownerNames;
          p.phones = st.phones;
          p.emails = st.emails;
          processed++;
          if (processed % 25 === 0) console.log(`Skip-trace progress: ${processed}/${prelimTop.length}`);
          await sleep(50);
        })
      )
    );

    // Rank enriched set including contacts
    rankLeads(prelimTop, { includeContacts: true });

    // Optionally filter by MIN_SCORE for export, but only within enriched set
    const minScore = process.env.MIN_SCORE ? parseInt(process.env.MIN_SCORE, 10) : null;
    const exportList = Number.isFinite(minScore) ? prelimTop.filter(p => (p.score || 0) >= minScore) : prelimTop;

    // Prepare CSV
    const headers = [
      'Zip',
      'Address',
      'City',
      'State',
      'Owner Names',
      'Phone1',
      'Phone2',
      'Phone3',
      'Email1',
      'Email2',
      'Email3',
      'Last Sale Date',
      'Last Sale Price',
      'AVM',
      'Mortgage Balance',
      'Years Owned',
      'Distress Flags',
      'Score',
    ];
    const csvRows = [toCSVRow(headers)];
    for (const p of exportList) {
      csvRows.push(toCSVRow(toOutputRow(p)));
    }

    const outPath = path.resolve(__dirname, '..', 'LeadDump_SouthNJ.csv');
    fs.writeFileSync(outPath, csvRows.join('\n'), 'utf8');
    if (Number.isFinite(minScore)) {
      console.log(`\nSaved ${exportList.length} rows (filtered by MIN_SCORE=${minScore}) out of ${prelimTop.length} enriched, from ${uniqueProps.length} total fetched, to ${outPath}`);
    } else {
      console.log(`\nSaved ${exportList.length} rows (top ${prelimTop.length} enriched, from ${uniqueProps.length} total fetched) to ${outPath}`);
    }

    // Print first 10 rows as preview
  console.log(`\nPreview (first ${PREVIEW_ROWS} rows):`);
  const preview = csvRows.slice(0, Math.min(1 + PREVIEW_ROWS, csvRows.length)); // include header + first N
    for (const line of preview) console.log(line);

    // Console summary: Top 10 and score distribution
    console.log('\nTop 10 leads (enriched):');
    const top10 = prelimTop.slice(0, 10);
    for (const p of top10) {
      const phones = Array.isArray(p.phones) ? p.phones.filter(Boolean).slice(0, 3).join('; ') : '';
      const emails = Array.isArray(p.emails) ? p.emails.filter(Boolean).slice(0, 3).join('; ') : '';
      const flagsStr = Array.isArray(p.distressFlags) && p.distressFlags.length ? p.distressFlags.join('|') : '';
      console.log(`- ${p.address || ''}, ${p.city || ''}, ${p.state || ''} | Phones: ${phones} | Emails: ${emails} | LastSale: ${p.lastSaleDate || ''} | AVM: ${p.avm || ''} | Distress: ${flagsStr} | Score: ${p.score ?? 0}`);
    }
    const dist = { gte90: 0, r70_89: 0, r50_69: 0, lt50: 0 };
    for (const p of prelimTop) {
      const s = p.score || 0;
      if (s >= 90) dist.gte90++;
      else if (s >= 70) dist.r70_89++;
      else if (s >= 50) dist.r50_69++;
      else dist.lt50++;
    }
    console.log('Distribution of scores:');
    console.log(`  90+: ${dist.gte90}`);
    console.log(`  70–89: ${dist.r70_89}`);
    console.log(`  50–69: ${dist.r50_69}`);
    console.log(`  <50: ${dist.lt50}`);

    // Stage summaries
    const pagesSummary = typeof totalPagesFetched === 'number' ? ` (pages: ${totalPagesFetched})` : '';
    console.log(`\nSummary: Total properties fetched: ${totalFetchedBeforeDedupe}${pagesSummary}. Enriched: ${prelimTop.length}. Exported: ${exportList.length}.`);

    console.log('\nDone.');
  }

  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
})();
