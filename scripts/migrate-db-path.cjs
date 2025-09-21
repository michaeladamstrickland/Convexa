#!/usr/bin/env node
/*
  Migrate SQLite DB to a single canonical path: backend/data/convexa.db
  - Detect candidates: backend/data/convexa.db and backend/backend/data/convexa.db
  - Pick the larger/newer as source, backup to backups/convexa-<timestamp>.db
  - Copy to canonical path and VACUUM
*/
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function statSafe(p){ try { return fs.statSync(p); } catch { return null; } }
function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }

const root = path.resolve(__dirname, '..');
const candA = path.resolve(root, 'backend', 'data', 'convexa.db');
const candB = path.resolve(root, 'backend', 'backend', 'data', 'convexa.db');
const canonical = candA;
const sa = statSafe(candA);
const sb = statSafe(candB);
if(!sa && !sb){
  console.error('No DB files found at', candA, 'or', candB);
  process.exit(2);
}
const pick = (!sb || (sa && sa.size >= sb.size)) ? candA : candB;
const pickStat = statSafe(pick);
console.log('Selected source DB:', pick, `(size=${pickStat?.size||0})`);

// Backup source
const backupDir = path.resolve(root, 'backups');
ensureDir(backupDir);
const ts = new Date().toISOString().replace(/[:.]/g,'-');
const backupPath = path.resolve(backupDir, `convexa-${ts}.db`);
fs.copyFileSync(pick, backupPath);
console.log('Backup written:', backupPath);

// Copy to canonical path
ensureDir(path.dirname(canonical));
fs.copyFileSync(pick, canonical);
console.log('Canonical written:', canonical);

// VACUUM canonical
try{
  const db = new Database(canonical);
  db.exec('VACUUM');
  db.close();
  console.log('VACUUM complete.');
}catch(e){
  console.warn('VACUUM failed:', e.message);
}

console.log('Done. Set SQLITE_DB_PATH=backend/data/convexa.db');
