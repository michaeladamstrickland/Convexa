#!/usr/bin/env node

/**
 * Database Schema Dump Audit
 * Dumps SQLite schema to ops/findings/db_schema.sql
 * Validates that ops/sql/indexes.sql is idempotent
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const repoRoot = path.resolve(__dirname, '..', '..');

/**
 * Find SQLite database files in the project
 */
function findDatabaseFiles() {
  const dbPaths = [];
  const commonDbPaths = [
    'data/database.db',
    'data/convexa.db',
    'database.db',
    'app.db',
    'data/app.db',
    'backend/data/database.db',
    'backend/database.db',
    'src/data/database.db'
  ];

  for (const dbPath of commonDbPaths) {
    const fullPath = path.join(repoRoot, dbPath);
    if (fs.existsSync(fullPath)) {
      dbPaths.push(fullPath);
    }
  }

  // Check if DATABASE_URL is specified in .env or .env.example
  const envFiles = ['.env', '.env.example', '.env.local'];
  for (const envFile of envFiles) {
    const envPath = path.join(repoRoot, envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('DATABASE_URL=') || line.startsWith('DB_PATH=')) {
          const url = line.split('=')[1]?.trim();
          if (url && url.startsWith('sqlite:')) {
            const sqlitePath = url.replace('sqlite:', '');
            const fullPath = path.resolve(repoRoot, sqlitePath);
            if (fs.existsSync(fullPath) && !dbPaths.includes(fullPath)) {
              dbPaths.push(fullPath);
            }
          } else if (url && !url.startsWith('http') && !url.startsWith('postgres')) {
            // Assume it's a file path
            const fullPath = path.resolve(repoRoot, url);
            if (fs.existsSync(fullPath) && !dbPaths.includes(fullPath)) {
              dbPaths.push(fullPath);
            }
          }
        }
      }
    }
  }

  return dbPaths;
}

/**
 * Extract schema from SQLite database
 */
