#!/usr/bin/env node
const axios = require('axios');

(async () => {
  try {
    const port = process.argv[2] ? Number(process.argv[2]) : 6002;
    const base = `http://127.0.0.1:${port}`;

    // Health check
    const health = await axios.get(`${base}/health`).then(r => r.data).catch(e => ({ error: e.message }));
    if (health && health.status !== 'healthy') {
      console.log('Health check not healthy:', health);
    } else {
      console.log('Health OK');
    }

    // Add a unique lead
    const address = `34 HILLCREST AVE, COLLINGSWOOD, NJ 08108 Apt ${Date.now()}`;
    const addBody = { address, owner_name: 'Smoke Test', source_type: 'smoke' };
    const addRes = await axios.post(`${base}/api/zip-search-new/add-lead`, addBody).then(r => r.data);
    console.log('Add lead response:', addRes);
    const leadId = addRes.leadId || addRes.existingId;
    if (!leadId) throw new Error('No leadId in add response');

    // Trigger skiptrace
    const postRes = await axios.post(`${base}/api/leads/${leadId}/skiptrace`, {}).then(r => r.data).catch(e => ({ error: e.message, data: e.response && e.response.data }));
    console.log('Skiptrace POST response:', postRes);

    // Short delay and GET result
    await new Promise(r => setTimeout(r, 500));
    const getRes = await axios.get(`${base}/api/leads/${leadId}/skiptrace`).then(r => r.data);
    console.log('Skiptrace GET response:', getRes);

    const data = getRes && getRes.data ? getRes.data : {};
    const phones = Array.isArray(data.phones) ? data.phones : [];
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const phoneSample = phones[0] && (phones[0].number || phones[0].phone || phones[0].e164 || phones[0].value || phones[0]);
    const emailSample = emails[0] && (emails[0].address || emails[0].email || emails[0].value || emails[0]);

    console.log(`Summary: phones=${phones.length} emails=${emails.length}`);
    if (phoneSample) console.log('Sample phone:', phoneSample);
    if (emailSample) console.log('Sample email:', emailSample);

    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
