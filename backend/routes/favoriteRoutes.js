import express from 'express';
const router = express.Router();
import { db } from '../database/db.js';

/**
 * @route   GET /api/favorites
 * @desc    Get all property favorites
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Check if the favorites table exists, create it if not
    await db.exec(`
      CREATE TABLE IF NOT EXISTS property_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attom_id TEXT UNIQUE,
        address TEXT NOT NULL,
        property_type TEXT,
        estimated_value INTEGER,
        bedrooms INTEGER,
        bathrooms INTEGER,
        square_feet INTEGER,
        year_built INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get all favorites
    const favorites = db.prepare(`SELECT * FROM property_favorites ORDER BY created_at DESC`).all();
    
    res.json({ success: true, favorites });
  } catch (error) {
    console.error('Error getting favorites:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/favorites/:attomId
 * @desc    Get favorite by ATTOM ID
 * @access  Public
 */
router.get('/:attomId', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    const favorite = db.prepare(`SELECT * FROM property_favorites WHERE attom_id = ?`).get(attomId);
    
    if (!favorite) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }
    
    res.json({ success: true, favorite });
  } catch (error) {
    console.error('Error getting favorite:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   POST /api/favorites
 * @desc    Add a new property favorite
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const {
      attom_id,
      address,
      property_type,
      estimated_value,
      bedrooms,
      bathrooms,
      square_feet,
      year_built,
      notes
    } = req.body;
    
    // Validate required fields
    if (!attom_id || !address) {
      return res.status(400).json({ success: false, message: 'ATTOM ID and address are required' });
    }
    
    // Check if already exists
    const existing = db.prepare(`SELECT id FROM property_favorites WHERE attom_id = ?`).get(attom_id);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Property is already in favorites' });
    }
    
    // Insert new favorite
    const result = db.prepare(`
      INSERT INTO property_favorites (
        attom_id, address, property_type, estimated_value, 
        bedrooms, bathrooms, square_feet, year_built, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attom_id, 
      address, 
      property_type || 'Unknown', 
      estimated_value || 0,
      bedrooms || 0,
      bathrooms || 0,
      square_feet || 0,
      year_built || 0,
      notes || ''
    );
    
    // Get the inserted favorite
    const favorite = db.prepare(`SELECT * FROM property_favorites WHERE id = ?`).get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message: 'Favorite added', favorite });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/favorites/:attomId
 * @desc    Update a property favorite
 * @access  Public
 */
router.put('/:attomId', async (req, res) => {
  try {
    const { attomId } = req.params;
    const {
      address,
      property_type,
      estimated_value,
      bedrooms,
      bathrooms,
      square_feet,
      year_built,
      notes
    } = req.body;
    
    // Check if exists
    const existing = db.prepare(`SELECT id FROM property_favorites WHERE attom_id = ?`).get(attomId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }
    
    // Update favorite
    db.prepare(`
      UPDATE property_favorites SET
        address = ?,
        property_type = ?,
        estimated_value = ?,
        bedrooms = ?,
        bathrooms = ?,
        square_feet = ?,
        year_built = ?,
        notes = ?
      WHERE attom_id = ?
    `).run(
      address,
      property_type || 'Unknown',
      estimated_value || 0,
      bedrooms || 0,
      bathrooms || 0,
      square_feet || 0,
      year_built || 0,
      notes || '',
      attomId
    );
    
    // Get the updated favorite
    const favorite = db.prepare(`SELECT * FROM property_favorites WHERE attom_id = ?`).get(attomId);
    
    res.json({ success: true, message: 'Favorite updated', favorite });
  } catch (error) {
    console.error('Error updating favorite:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/favorites/:attomId
 * @desc    Delete a property favorite
 * @access  Public
 */
router.delete('/:attomId', async (req, res) => {
  try {
    const { attomId } = req.params;
    
    // Check if exists
    const existing = db.prepare(`SELECT id FROM property_favorites WHERE attom_id = ?`).get(attomId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }
    
    // Delete favorite
    db.prepare(`DELETE FROM property_favorites WHERE attom_id = ?`).run(attomId);
    
    res.json({ success: true, message: 'Favorite deleted' });
  } catch (error) {
    console.error('Error deleting favorite:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