function extractSchema(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(new Error(`Cannot open database ${dbPath}: ${err.message}`));
        return;
      }
    });

    const schema = {
      tables: [],
      views: [],
      indexes: [],
      triggers: []
    };

    // Get all schema objects
    const query = `
      SELECT 
        type,
        name,
        sql,
        tbl_name
      FROM sqlite_master 
      WHERE sql IS NOT NULL 
      ORDER BY type, name
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      for (const row of rows) {
        switch (row.type) {
          case 'table':
            schema.tables.push({
              name: row.name,
              sql: row.sql
            });
            break;
          case 'view':
            schema.views.push({
              name: row.name,
              sql: row.sql
            });
            break;
          case 'index':
            if (!row.name.startsWith('sqlite_')) { // Skip auto-generated indexes
              schema.indexes.push({
                name: row.name,
                table: row.tbl_name,
                sql: row.sql
              });
            }
            break;
          case 'trigger':
            schema.triggers.push({
              name: row.name,
              table: row.tbl_name,
              sql: row.sql
            });
            break;
        }
      }

      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(schema);
        }
      });
    });
  });
}

/**
 * Get table information including column details
 */
function getTableInfo(dbPath, tableName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    // Get column info
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      // Get foreign keys
      db.all(`PRAGMA foreign_key_list(${tableName})`, [], (err, foreignKeys) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        // Get indexes for this table
        db.all(`PRAGMA index_list(${tableName})`, [], (err, indexes) => {
          db.close();
          if (err) {
            reject(err);
            return;
          }

          resolve({
            columns,
            foreignKeys,
            indexes
          });
        });
      });
    });
  });
}

/**
 * Generate SQL schema dump
 */
async function generateSchemaDump(dbPath) {
  try {
    const schema = await extractSchema(dbPath);
    let sql = `-- SQLite Schema Dump\n`;
    sql += `-- Generated from: ${path.relative(repoRoot, dbPath)}\n`;
    sql += `-- Generated at: ${new Date().toISOString()}\n\n`;

    sql += `-- Disable foreign key constraints during schema creation\n`;
    sql += `PRAGMA foreign_keys = OFF;\n\n`;

    // Tables
    if (schema.tables.length > 0) {
      sql += `-- Tables\n`;
      for (const table of schema.tables) {
        sql += `${table.sql};\n\n`;
        
        // Get detailed table info
        try {
          const tableInfo = await getTableInfo(dbPath, table.name);
          
          // Add comments about columns
          sql += `-- Table: ${table.name}\n`;
          sql += `-- Columns:\n`;
          for (const col of tableInfo.columns) {
            sql += `--   ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}\n`;
          }
          
          if (tableInfo.foreignKeys.length > 0) {
            sql += `-- Foreign Keys:\n`;
            for (const fk of tableInfo.foreignKeys) {
              sql += `--   ${fk.from} -> ${fk.table}.${fk.to}\n`;
            }
          }
          
          sql += `\n`;
        } catch (error) {
          sql += `-- Error getting table info for ${table.name}: ${error.message}\n\n`;
        }
      }
    }

    // Views
    if (schema.views.length > 0) {
      sql += `-- Views\n`;
      for (const view of schema.views) {
        sql += `${view.sql};\n\n`;
      }
    }

    // Indexes
    if (schema.indexes.length > 0) {
      sql += `-- Indexes\n`;
      for (const index of schema.indexes) {
        sql += `${index.sql};\n`;
      }
      sql += `\n`;
    }

    // Triggers
    if (schema.triggers.length > 0) {
      sql += `-- Triggers\n`;
      for (const trigger of schema.triggers) {
        sql += `${trigger.sql};\n\n`;
      }
    }

    sql += `-- Re-enable foreign key constraints\n`;
    sql += `PRAGMA foreign_keys = ON;\n`;

    return {
      sql,
      stats: {
        tables: schema.tables.length,
        views: schema.views.length,
        indexes: schema.indexes.length,
        triggers: schema.triggers.length
      }
    };

  } catch (error) {
    throw new Error(`Schema extraction failed: ${error.message}`);
  }
}

/**
 * Validate that indexes.sql is idempotent
 */
function validateIndexesSql() {
  const indexesSqlPath = path.join(repoRoot, 'ops', 'sql', 'indexes.sql');
  
  if (!fs.existsSync(indexesSqlPath)) {
    return {
      exists: false,
      idempotent: false,
      issues: ['File ops/sql/indexes.sql does not exist']
    };
  }

  const content = fs.readFileSync(indexesSqlPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
  
  const issues = [];
  let idempotent = true;

  // Check for CREATE INDEX statements
  const createIndexStatements = lines.filter(line => 
    line.toUpperCase().startsWith('CREATE INDEX') || 
    line.toUpperCase().startsWith('CREATE UNIQUE INDEX')
  );

  for (const statement of createIndexStatements) {
    // Check if it uses IF NOT EXISTS
    if (!statement.toUpperCase().includes('IF NOT EXISTS')) {
      issues.push(`Non-idempotent CREATE INDEX: ${statement.substring(0, 50)}...`);
      idempotent = false;
    }
  }

  // Check for DROP INDEX statements
  const dropIndexStatements = lines.filter(line => 
    line.toUpperCase().startsWith('DROP INDEX')
  );

  for (const statement of dropIndexStatements) {
    // Check if it uses IF EXISTS
    if (!statement.toUpperCase().includes('IF EXISTS')) {
      issues.push(`Non-idempotent DROP INDEX: ${statement.substring(0, 50)}...`);
      idempotent = false;
    }
  }

  return {
    exists: true,
    idempotent,
    issues,
    stats: {
      totalLines: lines.length,
      createIndexStatements: createIndexStatements.length,
      dropIndexStatements: dropIndexStatements.length
    }
  };
}

/**
 * Create idempotent indexes.sql template if it doesn't exist
 */
function createIndexesTemplate(schemaStats) {
  const indexesSqlPath = path.join(repoRoot, 'ops', 'sql', 'indexes.sql');
  
  if (fs.existsSync(indexesSqlPath)) {
    return false; // Don't overwrite existing file
  }

  // Ensure directory exists
  const opsDir = path.dirname(indexesSqlPath);
  if (!fs.existsSync(opsDir)) {
    fs.mkdirSync(opsDir, { recursive: true });
  }

  const template = `-- Database Indexes
-- This file should be idempotent - safe to run multiple times
-- Generated at: ${new Date().toISOString()}

-- Performance indexes for common queries
-- Add your indexes here using CREATE INDEX IF NOT EXISTS

-- Example indexes (uncomment and modify as needed):
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- CREATE INDEX IF NOT EXISTS idx_properties_address ON properties(address);
-- CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
-- CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- To drop an index, use:
-- DROP INDEX IF EXISTS index_name;

