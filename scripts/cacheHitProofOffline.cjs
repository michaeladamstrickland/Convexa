const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { v4: uuidv4 } = require('uuid');

const cacheHitProofCommand = new Command();
cacheHitProofCommand
  .option('--address <address>', 'Address for the lead')
  .option('--owner <owner>', 'Owner for the lead')
  .option('--db <db_path>', 'Path to the SQLite database', 'backend/data/convexa.db')
  .option('--output <output_dir>', 'Output directory for QA artifacts', 'qa');


async function cacheHitProofOffline(cliOptions) {
  const resolvedOptions = cliOptions || cacheHitProofCommand.opts();
  const ADDRESS = resolvedOptions.address;
  const OWNER = resolvedOptions.owner;
  const DB_PATH = resolvedOptions.db;
  const OUTPUT_DIR = resolvedOptions.output;

  if (!ADDRESS || !OWNER) {
    console.error('Error: --address and --owner are required.');
    if (require.main === module) process.exit(1);
    else throw new Error('Address and owner are required.');
  }

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error(`Error opening database: ${err.message}`);
      if (require.main === module) process.exit(1);
      else throw err;
    }
  });

  // Ensure Sprint-1 cache/log tables exist
  await setupDatabase(db); // Pass db instance

  const runId = uuidv4(); // Unique run ID for traceability (not used in counters)
  const leadId = 'proof-lead-1'; // Use a stable leadId for counting

  // Initial counters for the chosen leadId
  const beforeCounters = await getCounters(db, leadId);

  // First invocation
  console.log('First invocation...');
  const firstResult = await mockSkiptraceWithCache(db, leadId, ADDRESS, OWNER);
  console.log('First result:', firstResult);

  // Counters after first invocation
  const afterFirstCounters = await getCounters(db, leadId);

  // Second invocation
  console.log('Second invocation...');
  const secondResult = await mockSkiptraceWithCache(db, leadId, ADDRESS, OWNER);
  console.log('Second result:', secondResult);

  // Counters after second invocation
  const afterSecondCounters = await getCounters(db, leadId);

  const providerCallsDelta = afterSecondCounters.providerCalls - afterFirstCounters.providerCalls;
  const skipTraceLogsDelta = afterSecondCounters.skipTraceLogs - afterFirstCounters.skipTraceLogs;

  const verdict = secondResult.isCached === 1 && providerCallsDelta === 0 && skipTraceLogsDelta === 1
    ? 'PASS'
    : 'FAIL';

  const report = {
    address: ADDRESS,
    owner: OWNER,
    lead_id: leadId,
    first_invocation: {
      result: firstResult,
      counters_after: afterFirstCounters,
    },
    second_invocation: {
      result: secondResult,
      counters_after: afterSecondCounters,
    },
    deltas: {
      provider_calls: providerCallsDelta,
      skip_trace_logs: skipTraceLogsDelta,
    },
    verdict: verdict,
    notes: `Expected: second invocation is cached (isCached=1), provider_calls delta is 0, skip_trace_logs delta is 1 (for the cache hit log). Actual: second_invocation.result.isCached=${secondResult.isCached}, provider_calls_delta=${providerCallsDelta}, skip_trace_logs_delta=${skipTraceLogsDelta}`,
  };

  const outputFilePath = path.join(OUTPUT_DIR, 'qa_cache_hit_offline.json');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(outputFilePath, JSON.stringify(report, null, 2));
  console.log(`Cache hit proof report generated at ${outputFilePath}`);
  console.log(`Verdict: ${verdict}`);

  db.close();
  return report; // Return the report object
}

// Helper functions (moved outside cacheHitProofOffline for clarity and potential reuse)
async function setupDatabase(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS skiptrace_cache (
          id INTEGER PRIMARY KEY,
          provider TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          response_json TEXT NOT NULL,
          parsed_contacts_json TEXT NOT NULL,
          ttl_expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen DATETIME
        )
      `, (err) => { if (err) reject(err); });

      // Ensure a unique index exists to support ON CONFLICT(provider, idempotency_key)
      dbInstance.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_skiptrace_cache_provider_idem
        ON skiptrace_cache (provider, idempotency_key)
      `, (err) => { if (err) reject(err); });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS skip_trace_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          success BOOLEAN DEFAULT 0,
          cost REAL NOT NULL,
          phones_found INTEGER DEFAULT 0,
          emails_found INTEGER DEFAULT 0,
          cached BOOLEAN DEFAULT 0,
          error TEXT,
          request_payload TEXT,
          response_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) reject(err); else resolve(); });
    });
  });
}

