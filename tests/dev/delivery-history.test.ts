import { prisma } from '../../src/db/prisma';
import fetch from 'node-fetch';

const ADMIN = process.env.TEST_ADMIN_URL || 'http://localhost:3001/api/admin';

jest.setTimeout(20000);

describe('Delivery History API', () => {
  it('lists delivery history with filters', async () => {
    // Seed a couple of delivery logs
    const sub:any = await (prisma as any).webhookSubscription.create({ data: { targetUrl: 'http://localhost:3001/_mock/webhook', eventTypes: ['job.completed'], signingSecret: 'test', isActive: true } });
    const mk = (data:any) => (prisma as any).webhookDeliveryLog.create({ data });
    const now = new Date();
    await mk({ subscriptionId: sub.id, eventType: 'job.completed', status: 'delivered', attemptsMade: 1, jobId: 'j1', lastAttemptAt: now });
    await mk({ subscriptionId: sub.id, eventType: 'property.new', status: 'failed', attemptsMade: 3, jobId: 'j2', lastAttemptAt: now });

    const r = await fetch(`${ADMIN}/delivery-history?subscriptionId=${sub.id}&eventType=job.completed&status=delivered&limit=10`);
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(Array.isArray(j.data)).toBe(true);
    if (j.data.length) {
      expect(j.data[0].subscriptionId).toBe(sub.id);
      expect(j.data[0].eventType).toBe('job.completed');
    }
  });
});
