"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../db/prisma");
const router = (0, express_1.Router)();
function parseBool(v, def = true) { if (v === undefined)
    return def; return v === 'false' ? false : Boolean(v); }
// Lightweight global metrics tracker for feed usage
const feedMetrics = global.__FEED_METRICS__ || { servedTotal: 0, filterCounts: {} };
global.__FEED_METRICS__ = feedMetrics;
router.get('/', async (req, res) => {
    try {
        const { source, zip, beds, minPrice, maxPrice, propertyType, minSqft, condition, minScore, tag, reason, tagReasons, dedupedOnly = 'true', limit = '50', offset = '0' } = req.query;
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
        if (condition) {
            where.condition = condition;
            filtersApplied.push('condition');
        }
        if (minScore) {
            const ms = parseInt(minScore, 10);
            if (!isNaN(ms)) {
                where.investmentScore = { gte: ms };
                filtersApplied.push('minScore');
            }
        }
        if (tag) {
            const tokens = String(tag).split(',').map(s => s.trim()).filter(Boolean);
            if (tokens.length === 1) {
                where.enrichmentTags = { has: tokens[0] };
            }
            else if (tokens.length > 1) {
                where.enrichmentTags = { hasEvery: tokens };
            }
            if (tokens.length)
                filtersApplied.push('tag');
        }
        if (reason) {
            const tokens = String(reason).split(',').map(s => s.trim()).filter(Boolean);
            if (tokens.length === 1)
                where.reasons = { has: tokens[0], isEmpty: false };
            else if (tokens.length > 1)
                where.reasons = { hasSome: tokens, isEmpty: false };
            if (tokens.length)
                filtersApplied.push('reason');
        }
        if (tagReasons) {
            // Map common tokens to tags; fallback to substring match on tagReasons JSON not supported natively → approximate via tags
            const tokens = String(tagReasons).split(',').map(s => s.trim()).filter(Boolean);
            const knownTags = ['high-potential', 'low-margin', 'fixer', 'rental', 'equity', 'high-ROI'];
            const mapped = tokens.filter(t => knownTags.includes(t));
            if (mapped.length) {
                // OR semantics for tagReasons proxy
                where.enrichmentTags = where.enrichmentTags ? { ...where.enrichmentTags, hasSome: mapped } : { hasSome: mapped };
            }
            filtersApplied.push('tagReasons');
        }
        parseBool(dedupedOnly, true); // placeholder for future multi-version listing retention
        const p = prisma_1.prisma;
        const [totalCount, data] = await Promise.all([
            p.scrapedProperty.count({ where }),
            p.scrapedProperty.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take })
        ]);
        // increment served counter and per-filter usage
        try {
            feedMetrics.servedTotal++;
            // Track only top-level filter flags to keep metrics compact
            for (const f of filtersApplied) {
                // We focus on tag/reason/tagReasons usage, but count generically too
                const key = ['tag', 'reason', 'tagReasons'].includes(f) ? f : `other:${f}`;
                feedMetrics.filterCounts[key] = (feedMetrics.filterCounts[key] || 0) + 1;
            }
        }
        catch { }
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