import { describe, it, expect, beforeEach } from 'vitest';
import { recordImportResults, _testing_getMemory, _testing_reset } from '../../backend/services/importMetrics.js';

describe('importMetrics helper', () => {
  beforeEach(() => _testing_reset());

  it('increments memory fallback when prom-client missing', () => {
    recordImportResults({ created: 2, merged: 1, skipped: 3, invalid: 4 });
    const m = _testing_getMemory();
    expect(m.created).toBe(2);
    expect(m.merged).toBe(1);
    expect(m.skipped).toBe(3);
    expect(m.invalid).toBe(4);
  });
});
