"use strict";
/*
 * ZIP Search Integration
 *
 * This file shows how to integrate the ZIP search routes into the main server.
 * Copy and paste these sections into your server.ts file.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import section - add to your imports
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Database connection - add near other database connections
const setupZipSearchDb = () => {
    const rootDbPath = path_1.default.resolve(__dirname, '..', 'prisma', 'dev.db');
    if (!fs_1.default.existsSync(rootDbPath)) {
        console.error(`Database file not found at ${rootDbPath}`);
        return null;
    }
    try {
        const db = new better_sqlite3_1.default(rootDbPath, { readonly: false });
        console.log(`Connected to SQLite database with ${db.prepare('SELECT COUNT(*) as count FROM leads').get().count} leads`);
        return db;
    }
    catch (error) {
        console.error('Error connecting to SQLite database:', error);
        return null;
    }
};
// Create database connection
const zipSearchDb = setupZipSearchDb();
// Helper function - add near your utility functions
function getTemperatureTag(motivationScore) {
    if (motivationScore <= 25)
        return 'dead';
    if (motivationScore <= 50)
        return 'warm';
    if (motivationScore <= 75)
        return 'hot';
    return 'on_fire';
}
// Route handlers - add to your Express app setup
const setupZipSearchRoutes = (app) => {
    if (!zipSearchDb) {
        console.warn('ZIP search database not available, routes will not be added');
        return;
    }
    // Unified search endpoint
    app.get('/api/zip-search/search', (req, res) => {
        try {
            const { query, minValue, maxValue, city, state, zipCode, propertyType, source, temperature, limit = 50, page = 1 } = req.query;
            let sql = 'SELECT * FROM leads';
            const params = [];
            const whereClauses = [];
            // Add filters
            if (query) {
                whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
                params.push(`%${query}%`, `%${query}%`);
            }
            if (city) {
                whereClauses.push('address LIKE ?');
                params.push(`%${city}%`);
            }
            if (state) {
                whereClauses.push('address LIKE ?');
                params.push(`%${state}%`);
            }
            if (zipCode) {
                whereClauses.push('address LIKE ?');
                params.push(`%${zipCode}%`);
            }
            if (propertyType) {
                whereClauses.push('source_type = ?');
                params.push(propertyType);
            }
            if (source) {
                whereClauses.push('source_type = ?');
                params.push(source);
            }
            if (temperature) {
                whereClauses.push('temperature_tag = ?');
                params.push(temperature);
            }
            if (minValue || maxValue) {
                if (minValue) {
                    whereClauses.push('estimated_value >= ?');
                    params.push(parseFloat(minValue));
                }
                if (maxValue) {
                    whereClauses.push('estimated_value <= ?');
                    params.push(parseFloat(maxValue));
                }
            }
            // Add WHERE clause if needed
            if (whereClauses.length > 0) {
                sql += ' WHERE ' + whereClauses.join(' AND ');
            }
            // Get total count for pagination
            let countSql = 'SELECT COUNT(*) as total FROM leads';
            if (whereClauses.length > 0) {
                countSql += ' WHERE ' + whereClauses.join(' AND ');
            }
            const totalCount = zipSearchDb.prepare(countSql).get(...params).total;
            // Add ORDER BY and pagination
            sql += ' ORDER BY created_at DESC';
            const skip = (parseInt(page) - 1) * parseInt(limit);
            sql += ' LIMIT ? OFFSET ?';
            params.push(parseInt(limit), skip);
            // Execute query
            const leads = zipSearchDb.prepare(sql).all(...params);
            // Process the results
            const formattedLeads = leads.map(lead => ({
                id: lead.id,
                propertyAddress: lead.address,
                ownerName: lead.owner_name,
                phone: lead.phone,
                email: lead.email,
                estimatedValue: lead.estimated_value,
                equity: lead.equity,
                motivationScore: lead.motivation_score,
                temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
                status: lead.status,
                source: lead.source_type,
                isProbate: Boolean(lead.is_probate),
                isVacant: Boolean(lead.is_vacant),
                conditionScore: lead.condition_score,
                leadScore: lead.lead_score,
                createdAt: lead.created_at,
                updatedAt: lead.updated_at
            }));
            // Return the results
            res.json({
                leads: formattedLeads,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            });
        }
        catch (error) {
            console.error('Error in search endpoint:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // ZIP code search endpoint
    app.post('/api/zip-search/search-zip', (req, res) => {
        try {
            const { zipCode } = req.body;
            if (!zipCode) {
                return res.status(400).json({ error: 'Zip code is required' });
            }
            // Execute query
            const leads = zipSearchDb.prepare('SELECT * FROM leads WHERE address LIKE ?')
                .all(`%${zipCode}%`);
            // Format response
            res.json({
                leadCount: leads.length,
                zipCode,
                leads: leads.map(lead => ({
                    id: lead.id,
                    propertyAddress: lead.address,
                    ownerName: lead.owner_name,
                    estimatedValue: lead.estimated_value,
                    equity: lead.equity,
                    motivationScore: lead.motivation_score
                }))
            });
        }
        catch (error) {
            console.error('Error in ZIP search endpoint:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // Revenue analytics endpoint
    app.get('/api/zip-search/revenue-analytics', (req, res) => {
        try {
            // Calculate total estimated value
            const totalValueResult = zipSearchDb.prepare('SELECT SUM(estimated_value) as totalValue FROM leads')
                .get();
            // Get lead counts by source
            const leadsBySource = zipSearchDb.prepare('SELECT source_type as source, COUNT(*) as count FROM leads GROUP BY source_type')
                .all();
            // Get temperature distribution
            const temperatureDistribution = zipSearchDb.prepare('SELECT temperature_tag as tag, COUNT(*) as count FROM leads GROUP BY temperature_tag').all();
            // Prepare response
            res.json({
                analytics: {
                    totalLeads: zipSearchDb.prepare('SELECT COUNT(*) as count FROM leads').get().count,
                    totalEstimatedValue: totalValueResult.totalValue || 0,
                    avgMotivationScore: zipSearchDb.prepare('SELECT AVG(motivation_score) as avg FROM leads').get().avg || 0,
                    leadsBySource,
                    temperatureDistribution,
                    potentialRevenue: totalValueResult.totalValue * 0.05 // Example: 5% of total value
                }
            });
        }
        catch (error) {
            console.error('Error in revenue analytics endpoint:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    console.log('ZIP search routes added successfully');
};
// Use in your server.ts like:
// setupZipSearchRoutes(app);
// Cleanup on exit - add to your cleanup handlers
process.on('exit', () => {
    if (zipSearchDb) {
        console.log('Closing ZIP search database connection...');
        zipSearchDb.close();
    }
});
//# sourceMappingURL=zip-search-integration.js.map