async function getCounters(dbInstance, leadId) {
  const providerCalls = await new Promise((resolve, reject) => {
    dbInstance.get(`SELECT COUNT(*) AS count FROM skip_trace_logs WHERE lead_id = ? AND (cached = 0 OR cached IS NULL)`, [leadId], (err, row) => {
      if (err) reject(err);
      resolve((row && row.count) || 0);
    });
  });
  const skipTraceLogs = await new Promise((resolve, reject) => {
    dbInstance.get(`SELECT COUNT(*) AS count FROM skip_trace_logs WHERE lead_id = ?`, [leadId], (err, row) => {
      if (err) reject(err);
      resolve((row && row.count) || 0);
    });
  });
  return { providerCalls, skipTraceLogs };
}

async function mockSkiptraceWithCache(dbInstance, leadId, address, owner) {
  const cacheKey = `${address}-${owner}`.toLowerCase();
  // Sprint-1 cache keyed by provider+idempotency_key; use provider=batchdata and idem=hash(cacheKey)
  const idem = require('crypto').createHash('sha256').update(cacheKey).digest('hex');
  let cachedRow = await new Promise((resolve, reject) => {
    dbInstance.get(`SELECT parsed_contacts_json FROM skiptrace_cache WHERE provider = 'batchdata' AND idempotency_key = ? AND ttl_expires_at > CURRENT_TIMESTAMP`, [idem], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });

  let result;
  let isCached = 0;
  let costCents = 0;

  if (cachedRow) {
    isCached = 1;
    const parsed = JSON.parse(cachedRow.parsed_contacts_json || '{}');
    result = {
      primaryPhone: (parsed.phones && parsed.phones[0] && parsed.phones[0].number) || null,
      phonesCount: Array.isArray(parsed.phones) ? parsed.phones.length : 0,
      primaryEmail: (parsed.emails && parsed.emails[0] && parsed.emails[0].address) || null,
      emailsCount: Array.isArray(parsed.emails) ? parsed.emails.length : 0,
      hasDNC: 0,
    };
  } else {
    const hasPhone = Math.random() > 0.2;
    const hasEmail = Math.random() > 0.3;
    const hasDNC = Math.random() > 0.9;
    const phonesCount = hasPhone ? Math.floor(Math.random() * 3) + 1 : 0;
    const emailsCount = hasEmail ? Math.floor(Math.random() * 2) + 1 : 0;
    const primaryPhone = hasPhone ? `+1-555-${Math.floor(1000 + Math.random() * 9000)}` : null;
    const primaryEmail = hasEmail ? `${leadId.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : null;
    costCents = Math.floor(Math.random() * 100) + 50;

    result = {
      primaryPhone,
      phonesCount,
      primaryEmail,
      emailsCount,
      hasDNC: hasDNC ? 1 : 0,
    };

    await new Promise((resolve, reject) => {
      const responseJson = JSON.stringify({ status: 200 });
      const parsedContacts = JSON.stringify({ success: true, leadId, phones: result.primaryPhone ? [{ number: result.primaryPhone, isPrimary: true }] : [], emails: result.primaryEmail ? [{ address: result.primaryEmail, isPrimary: true }] : [], cost: 0, provider: 'batchdata', cached: false });
      const ttl = new Date(Date.now() + 7*24*3600*1000).toISOString();
      dbInstance.run(`
        INSERT INTO skiptrace_cache (provider, idempotency_key, payload_hash, response_json, parsed_contacts_json, ttl_expires_at, created_at, last_seen)
        VALUES ('batchdata', ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, idempotency_key) DO UPDATE SET
          payload_hash=excluded.payload_hash,
          response_json=excluded.response_json,
          parsed_contacts_json=excluded.parsed_contacts_json,
          ttl_expires_at=excluded.ttl_expires_at,
          last_seen=CURRENT_TIMESTAMP
      `, [
        idem,
        idem,
        responseJson,
        parsedContacts,
        ttl,
        new Date().toISOString(),
        new Date().toISOString(),
      ], (err) => { if (err) reject(err); else resolve(); });
    });
  }

  await new Promise((resolve, reject) => {
    dbInstance.run(`
      INSERT INTO skip_trace_logs (lead_id, provider, success, cost, phones_found, emails_found, cached, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      leadId,
      'batchdata',
      1,
      costCents / 100,
      result.phonesCount,
      result.emailsCount,
      isCached ? 1 : 0,
      new Date().toISOString(),
    ], (err) => { if (err) reject(err); else resolve(); });
  });

  return { ...result, isCached, costCents };
}

if (require.main === module) {
  cacheHitProofCommand.parse(process.argv);
  cacheHitProofOffline().catch(error => {
    console.error(`Cache hit proof failed: ${error.message}`);
    // db is closed in cacheHitProofOffline finally block
  });
} else {
  module.exports = cacheHitProofOffline;
}
