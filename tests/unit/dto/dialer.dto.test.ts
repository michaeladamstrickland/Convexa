import { describe, it, expect } from 'vitest';
import { DialRequest } from '../../../src/dto/v1/dialer';

describe('DialRequest DTO', () => {
  it('validates minimal valid payload', () => {
    const ok = DialRequest.safeParse({
      leadId: 'lead-1',
      toNumber: '15551234567',
      fromNumber: '15559876543',
    });
    expect(ok.success).toBe(true);
  });

  it('fails for short numbers', () => {
    const bad = DialRequest.safeParse({
      leadId: 'lead-2',
      toNumber: '123',
      fromNumber: '456',
    });
    expect(bad.success).toBe(false);
  });
});
