const fs = require('fs');
const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

function esc(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

(async () => {
  try {
    const raw = await fetch('http://127.0.0.1:6001/api/debug/skiptrace-latest?limit=200');
    const j = JSON.parse(raw);
    const data = j.data || [];
    const out = [];
    for (const row of data) {
      try {
        if (!row.response_data) continue;
        const resp = JSON.parse(row.response_data);
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
      } catch (e) {}
    }
    if (!out.length) {
      console.error('No real leads found in recent logs.');
      process.exit(2);
    }
    let csv = 'Address,Owner,Phone1,Phone2,Phone3,Email1,Email2,Email3\n';
    for (const r of out) {
      csv += [esc(r.address), esc(r.owner), esc(r.phone1), esc(r.phone2), esc(r.phone3), esc(r.email1), esc(r.email2), esc(r.email3)].join(',') + '\n';
    }
    fs.writeFileSync('real-leads-20.csv', csv, 'utf8');
    console.log('WROTE real-leads-20.csv');
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();
