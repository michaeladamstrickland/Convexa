import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database file path
const DB_PATH = path.join(DATA_DIR, 'leadflow.db');

// Open database connection
let db;

async function initializeDatabase() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');
  
  // Create tables if they don't exist
  await createTables();
  
  return db;
}

async function createTables() {
  // Leads table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      owner_name TEXT,
      phone_number TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      lead_source TEXT NOT NULL,
      estimated_value REAL,
      last_sale_price REAL,
      property_type TEXT,
      year_built INTEGER,
      square_feet INTEGER,
      bedrooms INTEGER,
      bathrooms REAL,
      notes TEXT,
      next_follow_up TEXT,
      ai_score INTEGER,
      ai_temperature REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Lead tags table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      UNIQUE (lead_id, tag)
    )
  `);
  
  // Communications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      method TEXT NOT NULL,
      notes TEXT,
      outcome TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);
  
  // Lead feedback table for AI training
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      feedback_label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);
  
  console.log('Database tables created successfully');
}

// Helper methods to wrap database operations
const dbHelpers = {
  all: async (sql, params = []) => {
    return await db.all(sql, params);
  },
  
  get: async (sql, params = []) => {
    return await db.get(sql, params);
  },
  
  run: async (sql, params = []) => {
    return await db.run(sql, params);
  },
  
  exec: async (sql) => {
    return await db.exec(sql);
  }
};

// Initialize the database when the module is imported
initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

export default dbHelpers;
