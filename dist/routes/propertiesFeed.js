import { Router } from 'express';
import { prisma } from '../db/prisma';
const router = Router();
// lightweight in-memory counter for metrics endpoint aggregation
const feedMetrics = global.__FEED_METRICS__ || { servedTotal: 0 };
global.__FEED_METRICS__ = feedMetrics;
// GET /api/properties
// Filters: source, zip, tag, condition, minScore, isEnriched, createdAt range (createdAfter/createdBefore)
// Sorting: createdAt desc (default) | score desc
router.get('/', async (req, res) => {
    try {
        const { source, zip, minPrice, maxPrice, beds, limit = '25', offset = '0', propertyType, dedupedOnly, tag, condition, minScore, isEnriched, createdAfter, createdBefore, sortBy = 'createdAt', order = 'desc' } = req.query;
        const take = Math.min(Math.max(parseInt(limit) || 25, 1), 500);
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
            const b = parseInt(beds, 10);
            if (!isNaN(b)) {
                where.beds = b;
                filtersApplied.push('beds');
            }
        }
        if (propertyType) {
            where.propertyType = propertyType;
            filtersApplied.push('propertyType');
        }
        if (minPrice) {
            const v = parseInt(minPrice, 10);
            if (!isNaN(v)) {
                where.price = { ...(where.price || {}), gte: v };
                filtersApplied.push('minPrice');
            }
        }
        if (maxPrice) {
            const v = parseInt(maxPrice, 10);
            if (!isNaN(v)) {
                where.price = { ...(where.price || {}), lte: v };
                filtersApplied.push('maxPrice');
            }
        }
        if (tag) {
            where.enrichmentTags = { has: tag };
            filtersApplied.push('tag');
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
        if (typeof isEnriched !== 'undefined') {
            const flag = isEnriched === 'true';
            where.investmentScore = flag ? { not: null } : null;
            filtersApplied.push('isEnriched');
        }
        // support legacy createdAfter/createdBefore and nested createdAt[from/to]
        const createdAtFrom = req.query['createdAt[from]'] || createdAfter;
        const createdAtTo = req.query['createdAt[to]'] || createdBefore;
        if (createdAtFrom || createdAtTo) {
            where.createdAt = {};
            if (createdAtFrom) {
                const d = new Date(createdAtFrom);
                if (!isNaN(d.getTime())) {
                    where.createdAt.gte = d;
                    filtersApplied.push('createdAt.from');
                }
            }
            if (createdAtTo) {
                const d = new Date(createdAtTo);
                if (!isNaN(d.getTime())) {
                    where.createdAt.lte = d;
                    filtersApplied.push('createdAt.to');
                }
            }
        }
        else if (createdAfter || createdBefore) {
            where.createdAt = {};
            if (createdAfter) {
                const d = new Date(createdAfter);
                if (!isNaN(d.getTime())) {
                    where.createdAt.gte = d;
                    filtersApplied.push('createdAfter');
                }
            }
            if (createdBefore) {
                const d = new Date(createdBefore);
                if (!isNaN(d.getTime())) {
                    where.createdAt.lte = d;
                    filtersApplied.push('createdBefore');
                }
            }
        }
        if (dedupedOnly === 'true') {
            filtersApplied.push('dedupedOnly');
        }
        const sortable = ['createdAt', 'score'];
        const sortSel = sortable.includes(sortBy) ? sortBy : 'createdAt';
        const dir = (String(order).toLowerCase() === 'asc') ? 'asc' : 'desc';
        const orderBy = sortSel === 'score' ? { investmentScore: dir } : { createdAt: dir };
        const p = prisma;
        const [rows, total] = await Promise.all([
            p.scrapedProperty.findMany({ where, orderBy, take, skip }),
            p.scrapedProperty.count({ where })
        ]);
        // increment metric
        try {
            feedMetrics.servedTotal++;
        }
        catch { }
        const nextOffset = Math.min(total, skip + rows.length);
        res.json({ data: rows, meta: { total, filtersApplied, pagination: { limit: take, offset: skip, nextOffset }, sortBy: sortSel, order: dir } });
    }
    catch (e) {
        res.status(500).json({ error: 'feed_failed', message: e?.message });
    }
});
export default router;
//# sourceMappingURL=propertiesFeed.js.map