-- Notes:
-- - Always use IF NOT EXISTS for CREATE INDEX
-- - Always use IF EXISTS for DROP INDEX  
-- - Test performance impact before adding indexes
-- - Document the purpose of each index
`;

  fs.writeFileSync(indexesSqlPath, template);
  return true;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Starting database schema audit...');
    
    // Find database files
    const dbPaths = findDatabaseFiles();
    
    if (dbPaths.length === 0) {
      console.log('⚠️  No SQLite database files found');
      console.log('   Looked for common database file patterns');
      console.log('   If you have a database, ensure it\'s accessible');
    }

    const report = {
      generatedAt: new Date().toISOString(),
      databases: [],
      indexesValidation: null,
      summary: {
        totalDatabases: dbPaths.length,
        totalTables: 0,
        totalIndexes: 0,
        indexesSqlStatus: 'missing'
      }
    };

    // Process each database
    for (const dbPath of dbPaths) {
      try {
        console.log(`📊 Extracting schema from: ${path.relative(repoRoot, dbPath)}`);
        
        const schemaDump = await generateSchemaDump(dbPath);
        const relativePath = path.relative(repoRoot, dbPath);
        
        report.databases.push({
          path: relativePath,
          stats: schemaDump.stats,
          schemaFile: `db_schema_${path.basename(dbPath, '.db')}.sql`
        });

        report.summary.totalTables += schemaDump.stats.tables;
        report.summary.totalIndexes += schemaDump.stats.indexes;

        // Write schema dump
        const schemaOutputPath = path.join(
          repoRoot, 
          'ops', 
          'findings', 
          `db_schema_${path.basename(dbPath, '.db')}.sql`
        );
        
        fs.writeFileSync(schemaOutputPath, schemaDump.sql);
        console.log(`📄 Schema dump written to: ${path.relative(repoRoot, schemaOutputPath)}`);
        console.log(`   - ${schemaDump.stats.tables} tables`);
        console.log(`   - ${schemaDump.stats.views} views`);
        console.log(`   - ${schemaDump.stats.indexes} indexes`);
        console.log(`   - ${schemaDump.stats.triggers} triggers`);

      } catch (error) {
        console.error(`❌ Error processing ${dbPath}:`, error.message);
        report.databases.push({
          path: path.relative(repoRoot, dbPath),
          error: error.message
        });
      }
    }

    // Validate indexes.sql
    console.log('\\n🔧 Validating ops/sql/indexes.sql...');
    const indexesValidation = validateIndexesSql();
    report.indexesValidation = indexesValidation;

    if (!indexesValidation.exists) {
      console.log('📝 Creating ops/sql/indexes.sql template...');
      const created = createIndexesTemplate(report.summary);
      if (created) {
        console.log('✅ Created idempotent indexes.sql template');
        report.summary.indexesSqlStatus = 'created';
      }
    } else if (!indexesValidation.idempotent) {
      console.log('⚠️  ops/sql/indexes.sql is not idempotent:');
      indexesValidation.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
      report.summary.indexesSqlStatus = 'non-idempotent';
    } else {
      console.log('✅ ops/sql/indexes.sql is idempotent');
      report.summary.indexesSqlStatus = 'valid';
    }

    // Write audit report
    const reportPath = path.join(repoRoot, 'ops', 'findings', 'db_audit_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\\n📄 Database audit report written to: ${path.relative(repoRoot, reportPath)}`);

    // Summary
    console.log('\\n✅ Database schema audit completed!');
    console.log(`   - ${report.summary.totalDatabases} databases processed`);
    console.log(`   - ${report.summary.totalTables} total tables`);
    console.log(`   - ${report.summary.totalIndexes} total indexes`);
    console.log(`   - indexes.sql status: ${report.summary.indexesSqlStatus}`);

    if (report.summary.indexesSqlStatus === 'non-idempotent') {
      console.log('\\n💡 Recommendations:');
      console.log('   - Add IF NOT EXISTS to CREATE INDEX statements');
      console.log('   - Add IF EXISTS to DROP INDEX statements');
      console.log('   - This ensures the script can be run multiple times safely');
    }

  } catch (error) {
    console.error('❌ Database schema audit failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractSchema, validateIndexesSql, generateSchemaDump };