const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const generateReportCommand = new Command();
generateReportCommand
  .option('--run <run_id>', 'Specify the run ID')
  .option('--db <db_path>', 'Specify the database path', 'backend/data/convexa.db')
  .option('--output <output_dir>', 'Specify the output directory for reports', 'run_reports');

async function generateRunReport(cliOptions) {
  const resolvedOptions = cliOptions || generateReportCommand.opts();
  const RUN_ID = resolvedOptions.run;
  const DB_PATH = resolvedOptions.db;
  const OUTPUT_DIR = resolvedOptions.output;

  if (!RUN_ID) {
    console.error('Error: --run <run_id> is required.');
    if (require.main === module) process.exit(1);
    else throw new Error('Run ID is required.');
  }

  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`Error opening database: ${err.message}`);
      if (require.main === module) process.exit(1);
      else throw err;
    }
  });

  try {
    const run = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM skiptrace_runs WHERE run_id = ?`, [RUN_ID], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!run) {
      console.error(`Error: Run ID ${RUN_ID} not found.`);
      if (require.main === module) process.exit(1);
      else throw new Error(`Run ID ${RUN_ID} not found.`);
    }

    // Totals from run items (schema-tolerant: item_id may not exist)
    const sriCols = await new Promise((resolve) => {
      db.all(`PRAGMA table_info(skiptrace_run_items)`, (err, rows) => {
        if (err) return resolve([]);
        resolve(rows.map(r => r.name));
      });
    });

    const hasItemId = sriCols.includes('item_id');
    const selectCols = hasItemId ? 'status, item_id, lead_id' : 'status, lead_id';
    const runItems = await new Promise((resolve, reject) => {
      db.all(`SELECT ${selectCols} FROM skiptrace_run_items WHERE run_id = ?`, [RUN_ID], (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      });
    });

    const statusDone = (s) => s === 'done' || s === 'completed' || s === 'success';
    const total = runItems.length;
    const done = runItems.filter(item => statusDone(item.status)).length;
    const failed = runItems.filter(item => item.status === 'failed').length;

    // Provider calls from provider_calls table (external calls only)
    const providerCalls = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) AS cnt FROM provider_calls WHERE run_id = ?`, [RUN_ID], (err, row) => {
        if (err) return reject(err);
        resolve((row && row.cnt) || 0);
      });
    });

    // Cache hits derived from done minus providerCalls (no CSV heuristics)
    const cacheHits = Math.max(0, done - providerCalls);

    // Dynamic schema detection for normalized contact tables
    const getTableColumns = async (table) => {
      return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
          if (err) return resolve([]); // tolerate missing table
          resolve(rows.map(r => r.name));
        });
      });
    };

    const phoneCols = await getTableColumns('phone_numbers');
    const emailCols = await getTableColumns('email_addresses');

    const hasPnLead = phoneCols.includes('lead_id');
    const hasPnItem = phoneCols.includes('item_id');
    const hasEmLead = emailCols.includes('lead_id');
    const hasEmItem = emailCols.includes('item_id');

    const countDistinctLeads = async (joinTable, joinOn, where) => new Promise((resolve) => {
      const sql = `SELECT COUNT(DISTINCT sri.lead_id) AS cnt FROM skiptrace_run_items sri JOIN ${joinTable} jt ON ${joinOn} WHERE sri.run_id = ? ${where ? 'AND ' + where : ''}`;
      db.get(sql, [RUN_ID], (err, row) => {
        if (err) return resolve(0);
        resolve((row && row.cnt) || 0);
      });
    });

    let phoneAnyCount = 0;
    if (hasPnLead) {
      phoneAnyCount = await countDistinctLeads('phone_numbers', 'jt.lead_id = sri.lead_id');
    } else if (hasPnItem) {
      phoneAnyCount = await countDistinctLeads('phone_numbers', 'jt.item_id = sri.item_id');
    } else {
      phoneAnyCount = 0;
    }

    let emailAnyCount = 0;
    if (hasEmLead) {
      emailAnyCount = await countDistinctLeads('email_addresses', 'jt.lead_id = sri.lead_id');
    } else if (hasEmItem) {
      emailAnyCount = await countDistinctLeads('email_addresses', 'jt.item_id = sri.item_id');
    } else {
      emailAnyCount = 0;
    }

    const phoneAnyPct = total > 0 ? (phoneAnyCount / total) * 100 : 0;
    const emailAnyPct = total > 0 ? (emailAnyCount / total) * 100 : 0;

    const errors = {};
    runItems.filter(item => item.status === 'failed').forEach(item => {
      const reason = item.error_message || 'Unknown error';
      errors[reason] = (errors[reason] || 0) + 1;
    });

  // Budgets: read from run table (schema tolerant)
  const capUsd = typeof run.budget_cap_usd === 'number' ? run.budget_cap_usd : 0;
  const spentUsd = typeof run.budget_spent_cents === 'number' ? (run.budget_spent_cents / 100) : 0;

  const cacheHitRatio = (providerCalls + cacheHits) > 0 ? (cacheHits / (providerCalls + cacheHits)) * 100 : 0;

    const report = {
      run_id: RUN_ID,
      started_at: run.started_at,
      finished_at: run.finished_at,
      totals: {
        total,
        done,
        failed,
        provider_calls: providerCalls,
        cache_hits: cacheHits,
      },
      hit_rate: {
        phone_any_pct: parseFloat(phoneAnyPct.toFixed(2)),
        email_any_pct: parseFloat(emailAnyPct.toFixed(2)),
      },
      budgets: {
        cap_usd: parseFloat(capUsd.toFixed(2)),
        spent_usd: parseFloat(spentUsd.toFixed(2)),
      },
      cache_hit_ratio: parseFloat(cacheHitRatio.toFixed(2)),
      errors: errors,
    };

    const runReportDir = path.join(OUTPUT_DIR, RUN_ID);
    if (!fs.existsSync(runReportDir)) {
      fs.mkdirSync(runReportDir, { recursive: true });
    }
    const reportPath = path.join(runReportDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report generated successfully at ${reportPath}`);
    return report; // Return the report object
  } catch (error) {
    console.error(`Error generating report: ${error.message}`);
    throw error; // Re-throw for handling in calling script
  } finally {
    db.close();
  }
}

if (require.main === module) {
  generateReportCommand.parse(process.argv);
  generateRunReport();
} else {
  module.exports = generateRunReport;
}
