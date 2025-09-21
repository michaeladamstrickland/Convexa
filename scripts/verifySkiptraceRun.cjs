#!/usr/bin/env node
// Verify a skip-trace backfill run and print a concise report.
// Inputs via env:
//  - OUT: path to output CSV
//  - DB: path to SQLite DB (used for provider_calls stats)
//  - API_BASE: backend base URL (optional; used for health)

const fs = require('fs');
const path = require('path');
let BetterSqlite3 = null;
try { BetterSqlite3 = require('better-sqlite3'); } catch (_) {}

const OUT = process.env.OUT;
const DB = process.env.DB;
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:6001';

if (!OUT || !fs.existsSync(OUT)) {
  console.error('Missing or invalid OUT path to CSV.');
  process.exit(1);
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(l => l.length > 0);
  const header = lines.shift();
  const rows = lines.map(line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/));
  return { header, rows };
}

function colIndex(header, name) {
  const cols = header.split(',');
  return cols.indexOf(name);
}

function runSql(sql, params = []) {
  if (!DB || !fs.existsSync(DB) || !BetterSqlite3) return null;
  try {
    const db = new BetterSqlite3(DB, { readonly: true });
    const stmt = db.prepare(sql);
    if (/^\s*select/i.test(sql)) {
      return stmt.all(...params);
    }
    return stmt.run(...params);
  } catch (e) { return null; }
}

function main() {
  const content = fs.readFileSync(OUT, 'utf8');
  const { header, rows } = parseCsv(content);
  const idx = {
    phone1: colIndex(header, 'Phone1'),
    email1: colIndex(header, 'Email1'),
  };
  const total = rows.length;
  const withPhone1 = rows.filter(r => (r[idx.phone1] || '').trim() !== '').length;
  const withEmail1 = rows.filter(r => (r[idx.email1] || '').trim() !== '').length;

  // Demo fingerprints
  const hasDemoEmail = content.includes('demo.convexa.local');
  const hasDemoPhone = /856-555-\d{4}/.test(content) || /\+1856555\d{4}/.test(content);

  // Provider usage today (UTC window)
  const dstr = new Date().toISOString().split('T')[0];
  const start = `${dstr}T00:00:00.000Z`;
  const end = `${dstr}T23:59:59.999Z`;
  const providerDist = runSql(
    'SELECT provider, COUNT(*) as count FROM provider_calls WHERE created_at BETWEEN ? AND ? GROUP BY provider',
    [start, end]
  );
  const latency = runSql(
    'SELECT provider, ROUND(AVG(duration_ms),0) as avg_ms, ROUND(SUM(cost),2) as total_cost FROM provider_calls WHERE created_at BETWEEN ? AND ? GROUP BY provider',
    [start, end]
  );

  // Sample enriched rows
  const samples = [];
  for (const r of rows) {
    if ((r[idx.phone1] || r[idx.email1] || '').trim() !== '') {
      samples.push(r);
      if (samples.length >= 5) break;
    }
  }

  // Print report
  console.log('--- Backfill Run Report ---');
  console.log(`File: ${OUT}`);
  console.log(`Total rows processed: ${total}`);
  console.log(`Rows with ≥1 phone: ${withPhone1}`);
  console.log(`Rows with ≥1 email: ${withEmail1}`);
  console.log(`Demo fingerprints present: ${hasDemoEmail || hasDemoPhone ? 'YES (FAIL)' : 'NO (PASS)'}`);
  if (providerDist && providerDist.length) {
    console.log('Provider distribution (today):');
    providerDist.forEach(p => console.log(`  - ${p.provider}: ${p.count}`));
  } else {
    console.log('Provider distribution: none recorded today or DB unavailable');
  }
  if (latency && latency.length) {
    console.log('Avg latency & total cost (today):');
    latency.forEach(p => console.log(`  - ${p.provider}: avg=${p.avg_ms}ms total_cost=$${p.total_cost}`));
  }
  if (samples.length) {
    console.log('Sample enriched rows (first 3-5):');
    for (let i=0;i<Math.min(5, samples.length);i++) {
      console.log(samples[i].join(','));
    }
  }
  console.log('ATTOM usage: not evaluated here (ensure endpoints were not called during this run).');
}

if (require.main === module) {
  main();
}
