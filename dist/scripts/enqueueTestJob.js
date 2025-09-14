"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scraperQueue_1 = require("../queues/scraperQueue");
async function main() {
    const job = await (0, scraperQueue_1.enqueueScraperJob)({ source: 'zillow', zip: '19147' });
    console.log('Enqueued test job:', job);
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=enqueueTestJob.js.map