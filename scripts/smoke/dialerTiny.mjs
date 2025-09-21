// Tiny dialer smoke: start integrated server on a temp port, exercise /dial, /dial/:dialId/asr-complete, /metrics, and webhook signature 401
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpReq(base, method, pathName, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, base);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(data ? { 'content-length': String(data.length) } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json ?? buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const env = { ...process.env, PORT: '6035', SKIP_TRACE_DEMO_MODE: 'true', TWILIO_AUTH_TOKEN: 'x' };
  const node = process.execPath;
  const entry = path.resolve(process.cwd(), 'scripts', 'start-integrated.mjs');
  const child = spawn(node, [entry], { env });
  let base = '';
  child.stdout.on('data', (b) => {
    const s = b.toString();
    const m = s.match(/running on port (\d+)/i);
    if (m && !base) base = `http://localhost:${m[1]}`;
    process.stdout.write(`[server] ${s}`);
  });
  child.stderr.on('data', (b) => process.stderr.write(`[server-err] ${b}`));

  // Wait up to 8s for base
  for (let i = 0; i < 32 && !base; i++) await wait(250);
  if (!base) { console.error('Server did not start'); child.kill('SIGINT'); process.exit(1); }

  // Find a lead id
  const list = await httpReq(base, 'GET', '/leads?limit=1', null);
  if (list.status !== 200 || !list.body?.leads?.length) {
    console.error('No leads available for dialing');
    child.kill('SIGINT');
    process.exit(2);
  }
  const leadId = list.body.leads[0].id;

  // Dial
  const dial = await httpReq(base, 'POST', '/dial', { leadId, toNumber: '+15556667777', fromNumber: '+15551234567' });
  if (dial.status !== 200 || !dial.body?.dialId) {
    console.error('Dial failed', dial);
    child.kill('SIGINT');
    process.exit(3);
  }
  const dialId = dial.body.dialId;

  // ASR complete
  const asr = await httpReq(base, 'POST', `/dial/${dialId}/asr-complete`, { transcriptUrl: 'https://example.com/t.txt', words: 10, latencyMs: 120 });
  if (asr.status !== 200 || asr.body?.success !== true) {
    console.error('ASR complete failed', asr);
    child.kill('SIGINT');
    process.exit(4);
  }

  // Metrics
  const metrics = await httpReq(base, 'GET', '/metrics');
  if (metrics.status !== 200 || typeof metrics.body !== 'string') {
    console.error('Metrics not available', metrics.status);
    child.kill('SIGINT');
    process.exit(5);
  }
  const mtxt = metrics.body;
  if (!/dial_attempts_total{.*status="queued".*}\s+\d+/i.test(mtxt)) {
    console.error('dial_attempts_total not found');
    child.kill('SIGINT');
    process.exit(6);
  }

  // Twilio webhook with bogus signature should be 401 when token present
  const webhook = await httpReq(base, 'POST', '/twilio/recording-complete', {}, { 'content-type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': 'bogus' });
  if (webhook.status !== 401) {
    console.error('Expected webhook 401, got', webhook.status);
    child.kill('SIGINT');
    process.exit(7);
  }

  console.log('Smoke OK');
  child.kill('SIGINT');
}

main().catch((e) => { console.error(e); process.exit(11); });
