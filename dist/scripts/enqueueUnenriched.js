#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const enrichmentQueue_1 = require("../queues/enrichmentQueue");
async function main() {
    const prisma = new client_1.PrismaClient();
    const unenriched = await prisma.scrapedProperty.findMany({
        where: {
            AND: [
                { OR: [{ investmentScore: null }, { investmentScore: { equals: null } }] },
                { OR: [{ enrichmentTags: { isEmpty: true } }] }
            ]
        },
        take: 500
    });
    console.log(`Found ${unenriched.length} unenriched properties`);
    let enqueued = 0;
    for (const p of unenriched) {
        await (0, enrichmentQueue_1.enqueueEnrichmentJob)({ propertyId: p.id });
        enqueued++;
    }
    console.log(`Enqueued ${enqueued} enrichment jobs`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=enqueueUnenriched.js.map