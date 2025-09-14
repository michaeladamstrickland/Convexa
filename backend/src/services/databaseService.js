/**
 * Enhanced database connection module with error handling and connection pooling
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';

// Get current file's directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for storing prepared statements
const statementCache = new NodeCache({ 
  stdTTL: 3600, // Cache statements for 1 hour
  checkperiod: 120, // Check for expired entries every 2 minutes
  useClones: false // Store references, don't clone objects
});

// Database configuration
const DB_CONFIG = {
  readonly: false,
  fileMustExist: true,
  timeout: 5000, // ms to wait when executing queries on a locked database
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
};

// Possible database file locations
const DB_PATHS = {
  prisma: [
    path.resolve(__dirname, '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db')
  ],
  leadflow: [
    path.resolve(__dirname, '..', 'data', 'leadflow.db'),
    path.resolve(__dirname, 'data', 'leadflow.db'),
    path.resolve(process.cwd(), 'data', 'leadflow.db')
  ],
  skipTrace: [
    path.resolve(__dirname, '..', 'data', 'skip_trace.db'),
    path.resolve(__dirname, 'data', 'skip_trace.db'),
    path.resolve(process.cwd(), 'data', 'skip_trace.db')
  ]
};

/**
 * Find a database file from possible locations
 * 
 * @param {Array<string>} paths - Possible paths to database file
 * @returns {string} The path to the database file
 * @throws {Error} If database file not found
 */
function findDatabaseFile(paths) {
  for (const dbPath of paths) {
    if (fs.existsSync(dbPath)) {
      console.log(`Using database at: ${dbPath}`);
      return dbPath;
    }
  }
  
  // If no database file found, throw error
  throw new Error('Database file not found. Check database paths.');
}

/**
 * Create a database connection with error handling
 * 
 * @param {string} dbType - Type of database (prisma, leadflow, skipTrace)
 * @returns {BetterSqlite3.Database} Database connection
 */
function createDatabaseConnection(dbType) {
  try {
    const paths = DB_PATHS[dbType];
    
    if (!paths) {
      throw new Error(`Unknown database type: ${dbType}`);
    }
    
    const dbPath = findDatabaseFile(paths);
    const db = new BetterSqlite3(dbPath, DB_CONFIG);
    
    // Set pragmas for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('temp_store = MEMORY');
    
    return db;
  } catch (error) {
    console.error(`Failed to connect to ${dbType} database:`, error);
    
    // For development, create an in-memory database as fallback
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Using in-memory ${dbType} database as fallback`);
      const db = new BetterSqlite3(':memory:', { verbose: console.log });
      
      // Set pragmas for better performance
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');
      
      return db;
    }
    
    throw error;
  }
}

/**
 * Get a cached prepared statement or prepare a new one
 * 
 * @param {BetterSqlite3.Database} db - Database connection
 * @param {string} sql - SQL query
 * @returns {BetterSqlite3.Statement} Prepared statement
 */
function getPreparedStatement(db, sql) {
  const cacheKey = `${db.name}:${sql}`;
  
  let stmt = statementCache.get(cacheKey);
  
  if (!stmt) {
    stmt = db.prepare(sql);
    statementCache.set(cacheKey, stmt);
  }
  
  return stmt;
}

/**
 * Execute a query with error handling
 * 
 * @param {BetterSqlite3.Database} db - Database connection
 * @param {string} sql - SQL query
 * @param {Object|Array} params - Query parameters
 * @returns {*} Query result
 */
function executeQuery(db, sql, params = {}) {
  try {
    const stmt = getPreparedStatement(db, sql);
    return stmt.run(params);
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', JSON.stringify(params));
    throw error;
  }
}

/**
 * Execute a query that returns all rows
 * 
 * @param {BetterSqlite3.Database} db - Database connection
 * @param {string} sql - SQL query
 * @param {Object|Array} params - Query parameters
 * @returns {Array} Query results
 */
function executeQueryAll(db, sql, params = {}) {
  try {
    const stmt = getPreparedStatement(db, sql);
    return stmt.all(params);
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', JSON.stringify(params));
    throw error;
  }
}

/**
 * Execute a query that returns a single row
 * 
 * @param {BetterSqlite3.Database} db - Database connection
 * @param {string} sql - SQL query
 * @param {Object|Array} params - Query parameters
 * @returns {Object|undefined} Query result
 */
function executeQueryGet(db, sql, params = {}) {
  try {
    const stmt = getPreparedStatement(db, sql);
    return stmt.get(params);
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', JSON.stringify(params));
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 * 
 * @param {BetterSqlite3.Database} db - Database connection
 * @param {Function} callback - Transaction function
 * @returns {*} Transaction result
 */
function executeTransaction(db, callback) {
  try {
    const transaction = db.transaction(callback);
    return transaction();
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}

// Create database connections
const prismaDb = createDatabaseConnection('prisma');
const leadflowDb = createDatabaseConnection('leadflow');
const skipTraceDb = createDatabaseConnection('skipTrace');

// Create a generic query interface
const db = {
  // Direct database connections
  prisma: prismaDb,
  leadflow: leadflowDb,
  skipTrace: skipTraceDb,
  
  // Helper functions
  execute: (sql, params) => executeQuery(leadflowDb, sql, params),
  executeAll: (sql, params) => executeQueryAll(leadflowDb, sql, params),
  executeGet: (sql, params) => executeQueryGet(leadflowDb, sql, params),
  transaction: (callback) => executeTransaction(leadflowDb, callback),
  
  // Prepared statement management
  prepareStatement: (sql) => getPreparedStatement(leadflowDb, sql),
  clearStatementCache: () => statementCache.flushAll(),
  
  // Database specific methods
  prisma: {
    execute: (sql, params) => executeQuery(prismaDb, sql, params),
    executeAll: (sql, params) => executeQueryAll(prismaDb, sql, params),
    executeGet: (sql, params) => executeQueryGet(prismaDb, sql, params),
    transaction: (callback) => executeTransaction(prismaDb, callback)
  },
  skipTrace: {
    execute: (sql, params) => executeQuery(skipTraceDb, sql, params),
    executeAll: (sql, params) => executeQueryAll(skipTraceDb, sql, params),
    executeGet: (sql, params) => executeQueryGet(skipTraceDb, sql, params),
    transaction: (callback) => executeTransaction(skipTraceDb, callback)
  }
};

// Setup cleanup on exit
process.on('SIGINT', () => {
  console.log('Closing database connections...');
  prismaDb.close();
  leadflowDb.close();
  skipTraceDb.close();
  process.exit();
});

export default db;
