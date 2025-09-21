const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const guardrailsSnapshotCommand = new Command();
guardrailsSnapshotCommand
  .option('--port <port>', 'Port for the backend server', '6025')
  .option('--output <output_dir>', 'Output directory for QA artifacts', 'qa');

async function guardrailsSnapshot(cliOptions) {
  const resolvedOptions = cliOptions || guardrailsSnapshotCommand.opts();
  const PORT = resolvedOptions.port;
  const OUTPUT_DIR = resolvedOptions.output;
  const BASE_URL = `http://localhost:${PORT}`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFilePath = path.join(OUTPUT_DIR, `guardrails_state_${timestamp}.json`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    console.log(`Attempting to fetch guardrails state from ${BASE_URL}/admin/guardrails-state`);
    const response = await axios.get(`${BASE_URL}/admin/guardrails-state`, {
      timeout: 5000, // 5 second timeout for HTTP requests
    });

    fs.writeFileSync(outputFilePath, JSON.stringify(response.data, null, 2));
    console.log(`Guardrails state snapshot saved to ${outputFilePath}`);
    return outputFilePath; // Return the path to the generated file
  } catch (error) {
    console.warn(`Error fetching guardrails state: ${error.message}. Writing "unavailable" snapshot.`);
    const unavailableReport = {
      status: 'unavailable',
      port: PORT,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(outputFilePath, JSON.stringify(unavailableReport, null, 2));
    console.log(`"Unavailable" guardrails state snapshot saved to ${outputFilePath}`);
    return outputFilePath; // Return the path to the generated file
  }
}

if (require.main === module) {
  guardrailsSnapshotCommand.parse(process.argv);
  guardrailsSnapshot();
} else {
  module.exports = guardrailsSnapshot;
}
