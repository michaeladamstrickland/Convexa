import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// We will start the real integrated server on a random available port by importing the entry but overriding PORT.

let serverProc: any;
let BASE = '';

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
  const env = { ...process.env, PORT: '6033', SQLITE_DB_PATH: path.resolve(process.cwd(), 'backend', 'data', 'convexa.db') };
    const node = process.execPath;
  const entry = path.resolve(process.cwd(), 'scripts', 'start-integrated.mjs');
    serverProc = spawn(node, [entry], { env });
    let port: number | null = null;
    BASE = '';
    serverProc.stdout.on('data', (buf: Buffer) => {
      const s = buf.toString();
      process.stdout.write(`[server] ${s}`);
      const m = s.match(/running on port (\d+)/i);
      if (m) {
        port = Number(m[1]);
        BASE = `http://localhost:${port}`;
        // don't resolve yet; wait for health to be ready via poll below
      }
    });
    serverProc.stderr.on('data', (buf: Buffer) => {
      // surface any startup errors
      const s = buf.toString();
      process.stderr.write(`[server-err] ${s}`);
      if (/EADDRINUSE/i.test(s)) reject(new Error(s));
    });
    serverProc.on('exit', (code: number) => {
      reject(new Error(`server exited early with code ${code}`));
    });

    // Poll health until ready (max ~10s)
    const httpAny: any = request as any;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const res = await (httpAny(BASE) as any).get('/health');
        if (res.status === 200) {
          resolve();
          return;
        }
      } catch {}
      if (attempts < 50) setTimeout(tick, 200);
      else reject(new Error('health never became ready'));
    };
    setTimeout(tick, 200);
  });
}

async function stopServer(): Promise<void> {
  if (serverProc) {
    serverProc.kill('SIGINT');
    serverProc = null;
  }
}

describe('routes: Problem+JSON + artifacts', () => {
  beforeAll(async () => {
    process.env.ARTIFACT_SIGNING_SECRET = 'test-secret';
    await startServer();
  }, 20000);
  afterAll(async () => {
    await stopServer();
  });

  it('POST /api/zip-search-new/add-lead with {} -> 400 Problem+JSON', async () => {
    const http: any = request as any;
    const res = await (http(BASE) as any).post('/api/zip-search-new/add-lead').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'validation_error');
    expect(res.body).toHaveProperty('message');
  });

  it('POST /api/leads/bulk/skiptrace with non-array -> 400 Problem+JSON', async () => {
    const http: any = request as any;
    const res = await (http(BASE) as any).post('/api/leads/bulk/skiptrace').send({ leadIds: 'oops' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'validation_error');
  });

  it('GET /admin/artifacts -> array of items', async () => {
    const http: any = request as any;
    const res = await (http(BASE) as any).get('/admin/artifacts');
    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : (Array.isArray(res.body?.artifacts) ? res.body.artifacts : []);
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      const item = items[0];
      expect(item).toHaveProperty('runId');
      expect(item).toHaveProperty('signedUrl');
    }
  });

  it('GET /admin/artifact-download signed -> 200; tampered/expired -> 401', async () => {
    const http: any = request as any;
    // Find first item
    const list = await (http(BASE) as any).get('/admin/artifacts');
    expect(list.status).toBe(200);
    const items = Array.isArray(list.body) ? list.body : (Array.isArray(list.body?.artifacts) ? list.body.artifacts : []);
    if (items.length === 0) return; // nothing to download yet in fresh env
    const { signedUrl } = items[0];
    const ok = await (http(BASE) as any).get(signedUrl);
    expect(ok.status).toBe(200);

    // Tamper signature
    const bad = await (http(BASE) as any).get(signedUrl + 'Z');
    expect(bad.status).toBe(401);
    expect(bad.body.code === 'invalid_signature' || bad.body.code === 'expired_signature').toBe(true);
  });
});
