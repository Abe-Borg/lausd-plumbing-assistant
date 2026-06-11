import { describe, expect, it } from 'vitest';
import { ENGINE_PACKAGE_READY } from '../src/index.ts';

describe('engine package scaffold', () => {
  it('loads', () => {
    expect(typeof ENGINE_PACKAGE_READY).toBe('boolean');
  });
});
