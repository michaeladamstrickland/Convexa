"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../db/prisma");
const router = (0, express_1.Router)();
function parseBool(v, def = true) { if (v === undefined)
    return def; return v === 'false' ? false : Boolean(v); }
router.get('/', async (req, res) => {
    try {
        const { source, zip, beds, minPrice, maxPrice, propertyType, minSqft, dedupedOnly = 'true', limit = '50', offset = '0' } = req.query;
        const take = Math.min(parseInt(limit) || 50, 200);
        const skip = parseInt(offset) || 0;
        const where = {};
        const filtersApplied = [];
        if (source) {
            where.source = source;
            filtersApplied.push('source');
        }
        if (zip) {
            where.zip = zip;
            filtersApplied.push('zip');
        }
        if (beds) {
            const b = parseInt(beds);
            if (!isNaN(b)) {
                where.beds = { gte: b };
                filtersApplied.push('beds');
            }
        }
        if (minPrice) {
            const p = parseInt(minPrice);
            if (!isNaN(p)) {
                where.price = { ...(where.price || {}), gte: p };
                filtersApplied.push('minPrice');
            }
        }
        if (maxPrice) {
            const p = parseInt(maxPrice);
            if (!isNaN(p)) {
                where.price = { ...(where.price || {}), lte: p };
                filtersApplied.push('maxPrice');
            }
        }
        if (propertyType) {
            where.propertyType = propertyType;
            filtersApplied.push('propertyType');
        }
        if (minSqft) {
            const s = parseInt(minSqft);
            if (!isNaN(s)) {
                where.sqft = { gte: s };
                filtersApplied.push('minSqft');
            }
        }
        parseBool(dedupedOnly, true); // placeholder for future multi-version listing retention
        const p = prisma_1.prisma;
        const [totalCount, data] = await Promise.all([
            p.scrapedProperty.count({ where }),
            p.scrapedProperty.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take })
        ]);
        res.json({
            data,
            meta: { totalCount, filtersApplied, pagination: { limit: take, offset: skip } }
        });
    }
    catch (e) {
        res.status(500).json({ error: 'feed_query_failed', message: e?.message });
    }
});
exports.default = router;
//# sourceMappingURL=publicProperties.js.map