#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');

(async () => {
  const startTime = process.hrtime.bigint();
  const port = process.argv[2] ? Number(process.argv[2]) : 6001;
  const numCalls = process.argv[3] ? Number(process.argv[3]) : 10;
  const outputPath = process.argv[4];
  const base = `http://127.0.0.1:${port}`;
  const results = [];

  try {
    // Health check
    const health = await axios.get(`${base}/health`).then(r => r.data).catch(e => ({ error: e.message }));
    if (health && health.status !== 'healthy') {
      console.log('Health check not healthy:', health);
      process.exit(1);
    } else {
      console.log('Health OK');
    }

    for (let i = 0; i < numCalls; i++) {
      const callStartTime = process.hrtime.bigint();
      const address = `34 HILLCREST AVE, COLLINGSWOOD, NJ 08108 Apt ${Date.now()}-${i}`;
      const addBody = { address, owner_name: `Smoke Test ${i}`, source_type: 'smoke' };
      
      try {
        const addRes = await axios.post(`${base}/api/zip-search-new/add-lead`, addBody).then(r => r.data);
        const leadId = addRes.leadId || addRes.existingId;
        if (!leadId) throw new Error('No leadId in add response');

        const postRes = await axios.post(`${base}/api/leads/${leadId}/skiptrace`, {}).then(r => r.data).catch(e => ({ error: e.message, data: e.response && e.response.data }));
        
        const callEndTime = process.hrtime.bigint();
        const elapsedMs = Number(callEndTime - callStartTime) / 1_000_000;

        results.push({
          call: i + 1,
          leadId: leadId,
          addLeadResponse: addRes,
          skipTraceResponse: postRes,
          elapsedMs: elapsedMs
        });
        console.log(`Call ${i + 1} completed in ${elapsedMs.toFixed(2)} ms`);

        // Respect SKIP_TRACE_RPS by waiting if necessary
        const rps = process.env.SKIP_TRACE_RPS ? Number(process.env.SKIP_TRACE_RPS) : 1;
        const minDelayMs = 1000 / rps;
        if (elapsedMs < minDelayMs) {
          await new Promise(r => setTimeout(r, minDelayMs - elapsedMs));
        }

      } catch (error) {
        const callEndTime = process.hrtime.bigint();
        const elapsedMs = Number(callEndTime - callStartTime) / 1_000_000;
        results.push({
          call: i + 1,
          error: error.message,
          elapsedMs: elapsedMs
        });
        console.error(`Call ${i + 1} failed:`, error.message);
      }
    }

    const endTime = process.hrtime.bigint();
    const totalElapsedMs = Number(endTime - startTime) / 1_000_000;
    const summary = {
      timestamp: new Date().toISOString(),
      totalCalls: numCalls,
      totalElapsedMs: totalElapsedMs,
      averageElapsedMs: totalElapsedMs / numCalls,
      results: results
    };

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
      console.log(`Throttle smoke test summary saved to ${outputPath}`);
    } else {
      console.log('Throttle smoke test summary:');
      console.log(JSON.stringify(summary, null, 2));
    }

    process.exit(0);

  } catch (err) {
    console.error('Throttle smoke test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
