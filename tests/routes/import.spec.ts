import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const TEST_PORT = 5059;
const BASE = `http://127.0.0.1:${TEST_PORT}`;
// supertest types don't nicely cover string-base overloads; cast to any for URL usage
const req: any = (supertest as any)(BASE);
const serverPath = path.resolve('backend', 'integrated-server.js');
let child: any;
const tmpDb = path.join(os.tmpdir(), `convexa_test_${Date.now()}.db`);

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Server did not become healthy in time');
}

beforeAll(async () => {
  // Ensure any previous file removed
  try { fs.unlinkSync(tmpDb); } catch {}
  child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(TEST_PORT), SQLITE_DB_PATH: tmpDb, BASIC_AUTH_USER: '', BASIC_AUTH_PASS: '' },
    stdio: 'inherit'
  });
  await waitForHealth();
});

afterAll(async () => {
  try { child.kill(); } catch {}
  try { fs.unlinkSync(tmpDb); } catch {}
});

describe('CSV Import route', () => {
  it('400 when empty (no file)', async () => {
  const agent = supertest.agent(BASE);
  const res = await req.post('/admin/import/csv?mode=preview');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('415 wrong content-type (not csv)', async () => {
    const res = await req
      .post('/admin/import/csv?mode=preview')
      .attach('file', Buffer.from('not a csv'), { filename: 'file.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('unsupported_media_type');
  });

  it('413 when >10MB', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 'a');
    const res = await req
      .post('/admin/import/csv?mode=preview')
      .attach('file', big, { filename: 'big.csv', contentType: 'text/csv' });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('payload_too_large');
  });

  it('happy path: preview then commit writes audit and increments metrics', async () => {
    const csv = 'address,owner_name\n123 Main St,John Doe\n123 Main St,John Doe\n';
    const prev = await req
      .post('/admin/import/csv?mode=preview')
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });
    expect(prev.status).toBe(200);
    expect(prev.body.ok).toBe(true);
    expect(prev.body.preview.would_create).toBe(1);
    expect(prev.body.preview.would_skip).toBe(1);

    const commit = await req
      .post('/admin/import/csv?mode=commit')
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });
    expect(commit.status).toBe(200);
    expect(commit.body.ok).toBe(true);
    expect(commit.body.created).toBe(1);
    expect(commit.body.skipped).toBe(1);
    expect(commit.body.merged).toBeTypeOf('number');
    expect(commit.body.artifact && commit.body.artifact.auditUrl).toBeTruthy();

    // Fetch audit
    const auditUrl: string = commit.body.artifact.auditUrl;
    const audit = await fetch(`${BASE}${auditUrl}`);
    expect(audit.ok).toBe(true);

    // Check metrics
    const metrics = await fetch(`${BASE}/metrics`).then(r => r.text());
    expect(metrics).toContain('convexa_import_rows_total');
    expect(metrics).toMatch(/convexa_import_rows_total\{result="created"} .*\n/);
    expect(metrics).toMatch(/convexa_import_rows_total\{result="skipped"} .*\n/);
  });
});
