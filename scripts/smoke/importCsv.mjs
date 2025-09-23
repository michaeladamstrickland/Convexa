import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';

async function main() {
  const base = process.argv[2] || process.env.STAGING_URL || 'http://localhost:5001';
  const user = process.env.BASIC_AUTH_USER || '';
  const pass = process.env.BASIC_AUTH_PASS || '';
  const auth = user && pass ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') : '';
  const samplePath = path.resolve(process.cwd(), 'ops', 'samples', 'import_sample.csv');
  const csv = fs.readFileSync(samplePath);

  // helper to post multipart
  async function postMultipart(url, buf) {
    const boundary = '----convexaimport' + Math.random().toString(16).slice(2);
    const bodyParts = [];
    bodyParts.push(`--${boundary}\r\n`);
    bodyParts.push('Content-Disposition: form-data; name="file"; filename="import_sample.csv"\r\n');
    bodyParts.push('Content-Type: text/csv\r\n\r\n');
    bodyParts.push(buf);
    bodyParts.push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(bodyParts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, ...(auth ? { Authorization: auth } : {}) },
      body
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('Non-JSON response: ' + text); }
    return { status: res.status, json };
  }

  // Preview
  const prev = await postMultipart(`${base}/admin/import/csv?mode=preview`, csv);
  console.log('Preview status:', prev.status, 'body:', prev.json);
  if (prev.status !== 200 || !prev.json.ok) throw new Error('Preview failed');

  // Commit
  const com = await postMultipart(`${base}/admin/import/csv?mode=commit`, csv);
  console.log('Commit status:', com.status, 'body:', com.json);
  if (com.status !== 200 || !com.json.ok || !com.json.artifact || !com.json.artifact.auditUrl) throw new Error('Commit failed');

  // Fetch audit
  const aud = await fetch(`${base}${com.json.artifact.auditUrl}`, { headers: auth ? { Authorization: auth } : {} });
  const audText = await aud.text();
  try { JSON.parse(audText); } catch { throw new Error('Audit not JSON: ' + audText); }

  console.log('SMOKE IMPORT OK');
}

main().catch((e) => { console.error('SMOKE IMPORT FAILED', e); process.exit(1); });
