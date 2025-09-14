import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../database.js';

const router = express.Router();

/**
 * @route GET /api/leads
 * @desc Get all leads with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    // Build query based on filters
    let sql = `SELECT leads.*, 
               MAX(communications.date) as lastContact
               FROM leads 
               LEFT JOIN communications ON leads.id = communications.lead_id`;
    
    const params = [];
    const whereConditions = [];
    
    // Filter by status
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      const placeholders = statuses.map(() => '?').join(',');
      whereConditions.push(`status IN (${placeholders})`);
      params.push(...statuses);
    }
    
    // Filter by value range
    if (req.query.minValue) {
      whereConditions.push('estimated_value >= ?');
      params.push(req.query.minValue);
    }
    
    if (req.query.maxValue) {
      whereConditions.push('estimated_value <= ?');
      params.push(req.query.maxValue);
    }
    
    // Filter by location
    if (req.query.city) {
      whereConditions.push('city LIKE ?');
      params.push(`%${req.query.city}%`);
    }
    
    if (req.query.state) {
      whereConditions.push('state = ?');
      params.push(req.query.state);
    }
    
    if (req.query.zipCode) {
      whereConditions.push('zip_code = ?');
      params.push(req.query.zipCode);
    }
    
    // Filter by lead source
    if (req.query.leadSource) {
      const sources = Array.isArray(req.query.leadSource) ? req.query.leadSource : [req.query.leadSource];
      const placeholders = sources.map(() => '?').join(',');
      whereConditions.push(`lead_source IN (${placeholders})`);
      params.push(...sources);
    }
    
    // Filter by creation date
    if (req.query.createdAfter) {
      whereConditions.push('created_at >= ?');
      params.push(req.query.createdAfter);
    }
    
    if (req.query.createdBefore) {
      whereConditions.push('created_at <= ?');
      params.push(req.query.createdBefore);
    }
    
    // Filter by tags (requires joining with the tags table)
    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      
      // This adds a subquery for each tag that needs to be matched
      tags.forEach((tag, index) => {
        sql += `
          INNER JOIN lead_tags AS lt${index} 
          ON leads.id = lt${index}.lead_id AND lt${index}.tag = ?
        `;
        params.push(tag);
      });
    }
    
    // Add WHERE clause if there are any conditions
    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Group by lead id to handle the aggregate function (MAX date)
    sql += ' GROUP BY leads.id';
    
    // Sorting
    const sortField = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // Validate sort field to prevent SQL injection
    const validSortFields = ['created_at', 'updated_at', 'last_sale_date', 'estimated_value', 'lead_source', 'status', 'address', 'city', 'state', 'owner_name'];
    
    if (validSortFields.includes(sortField)) {
      sql += ` ORDER BY ${sortField} ${sortOrder}`;
      
      if (sortField !== 'id') {
        sql += ', id DESC'; // Secondary sort by ID for consistency
      }
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;
    
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
    
    console.log('Executing SQL:', sql);
    console.log('With parameters:', params);
    
    // Execute the query
    const leads = await db.all(sql, params);
    
    // Get tags for each lead
    for (const lead of leads) {
      const tags = await db.all(
        'SELECT tag FROM lead_tags WHERE lead_id = ?',
        [lead.id]
      );
      lead.tags = tags.map(t => t.tag);
    }
    
    // Format the response
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zip_code,
      ownerName: lead.owner_name,
      phoneNumber: lead.phone_number,
      email: lead.email,
      status: lead.status,
      leadSource: lead.lead_source,
      estimatedValue: lead.estimated_value,
      lastSalePrice: lead.last_sale_price,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      squareFeet: lead.square_feet,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      notes: lead.notes,
      tags: lead.tags,
      nextFollowUp: lead.next_follow_up,
      lastContact: lead.lastContact,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));
    
    res.json(formattedLeads);
  } catch (error) {
    console.error('Error getting leads:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
});

/**
 * @route GET /api/leads/:id
 * @desc Get a single lead by ID with all related data
 */
