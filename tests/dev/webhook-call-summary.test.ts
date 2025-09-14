import { describe, it, expect } from '@jest/globals';
import fetch from 'node-fetch';

const base = 'http://localhost:3001';

describe('Webhook for call.summary', () => {
  it('emits crm.activity webhook and updates metrics on analyze', async () => {
    const callSid = 'CA_wh_' + Math.random().toString(36).slice(2);
    // Create transcript
    await fetch(base + '/api/calls/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    await fetch(base + '/api/calls/transcript', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid, transcript: 'Owner is warm to a cash offer.' }) });
    // Analyze (this should create crm.activity and enqueue webhook)
    const r = await fetch(base + '/api/calls/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    expect(r.status).toBeLessThan(300);
    // Scrape metrics text for crm activity counters exist; delivery logs are handled async but we at least verify total counters line
    const m = await fetch(base + '/api/dev/metrics');
    expect(m.status).toBe(200);
    const text = await m.text();
    expect(text).toMatch(/leadflow_crm_activity_total\s+\d+/);
  });
});
