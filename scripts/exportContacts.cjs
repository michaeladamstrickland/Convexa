#!/usr/bin/env node
/*
  Export contacts to CSV with optional redaction.
  Usage:
    node scripts/exportContacts.cjs --out tmp/contacts.csv [--redact=emails|phones|both]
  Honors SQLITE_DB_PATH (default backend/data/convexa.db)
*/
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const outIdx = args.findIndex(a => a === '--out');
if (outIdx === -1 || !args[outIdx+1]) {
  console.error('Missing --out <file>');
  process.exit(2);
}
const outPath = path.resolve(args[outIdx+1]);
const redactArg = (args.find(a => a.startsWith('--redact=')) || '--redact=none').split('=')[1];
const redactEmails = redactArg === 'emails' || redactArg === 'both';
const redactPhones = redactArg === 'phones' || redactArg === 'both';

function esc(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function uniquePreserveOrder(arr){ const seen=new Set(); const out=[]; for(const v of arr){ const k=(v||'').trim(); if(!k||seen.has(k)) continue; seen.add(k); out.push(k);} return out; }
function redactEmail(e){ if(!e) return e; const [u, d] = String(e).split('@'); if(!d) return e; const u2 = u.length<=2 ? u[0]||'' : (u[0] + '*'.repeat(Math.max(1,u.length-2)) + u[u.length-1]); return `${u2}@${d}`; }
function redactPhone(p){ if(!p) return p; const s=String(p).replace(/\D/g,''); if(s.length<4) return '***'; return '***-***-' + s.slice(-4); }

try {
  const root = path.resolve(__dirname, '..');
  const dbEnv = process.env.SQLITE_DB_PATH || 'backend/data/convexa.db';
  const dbPath = path.isAbsolute(dbEnv) ? dbEnv : path.resolve(root, dbEnv);
  const db = new Database(dbPath, { readonly: true });

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
        const addr = p.propertyAddress || p.mailingAddress || {};
        const addrStr = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
        if (!address && addrStr) address = addrStr;
        const nm = (p?.name?.full) || [p?.name?.first, p?.name?.last].filter(Boolean).join(' ');
        if (!owner && nm) owner = nm;
        for (const ph of (p.phoneNumbers || [])) if (ph && ph.number) phones.push(String(ph.number));
        for (const em of (p.emails || [])) if (em && em.email) emails.push(String(em.email));
      }
      const uph = uniquePreserveOrder(phones).slice(0,3).map(x => redactPhones ? redactPhone(x) : x);
      const uem = uniquePreserveOrder(emails).slice(0,3).map(x => redactEmails ? redactEmail(x) : x);
      if (uph.length===0 && uem.length===0) continue;
      out.push({address, owner, phones: uph, emails: uem});
    } catch (_) {}
  }

  let csv = 'Address,Owner,Phone1,Phone2,Phone3,Email1,Email2,Email3\n';
  for (const r of out) {
    csv += [esc(r.address), esc(r.owner), esc(r.phones[0]||''), esc(r.phones[1]||''), esc(r.phones[2]||''), esc(r.emails[0]||''), esc(r.emails[1]||''), esc(r.emails[2]||'')].join(',') + '\n';
  }
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`WROTE ${outPath} with ${out.length} rows; redact=${redactArg}`);
} catch (e) {
  console.error('Failed:', e.message);
  process.exit(1);
}
