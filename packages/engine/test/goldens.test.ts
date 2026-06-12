// T3 golden-file + determinism tests (plan §12).
// Three committed goldens:
//   v1-empty-store.json       — resolve(vista v1, kb, {})
//   v1-full-resolution.json   — after the scripted decision file
//   v2-delta.json             — v2 against the v1 store + the delta summary
// Regenerate with: GOLDEN_UPDATE=1 npx vitest run packages/engine/test/goldens.test.ts
// The determinism gate: two runs must be byte-identical (no clock, no randomness).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeDelta } from '../src/index.ts';
import type { RoomProgram } from '../src/contracts/types.ts';
import { resolveV1, resolveV2, roomsV1Json, runScript } from './helpers.ts';

function checkGolden(name: string, value: unknown): void {
  const path = fileURLToPath(new URL(`./goldens/${name}.json`, import.meta.url));
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (process.env.GOLDEN_UPDATE === '1' || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serialized);
    if (process.env.GOLDEN_UPDATE !== '1') {
      throw new Error(`golden ${name} did not exist — written; review it and re-run`);
    }
    return;
  }
  const expected = readFileSync(path, 'utf8');
  expect(serialized, `golden mismatch: ${name} (review or GOLDEN_UPDATE=1)`).toBe(expected);
}

describe('determinism (non-negotiable §0.1)', () => {
  it('same inputs + same KB + same decisions → deep-equal, byte-identical output', () => {
    const a = resolveV1();
    const b = resolveV1();
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const runA = runScript();
    const runB = runScript();
    expect(runA.result).toEqual(runB.result);
    expect(JSON.stringify(runA.store)).toBe(JSON.stringify(runB.store));
  });

  it('decision ids and fingerprints are content-derived (no uuids, no timestamps)', () => {
    const result = resolveV1();
    for (const dp of result.decision_points) {
      expect(dp.id).toMatch(/^(room|building|project):/);
      expect(dp.inputs_fingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(JSON.stringify(result)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/); // no ISO timestamps
  });
});

describe('golden files', () => {
  it('v1 + empty store matches the committed golden', () => {
    checkGolden('v1-empty-store', resolveV1());
  });

  it('v1 + scripted decision file matches the committed golden', () => {
    const { store, result } = runScript();
    checkGolden('v1-full-resolution', { store, result });
  });

  it('v2 + v1 store (the DD shuffle) matches the committed golden', () => {
    const { store } = runScript();
    const v2 = resolveV2(store);
    const delta = computeDelta(roomsV1Json as unknown as RoomProgram, v2, store);
    checkGolden('v2-delta', { delta, result: v2 });
  });
});
