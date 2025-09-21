import { describe, it, expect } from 'vitest';
import { LeadCreate } from '../../../src/dto/v1/leads';

describe('LeadCreate DTO', () => {
  it('accepts minimal valid input', () => {
    const parsed = LeadCreate.parse({ address: '123 Main St' });
    expect(parsed.address).toBe('123 Main St');
  });

  it('rejects missing address', () => {
    const res = LeadCreate.safeParse({});
    expect(res.success).toBe(false);
  });
});
