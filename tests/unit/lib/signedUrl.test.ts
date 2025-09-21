import { describe, it, expect } from 'vitest';
import { signPath, verifyPath } from '../../../src/lib/signedUrl';

describe('signedUrl util', () => {
  it('verifies valid signatures', () => {
    const secret = 'test-secret';
    const rel = 'run_reports/abc/report.json';
    const exp = Math.floor(Date.now() / 1000) + 10;
    const sig = signPath(rel, exp, secret);
    expect(verifyPath(rel, exp, sig, secret)).toBe(true);
  });
  it('rejects expired signatures', () => {
    const secret = 'test-secret';
    const rel = 'run_reports/abc/report.json';
    const exp = Math.floor(Date.now() / 1000) - 1;
    const sig = signPath(rel, exp, secret);
    expect(verifyPath(rel, exp, sig, secret)).toBe(false);
  });
  it('rejects tampered signatures', () => {
    const secret = 'test-secret';
    const rel = 'run_reports/abc/report.json';
    const exp = Math.floor(Date.now() / 1000) + 10;
    const sig = signPath(rel, exp, secret);
    expect(verifyPath(rel, exp, sig + 'A', secret)).toBe(false);
  });
});
