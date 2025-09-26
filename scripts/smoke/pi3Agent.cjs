// scripts/smoke/pi3Agent.cjs
// This script simulates PI3 agent interactions for CI smoke tests.
// It runs in "sim" mode to avoid actual Twilio spend.

require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:5001';
const AGENT_MODE = process.env.AGENT_MODE || 'sim'; // 'live' or 'sim'

console.log(`Running PI3 Agent Smoke Test in ${AGENT_MODE} mode...`);

const simulateCall = async (callId) => {
  console.log(`[${callId}] Simulating call...`);
  const start = performance.now();

  // Simulate call connection
  await axios.post(`${BASE_URL}/api/calls/start`, { callSid: callId, leadId: `lead-${callId}`, userId: `user-${callId}` });
  console.log(`[${callId}] Call started.`);

  // Simulate agent latency
  const agentLatency = Math.random() * 2000 + 100; // 100ms to 2100ms
  await new Promise(resolve => setTimeout(resolve, agentLatency));
  // In a real scenario, this would be recorded in callMetrics.agentLatencyMs

  // Simulate intent detection
  if (Math.random() > 0.3) { // 70% chance of intent detection
    // In a real scenario, this would increment callMetrics.intentsDetected
    console.log(`[${callId}] Intent detected.`);
  }

  // Simulate transcript
  const transcript = `This is a simulated transcript for call ${callId}. The agent discussed some details.`;
  await axios.post(`${BASE_URL}/api/calls/transcript`, { callSid: callId, transcript });
  console.log(`[${callId}] Transcript submitted.`);

  // Simulate call completion
  await axios.post(`${BASE_URL}/api/calls/complete`, { callSid: callId, audioUrl: `http://example.com/recording-${callId}.mp3` });
  console.log(`[${callId}] Call completed.`);

  const end = performance.now();
  console.log(`[${callId}] Call simulation finished in ${Math.round(end - start)}ms`);
};

const runSmokeTest = async () => {
  if (AGENT_MODE !== 'sim') {
    console.log('AGENT_MODE is not "sim". Skipping PI3 agent smoke test.');
    return;
  }

  const numCalls = 5;
  const callPromises = [];

  for (let i = 0; i < numCalls; i++) {
    const callId = `pi3-smoke-call-${Date.now()}-${i}`;
    callPromises.push(simulateCall(callId));
  }

  await Promise.all(callPromises);
  console.log(`Successfully simulated ${numCalls} calls in "sim" mode.`);
};

runSmokeTest().catch(error => {
  console.error('PI3 Agent Smoke Test failed:', error);
  process.exit(1);
});
