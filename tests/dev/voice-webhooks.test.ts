import { describe, it, expect } from '@jest/globals';
import fetch from 'node-fetch';

const base = 'http://localhost:3001';

jest.setTimeout(15000);

describe('Voice webhook ingestion (AssemblyAI, Twilio)', () => {
  it('accepts AssemblyAI webhook and increments live transcript metrics', async () => {
    const callSid = 'CA_asm_' + Math.random().toString(36).slice(2);
    const payload = {
      callSid,
      utterances: [
        { speaker: 'agent', text: 'Hello, thanks for taking my call.' },
        { speaker: 'seller', text: 'I might sell if the price is right.' }
      ],
      audio_url: 'https://example.com/audio.wav',
      transcript_url: 'https://example.com/transcript.json',
      status: 'processing'
    };
    const r = await fetch(base + '/api/calls/webhooks/assemblyai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    expect(r.status).toBeLessThan(300);
    const metrics = await (await fetch(base + '/api/dev/metrics')).text();
    expect(metrics).toContain('leadflow_call_live_transcript_total');
  });

  it('accepts Twilio webhook form data and records DTMF as live transcript', async () => {
    const callSid = 'CA_twi_' + Math.random().toString(36).slice(2);
    const form = new URLSearchParams();
    form.set('CallSid', callSid);
    form.set('Digits', '123#');
    const r = await fetch(base + '/api/calls/webhooks/twilio', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    expect(r.status).toBeLessThan(300);
    const metrics = await (await fetch(base + '/api/dev/metrics')).text();
    expect(metrics).toContain('leadflow_call_live_transcript_total');
  });
});
