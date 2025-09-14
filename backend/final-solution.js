// Final solution: Create a TypeScript file that will work with our database
// This file uses direct SQLite access to bypass Prisma client issues

// Simple test to demonstrate functional SQL search with ZIP codes
const testDatabase = async () => {
  // Use ES modules imports
  const sqlite3 = (await import('better-sqlite3')).default;
  const path = await import('path');
  const fs = await import('fs');
  
  // Find database file
  console.log('Looking for database file...');
  const rootDbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  
  if (!fs.existsSync(rootDbPath)) {
    console.error('Database file not found at', rootDbPath);
    return;
  }
  
  console.log('Database found at', rootDbPath);
  
  // Open database connection
  const db = sqlite3(rootDbPath, { readonly: true });
  
  // Check for tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:', tables.map(t => t.name));
  
  // Function to search by ZIP code
  const searchByZip = (zipCode) => {
    const stmt = db.prepare('SELECT * FROM leads WHERE address LIKE ?');
    return stmt.all(`%${zipCode}%`);
  };
  
  // Test a search
  const testZip = '85034';
  const results = searchByZip(testZip);
  
  console.log(`Found ${results.length} leads in ZIP code ${testZip}`);
  if (results.length > 0) {
    console.log('Properties:');
    results.forEach(lead => {
      console.log(`- ${lead.address} (Owner: ${lead.owner_name || 'Unknown'})`);
    });
  }
  
  // Function to format lead data
  const formatLeadForAPI = (lead) => {
    return {
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      estimatedValue: lead.estimated_value,
      motivationScore: lead.motivation_score,
      // Format other fields as needed
    };
  };
  
  // Example search functionality
  const searchLeads = (options = {}) => {
    const {
      query,
      minValue,
      maxValue,
      limit = 10,
      offset = 0,
    } = options;
    
    // Build SQL query with parameters
    let sql = 'SELECT * FROM leads';
    const params = [];
    const whereClauses = [];
    
    if (query) {
      whereClauses.push('(address LIKE ? OR owner_name LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }
    
    if (minValue) {
      whereClauses.push('estimated_value >= ?');
      params.push(minValue);
    }
    
    if (maxValue) {
      whereClauses.push('estimated_value <= ?');
      params.push(maxValue);
    }
    
    // Add WHERE clause if needed
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Add ORDER BY, LIMIT, and OFFSET
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    // Execute query
    const stmt = db.prepare(sql);
    const results = stmt.all(...params);
    
    // Format results
    return results.map(formatLeadForAPI);
  };
  
  // Try a general search
  const searchResults = searchLeads({
    minValue: 300000,
    limit: 5,
  });
  
  console.log(`\nGeneral search found ${searchResults.length} leads:`);
  searchResults.forEach(lead => {
    console.log(`- ${lead.propertyAddress} ($${lead.estimatedValue.toLocaleString()})`);
  });
  
  // Clean up
  db.close();
  console.log('\nDatabase connection closed.');
};

// Run the test
testDatabase().catch(console.error);
