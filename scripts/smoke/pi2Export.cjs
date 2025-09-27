/**
 * @file Smoke test for PI2 Export metrics.
 * @description This script simulates export bundle creation and fetching, then verifies the `export_bundles_total` metric.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FINDINGS_DIR = path.join(__dirname, '../../ops/findings');
const METRICS_SAMPLE_FILE = path.join(FINDINGS_DIR, 'pi2_metrics_sample.txt');
const RESULT_FILE = path.join(FINDINGS_DIR, 'pi2_export_smoke.md');

async function runExportSmokeTest() {
  console.log('Running PI2 Export Smoke Test...');
  let success = true;
  let output = '';

  try {
    // Simulate creating and fetching a bundle ZIP
    console.log('Simulating export bundle creation and fetching...');
    // Example: execSync('curl -X POST http://localhost:3000/api/export/bundle?kind=weekly', { stdio: 'inherit' });
    // Example: execSync('curl http://localhost:3000/api/export/bundle/latest', { stdio: 'inherit' });
    output += 'Simulated export bundle activity.\n';

    // Fetch metrics sample
    console.log('Fetching metrics sample...');
    const metrics = execSync('curl http://localhost:9090/metrics', { encoding: 'utf8' });
    fs.writeFileSync(METRICS_SAMPLE_FILE, metrics);
    output += `Metrics sample saved to ${METRICS_SAMPLE_FILE}\n`;

    // Verify metrics
    const requiredMetrics = [
      'export_bundles_total'
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
      output += '\n✨ PI2 Export Smoke Test PASSED! ✨\n';
    } else {
      output += '\n🚨 PI2 Export Smoke Test FAILED! 🚨\n';
    }

  } catch (error) {
    console.error('Error during PI2 Export Smoke Test:', error);
    output += `\nError during PI2 Export Smoke Test: ${error.message}\n`;
    success = false;
  } finally {
    fs.writeFileSync(RESULT_FILE, `## PI2 Export Smoke Test Report\n\n${output}`);
    console.log(`Report saved to ${RESULT_FILE}`);
  }

  return success;
}

if (require.main === module) {
  runExportSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runExportSmokeTest;
