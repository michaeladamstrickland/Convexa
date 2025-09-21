import { describe, it, expect } from 'vitest';

describe('report.json shape (skeleton)', () => {
  it('matches minimal shape snapshot', () => {
    const minimal = { totals: { total: 0, done: 0 }, costs: { total: 0 } };
    expect(minimal).toMatchSnapshot();
  });
});
