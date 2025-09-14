import fetch from 'node-fetch';
import { prisma } from '../../src/db/prisma';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

const ADMIN = 'http://localhost:3001/api/admin';
const DEV = 'http://localhost:3001/api/dev';

jest.setTimeout(120000);

describe('CRM Activity auto-emit on enrichment.completed', () => {
  it('creates crm.activity (enrichment.completed) and exposes metrics', async () => {
    // Seed a property that will be enriched
    const prop: any = await (prisma as any).scrapedProperty.create({ data: { source:'zillow', zip:'85001', address:`ENRICH-CRM-${Date.now()}`, price: 150000, sqft: 1400, enrichmentTags: [], condition: 'Fair' } });
    // Baseline metrics
    const m0r = await fetch(`${DEV}/metrics`); const m0 = await m0r.text();
    const beforeMatch = m0.match(/leadflow_crm_activity_total\{type="enrichment\.completed"\} (\d+)/);
    const before = beforeMatch ? parseInt(beforeMatch[1],10) : 0;
    // Trigger enrichment
    const resp = await fetch(`${ADMIN}/enrich/${prop.id}`, { method:'POST' });
    expect([200,202].includes(resp.status)).toBe(true);
    // Poll CRM list & metrics
    const deadline = Date.now() + 90000;
    let seen = false; let after = before;
    while (Date.now() < deadline && !seen) {
      // List activities filtered by type
      const lr = await fetch(`${ADMIN}/crm-activity?type=enrichment.completed&limit=1`);
      if (lr.status === 200) {
        const lj: any = await lr.json();
        if (Array.isArray(lj?.data) && lj.data.length > 0) {
          seen = true; break;
        }
      }
      const m1r = await fetch(`${DEV}/metrics`); const m1 = await m1r.text();
      const mm = m1.match(/leadflow_crm_activity_total\{type="enrichment\.completed"\} (\d+)/);
      after = mm ? parseInt(mm[1],10) : after;
      if (after > before) { seen = true; break; }
      await sleep(200);
    }
    expect(seen).toBe(true);
  });
});
