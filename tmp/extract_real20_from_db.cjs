const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function esc(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

try {
  // Prefer the larger/most recent DB under backend/backend/data
  const dbPath = path.resolve(__dirname, '..', 'backend', 'backend', 'data', 'convexa.db');
  if (!fs.existsSync(dbPath)) throw new Error('DB not found at ' + dbPath);
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare(`
    SELECT id, lead_id, response_data, created_at
    FROM skip_trace_logs
    WHERE success = 1 AND provider = 'batchdata' AND response_data IS NOT NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 200
  `).all();
  const out = [];
  for (const r of rows) {
    try {
      const resp = JSON.parse(r.response_data);
      const persons = resp?.sample?.results?.persons || [];
      if (!persons.length) continue;
      for (const p of persons) {
        const addr = p.propertyAddress || p.mailingAddress || {};
        const name = (p?.name?.full) || [p?.name?.first, p?.name?.last].filter(Boolean).join(' ');
        const phones = (p.phoneNumbers || []).map(x => x.number).filter(Boolean);
        const emails = (p.emails || []).map(x => x.email).filter(Boolean);
        if (!phones.length && !emails.length) continue;
        out.push({
          address: [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
          owner: name,
          phone1: phones[0] || '',
          phone2: phones[1] || '',
          phone3: phones[2] || '',
          email1: emails[0] || '',
          email2: emails[1] || '',
          email3: emails[2] || '',
        });
        if (out.length >= 20) break;
      }
      if (out.length >= 20) break;
    } catch (_) {}
  }
  if (!out.length) {
    console.error('No real leads found in DB logs.');
    process.exit(2);
  }
  let csv = 'Address,Owner,Phone1,Phone2,Phone3,Email1,Email2,Email3\n';
  for (const r of out) {
    csv += [esc(r.address), esc(r.owner), esc(r.phone1), esc(r.phone2), esc(r.phone3), esc(r.email1), esc(r.email2), esc(r.email3)].join(',') + '\n';
  }
  fs.writeFileSync(path.resolve(__dirname, 'real-leads-20.csv'), csv, 'utf8');
  console.log('WROTE tmp/real-leads-20.csv with', out.length, 'rows');
} catch (e) {
  console.error('Failed:', e.message);
  process.exit(1);
}
