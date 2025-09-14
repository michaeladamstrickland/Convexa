import { describe, it, expect } from '@jest/globals';
import fetch from 'node-fetch';

const base = 'http://localhost:3001';

describe('Call summary idempotency', () => {
  it('only creates one crm.activity call.summary by default, allows force to emit again', async () => {
    const callSid = 'CA_idem_' + Math.random().toString(36).slice(2);
    await fetch(base + '/api/calls/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    await fetch(base + '/api/calls/transcript', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid, transcript: 'Interested in quick cash offer.' }) });
    // First analyze
    let r = await fetch(base + '/api/calls/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    expect(r.status).toBeLessThan(300);
    // Second analyze (no force)
    r = await fetch(base + '/api/calls/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    expect(r.status).toBeLessThan(300);
    // Verify only one call.summary activity exists in listing via admin endpoint (filter by type)
    const list = await fetch(base + '/api/admin/crm-activity?type=call.summary');
    const j = await list.json();
    const rows = j?.data || [];
    const bySid = rows.filter((x: any) => x?.metadata?.callSid === callSid);
    expect(bySid.length).toBe(1);
    // Force should make another event
    r = await fetch(base + '/api/calls/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid, force: true }) });
    expect(r.status).toBeLessThan(300);
    const list2 = await fetch(base + '/api/admin/crm-activity?type=call.summary');
    const j2 = await list2.json();
    const rows2 = j2?.data || [];
    const bySid2 = rows2.filter((x: any) => x?.metadata?.callSid === callSid);
    expect(bySid2.length).toBeGreaterThanOrEqual(2);
  });
});
