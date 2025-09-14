// Lead management routes for FlipTracker
import express from 'express';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all leads with optional filtering
router.get('/', async (req, res) => {
  try {
    const {
      status,
      leadSource,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      dateCreatedStart,
      dateCreatedEnd,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;
    
    // Build the SQL query
    let sql = `
      SELECT l.*, 
      (SELECT COUNT(*) FROM lead_communications lc WHERE lc.lead_id = l.id) as communication_count
      FROM leads l
    `;
    
    // Start building where clause
    let whereClauses = [];
    let params = [];
    
    // Apply filters
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      whereClauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params = params.concat(statuses);
    }
    
    if (leadSource) {
      const sources = Array.isArray(leadSource) ? leadSource : [leadSource];
      whereClauses.push(`lead_source IN (${sources.map(() => '?').join(', ')})`);
      params = params.concat(sources);
    }
    
    if (minValue) {
      whereClauses.push('estimated_value >= ?');
      params.push(parseFloat(minValue));
    }
    
    if (maxValue) {
      whereClauses.push('estimated_value <= ?');
      params.push(parseFloat(maxValue));
    }
    
    if (city) {
      whereClauses.push('city LIKE ?');
      params.push(`%${city}%`);
    }
    
    if (state) {
      whereClauses.push('state = ?');
      params.push(state);
    }
    
    if (zipCode) {
      whereClauses.push('zip_code = ?');
      params.push(zipCode);
    }
    
    if (dateCreatedStart) {
      whereClauses.push('created_at >= ?');
      params.push(dateCreatedStart);
    }
    
    if (dateCreatedEnd) {
      whereClauses.push('created_at <= ?');
      params.push(dateCreatedEnd);
    }
    
    // Finalize where clause
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Count total for pagination
    const countSql = sql.replace('SELECT l.*, (SELECT COUNT(*) FROM lead_communications lc WHERE lc.lead_id = l.id) as communication_count', 'SELECT COUNT(*) as total');
    const countResult = await db.get(countSql, params);
    const totalLeads = countResult.total;
    
    // Add sorting and pagination
    const sortField = sortBy === 'lastContact' ? 'last_contact' : 
                      sortBy === 'createdAt' ? 'created_at' : 
                      sortBy === 'estimatedValue' ? 'estimated_value' : 'created_at';
                      
    sql += ` ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    // Execute the query
    const leads = await db.all(sql, params);
    
    // Get tags for each lead
    const leadsWithTags = await Promise.all(leads.map(async (lead) => {
      const tagsSql = 'SELECT tag FROM lead_tags WHERE lead_id = ?';
      const tags = await db.all(tagsSql, [lead.id]);
      
      return {
        id: lead.id,
        propertyId: lead.property_id,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zipCode: lead.zip_code,
        ownerName: lead.owner_name,
        estimatedValue: lead.estimated_value,
        lastSalePrice: lead.last_sale_price,
        propertyType: lead.property_type,
        squareFeet: lead.square_feet,
        bedrooms: lead.bedrooms,
        bathrooms: lead.bathrooms,
        yearBuilt: lead.year_built,
        status: lead.status,
        notes: lead.notes,
        lastContact: lead.last_contact,
        nextFollowUp: lead.next_follow_up,
        leadSource: lead.lead_source,
        communicationCount: lead.communication_count,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        tags: tags.map(t => t.tag)
      };
    }));
    
    res.json({
      status: 'success',
      message: `Retrieved ${leads.length} leads`,
      leads: leadsWithTags,
      pagination: {
        total: totalLeads,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalLeads / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting leads:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving leads',
      error: error.message
    });
  }
});

// Get a lead by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the lead
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Get tags
    const tags = await db.all('SELECT tag FROM lead_tags WHERE lead_id = ?', [id]);
    
    // Get communication history
    const communications = await db.all(
      'SELECT * FROM lead_communications WHERE lead_id = ? ORDER BY date DESC', 
      [id]
    );
    
    // Format the lead
    const formattedLead = {
      id: lead.id,
      propertyId: lead.property_id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zip_code,
      ownerName: lead.owner_name,
      estimatedValue: lead.estimated_value,
      lastSalePrice: lead.last_sale_price,
      propertyType: lead.property_type,
      squareFeet: lead.square_feet,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      yearBuilt: lead.year_built,
      status: lead.status,
      notes: lead.notes,
      lastContact: lead.last_contact,
      nextFollowUp: lead.next_follow_up,
      leadSource: lead.lead_source,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      tags: tags.map(t => t.tag),
      communication: communications.map(c => ({
        id: c.id,
        leadId: c.lead_id,
        date: c.date,
        method: c.method,
        notes: c.notes,
        outcome: c.outcome,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
    };
    
    res.json({
      status: 'success',
      message: `Lead found with ID ${id}`,
      lead: formattedLead
    });
  } catch (error) {
    console.error(`Error getting lead with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving lead',
      error: error.message
    });
  }
});

