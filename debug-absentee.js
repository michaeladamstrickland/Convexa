import sqlite3 from 'better-sqlite3';
import path from 'path';

// Open the same database
const dbPath = path.join(process.cwd(), 'backend/backend/data/convexa.db');
const db = sqlite3(dbPath);

console.log('Testing absentee campaign search query...');

// Reproduce the same logic as in the server
const type = 'absentee';
const where = [];
const params = [];

// Replicate the absentee case logic
where.push("(owner_name IS NOT NULL AND owner_name != '')");

console.log('where array:', where);
console.log('params array:', params);

const countSql = where.length ? 
  `SELECT COUNT(*) as total FROM leads WHERE ${where.join(' AND ')}` :
  'SELECT COUNT(*) as total FROM leads';

console.log('Count SQL:', countSql);

try {
  const totalCount = db.prepare(countSql).get(...params).total;
  console.log('Total count:', totalCount);
} catch (error) {
  console.error('Error:', error.message);
  console.error('SQL was:', countSql);
  console.error('Params were:', params);
}

db.close();