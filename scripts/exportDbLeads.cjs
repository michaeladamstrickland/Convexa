#!/usr/bin/env node
/**
 * Export leads from local SQLite DB for specified ZIP codes to CSV.
 * No external API calls. Uses normalized phone/email tables when available.
 *
 * Env vars:
 *  - DB_PATH: optional path to sqlite db (defaults to backend/prisma/dev.db)
 *  - ZIPS: comma-separated list of zip codes (e.g., "08108,08109,08030")
 *  - OUT: output CSV filepath (defaults to LeadDump_SouthNJ_full.csv)
 */

const fs = require('fs');
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

const ROOT = process.cwd();
const DEFAULT_DB = path.resolve(ROOT, 'backend', 'prisma', 'dev.db');
const DB_PATH = process.env.DB_PATH || process.env.SQLITE_DB_PATH || DEFAULT_DB;
const ZIPS = (process.env.ZIPS || '08108,08109,08030,08059,08002,08102,08104,08016,08065,08031')
  .split(',')
  .map(z => z.trim())
  .filter(Boolean);
const OUT = process.env.OUT || path.resolve(ROOT, `LeadDump_SouthNJ_full.csv`);

function parseCityStateZip(address) {
  // Expect format like: "218 HADDON AVE, COLLINGSWOOD, NJ 08108"
  if (!address) return { city: '', state: '', zip: '' };
  const parts = String(address).split(',').map(s => s.trim());
  // parts[1] -> city, parts[2] -> "NJ 08108"
  const city = parts[1] || '';
  const stateZip = parts[2] || '';
  const m = stateZip.match(/([A-Z]{2})\s*(\d{5})/);
  return {
    city,
    state: m ? m[1] : '',
    zip: m ? m[2] : ''
  };
}

function toCsvRow(values) {
  return values.map(v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

function main() {
  console.log(`[SQLite] Using DB at: ${DB_PATH}`);
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new BetterSqlite3(DB_PATH, { readonly: true });

  // Build WHERE clause to match any of the ZIPS in address string
  const orClauses = ZIPS.map(() => 'address LIKE ?').join(' OR ');
  const params = ZIPS.map(z => `%${z}%`);

  // Fetch leads and attach phones/emails from normalized tables when present
  const leads = db.prepare(`
    SELECT * FROM leads
    WHERE ${orClauses}
    ORDER BY created_at DESC
  `).all(...params);

  // Index phones/emails by lead_id if tables exist
  let phonesByLead = new Map();
  let emailsByLead = new Map();
  try {
    const phoneRows = db.prepare(`
      SELECT lead_id, phone_number as number, is_primary as isPrimary
      FROM phone_numbers
      WHERE lead_id IN (${leads.map(() => '?').join(',')})
      ORDER BY is_primary DESC, confidence DESC
    `).all(...leads.map(l => l.id));
    for (const r of phoneRows) {
      const arr = phonesByLead.get(r.lead_id) || [];
      arr.push({ number: r.number, isPrimary: r.isPrimary === 1 });
      phonesByLead.set(r.lead_id, arr);
    }
  } catch (_) {
    // table may not exist; ignore
  }
  try {
    const emailRows = db.prepare(`
      SELECT lead_id, email_address as address, is_primary as isPrimary
      FROM email_addresses
      WHERE lead_id IN (${leads.map(() => '?').join(',')})
      ORDER BY is_primary DESC, confidence DESC
    `).all(...leads.map(l => l.id));
    for (const r of emailRows) {
      const arr = emailsByLead.get(r.lead_id) || [];
      arr.push({ address: r.address, isPrimary: r.isPrimary === 1 });
      emailsByLead.set(r.lead_id, arr);
    }
  } catch (_) {
    // table may not exist; ignore
  }

  // Prepare CSV
  const header = [
    'Zip','Address','City','State','Owner Names',
    'Phone1','Phone2','Phone3','Email1','Email2','Email3',
    'Last Sale Date','Last Sale Price','AVM','Mortgage Balance','Years Owned','Distress Flags','Score'
  ];

  const rows = [toCsvRow(header)];

  for (const lead of leads) {
    const { city, state, zip } = parseCityStateZip(lead.address);
    const phones = (phonesByLead.get(lead.id) || [])
      .map(p => p.number)
      .filter(Boolean)
      .slice(0, 3);
    const emails = (emailsByLead.get(lead.id) || [])
      .map(e => e.address)
      .filter(Boolean)
      .slice(0, 3);

    rows.push(toCsvRow([
      zip,
      // Address line without city/state/zip (first part before first comma)
      String(lead.address || '').split(',')[0] || '',
      city,
      state,
      lead.owner_name || '',
      phones[0] || '',
      phones[1] || '',
      phones[2] || '',
      emails[0] || '',
      emails[1] || '',
      emails[2] || '',
      '', // Last Sale Date (not stored)
      '', // Last Sale Price (not stored)
      '', // AVM (not stored)
      '', // Mortgage Balance (not stored)
      '', // Years Owned (not stored)
      '', // Distress Flags (not stored)
      lead.motivation_score != null ? lead.motivation_score : '' // Score fallback
    ]));
  }

  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');
  console.log(`Exported ${leads.length} leads to ${OUT}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