// Create a new lead
router.post('/', async (req, res) => {
  try {
    const {
      propertyId,
      address,
      city,
      state,
      zipCode,
      ownerName,
      estimatedValue,
      lastSalePrice,
      propertyType,
      squareFeet,
      bedrooms,
      bathrooms,
      yearBuilt,
      status,
      notes,
      leadSource,
      tags
    } = req.body;
    
    // Validate required fields
    if (!address || !city || !state || !zipCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: address, city, state, and zipCode are required'
      });
    }
    
    // Generate a unique ID for the lead
    const leadId = uuidv4();
    const now = new Date().toISOString();
    
    // Check if a lead with this address already exists
    const existingLead = await db.get(
      'SELECT id FROM leads WHERE address = ? AND city = ? AND state = ? AND zip_code = ?',
      [address, city, state, zipCode]
    );
    
    if (existingLead) {
      return res.status(400).json({
        status: 'error',
        message: 'A lead with this address already exists',
        existingId: existingLead.id
      });
    }
    
    // Insert the lead
    const sql = `
      INSERT INTO leads (
        id, property_id, address, city, state, zip_code, owner_name,
        estimated_value, last_sale_price, property_type, square_feet,
        bedrooms, bathrooms, year_built, status, notes, lead_source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.run(sql, [
      leadId,
      propertyId || null,
      address,
      city,
      state,
      zipCode,
      ownerName || 'Unknown',
      estimatedValue || null,
      lastSalePrice || null,
      propertyType || null,
      squareFeet || null,
      bedrooms || null,
      bathrooms || null,
      yearBuilt || null,
      status || 'New',
      notes || '',
      leadSource || 'Property Search',
      now,
      now
    ]);
    
    // Add tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagInsertSql = 'INSERT INTO lead_tags (lead_id, tag) VALUES (?, ?)';
      for (const tag of tags) {
        await db.run(tagInsertSql, [leadId, tag]);
      }
    }
    
    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully',
      lead: {
        id: leadId,
        propertyId,
        address,
        city,
        state,
        zipCode,
        ownerName,
        estimatedValue,
        lastSalePrice,
        propertyType,
        squareFeet,
        bedrooms,
        bathrooms,
        yearBuilt,
        status: status || 'New',
        notes: notes || '',
        leadSource: leadSource || 'Property Search',
        createdAt: now,
        updatedAt: now,
        tags: tags || []
      }
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating lead',
      error: error.message
    });
  }
});

// Update a lead
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      propertyId,
      address,
      city,
      state,
      zipCode,
      ownerName,
      estimatedValue,
      lastSalePrice,
      propertyType,
      squareFeet,
      bedrooms,
      bathrooms,
      yearBuilt,
      status,
      notes,
      lastContact,
      nextFollowUp,
      leadSource,
      tags
    } = req.body;
    
    // Check if the lead exists
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Build update fields
    const updateFields = [];
    const params = [];
    
    if (propertyId !== undefined) {
      updateFields.push('property_id = ?');
      params.push(propertyId);
    }
    
    if (address !== undefined) {
      updateFields.push('address = ?');
      params.push(address);
    }
    
    if (city !== undefined) {
      updateFields.push('city = ?');
      params.push(city);
    }
    
    if (state !== undefined) {
      updateFields.push('state = ?');
      params.push(state);
    }
    
    if (zipCode !== undefined) {
      updateFields.push('zip_code = ?');
      params.push(zipCode);
    }
    
    if (ownerName !== undefined) {
      updateFields.push('owner_name = ?');
      params.push(ownerName);
    }
    
    if (estimatedValue !== undefined) {
      updateFields.push('estimated_value = ?');
      params.push(estimatedValue);
    }
    
    if (lastSalePrice !== undefined) {
      updateFields.push('last_sale_price = ?');
      params.push(lastSalePrice);
    }
    
    if (propertyType !== undefined) {
      updateFields.push('property_type = ?');
      params.push(propertyType);
    }
    
    if (squareFeet !== undefined) {
      updateFields.push('square_feet = ?');
      params.push(squareFeet);
    }
    
    if (bedrooms !== undefined) {
      updateFields.push('bedrooms = ?');
      params.push(bedrooms);
    }
    
    if (bathrooms !== undefined) {
      updateFields.push('bathrooms = ?');
      params.push(bathrooms);
    }
    
    if (yearBuilt !== undefined) {
      updateFields.push('year_built = ?');
      params.push(yearBuilt);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }
    
    if (lastContact !== undefined) {
      updateFields.push('last_contact = ?');
      params.push(lastContact);
    }
    
    if (nextFollowUp !== undefined) {
      updateFields.push('next_follow_up = ?');
      params.push(nextFollowUp);
    }
    
    if (leadSource !== undefined) {
      updateFields.push('lead_source = ?');
      params.push(leadSource);
    }
    
    // Add updated_at
    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    
    // Add the lead ID to the params
    params.push(id);
    
    // Update the lead if there are fields to update
    if (updateFields.length > 0) {
      const sql = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`;
      await db.run(sql, params);
    }
    
    // Update tags if provided
    if (tags !== undefined) {
      // Delete existing tags
      await db.run('DELETE FROM lead_tags WHERE lead_id = ?', [id]);
      
      // Insert new tags
      if (Array.isArray(tags) && tags.length > 0) {
        const tagInsertSql = 'INSERT INTO lead_tags (lead_id, tag) VALUES (?, ?)';
        for (const tag of tags) {
          await db.run(tagInsertSql, [id, tag]);
        }
      }
    }
    
    // Get the updated lead
    const updatedLead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    const updatedTags = await db.all('SELECT tag FROM lead_tags WHERE lead_id = ?', [id]);
    
    // Format the response
    const formattedLead = {
      id: updatedLead.id,
      propertyId: updatedLead.property_id,
      address: updatedLead.address,
      city: updatedLead.city,
      state: updatedLead.state,
      zipCode: updatedLead.zip_code,
      ownerName: updatedLead.owner_name,
      estimatedValue: updatedLead.estimated_value,
      lastSalePrice: updatedLead.last_sale_price,
      propertyType: updatedLead.property_type,
      squareFeet: updatedLead.square_feet,
      bedrooms: updatedLead.bedrooms,
      bathrooms: updatedLead.bathrooms,
      yearBuilt: updatedLead.year_built,
      status: updatedLead.status,
      notes: updatedLead.notes,
      lastContact: updatedLead.last_contact,
      nextFollowUp: updatedLead.next_follow_up,
      leadSource: updatedLead.lead_source,
      createdAt: updatedLead.created_at,
      updatedAt: updatedLead.updated_at,
      tags: updatedTags.map(t => t.tag)
    };
    
    res.json({
      status: 'success',
      message: 'Lead updated successfully',
      lead: formattedLead
    });
  } catch (error) {
    console.error(`Error updating lead with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating lead',
      error: error.message
    });
  }
});

// Delete a lead
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the lead exists
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Delete related records first
    await db.run('DELETE FROM lead_tags WHERE lead_id = ?', [id]);
    await db.run('DELETE FROM lead_communications WHERE lead_id = ?', [id]);
    
    // Delete the lead
    await db.run('DELETE FROM leads WHERE id = ?', [id]);
    
    res.json({
      status: 'success',
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting lead with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting lead',
      error: error.message
    });
  }
});

// Add communication entry to a lead
router.post('/:id/communication', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, method, notes, outcome } = req.body;
    
    // Check if the lead exists
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Validate required fields
    if (!date || !method) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: date and method are required'
      });
    }
    
    // Generate a unique ID for the communication
    const communicationId = uuidv4();
    const now = new Date().toISOString();
    
    // Insert the communication
    const sql = `
      INSERT INTO lead_communications (
        id, lead_id, date, method, notes, outcome, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.run(sql, [
      communicationId,
      id,
      date,
      method,
      notes || '',
      outcome || '',
      now,
      now
    ]);
    
    // Update the lead's last contact date
    await db.run('UPDATE leads SET last_contact = ?, updated_at = ? WHERE id = ?', [
      date,
      now,
      id
    ]);
    
    // Get the created communication
    const communication = {
      id: communicationId,
      leadId: id,
      date,
      method,
      notes: notes || '',
      outcome: outcome || '',
      createdAt: now,
      updatedAt: now
    };
    
    res.status(201).json({
      status: 'success',
      message: 'Communication added successfully',
      communication
    });
  } catch (error) {
    console.error(`Error adding communication to lead ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error adding communication',
      error: error.message
    });
  }
});

// Get lead statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total leads
    const totalLeads = await db.get('SELECT COUNT(*) as count FROM leads');
    
    // Get leads by status
    const statusCounts = await db.all(
      'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
    );
    
    // Get leads by source
    const sourceCounts = await db.all(
      'SELECT lead_source, COUNT(*) as count FROM leads GROUP BY lead_source'
    );
    
    // Get leads by city
    const cityCounts = await db.all(
      'SELECT city, COUNT(*) as count FROM leads GROUP BY city ORDER BY count DESC LIMIT 10'
    );
    
    // Get total estimated value
    const totalValue = await db.get(
      'SELECT SUM(estimated_value) as total FROM leads WHERE estimated_value IS NOT NULL'
    );
    
    // Get average estimated value
    const avgValue = await db.get(
      'SELECT AVG(estimated_value) as average FROM leads WHERE estimated_value IS NOT NULL'
    );
    
    // Get leads created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLeads = await db.get(
      'SELECT COUNT(*) as count FROM leads WHERE created_at >= ?',
      [thirtyDaysAgo.toISOString()]
    );
    
    // Format the response
    const stats = {
      totalLeads: totalLeads.count,
      byStatus: statusCounts,
      bySource: sourceCounts,
      byCities: cityCounts,
      totalEstimatedValue: totalValue.total,
      averageEstimatedValue: avgValue.average,
      recentLeads: recentLeads.count
    };
    
    res.json({
      status: 'success',
      message: 'Lead statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Error getting lead statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving lead statistics',
      error: error.message
    });
  }
});

// Get available lead statuses
router.get('/statuses', async (req, res) => {
  try {
    // Get all unique statuses
    const statuses = await db.all('SELECT DISTINCT status FROM leads');
    
    // Default statuses to include even if not in use
    const defaultStatuses = ['New', 'Contacted', 'Negotiating', 'Under Contract', 'Closed', 'Dead'];
    
    // Combine and deduplicate
    const allStatuses = [...new Set([
      ...defaultStatuses,
      ...statuses.map(s => s.status).filter(Boolean)
    ])];
    
    res.json({
      status: 'success',
      message: 'Lead statuses retrieved successfully',
      statuses: allStatuses
    });
  } catch (error) {
    console.error('Error getting lead statuses:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving lead statuses',
      error: error.message
    });
  }
});

// Add tags to a lead
router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    // Check if the lead exists
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Validate tags
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tags must be provided as a non-empty array'
      });
    }
    
    // Get existing tags
    const existingTags = await db.all('SELECT tag FROM lead_tags WHERE lead_id = ?', [id]);
    const existingTagValues = existingTags.map(t => t.tag);
    
    // Add new tags
    const tagInsertSql = 'INSERT INTO lead_tags (lead_id, tag) VALUES (?, ?)';
    for (const tag of tags) {
      if (!existingTagValues.includes(tag)) {
        await db.run(tagInsertSql, [id, tag]);
      }
    }
    
    // Update the lead's updated_at timestamp
    await db.run('UPDATE leads SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    
    // Get all tags for the lead
    const allTags = await db.all('SELECT tag FROM lead_tags WHERE lead_id = ?', [id]);
    
    res.json({
      status: 'success',
      message: 'Tags added successfully',
      lead: {
        id,
        tags: allTags.map(t => t.tag)
      }
    });
  } catch (error) {
    console.error(`Error adding tags to lead ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error adding tags',
      error: error.message
    });
  }
});

// Remove tags from a lead
router.delete('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    // Check if the lead exists
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [id]);
    
    if (!lead) {
      return res.status(404).json({
        status: 'error',
        message: `No lead found with ID ${id}`
      });
    }
    
    // Validate tags
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tags must be provided as a non-empty array'
      });
    }
    
    // Delete specified tags
    for (const tag of tags) {
      await db.run('DELETE FROM lead_tags WHERE lead_id = ? AND tag = ?', [id, tag]);
    }
    
    // Update the lead's updated_at timestamp
    await db.run('UPDATE leads SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    
    // Get remaining tags for the lead
    const remainingTags = await db.all('SELECT tag FROM lead_tags WHERE lead_id = ?', [id]);
    
    res.json({
      status: 'success',
      message: 'Tags removed successfully',
      lead: {
        id,
        tags: remainingTags.map(t => t.tag)
      }
    });
  } catch (error) {
    console.error(`Error removing tags from lead ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error removing tags',
      error: error.message
    });
  }
});

export default router;
