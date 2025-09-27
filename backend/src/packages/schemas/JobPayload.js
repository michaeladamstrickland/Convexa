import { z } from 'zod';
// Queue job payload for scraper tasks
export const ScraperJobPayload = z.object({
    source: z.enum(['zillow', 'auction']),
    zip: z.string().min(5).max(10),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // Optional filters forwarded to adapters; enables deterministic test assertions
    filters: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        beds: z.number().int().optional(),
        propertyTypes: z.array(z.string()).optional(),
        minSqft: z.number().int().optional()
    }).partial().optional(),
    // future extensibility: optional page limit, state, etc.
    options: z.object({
        maxPages: z.number().int().min(1).max(50).default(5)
    }).partial().default({})
}).refine(d => !(d.fromDate && !d.toDate) && !(d.toDate && !d.fromDate), {
    message: 'fromDate and toDate must be provided together'
}).refine(d => {
    if (d.fromDate && d.toDate) {
        return new Date(d.fromDate) <= new Date(d.toDate);
    }
    return true;
}, { message: 'fromDate must be <= toDate' });
export function parseScraperJobPayload(data) {
    return ScraperJobPayload.parse(data);
}
//# sourceMappingURL=JobPayload.js.map