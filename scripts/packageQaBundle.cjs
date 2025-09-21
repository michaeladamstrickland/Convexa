const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { program } = require('commander');

program
  .option('--run <run_id>', 'Specify the run ID for batch artifacts')
  .option('--guardrails <guardrails_snapshot_path>', 'Path to the guardrails snapshot JSON file')
  .option('--output <output_dir>', 'Output directory for the QA bundle', 'qa');

program.parse(process.argv);

const options = program.opts();
const RUN_ID = options.run;
const GUARDRAILS_SNAPSHOT_PATH = options.guardrails;
const OUTPUT_DIR = options.output;

if (!RUN_ID || !GUARDRAILS_SNAPSHOT_PATH) {
  console.error('Error: --run and --guardrails are required.');
  process.exit(1);
}

async function packageQaBundle() {
  const bundlePath = path.join(OUTPUT_DIR, 'qa_bundle.zip');
  const output = fs.createWriteStream(bundlePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(`QA bundle created successfully: ${archive.pointer()} total bytes`);
    console.log(`Bundle saved to ${bundlePath}`);
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // Add enriched.csv and report.json (Sprint-1 standard locations)
  const runReportsDir = path.join('run_reports', RUN_ID);
  archive.file(path.join(runReportsDir, 'enriched.csv'), { name: path.join('run_reports', RUN_ID, 'enriched.csv') });
  archive.file(path.join(runReportsDir, 'report.json'), { name: path.join('run_reports', RUN_ID, 'report.json') });

  // Add qa_cache_hit_offline.json when present (either in run dir or output dir)
  const qaCacheLocal = path.join(runReportsDir, 'qa_cache_hit_offline.json');
  const qaCacheAlt = path.join(OUTPUT_DIR, 'qa_cache_hit_offline.json');
  if (fs.existsSync(qaCacheLocal)) {
    archive.file(qaCacheLocal, { name: path.join('qa', 'qa_cache_hit_offline.json') });
  } else if (fs.existsSync(qaCacheAlt)) {
    archive.file(qaCacheAlt, { name: path.join('qa', 'qa_cache_hit_offline.json') });
  }

  // Add guardrails snapshot
  archive.file(GUARDRAILS_SNAPSHOT_PATH, { name: path.join('qa', path.basename(GUARDRAILS_SNAPSHOT_PATH)) });

  await archive.finalize();
}

packageQaBundle().catch(error => {
  console.error(`Error packaging QA bundle: ${error.message}`);
  process.exit(1);
});
