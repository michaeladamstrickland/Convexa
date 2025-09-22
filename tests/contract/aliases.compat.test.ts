import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';

let serverProc: any;
let BASE = '';

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const env = { ...process.env, PORT: '6044', SQLITE_DB_PATH: path.resolve(process.cwd(), 'backend', 'data', 'convexa.db') };
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
      }
    });
    serverProc.stderr.on('data', (buf: Buffer) => {
      const s = buf.toString();
      process.stderr.write(`[server-err] ${s}`);
      if (/EADDRINUSE/i.test(s)) reject(new Error(s));
    });
    serverProc.on('exit', (code: number) => {
      reject(new Error(`server exited early with code ${code}`));
    });

    // Poll health until ready
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

describe('Compatibility aliases: /api/leads and /api/search', () => {
  beforeAll(async () => {
    await startServer();
  }, 20000);
  afterAll(async () => {
    await stopServer();
  });

  it('POST /api/leads with {} -> 400 Problem+JSON', async () => {
    const http: any = request as any;
    const res = await (http(BASE) as any).post('/api/leads').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'validation_error');
  });

  it('GET /api/search?limit=1 -> 200 with leads array', async () => {
    const http: any = request as any;
    const res = await (http(BASE) as any).get('/api/search').query({ limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leads');
    expect(Array.isArray(res.body.leads)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });
});
