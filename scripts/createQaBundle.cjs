const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

(async () => {
  const timestamp = process.argv[2];
  const runId = process.argv[3]; // The run ID from runAdHocBatch.cjs
  const outputPath = `qa/qa_live_budget_bundle_${timestamp}.zip`;

  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(`QA bundle created successfully: ${archive.pointer()} total bytes`);
    console.log(`Bundle saved to ${outputPath}`);
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // Add guardrails files
  archive.file(path.join('qa', 'live_budget_proof', timestamp, 'guardrails_before.json'), { name: `qa/live_budget_proof/${timestamp}/guardrails_before.json` });
  archive.file(path.join('qa', 'live_budget_proof', timestamp, 'guardrails_after.json'), { name: `qa/live_budget_proof/${timestamp}/guardrails_after.json` });

  // Add batch run artifacts
  const batchRunDir = path.join('qa', 'live_budget_proof', timestamp, runId);
  archive.file(path.join(batchRunDir, 'enriched.csv'), { name: `qa/live_budget_proof/${timestamp}/${runId}/enriched.csv` });
  archive.file(path.join(batchRunDir, 'report.json'), { name: `qa/live_budget_proof/${timestamp}/${runId}/report.json` });

  // Add README
  archive.file(path.join('qa', 'live_budget_proof', timestamp, 'README.md'), { name: `qa/live_budget_proof/${timestamp}/README.md` });

  // Add throttle smoke test summary
  archive.file(path.join('qa', `throttle_smoke_${timestamp}.json`), { name: `qa/throttle_smoke_${timestamp}.json` });

  await archive.finalize();
})();
