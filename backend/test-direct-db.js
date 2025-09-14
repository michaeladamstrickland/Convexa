#!/usr/bin/env node

// Script to test SQLite database connection directly

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDatabaseConnection() {
  try {
    // Import better-sqlite3
    const Database = (await import('better-sqlite3')).default;
    
    // Try multiple possible database paths
    const possiblePaths = [
      path.resolve(__dirname, '..', 'prisma', 'dev.db'),
      path.resolve(__dirname, 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'prisma', 'dev.db')
    ];
    
    console.log('Searching for SQLite database file...');
    let dbPath = null;
    
    for (const p of possiblePaths) {
      console.log(`Checking ${p}...`);
      if (fs.existsSync(p)) {
        console.log(`✓ Database file found at: ${p}`);
        dbPath = p;
        break;
      }
    }
    
    if (!dbPath) {
      console.error('❌ Could not find database file in any expected locations');
      
      // List the prisma directory contents if it exists
      const prismaDir = path.resolve(__dirname, '..', 'prisma');
      if (fs.existsSync(prismaDir)) {
        console.log(`Contents of ${prismaDir}:`);
        console.log(fs.readdirSync(prismaDir));
      }
      
      return;
    }
    
    console.log('Opening SQLite database...');
    const db = new Database(dbPath, { readonly: true });
    
    // Check if the leads table exists
    console.log('Checking database tables...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:', tables.map(t => t.name));
    
    // Count leads if the table exists
    if (tables.some(t => t.name === 'leads')) {
      const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      console.log(`✓ Database access successful. Found ${leadCount.count} leads.`);
      
      if (leadCount.count > 0) {
        const sampleLead = db.prepare('SELECT * FROM leads LIMIT 1').get();
        console.log('Sample lead fields:', Object.keys(sampleLead));
        console.log('Sample lead:', JSON.stringify(sampleLead, null, 2));
      }
    } else {
      console.log('❌ Leads table not found in the database.');
    }
    
    // Close the database connection
    db.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}

console.log('===== TESTING DIRECT SQLITE DATABASE CONNECTION =====');
testDatabaseConnection().then(() => {
  console.log('===== DATABASE TEST COMPLETED =====');
});
