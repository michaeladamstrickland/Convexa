import fetch from 'node-fetch';

describe('CRM Activity Webhook & Metrics', () => {
  it('emits crm.activity webhook on POST and exposes metrics', async () => {
    const res = await fetch('http://localhost:3001/api/admin/crm-activity', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'manual.note', metadata:{ test:true }, emitWebhook:true }) });
    expect(res.status).toBe(201);
    const m = await fetch('http://localhost:3001/api/dev/metrics');
    expect(m.status).toBe(200);
    const text = await m.text();
    expect(text).toMatch(/leadflow_crm_activity_total\s+\d+/);
  });
});
