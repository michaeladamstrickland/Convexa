// Lightweight import metrics helper. Uses prom-client if present, otherwise keeps in-memory counters for tests.
import crypto from 'crypto';

let promClient = null;
try { promClient = (await import('prom-client')).default; } catch (_) { promClient = null; }

let counter = null;
let memory = { created: 0, merged: 0, skipped: 0, invalid: 0 };

function ensureCounter() {
  if (counter || !promClient) return;
  try {
    counter = new promClient.Counter({ name: 'convexa_import_rows_total', help: 'Import rows results', labelNames: ['result'] });
  } catch (_) { /* noop if counter exists */ }
}

export function recordImportResults(results) {
  const { created = 0, merged = 0, skipped = 0, invalid = 0 } = results || {};
  ensureCounter();
  // Always keep in-memory counters updated for local tests/inspection
  memory.created += created;
  memory.merged += merged;
  memory.skipped += skipped;
  memory.invalid += invalid;
  // If prom-client is available, increment real counters as well
  if (counter) {
    try {
      if (created) counter.inc({ result: 'created' }, created);
      if (merged) counter.inc({ result: 'merged' }, merged);
      if (skipped) counter.inc({ result: 'skipped' }, skipped);
      if (invalid) counter.inc({ result: 'invalid' }, invalid);
    } catch (_) {}
  }
}

export function _testing_getMemory() {
  return { ...memory };
}

export function _testing_reset() {
  memory = { created: 0, merged: 0, skipped: 0, invalid: 0 };
}
