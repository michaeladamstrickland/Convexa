const axios = require('axios');

const STAGING_URL = process.argv[2] || 'http://localhost:3001';
const BASIC_AUTH_USER = process.argv[3] || 'admin';
const BASIC_AUTH_PASS = process.argv[4] || 'password';

const runSmokeTest = async () => {
  console.log(`Running smoke tests against staging at ${STAGING_URL}`);

  const auth = {
    username: BASIC_AUTH_USER,
    password: BASIC_AUTH_PASS
  };

  try {
    // GET /leads?limit=1 (using alias route)
    console.log('\n--- GET /leads?limit=1 ---');
    const leadsResponse = await axios.get(`${STAGING_URL}/leads?limit=1`, { auth });
    console.log(`Status: ${leadsResponse.status}`);
    console.log('Data:', leadsResponse.data);

    // POST /dial
    console.log('\n--- POST /dial ---');
    const dialResponse = await axios.post(`${STAGING_URL}/dial`, {
      leadId: leadsResponse.data.leads[0].id, // Use 'id' from the alias route response
      toNumber: '1234567890', // Changed to toNumber as per integrated-server.js
      fromNumber: '0987654321' // Added fromNumber as per integrated-server.js
    }, { auth });
    console.log(`Status: ${dialResponse.status}`);
    console.log('Data:', dialResponse.data);
    const dialId = dialResponse.data.dialId;

    // POST /dial/:dialId/asr-complete
    console.log(`\n--- POST /dial/${dialId}/asr-complete ---`);
    const asrCompleteResponse = await axios.post(`${STAGING_URL}/dial/${dialId}/asr-complete`, {
      dialId: dialId, // Added dialId to body as per integrated-server.js
      transcriptUrl: 'http://example.com/transcript.txt', // Changed to transcriptUrl as per integrated-server.js
      words: 10, // Added words as per integrated-server.js
      latencyMs: 1500 // Added latencyMs as per integrated-server.js
    }, { auth });
    console.log(`Status: ${asrCompleteResponse.status}`);
    console.log('Data:', asrCompleteResponse.data);

    // GET /metrics
    console.log('\n--- GET /metrics ---');
    const metricsResponse = await axios.get(`${STAGING_URL}/metrics`, { auth });
    console.log(`Status: ${metricsResponse.status}`);
    console.log('Data (truncated to first 500 chars):', metricsResponse.data.substring(0, 500));

    // (Optional) POST /twilio/recording-complete with bogus signature
    console.log('\n--- POST /twilio/recording-complete (bogus signature) ---');
    try {
      const twilioResponse = await axios.post(`${STAGING_URL}/twilio/recording-complete`, {
        CallSid: 'SMOKE_TEST_CALL_SID',
        RecordingUrl: 'http://example.com/recording.mp3',
        RecordingDuration: '30'
      }, {
        headers: {
          'X-Twilio-Signature': 'bogus_signature'
        }
      });
      console.log(`Status: ${twilioResponse.status}`);
      console.log('Data:', twilioResponse.data);
    } catch (error) {
      if (error.response) {
        console.log(`Expected Error Status: ${error.response.status}`);
        console.log('Expected Error Data:', error.response.data);
      } else {
        console.error('Error:', error.message);
      }
    }

    console.log('\nSmoke tests completed successfully.');

  } catch (error) {
    console.error('Smoke test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
};

const run = async () => {
  await runSmokeTest();
};

run();
