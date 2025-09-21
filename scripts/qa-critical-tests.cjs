/* Critical-path API Tests for Convexa
   Node 18+/20+ required (global fetch available)
   Writes JSON/text outputs to logs/qa and prints a summary JSON to stdout.
   Run: node scripts/qa-critical-tests.cjs
*/
const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'http://localhost:5001';
const OUTDIR = path.join(process.cwd(), 'logs', 'qa');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function saveJSON(name, obj) {
  const file = path.join(OUTDIR, name);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}
function saveText(name, text) {
  const file = path.join(OUTDIR, name);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}
async function req(method, urlPath, body, headers = {}) {
  const url = `${BASE}${urlPath}`;
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let status = 0, text = '', json = null;
  try {
    const res = await fetch(url, init);
    status = res.status;
    const ct = res.headers.get('content-type') || '';
    text = await res.text();
    if (ct.includes('application/json')) {
      try { json = JSON.parse(text); } catch { json = null; }
    }
    return { ok: res.ok, status, json, text };
  } catch (e) {
    return { ok: false, status, json: null, text: String(e && e.message ? e.message : e) };
  }
}

(async () => {
  ensureDir(OUTDIR);
  const summary = {
    base: BASE,
    timestamp: new Date().toISOString(),
    results: {}
  };

  // 0) Health check (optional)
  const h = await req('GET', '/health');
  summary.results.health = { status: h.status, ok: h.ok, body: h.json || h.text };
  saveJSON('00_health.json', summary.results.health);

  // 1) POST /api/skip-trace with address payload
  const addrPayload = { address: '123 Main St', city: 'Phoenix', state: 'AZ', zipCode: '85001' };
  const r1 = await req('POST', '/api/skip-trace', addrPayload);
  summary.results.skip_trace_address = { status: r1.status, ok: r1.ok, body: r1.json || r1.text };
  saveJSON('01_skip_trace_address.json', summary.results.skip_trace_address);

  // 2) POST /api/skip-trace invalid payload {}
  const r2 = await req('POST', '/api/skip-trace', {});
  summary.results.skip_trace_invalid = { status: r2.status, ok: r2.ok, body: r2.json || r2.text };
  saveJSON('02_skip_trace_invalid.json', summary.results.skip_trace_invalid);

  // 3) POST /api/skip-trace/bulk with leadIds (likely nonexistent)
  const r3 = await req('POST', '/api/skip-trace/bulk', { leadIds: ['nonexistent1', 'nonexistent2'] });
  summary.results.skip_trace_bulk_ids = { status: r3.status, ok: r3.ok, body: r3.json || r3.text };
  saveJSON('03_skip_trace_bulk_ids.json', summary.results.skip_trace_bulk_ids);

  // 4) POST /api/skip-trace/bulk with leads payload
  const r4 = await req('POST', '/api/skip-trace/bulk', {
    leads: [
      { address: '1 A St', city: 'Phoenix', state: 'AZ', zipCode: '85001' },
      { address: '2 B Ave', city: 'Tampa', state: 'FL', zipCode: '33601' }
    ]
  });
  summary.results.skip_trace_bulk_leads = { status: r4.status, ok: r4.ok, body: r4.json || r4.text };
  saveJSON('04_skip_trace_bulk_leads.json', summary.results.skip_trace_bulk_leads);

  // 5) GET /api/skip-trace/:leadId (using an unknown id)
  const r5 = await req('GET', '/api/skip-trace/unknown');
  summary.results.skip_trace_get_unknown = { status: r5.status, ok: r5.ok, body: r5.json || r5.text };
  saveJSON('05_skip_trace_get_unknown.json', summary.results.skip_trace_get_unknown);

  // 6) GET /api/skip-trace/metrics
  const r6 = await req('GET', '/api/skip-trace/metrics');
  summary.results.skip_trace_metrics = { status: r6.status, ok: r6.ok, body: r6.json || r6.text };
  saveJSON('06_skip_trace_metrics.json', summary.results.skip_trace_metrics);

  // 7) POST /api/calls/analyze with transcript only (OPENAI key assumed missing; should fallback gracefully)
  const r7 = await req('POST', '/api/calls/analyze', { transcript: "Hello, I'm not interested in selling today but maybe in the spring." });
  summary.results.calls_analyze_transcript_only = { status: r7.status, ok: r7.ok, body: r7.json || r7.text };
  saveJSON('07_calls_analyze_transcript_only.json', summary.results.calls_analyze_transcript_only);

  // 8) POST /api/calls/transcript (store a transcript for a callSid)
  const r8 = await req('POST', '/api/calls/transcript', {
    callSid: 'QA_TEST_1',
    transcript: 'Seller wants to wait 60-90 days; follow-up suggested.',
    text: 'Seller wants to wait 60-90 days; follow-up suggested.'
  });
  summary.results.calls_transcript_store = { status: r8.status, ok: r8.ok, body: r8.json || r8.text };
  saveJSON('08_calls_transcript_store.json', summary.results.calls_transcript_store);

  // 9) POST /api/calls/analyze with callSid (will succeed only if transcript storage is wired)
  const r9 = await req('POST', '/api/calls/analyze', { callSid: 'QA_TEST_1' });
  summary.results.calls_analyze_by_sid = { status: r9.status, ok: r9.ok, body: r9.json || r9.text };
  saveJSON('09_calls_analyze_by_sid.json', summary.results.calls_analyze_by_sid);

  // 10) GET /api/dev/metrics (Prometheus text)
  const r10 = await req('GET', '/api/dev/metrics');
  summary.results.dev_metrics = { status: r10.status, ok: r10.ok, contentType: 'text/plain', lines: (r10.text || '').split('\n').slice(0, 50) };
  saveText('10_dev_metrics.txt', r10.text || '');

  // Write final summary
  console.log(JSON.stringify(summary, null, 2));
  saveJSON('00_summary.json', summary);
})().catch(e => {
  const msg = (e && e.stack) ? e.stack : String(e);
  try {
    ensureDir(OUTDIR);
    saveText('z_script_error.txt', msg);
  } catch {}
  console.error(msg);
  process.exitCode = 1;
});
