import { describe, it, expect } from 'vitest';
import { SkiptraceRequest } from '../../../src/dto/v1/skiptrace';

describe('SkiptraceRequest DTO', () => {
  it('accepts a valid payload', () => {
    const ok = SkiptraceRequest.safeParse({
      force: true,
      provider: 'batchdata',
      fallback: false,
      maxRetries: 2,
      runId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects invalid runId', () => {
    const bad = SkiptraceRequest.safeParse({ runId: 'not-a-uuid' });
    expect(bad.success).toBe(false);
  });
});
