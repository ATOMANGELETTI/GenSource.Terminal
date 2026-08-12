import { describe, expect, it } from 'vitest';

describe('gensource terminal', () => {
  it('exposes the product name', () => {
    expect('GenSource Terminal').toContain('GenSource');
  });
});
