/**
 * BatchData Skip Trace API Adapter
 * 
 * This service interfaces with the BatchData API to perform skip tracing
 * operations, enriching property leads with contact information.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { stubBatchDataV1 } from '../test/providerStub.js';

// Load environment variables
dotenv.config();

// API configuration (explicit, no guessing)
const BATCHDATA_BASE_URL = process.env.BATCHDATA_BASE_URL || process.env.BATCHDATA_API_URL || '';
const BATCHDATA_SKIPTRACE_PATH = process.env.BATCHDATA_SKIPTRACE_PATH || '';
const BATCHDATA_AUTH_STYLE = (process.env.BATCHDATA_AUTH_STYLE || '').toLowerCase();
const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY;

// Cost per skip trace request
const SKIP_TRACE_COST = 0.25; // Default cost per lookup

// Utility: mask secrets in debug snapshots
const maskHeaders = (h) => {
  if (!h) return h;
  const c = { ...h };
  if (c.Authorization) c.Authorization = '***';
  if (c['X-API-KEY']) c['X-API-KEY'] = '***';
  if (c['x-api-key']) c['x-api-key'] = '***';
  return c;
};

// Helper: derive first/last from ownerName without guessing beyond basic tokenization
function splitOwner(ownerName) {
  const raw = String(ownerName || '').trim();
  if (!raw) return { first: '', last: '' };
  const tokens = raw.split(/\s+/).filter(t => t && !/^(&|and)$/i.test(t));
  if (tokens.length === 1) return { first: tokens[0], last: '' };
  const last = tokens[tokens.length - 1];
  // Prefer the token immediately before last that isn't a connector as first name
  const first = tokens.slice(0, -1).pop() || tokens[0];
  return { first, last };
}

// BatchData API adapter
const batchDataAdapter = {
  /**
   * Skip trace a lead by owner name and property address
   * 
   * @param leadId - The ID of the lead to skip trace
   * @param ownerName - The property owner's name
   * @param address - The property address
   * @param city - The property city
   * @param state - The property state
   * @param zipCode - The property ZIP code
   * @returns Skip trace result with contact information
   */
  skipTraceLead: async (
    leadId,
    ownerName,
    address,
    city,
    state,
    zipCode
  ) => {
    // Optional zero-cost stub mode for testing
    if (String(process.env.PROVIDER_STUB || '').toLowerCase() === 'true') {
      try {
        // Support failure-rate and latency for breaker smoke tests
        const failRate = Math.max(0, Math.min(100, Number(process.env.PROVIDER_STUB_FAIL_PCT || 0)));
        const latencyMs = Math.max(0, Number(process.env.PROVIDER_STUB_LATENCY_MS || 0));
        if (latencyMs) {
          await new Promise(r => setTimeout(r, latencyMs));
        }
        // Random failure based on failRate
        if (failRate > 0 && Math.random() * 100 < failRate) {
          return {
            success: false,
            leadId,
            phones: [],
            emails: [],
            cost: 0,
            provider: 'batchdata',
            error: 'Stubbed failure',
            requestId: 'stubbed-fail',
            _debug: {
              request: { url: 'stub://batchdata', payload: { leadId, ownerName, address, city, state, zipCode } },
              response: { status: 500, error: 'stubbed failure' }
            }
          };
        }
        const data = stubBatchDataV1();
        // Parse like the 200 branch below
        let phones = [];
        let emails = [];
        let matchCount = 0;
        let personsCount;
        const person = data?.results?.persons?.[0] || null;
        if (person) {
          personsCount = Array.isArray(data?.results?.persons) ? data.results.persons.length : undefined;
          phones = (person.phones || person.phoneNumbers || []).map((phone, idx) => ({
            number: phone.number || phone.phone || phone.value,
            type: phone.type || phone.lineType || 'unknown',
            carrier: phone.carrier || undefined,
            tested: Boolean(phone.tested),
            reachable: Boolean(phone.reachable),
            isPrimary: idx === 0,
            isDoNotCall: Boolean(person?.dnc?.phone || person?.dnc?.overall || phone.dnc || false),
            confidence: Number(phone.score ?? phone.confidence ?? 0)
          }));
          emails = (person.emails || []).map((email, idx) => ({
            address: email.email || email.address || email.value,
            type: email.type || 'unknown',
            isPrimary: idx === 0,
            confidence: Number(email.score ?? email.confidence ?? 0)
          }));
          matchCount = Number(data?.results?.meta?.matchCount ?? (person ? 1 : 0));
        }
        return {
          success: true,
          leadId,
          phones,
          emails,
          cost: matchCount > 0 ? 0 : 0,
          provider: 'batchdata',
          requestId: 'stubbed',
          cached: false,
          _debug: {
            request: { url: 'stub://batchdata', payload: { leadId, ownerName, address, city, state, zipCode }, headers: { Authorization: '***' } },
            response: { status: 200, sample: data }
          }
        };
      } catch (e) {
        return { success: false, leadId, phones: [], emails: [], cost: 0, provider: 'batchdata', error: 'Stub failed: ' + (e?.message || e) };
      }
    }
    // Strict env validation
    if (!BATCHDATA_BASE_URL || !BATCHDATA_SKIPTRACE_PATH) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'batchdata',
        error: 'BatchData configuration incomplete: BATCHDATA_BASE_URL and BATCHDATA_SKIPTRACE_PATH are required'
      };
    }
    if (!BATCHDATA_API_KEY) {
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'batchdata',
        error: 'BatchData API key not configured'
      };
    }

    // Exact URL + payload + headers per contract
    const base = String(BATCHDATA_BASE_URL).replace(/\/$/, '');
    const path = String(BATCHDATA_SKIPTRACE_PATH).startsWith('/')
      ? BATCHDATA_SKIPTRACE_PATH
      : `/${BATCHDATA_SKIPTRACE_PATH}`;
    const url = `${base}${path}`;
    const { first, last } = splitOwner(ownerName);
    // Build payload depending on path hint (v1 batch vs v2 flat)
    const isV2 = /\/v2\//.test(path);
    let payload;
    if (isV2) {
      // Common v2 style (based on provider examples)
      payload = {
        street: address || '',
        city: city || '',
        state: state || '',
        zip: zipCode || '',
        owner_first: first || undefined,
        owner_last: last || undefined
      };
    } else {
      // v1 batch shape under `requests` with `propertyAddress`
      const single = {
        propertyAddress: {
          street: address || '',
          city: city || '',
          state: state || '',
          zip: zipCode || ''
        }
      };
      if (first || last) single.name = { first: first || '', last: last || '' };
      payload = { requests: [ single ] };
    }
    const headers = {
      'Content-Type': 'application/json',
      ...(BATCHDATA_AUTH_STYLE === 'x-api-key'
        ? { 'X-API-KEY': BATCHDATA_API_KEY }
        : { Authorization: `Bearer ${BATCHDATA_API_KEY}` })
    };

    // Hoist for debug
    let response = null;
    const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);
    try {
  response = await axios.post(url, payload, { headers, timeout: timeoutMs, validateStatus: () => true });

      if (response.status === 200 && response.data) {
        const data = response.data;
        // Detect v1 vs v2-like shapes and normalize
        let phones = [];
        let emails = [];
        let matchCount = 0;
        let personsCount;

        // v1 expected: data.results.persons[0]
        let person = data?.results?.persons?.[0] || null;
        if (person) {
          personsCount = Array.isArray(data?.results?.persons) ? data.results.persons.length : undefined;
          phones = (person.phones || person.phoneNumbers || []).map((phone, idx) => ({
            number: phone.number || phone.phone || phone.value,
            type: phone.type || phone.lineType || 'unknown',
            carrier: phone.carrier || undefined,
            tested: Boolean(phone.tested),
            reachable: Boolean(phone.reachable),
            isPrimary: idx === 0,
            isDoNotCall: Boolean(person?.dnc?.phone || person?.dnc?.overall || phone.dnc || false),
            confidence: Number(phone.score ?? phone.confidence ?? 0)
          }));
          emails = (person.emails || []).map((email, idx) => ({
            address: email.email || email.address || email.value,
            type: email.type || 'unknown',
            isPrimary: idx === 0,
            confidence: Number(email.score ?? email.confidence ?? 0)
          }));
          matchCount = Number(data?.results?.meta?.matchCount ?? (person ? 1 : 0));
        } else {
          // Try v2-like: top-level phones/emails or data.result(s)[0]
          const v2Root = Array.isArray(data?.results) ? data.results[0] : (data?.result || data);
          const v2Phones = v2Root?.phones || v2Root?.phoneNumbers || v2Root?.phone_numbers || [];
          const v2Emails = v2Root?.emails || v2Root?.emailAddresses || v2Root?.email_addresses || [];
          phones = (Array.isArray(v2Phones) ? v2Phones : []).map((phone, idx) => ({
            number: phone.number || phone.phone || phone.value,
            type: phone.type || phone.lineType || 'unknown',
            carrier: phone.carrier || undefined,
            tested: Boolean(phone.tested),
            reachable: Boolean(phone.reachable),
            isPrimary: idx === 0,
            isDoNotCall: Boolean(phone.dnc || phone.do_not_call || false),
            confidence: Number(phone.score ?? phone.confidence ?? 0)
          }));
          emails = (Array.isArray(v2Emails) ? v2Emails : []).map((email, idx) => ({
            address: email.email || email.address || email.value,
            type: email.type || 'unknown',
            isPrimary: idx === 0,
            confidence: Number(email.score ?? email.confidence ?? 0)
          }));
          personsCount = undefined;
          const mc1 = data?.meta?.matchCount ?? data?.results?.meta?.matchCount;
          matchCount = Number(mc1 ?? (phones.length || emails.length ? 1 : 0));
        }
        
        // Return the formatted skip trace result
        return {
          success: true,
          leadId,
          phones,
          emails,
          cost: matchCount > 0 ? 0.25 : 0, // Bill only matched results per provider note
          provider: 'batchdata',
          requestId: data.request_id,
          cached: false,
          _debug: {
            request: { url, payload, headers: maskHeaders(headers) },
            response: {
              status: response.status,
              keys: Object.keys(data || {}),
              hasResults: Boolean(data?.results || data?.result || data?.phones || data?.emails),
              personsCount,
              sample: Array.isArray(response.data) ? response.data.slice(0,1) : response.data
            }
          }
        };
      } else {
        // Handle API error, sanitize details; fail fast with precise reason
        const providerCode = response?.data?.error_code || response?.data?.code || null;
        const providerMsg = response?.data?.message || response?.data?.error || response?.statusText || 'Unknown error';
        const errText = `API ${response?.status ?? 'N/A'}${providerCode ? ` [${providerCode}]` : ''}: ${providerMsg}`;
        return {
          success: false,
          leadId,
          phones: [],
          emails: [],
          cost: 0,
          provider: 'batchdata',
          error: errText,
          requestId: response?.data?.request_id,
          _debug: {
            request: { url, payload, headers: maskHeaders(headers) },
            response: { status: response && response.status, data: response && response.data }
          }
        };
      }
    } catch (error) {
      // Handle exceptions (network/timeouts)
      const status = error.response?.status;
      const code = error.code || error.response?.data?.code;
      const msg = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        leadId,
        phones: [],
        emails: [],
        cost: 0,
        provider: 'batchdata',
        error: `Exception${status ? ` ${status}` : ''}${code ? ` [${code}]` : ''}: ${msg}`,
        requestId: error.response?.data?.request_id,
        _debug: {
          request: { url, payload, headers: maskHeaders(headers) },
          response: { status, data: error.response?.data }
        }
      };
    }
  }
};

export { batchDataAdapter as default };
