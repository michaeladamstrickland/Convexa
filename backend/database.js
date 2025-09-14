/**
 * Database connection module
 * 
 * This module exports a better-sqlite3 database connection
 * to be used throughout the application
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current file's directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Possible database file locations
const possiblePaths = [
  path.resolve(__dirname, '..', 'prisma', 'dev.db'),
  path.resolve(__dirname, 'prisma', 'dev.db'),
  path.resolve(process.cwd(), 'prisma', 'dev.db')
];

// Find the database file
function findDatabaseFile() {
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      console.log(`Using database at: ${dbPath}`);
      return dbPath;
    }
  }
  
  // If no database file found, throw error
  throw new Error('Database file not found. Check if prisma/dev.db exists.');
}

// Create and export the database connection
const db = new BetterSqlite3(findDatabaseFile(), { readonly: false });

// Prepare pragmas for SQLite performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export default db;
