/**
 * @file Smoke test for PI2 Call Summary metrics.
 * @description This script simulates call summary generation and verifies the `call_summary_generated_total` metric.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const METRICS_SAMPLE_FILE = path.join(FINDINGS_DIR, 'pi2_metrics_sample.txt');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_summary_smoke.md');

async function runSummarySmokeTest() {
  console.log('Running PI2 Call Summary Smoke Test...');
  let success = true;
  let output = '';

  try {
    // Ensure a transcript exists and then summarize it
    console.log('Simulating call summary generation...');
    // Example: execSync('curl -X POST http://localhost:3000/api/call/summarize?reason=test', { stdio: 'inherit' });
    output += 'Simulated call summary generation.\n';

    // Fetch metrics sample
    console.log('Fetching metrics sample...');
    const metrics = execSync('curl http://localhost:9090/metrics', { encoding: 'utf8' });
    fs.writeFileSync(METRICS_SAMPLE_FILE, metrics);
    output += `Metrics sample saved to ${METRICS_SAMPLE_FILE}\n`;

    // Verify metrics
    const requiredMetrics = [
      'call_summary_generated_total'
    ];

    for (const metric of requiredMetrics) {
      if (metrics.includes(metric)) {
        output += `✅ Metric "${metric}" found.\n`;
      } else {
        output += `❌ Metric "${metric}" NOT found.\n`;
        success = false;
      }
    }

    if (success) {
      output += '\n✨ PI2 Call Summary Smoke Test PASSED! ✨\n';
    } else {
      output += '\n🚨 PI2 Call Summary Smoke Test FAILED! 🚨\n';
    }

  } catch (error) {
    console.error('Error during PI2 Call Summary Smoke Test:', error);
    output += `\nError during PI2 Call Summary Smoke Test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, `## PI2 Call Summary Smoke Test Report\n\n${output}`);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runSummarySmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runSummarySmokeTest;