router.get('/:id', [
  param('id').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Get lead
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get tags
    const tags = await db.all(
      'SELECT tag FROM lead_tags WHERE lead_id = ?',
      [lead.id]
    );
    
    // Get communications
    const communications = await db.all(
      'SELECT * FROM communications WHERE lead_id = ? ORDER BY date DESC',
      [lead.id]
    );
    
    // Format communications
    const formattedCommunications = communications.map(comm => ({
      id: comm.id,
      leadId: comm.lead_id,
      date: comm.date,
      method: comm.method,
      notes: comm.notes,
      outcome: comm.outcome,
      createdAt: comm.created_at
    }));
    
    // Format the response
    const formattedLead = {
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zip_code,
      ownerName: lead.owner_name,
      phoneNumber: lead.phone_number,
      email: lead.email,
      status: lead.status,
      leadSource: lead.lead_source,
      estimatedValue: lead.estimated_value,
      lastSalePrice: lead.last_sale_price,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      squareFeet: lead.square_feet,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      notes: lead.notes,
      tags: tags.map(t => t.tag),
      nextFollowUp: lead.next_follow_up,
      communication: formattedCommunications,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
    
    res.json(formattedLead);
  } catch (error) {
    console.error('Error getting lead:', error);
    res.status(500).json({ error: 'Failed to get lead' });
  }
});

/**
 * @route POST /api/leads
 * @desc Create a new lead
 */
