#!/usr/bin/env node
/* Golden Precheck for BatchData: posts two payloads and reports status + body prefix.
   - Reads backend/.env for BATCHDATA_* vars
   - Uses HTTPS core module; no external deps
*/
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ENV_PATH = path.resolve(__dirname, '..', 'backend', '.env');
function readEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}

function joinUrl(base, p) {
  const b = String(base || '').replace(/\/$/, '');
  const s = String(p || '');
  const seg = s.startsWith('/') ? s : ('/' + s);
  return b + seg;
}

function postJson(urlStr, bodyObj, headers) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const data = JSON.stringify(bodyObj || {});
      const opts = {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        protocol: u.protocol,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }, headers || {})
      };
      const req = https.request(opts, (res) => {
        let chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode || 0, bodyPrefix: buf.toString('utf8').slice(0, 20) });
        });
      });
      req.on('error', (err) => resolve({ error: String(err && err.message || err) }));
      req.setTimeout(15000, () => {
        req.destroy(new Error('Timeout'));
      });
      req.write(data);
      req.end();
    } catch (e) {
      resolve({ error: String(e && e.message || e) });
    }
  });
}

(async () => {
  const env = readEnv(ENV_PATH);
  const base = env.BATCHDATA_BASE_URL;
  const pathp = env.BATCHDATA_SKIPTRACE_PATH;
  const authStyle = String(env.BATCHDATA_AUTH_STYLE || 'bearer').toLowerCase();
  const token = env.BATCHDATA_API_KEY;
  const url = joinUrl(base, pathp);

  const hdrBearer = { 'Authorization': `Bearer ${token}` };
  const hdrXApi = { 'X-API-KEY': token };
  const useHdr = authStyle === 'x-api-key' ? hdrXApi : hdrBearer;

  const payloadA = { requests: [{ propertyAddress: { street: '921 Park Pl', city: 'Ocean City', state: 'NJ', zip: '08226' } }] };
  const payloadB = { requests: [{ propertyAddress: { street: '921 Park Pl', city: 'Ocean City', state: 'NJ', zip: '08226' }, name: { first: 'Christine', last: 'Tomei' } }] };

  // A
  const A = await postJson(url, payloadA, useHdr);
  if (A.error) console.log('A_ERROR:', A.error); else console.log(`A_STATUS:${A.status} A_BODY_PREFIX:${(A.bodyPrefix||'').replace(/\n/g,' ')}`);
  // B
  const B = await postJson(url, payloadB, useHdr);
  if (B.error) console.log('B_ERROR:', B.error); else console.log(`B_STATUS:${B.status} B_BODY_PREFIX:${(B.bodyPrefix||'').replace(/\n/g,' ')}`);

  // 404 path fallbacks
  const needFallback = (!A.error && A.status === 404) && (!B.error && B.status === 404);
  if (needFallback) {
    const variants = [
      '/api/v1/property/skip-trace',
      '/v1/property/skip-trace',
      '/api/v1/skiptrace/property',
      '/v1/skiptrace/property',
      '/skiptrace/property'
    ];
    for (const p of variants) {
      const u = joinUrl(base, p);
      const R = await postJson(u, payloadB, useHdr);
      if (R.error) {
        console.log(`ALT_PATH_TEST: ${p} ERROR:${R.error}`);
      } else {
        console.log(`ALT_PATH_TEST: ${p} CODE:${R.status} PREFIX:${(R.bodyPrefix||'').replace(/\n/g,' ')}`);
        if (R.status === 200) {
          console.log(`WORKING_PATH:${p}`);
          break;
        }
      }
    }
  }

  // 401/403 flip auth
  const needFlip = (!A.error && (A.status === 401 || A.status === 403)) || (!B.error && (B.status === 401 || B.status === 403));
  if (needFlip) {
    const hdr2 = (authStyle === 'x-api-key') ? hdrBearer : hdrXApi;
    const A2 = await postJson(url, payloadA, hdr2);
    if (A2.error) console.log('A_XAPI_ERROR:', A2.error); else console.log(`A_XAPI_STATUS:${A2.status} A_XAPI_BODY_PREFIX:${(A2.bodyPrefix||'').replace(/\n/g,' ')}`);
    const B2 = await postJson(url, payloadB, hdr2);
    if (B2.error) console.log('B_XAPI_ERROR:', B2.error); else console.log(`B_XAPI_STATUS:${B2.status} B_XAPI_BODY_PREFIX:${(B2.bodyPrefix||'').replace(/\n/g,' ')}`);
  }
})();
