import { describe, expect, it } from 'vitest';

describe('gensource template', () => {
  it('exposes the product name', () => {
    expect('GenSource Template').toContain('GenSource');
  });
});
