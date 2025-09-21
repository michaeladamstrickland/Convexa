#!/usr/bin/env node
const fs = require('fs');
const src = process.argv[2] || 'tmp/real-leads-609.csv';
const dst = process.argv[3] || 'tmp/real-leads-20.csv';
const s = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const out = s.slice(0, Math.min(21, s.length)).join('\n');
fs.writeFileSync(dst, out);
const lines = out.split(/\r?\n/).filter(Boolean).length;
console.log(`Wrote ${dst} with ${lines} lines`);
