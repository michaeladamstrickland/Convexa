#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import { enqueueEnrichmentJob } from '../queues/enrichmentQueue';

async function main() {
  const prisma = new PrismaClient();
  const unenriched: any[] = await (prisma as any).scrapedProperty.findMany({
    where: {
      AND: [
        { OR: [ { investmentScore: null }, { investmentScore: { equals: null } } ] },
        { OR: [ { enrichmentTags: { isEmpty: true } } ] }
      ]
    },
    take: 500
  });
  console.log(`Found ${unenriched.length} unenriched properties`);
  let enqueued = 0;
  for (const p of unenriched) {
    await enqueueEnrichmentJob({ propertyId: p.id });
    enqueued++;
  }
  console.log(`Enqueued ${enqueued} enrichment jobs`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
