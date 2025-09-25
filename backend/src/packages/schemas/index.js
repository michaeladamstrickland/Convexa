import { z } from 'zod';
export { ScraperJobPayload, parseScraperJobPayload } from './JobPayload';
// Distress signal enumeration
export const DistressSignalEnum = z.enum([
    'FSBO',
    'AUCTION',
    'PRE_FORECLOSURE',
    'CODE_VIOLATION',
    'TAX_DELINQUENT',
    'PROBATE',
    'EVICTION'
]);
// Contacts schema
export const ContactSchema = z.object({
    type: z.enum(['phone', 'email']),
    value: z.string(),
    confidence: z.number().optional(),
    source: z.string().optional()
});
// ScrapedProperty schema (supports dynamic county-*)
export const ScrapedProperty = z.object({
    sourceKey: z.union([
        z.enum(['zillow', 'auction-com']),
        z.string().regex(/^county-.+$/, 'county-* sources must start with county-')
    ]),
    capturedAt: z.string().datetime(),
    address: z.object({
        line1: z.string(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional()
    }),
    parcelId: z.string().optional(),
    apn: z.string().optional(),
    ownerName: z.string().optional(),
    attributes: z.record(z.string(), z.any()).optional(),
    priceHint: z.number().optional(),
    lastEventDate: z.string().optional(),
    distressSignals: z.array(DistressSignalEnum).default([]),
    contacts: z.array(ContactSchema).optional(),
    attachments: z.array(z.object({
        kind: z.enum(['img', 'pdf', 'html']),
        s3Key: z.string().optional(),
        sha256: z.string().optional()
    })).optional()
});
export const ScrapeResult = z.object({
    ok: z.boolean(),
    errors: z.array(z.string()).optional(),
    items: z.array(ScrapedProperty)
});
// Helper runtime validators
export function parseScrapeResult(data) {
    return ScrapeResult.parse(data);
}
export function parseScrapedProperty(data) {
    return ScrapedProperty.parse(data);
}
//# sourceMappingURL=index.js.map