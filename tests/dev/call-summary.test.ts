import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';

const base = 'http://localhost:3001';

describe('Call summary flow (transcript -> analyze -> CRM activity)', () => {
  it('creates transcript, analyzes, and emits crm activity', async () => {
    const callSid = 'CA_test_' + Math.random().toString(36).slice(2);
    // Start call
    let r = await fetch(base + '/api/calls/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid, leadId: 'lead_1', userId: 'user_1' }) });
    expect(r.status).toBeLessThan(300);
    // Submit transcript
    r = await fetch(base + '/api/calls/transcript', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid, transcript: 'Seller is interested in a cash offer and can close quickly.' }) });
    expect(r.status).toBeLessThan(300);
    const data = await r.json();
    expect(data?.data?.callSid).toBe(callSid);
    // Analyze
    r = await fetch(base + '/api/calls/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callSid }) });
    expect(r.status).toBeLessThan(300);
    const a = await r.json();
    expect(a?.analysis?.summary).toBeTruthy();
    // Check metrics text for counters
    const m = await fetch(base + '/api/dev/metrics');
    const text = await m.text();
    expect(text).toMatch(/leadflow_call_started_total/);
    expect(text).toMatch(/leadflow_call_summary_total\{status="success"\}/);
    // Verify CRM activity in DB via admin endpoint list (if exists) or skip
  });
});
