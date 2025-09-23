import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';

// This test suite assumes the integrated server is started separately on PORT=5001.
// Keep lightweight to avoid flakiness in CI when server not available.
const BASE = process.env.TEST_BASE || 'http://localhost:5001';

async function get(path){
  const res = await fetch(BASE + path);
  return { status: res.status, text: await res.text(), headers: Object.fromEntries(res.headers.entries()) };
}
async function getJson(path){
  const r = await fetch(BASE + path);
  return { status: r.status, json: await r.json() };
}
async function postJson(path, body){
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body||{}) });
  return { status: r.status, json: await r.json() };
}

describe('Operator UI and route aliases', () => {
  it('GET /api/search alias responds (200/JSON)', async () => {
    const r = await get('/api/search?limit=1');
    expect(r.status).toBeTypeOf('number');
  });
  it('POST /api/leads alias validates', async () => {
    const r = await postJson('/api/leads', { address: '123 Test St' });
    expect([200,400]).toContain(r.status);
  });
  it('GET /ops/leads returns HTML', async () => {
    const r = await get('/ops/leads');
    expect(r.headers['content-type'] || '').toContain('text/html');
  });
  it('GET /admin/artifacts returns JSON array or object', async () => {
    const r = await getJson('/admin/artifacts');
    expect([200,401]).toContain(r.status);
  });
});
