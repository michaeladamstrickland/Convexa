import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

const ADMIN = 'http://localhost:3001/api/admin';
const DEV = 'http://localhost:3001/api/dev';

jest.setTimeout(120000);

describe('CRM Activity auto-emit on matchmaking.completed', () => {
  it('creates crm.activity (matchmaking.completed) and exposes metrics', async () => {
    // Seed property and matchmaking job
    const prop: any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'90002', address:`MM-CRM-${Date.now()}`, price: 210000, sqft: 1200, enrichmentTags: ['high-potential'], condition: 'Fair', investmentScore: 90 } });
    // Baseline metrics
    const m0r = await fetch(`${DEV}/metrics`); const m0 = await m0r.text();
    const beforeMatch = m0.match(/leadflow_crm_activity_total\{type="matchmaking\.completed"\} (\d+)/);
    const before = beforeMatch ? parseInt(beforeMatch[1],10) : 0;
    // Create matchmaking job filtered to this property and run
    const mmr = await fetch(`${ADMIN}/matchmaking-jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON: { propertyId: prop.id } }) });
    expect(mmr.status).toBe(201);
    // Poll activity and metrics
    const deadline = Date.now() + 90000; let seen=false; let after = before;
    while (Date.now() < deadline && !seen) {
      const lr = await fetch(`${ADMIN}/crm-activity?type=matchmaking.completed&limit=1`);
      if (lr.status === 200) {
        const lj: any = await lr.json();
        if (Array.isArray(lj?.data) && lj.data.length > 0) { seen = true; break; }
      }
      const m1r = await fetch(`${DEV}/metrics`); const m1 = await m1r.text();
      const mm = m1.match(/leadflow_crm_activity_total\{type="matchmaking\.completed"\} (\d+)/);
      after = mm ? parseInt(mm[1],10) : after;
      if (after > before) { seen = true; break; }
      await sleep(200);
    }
    expect(seen).toBe(true);
  });
});
