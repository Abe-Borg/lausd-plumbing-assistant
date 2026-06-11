import { describe, expect, it } from 'vitest';
import { KB_PACKAGE_READY } from '../src/index.ts';

describe('kb package scaffold', () => {
  it('loads', () => {
    expect(typeof KB_PACKAGE_READY).toBe('boolean');
  });
});
