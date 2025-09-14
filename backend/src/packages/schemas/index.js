"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapeResult = exports.ScrapedProperty = exports.ContactSchema = exports.DistressSignalEnum = exports.parseScraperJobPayload = exports.ScraperJobPayload = void 0;
exports.parseScrapeResult = parseScrapeResult;
exports.parseScrapedProperty = parseScrapedProperty;
const zod_1 = require("zod");
var JobPayload_1 = require("./JobPayload");
Object.defineProperty(exports, "ScraperJobPayload", { enumerable: true, get: function () { return JobPayload_1.ScraperJobPayload; } });
Object.defineProperty(exports, "parseScraperJobPayload", { enumerable: true, get: function () { return JobPayload_1.parseScraperJobPayload; } });
// Distress signal enumeration
exports.DistressSignalEnum = zod_1.z.enum([
    'FSBO',
    'AUCTION',
    'PRE_FORECLOSURE',
    'CODE_VIOLATION',
    'TAX_DELINQUENT',
    'PROBATE',
    'EVICTION'
]);
// Contacts schema
exports.ContactSchema = zod_1.z.object({
    type: zod_1.z.enum(['phone', 'email']),
    value: zod_1.z.string(),
    confidence: zod_1.z.number().optional(),
    source: zod_1.z.string().optional()
});
// ScrapedProperty schema (supports dynamic county-*)
exports.ScrapedProperty = zod_1.z.object({
    sourceKey: zod_1.z.union([
        zod_1.z.enum(['zillow', 'auction-com']),
        zod_1.z.string().regex(/^county-.+$/, 'county-* sources must start with county-')
    ]),
    capturedAt: zod_1.z.string().datetime(),
    address: zod_1.z.object({
        line1: zod_1.z.string(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        zip: zod_1.z.string().optional()
    }),
    parcelId: zod_1.z.string().optional(),
    apn: zod_1.z.string().optional(),
    ownerName: zod_1.z.string().optional(),
    attributes: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    priceHint: zod_1.z.number().optional(),
    lastEventDate: zod_1.z.string().optional(),
    distressSignals: zod_1.z.array(exports.DistressSignalEnum).default([]),
    contacts: zod_1.z.array(exports.ContactSchema).optional(),
    attachments: zod_1.z.array(zod_1.z.object({
        kind: zod_1.z.enum(['img', 'pdf', 'html']),
        s3Key: zod_1.z.string().optional(),
        sha256: zod_1.z.string().optional()
    })).optional()
});
exports.ScrapeResult = zod_1.z.object({
    ok: zod_1.z.boolean(),
    errors: zod_1.z.array(zod_1.z.string()).optional(),
    items: zod_1.z.array(exports.ScrapedProperty)
});
// Helper runtime validators
function parseScrapeResult(data) {
    return exports.ScrapeResult.parse(data);
}
function parseScrapedProperty(data) {
    return exports.ScrapedProperty.parse(data);
}
//# sourceMappingURL=index.js.map