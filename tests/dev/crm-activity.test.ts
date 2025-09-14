import fetch from 'node-fetch';

describe('CRM Activity API', () => {
  it('creates and lists crm activities', async () => {
    const res = await fetch('http://localhost:3001/api/admin/crm-activity', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ type: 'manual.note', metadata: { note: 'hello' } }) });
    expect(res.status).toBe(201);
    const j: any = await res.json();
    expect(j?.data?.type).toBe('manual.note');
    const id = j?.data?.id; expect(id).toBeTruthy();
    const list = await fetch('http://localhost:3001/api/admin/crm-activity?type=manual.note&limit=1');
    expect(list.status).toBe(200);
    const lj: any = await list.json();
    expect(Array.isArray(lj?.data)).toBe(true);
  });
});
