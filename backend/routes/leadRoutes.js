/**
 * Route handler for adding leads
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../logger');

/**
 * Add a new lead
 * POST /api/zip-search-new/add-lead
 */
router.post('/add-lead', async (req, res) => {
  try {
    logger.info('Adding new lead', { data: req.body });
    
    const {
      firstname,
      lastname,
      address,
      city,
      state,
      zip,
      email,
      phone,
      owner_occupied,
      absentee_owner,
      is_vacant,
      is_probate,
      notes,
      status,
      attom_id
    } = req.body;
    
    // Validate required fields
    if (!address || !city || !state || !zip) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: address, city, state, and zip are required'
      });
    }
    
    // Generate a unique ID for the lead
    const leadId = uuidv4();
    const now = new Date().toISOString();
    
    // Insert into database
    const query = `
      INSERT INTO leads (
        id, firstname, lastname, address, city, state, zip, email, phone, 
        owner_occupied, absentee_owner, is_vacant, is_probate, notes, status, 
        attom_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      leadId,
      firstname || '',
      lastname || '',
      address,
      city,
      state,
      zip,
      email || '',
      phone || '',
      owner_occupied ? 1 : 0,
      absentee_owner ? 1 : 0,
      is_vacant ? 1 : 0,
      is_probate ? 1 : 0,
      notes || '',
      status || 'NEW',
      attom_id || null,
      now,
      now
    ];
    
    await db.run(query, params);
    
    logger.info('Lead added successfully', { leadId });
    
    res.json({
      success: true,
      message: 'Lead added successfully',
      leadId
    });
  } catch (error) {
    logger.error('Error adding lead', { error: error.message });
    res.status(500).json({
      success: false,
      message: `Error adding lead: ${error.message}`
    });
  }
});

module.exports = router;
