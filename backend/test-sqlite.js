// Simple test script for SQLite database access using better-sqlite3

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the database file
function findDatabaseFile() {
  const possiblePaths = [
    path.resolve(__dirname, 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db')
  ];

  console.log('Looking for database file in:');
  for (const p of possiblePaths) {
    console.log(`  - ${p}`);
    if (fs.existsSync(p)) {
      console.log(`✓ Found at: ${p}`);
      return p;
    }
  }

  console.error('❌ Database file not found in any of the expected locations');
  console.log('Current working directory:', process.cwd());
  return null;
}

// Main function
async function main() {
  console.log('====== SQLITE DATABASE TEST ======');
  
  const dbPath = findDatabaseFile();
  if (!dbPath) {
    console.error('Database file not found. Exiting.');
    return;
  }
  
  // Check file size
  const stats = fs.statSync(dbPath);
  console.log(`Database file size: ${stats.size} bytes`);
  if (stats.size === 0) {
    console.log('Warning: Database file is empty (0 bytes)');
  }

  try {
    // Connect to the database
    console.log('Connecting to database...');
    const db = new BetterSqlite3(dbPath, { readonly: true });
    
    // List all tables
    console.log('\nTables in database:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    tables.forEach(table => console.log(` - ${table.name}`));
    
    if (tables.some(t => t.name === 'leads')) {
      // Count leads
      const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      console.log(`\nFound ${leadCount.count} leads in the database.`);
      
      // Show schema
      console.log('\nLead table schema:');
      const columns = db.prepare('PRAGMA table_info(leads)').all();
      columns.forEach(col => {
        console.log(` - ${col.name} (${col.type})${col.pk ? ' [PRIMARY KEY]' : ''}`);
      });
      
      // Sample data
      if (leadCount.count > 0) {
        console.log('\nSample lead:');
        const sampleLead = db.prepare('SELECT * FROM leads LIMIT 1').get();
        console.log(JSON.stringify(sampleLead, null, 2));
        
        // Search functionality
        console.log('\nTesting search by ZIP code (85034):');
        const zipResults = db.prepare("SELECT * FROM leads WHERE address LIKE ?").all('%85034%');
        console.log(`Found ${zipResults.length} leads with ZIP code 85034`);
        if (zipResults.length > 0) {
          console.log(zipResults.map(lead => lead.address));
        }
      }
    }
    
    // Close the database
    db.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error accessing database:', error);
  }
  
  console.log('\n====== TEST COMPLETE ======');
}

main().catch(console.error);
