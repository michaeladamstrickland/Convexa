"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperJobPayload = void 0;
exports.parseScraperJobPayload = parseScraperJobPayload;
const zod_1 = require("zod");
// Queue job payload for scraper tasks
exports.ScraperJobPayload = zod_1.z.object({
    source: zod_1.z.enum(['zillow', 'auction']),
    zip: zod_1.z.string().min(5).max(10),
    fromDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // Optional filters forwarded to adapters; enables deterministic test assertions
    filters: zod_1.z.object({
        minPrice: zod_1.z.number().optional(),
        maxPrice: zod_1.z.number().optional(),
        beds: zod_1.z.number().int().optional(),
        propertyTypes: zod_1.z.array(zod_1.z.string()).optional(),
        minSqft: zod_1.z.number().int().optional()
    }).partial().optional(),
    // future extensibility: optional page limit, state, etc.
    options: zod_1.z.object({
        maxPages: zod_1.z.number().int().min(1).max(50).default(5)
    }).partial().default({})
}).refine(d => !(d.fromDate && !d.toDate) && !(d.toDate && !d.fromDate), {
    message: 'fromDate and toDate must be provided together'
}).refine(d => {
    if (d.fromDate && d.toDate) {
        return new Date(d.fromDate) <= new Date(d.toDate);
    }
    return true;
}, { message: 'fromDate must be <= toDate' });
function parseScraperJobPayload(data) {
    return exports.ScraperJobPayload.parse(data);
}
//# sourceMappingURL=JobPayload.js.map