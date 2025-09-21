const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function esc(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

function uniquePreserveOrder(arr){ const seen=new Set(); const out=[]; for(const v of arr){ const k=(v||'').trim(); if(!k||seen.has(k)) continue; seen.add(k); out.push(k);} return out; }

try {
  const root = path.resolve(__dirname, '..');
  const dbEnv = process.env.SQLITE_DB_PATH || 'backend/data/convexa.db';
  const dbPath = path.isAbsolute(dbEnv) ? dbEnv : path.resolve(root, dbEnv);
  const db = new Database(dbPath, { readonly: true });
  // Get the latest successful entry per lead_id that has phones or emails
  const rows = db.prepare(`
    SELECT t.lead_id, t.response_data
    FROM skip_trace_logs t
    JOIN (
      SELECT lead_id, MAX(datetime(created_at)) AS max_created
      FROM skip_trace_logs
      WHERE success=1 AND provider='batchdata' AND (phones_found>0 OR emails_found>0)
      GROUP BY lead_id
    ) m ON m.lead_id=t.lead_id AND datetime(t.created_at)=m.max_created
    WHERE t.success=1 AND t.provider='batchdata' AND (t.phones_found>0 OR t.emails_found>0)
    ORDER BY t.created_at DESC
  `).all();

  const out = [];
  for (const r of rows) {
    try {
      const resp = JSON.parse(r.response_data);
      const persons = resp?.sample?.results?.persons || [];
      const phones=[]; const emails=[]; let owner=''; let address='';
      for (const p of persons) {
        // address
        const addr = p.propertyAddress || p.mailingAddress || {};
        const addrStr = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
        if (!address && addrStr) address = addrStr;
        // owner name (pick first present)
        const nm = (p?.name?.full) || [p?.name?.first, p?.name?.last].filter(Boolean).join(' ');
        if (!owner && nm) owner = nm;
        // collect contacts
        for (const ph of (p.phoneNumbers || [])) {
          if (ph && ph.number) phones.push(String(ph.number));
        }
        for (const em of (p.emails || [])) {
          if (em && em.email) emails.push(String(em.email));
        }
      }
      const uph = uniquePreserveOrder(phones).slice(0,3);
      const uem = uniquePreserveOrder(emails).slice(0,3);
      if (uph.length===0 && uem.length===0) continue;
      out.push({address, owner, phones: uph, emails: uem});
    } catch (e) { /* ignore */ }
  }

  if (!out.length) { console.error('No real contacts found.'); process.exit(2); }

  let csv = 'LeadID,Address,Owner,Phone1,Phone2,Phone3,Email1,Email2,Email3\n';
  for (let i=0;i<out.length;i++) {
    const r = out[i];
    const row = [
      esc(i+1),
      esc(r.address),
      esc(r.owner),
      esc(r.phones[0]||''), esc(r.phones[1]||''), esc(r.phones[2]||''),
      esc(r.emails[0]||''), esc(r.emails[1]||''), esc(r.emails[2]||'')
    ].join(',');
    csv += row + '\n';
  }
  const outPath = path.resolve(__dirname, 'real-leads-609.csv');
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`WROTE ${outPath} with ${out.length} rows`);
} catch (e) {
  console.error('Failed:', e.message);
  process.exit(1);
}