router.post('/', [
  body('address').isString().notEmpty(),
  body('city').isString().notEmpty(),
  body('state').isString().notEmpty(),
  body('zipCode').isString().notEmpty(),
  body('status').isString().notEmpty(),
  body('leadSource').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const {
      address,
      city,
      state,
      zipCode,
      ownerName,
      phoneNumber,
      email,
      status,
      leadSource,
      estimatedValue,
      lastSalePrice,
      propertyType,
      yearBuilt,
      squareFeet,
      bedrooms,
      bathrooms,
      notes,
      tags,
      nextFollowUp
    } = req.body;
    
    const now = new Date().toISOString();
    
    // Insert the lead
    const result = await db.run(
      `INSERT INTO leads (
        address, city, state, zip_code, owner_name, phone_number,
        email, status, lead_source, estimated_value, last_sale_price,
        property_type, year_built, square_feet, bedrooms, bathrooms,
        notes, next_follow_up, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        address, city, state, zipCode, ownerName, phoneNumber,
        email, status, leadSource, estimatedValue, lastSalePrice,
        propertyType, yearBuilt, squareFeet, bedrooms, bathrooms,
        notes, nextFollowUp, now, now
      ]
    );
    
    const leadId = result.lastID;
    
    // Insert tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await db.run(
          'INSERT INTO lead_tags (lead_id, tag, created_at) VALUES (?, ?, ?)',
          [leadId, tag, now]
        );
      }
    }
    
    // Return the created lead
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
    
    // Get tags
    const leadTags = await db.all(
      'SELECT tag FROM lead_tags WHERE lead_id = ?',
      [leadId]
    );
    
    // Format the response
    const formattedLead = {
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zip_code,
      ownerName: lead.owner_name,
      phoneNumber: lead.phone_number,
      email: lead.email,
      status: lead.status,
      leadSource: lead.lead_source,
      estimatedValue: lead.estimated_value,
      lastSalePrice: lead.last_sale_price,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      squareFeet: lead.square_feet,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      notes: lead.notes,
      tags: leadTags.map(t => t.tag),
      nextFollowUp: lead.next_follow_up,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
    
    res.status(201).json(formattedLead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * @route PUT /api/leads/:id
 * @desc Update an existing lead
 */
router.put('/:id', [
  param('id').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const {
      address,
      city,
      state,
      zipCode,
      ownerName,
      phoneNumber,
      email,
      status,
      leadSource,
      estimatedValue,
      lastSalePrice,
      propertyType,
      yearBuilt,
      squareFeet,
      bedrooms,
      bathrooms,
      notes,
      tags,
      nextFollowUp
    } = req.body;
    
    // Check if lead exists
    const existingLead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const now = new Date().toISOString();
    
    // Update the lead
    await db.run(
      `UPDATE leads SET
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        zip_code = COALESCE(?, zip_code),
        owner_name = ?,
        phone_number = ?,
        email = ?,
        status = COALESCE(?, status),
        lead_source = COALESCE(?, lead_source),
        estimated_value = ?,
        last_sale_price = ?,
        property_type = ?,
        year_built = ?,
        square_feet = ?,
        bedrooms = ?,
        bathrooms = ?,
        notes = ?,
        next_follow_up = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        address, city, state, zipCode, ownerName, phoneNumber,
        email, status, leadSource, estimatedValue, lastSalePrice,
        propertyType, yearBuilt, squareFeet, bedrooms, bathrooms,
        notes, nextFollowUp, now, req.params.id
      ]
    );
    
    // Update tags if provided
    if (tags && Array.isArray(tags)) {
      // Delete all existing tags
      await db.run(
        'DELETE FROM lead_tags WHERE lead_id = ?',
        [req.params.id]
      );
      
      // Insert new tags
      for (const tag of tags) {
        await db.run(
          'INSERT INTO lead_tags (lead_id, tag, created_at) VALUES (?, ?, ?)',
          [req.params.id, tag, now]
        );
      }
    }
    
    // Return the updated lead
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    
    // Get tags
    const leadTags = await db.all(
      'SELECT tag FROM lead_tags WHERE lead_id = ?',
      [req.params.id]
    );
    
    // Format the response
    const formattedLead = {
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zip_code,
      ownerName: lead.owner_name,
      phoneNumber: lead.phone_number,
      email: lead.email,
      status: lead.status,
      leadSource: lead.lead_source,
      estimatedValue: lead.estimated_value,
      lastSalePrice: lead.last_sale_price,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      squareFeet: lead.square_feet,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      notes: lead.notes,
      tags: leadTags.map(t => t.tag),
      nextFollowUp: lead.next_follow_up,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
    
    res.json(formattedLead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * @route DELETE /api/leads/:id
 * @desc Delete a lead and all related data
 */
router.delete('/:id', [
  param('id').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Delete communications
      await db.run(
        'DELETE FROM communications WHERE lead_id = ?',
        [req.params.id]
      );
      
      // Delete tags
      await db.run(
        'DELETE FROM lead_tags WHERE lead_id = ?',
        [req.params.id]
      );
      
      // Delete lead
      await db.run(
        'DELETE FROM leads WHERE id = ?',
        [req.params.id]
      );
      
      // Commit transaction
      await db.run('COMMIT');
      
      res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
      // Rollback transaction on error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * @route GET /api/leads/statuses
 * @desc Get all available lead statuses
 */
router.get('/statuses', async (req, res) => {
  try {
    const statuses = await db.all(
      'SELECT DISTINCT status FROM leads ORDER BY status'
    );
    
    res.json(statuses.map(row => row.status));
  } catch (error) {
    console.error('Error getting lead statuses:', error);
    res.status(500).json({ error: 'Failed to get lead statuses' });
  }
});

/**
 * @route GET /api/leads/tags
 * @desc Get all available tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await db.all(
      'SELECT DISTINCT tag FROM lead_tags ORDER BY tag'
    );
    
    res.json(tags.map(row => row.tag));
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

/**
 * @route POST /api/leads/:id/communications
 * @desc Add a communication to a lead
 */
router.post('/:id/communications', [
  param('id').isString().notEmpty(),
  body('date').isString().notEmpty(),
  body('method').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { date, method, notes, outcome } = req.body;
    
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const now = new Date().toISOString();
    
    // Insert the communication
    const result = await db.run(
      `INSERT INTO communications (
        lead_id, date, method, notes, outcome, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, date, method, notes, outcome, now]
    );
    
    // Update the lead's lastContact date
    await db.run(
      `UPDATE leads SET updated_at = ? WHERE id = ?`,
      [now, req.params.id]
    );
    
    // Return the created communication
    const communication = await db.get(
      'SELECT * FROM communications WHERE id = ?',
      [result.lastID]
    );
    
    // Format the response
    const formattedCommunication = {
      id: communication.id,
      leadId: communication.lead_id,
      date: communication.date,
      method: communication.method,
      notes: communication.notes,
      outcome: communication.outcome,
      createdAt: communication.created_at
    };
    
    res.status(201).json(formattedCommunication);
  } catch (error) {
    console.error('Error adding communication:', error);
    res.status(500).json({ error: 'Failed to add communication' });
  }
});

/**
 * @route GET /api/leads/:id/communications
 * @desc Get all communications for a lead
 */
router.get('/:id/communications', [
  param('id').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get communications
    const communications = await db.all(
      'SELECT * FROM communications WHERE lead_id = ? ORDER BY date DESC',
      [req.params.id]
    );
    
    // Format the response
    const formattedCommunications = communications.map(comm => ({
      id: comm.id,
      leadId: comm.lead_id,
      date: comm.date,
      method: comm.method,
      notes: comm.notes,
      outcome: comm.outcome,
      createdAt: comm.created_at
    }));
    
    res.json(formattedCommunications);
  } catch (error) {
    console.error('Error getting communications:', error);
    res.status(500).json({ error: 'Failed to get communications' });
  }
});

/**
 * @route POST /api/leads/:id/tags
 * @desc Add a tag to a lead
 */
router.post('/:id/tags', [
  param('id').isString().notEmpty(),
  body('tag').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { tag } = req.body;
    
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Check if tag already exists for this lead
    const existingTag = await db.get(
      'SELECT * FROM lead_tags WHERE lead_id = ? AND tag = ?',
      [req.params.id, tag]
    );
    
    if (existingTag) {
      // Tag already exists, no need to add
      return res.status(200).json({ message: 'Tag already exists' });
    }
    
    const now = new Date().toISOString();
    
    // Insert the tag
    await db.run(
      'INSERT INTO lead_tags (lead_id, tag, created_at) VALUES (?, ?, ?)',
      [req.params.id, tag, now]
    );
    
    // Get all tags for this lead
    const tags = await db.all(
      'SELECT tag FROM lead_tags WHERE lead_id = ?',
      [req.params.id]
    );
    
    res.status(201).json({
      id: lead.id,
      tags: tags.map(t => t.tag)
    });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

/**
 * @route DELETE /api/leads/:id/tags/:tag
 * @desc Remove a tag from a lead
 */
router.delete('/:id/tags/:tag', [
  param('id').isString().notEmpty(),
  param('tag').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Delete the tag
    await db.run(
      'DELETE FROM lead_tags WHERE lead_id = ? AND tag = ?',
      [req.params.id, req.params.tag]
    );
    
    // Get remaining tags
    const tags = await db.all(
      'SELECT tag FROM lead_tags WHERE lead_id = ?',
      [req.params.id]
    );
    
    res.json({
      id: lead.id,
      tags: tags.map(t => t.tag)
    });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

/**
 * @route POST /api/leads/:id/score
 * @desc Score a lead using AI
 */
router.post('/:id/score', [
  param('id').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Mock AI scoring logic for demonstration
    // In a real application, this would call a machine learning service
    const score = Math.floor(Math.random() * 100);
    const temperature = Math.random() * 4; // 0-4 scale
    
    // Update the lead with the score
    const now = new Date().toISOString();
    await db.run(
      'UPDATE leads SET ai_score = ?, ai_temperature = ?, updated_at = ? WHERE id = ?',
      [score, temperature, now, req.params.id]
    );
    
    res.json({
      id: lead.id,
      score,
      temperature,
      lastScored: now
    });
  } catch (error) {
    console.error('Error scoring lead:', error);
    res.status(500).json({ error: 'Failed to score lead' });
  }
});

/**
 * @route POST /api/leads/:id/feedback
 * @desc Submit feedback for a lead for AI training
 */
router.post('/:id/feedback', [
  param('id').isString().notEmpty(),
  body('label').isIn(['good', 'bad']).notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { label } = req.body;
    
    // Check if lead exists
    const lead = await db.get(
      'SELECT * FROM leads WHERE id = ?',
      [req.params.id]
    );
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const now = new Date().toISOString();
    
    // Store the feedback for AI training
    await db.run(
      `INSERT INTO lead_feedback (
        lead_id, feedback_label, created_at
      ) VALUES (?, ?, ?)`,
      [req.params.id, label, now]
    );
    
    res.json({
      id: lead.id,
      feedbackLabel: label,
      submittedAt: now
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
