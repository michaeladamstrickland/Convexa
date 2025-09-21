#!/usr/bin/env node
// Flood skiptrace to exercise circuit breaker with controllable concurrency

const axios = require('axios');

async function main() {
  const port = Number(process.env.PORT || 6001);
  const leadId = process.argv[2] || '1';
  const count = Number(process.argv[3] || 40);
  const conc = Number(process.env.FLOOD_CONC || 8);
  console.error(`Breaker flood: port=${port} leadId=${leadId} count=${count} conc=${conc}`);
  const q = [];
  for (let i = 0; i < count; i++) q.push(i);
  let inFlight = 0, idx = 0, ok = 0, err = 0;
  const start = Date.now();
  await new Promise((resolve) => {
    const next = () => {
      while (inFlight < conc && idx < q.length) {
        inFlight++;
        const url = `http://localhost:${port}/api/leads/${encodeURIComponent(leadId)}/skiptrace?force=true`;
        axios.post(url).then(r => {
          // Count based on provider success in body, not HTTP status
          const body = r && r.data || {};
          if (body && body.success === true) ok++; else err++;
        }).catch(() => { err++; }).finally(() => { inFlight--; next(); });
        idx++;
      }
      if (inFlight === 0 && idx >= q.length) return resolve();
    };
    next();
  });
  const ms = Date.now() - start;
  console.log(JSON.stringify({ sent: count, ok, err, ms }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
