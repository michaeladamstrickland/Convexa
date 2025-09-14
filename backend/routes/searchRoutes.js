const express = require('express');
const router = express.Router();
const db = require('../database');
const { logInfo, logError } = require('../utils/logger');

// In-memory cache for search results
let searchCache = {};

// Function to get temperature tag based on motivation score
function getTemperatureTag(motivationScore) {
  if (motivationScore <= 25) return 'COLD';
  if (motivationScore <= 50) return 'WARM';
  if (motivationScore <= 75) return 'HOT';
  return 'ON_FIRE';
}

// Search leads with filters
router.post('/', async (req, res) => {
  try {
    const {
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      propertyType,
      source,
      temperature,
      status,
      limit = 10,
      page = 1,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.body;

    // Generate a cache key based on the search parameters
    const cacheKey = JSON.stringify({
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      propertyType,
      source,
      temperature,
      status,
      limit,
      page,
      sortBy,
      sortOrder
    });

    // Check if we have cached results for this query
    if (searchCache[cacheKey]) {
      return res.json(searchCache[cacheKey]);
    }

    // Build the SQL query
    let sql = 'SELECT * FROM leads';
    const params = [];
    const whereClauses = [];

    // Add filters
    if (query) {
      whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    if (city) {
      whereClauses.push('city LIKE ?');
      params.push(`%${city}%`);
    }

    if (state) {
      whereClauses.push('state LIKE ?');
      params.push(`%${state}%`);
    }

    if (zipCode) {
      whereClauses.push('zip_code LIKE ?');
      params.push(`%${zipCode}%`);
    }

    if (propertyType) {
      whereClauses.push('property_type = ?');
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

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (minValue) {
      whereClauses.push('estimated_value >= ?');
      params.push(parseFloat(minValue));
    }

    if (maxValue) {
      whereClauses.push('estimated_value <= ?');
      params.push(parseFloat(maxValue));
    }

    // Add WHERE clause if needed
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Count total records for pagination
    let countSql = 'SELECT COUNT(*) as total FROM leads';
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }

    const totalCount = await db.get(countSql, params);

    // Add ORDER BY and pagination
    sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    // Execute query
    const leads = await db.all(sql, params);

    // Format the results
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      phone: lead.phone || lead.owner_phone,
      email: lead.email || lead.owner_email,
      phones: lead.phones ? JSON.parse(lead.phones) : [],
      emails: lead.emails ? JSON.parse(lead.emails) : [],
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      motivationScore: lead.motivation_score || 0,
      aiScore: lead.ai_score || 0,
      temperatureTag: lead.temperature_tag || getTemperatureTag(lead.motivation_score || 0),
      status: lead.status || 'NEW',
      source: lead.source || lead.source_type,
      sourceType: lead.source_type,
      isProbate: Boolean(lead.is_probate),
      isVacant: Boolean(lead.is_vacant),
      conditionScore: lead.condition_score,
      leadScore: lead.lead_score,
      notes: lead.notes,
      rawData: lead.raw_data ? JSON.parse(lead.raw_data) : {},
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));

    // Calculate total pages
    const totalPages = Math.ceil(totalCount.total / parseInt(limit));

    // Create response
    const response = {
      leads: formattedLeads,
      pagination: {
        total: totalCount.total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: totalPages
      }
    };

    // Cache the results
    searchCache[cacheKey] = response;

    // Return the results
    res.json(response);
  } catch (error) {
    logError(`Error in search endpoint: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics
router.get('/analytics', async (req, res) => {
  try {
    // Total leads
    const totalLeads = await db.get('SELECT COUNT(*) as count FROM leads');

    // Total estimated value
    const totalValueResult = await db.get('SELECT SUM(estimated_value) as totalValue FROM leads');

    // Average motivation score
    const avgMotivation = await db.get('SELECT AVG(motivation_score) as avg FROM leads');

    // Temperature distribution
    const temperatureDistribution = await db.all(
      'SELECT temperature_tag as tag, COUNT(*) as count FROM leads GROUP BY temperature_tag'
    );

    // Leads by source
    const leadsBySource = await db.all(
      'SELECT source_type as source, COUNT(*) as count FROM leads GROUP BY source_type'
    );

    // Leads by status
    const leadsByStatus = await db.all(
      'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
    );

    // Prepare response
    const analytics = {
      totalLeads: totalLeads.count,
      totalEstimatedValue: totalValueResult.totalValue || 0,
      avgMotivationScore: avgMotivation.avg || 0,
      temperatureDistribution,
      leadsBySource,
      leadsByStatus,
      potentialRevenue: (totalValueResult.totalValue || 0) * 0.05 // Example: 5% of total value
    };

    res.json({ analytics });
  } catch (error) {
    logError(`Error in analytics endpoint: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear search cache
router.post('/clear-cache', (req, res) => {
  try {
    searchCache = {};
    res.json({
      success: true,
      message: 'Search cache cleared successfully'
    });
  } catch (error) {
    logError(`Error clearing cache: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
