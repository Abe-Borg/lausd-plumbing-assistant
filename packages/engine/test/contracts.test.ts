// T1 — contracts-as-code fixture tests (plan §12).
// Positive: all three synthetic Vista del Sol files validate cleanly.
// Negative: one deliberately broken fixture per ★ field, each asserting the
// contract-specified behavior (hard refusal vs. room refusal vs. warn-and-degrade)
// and a human-readable message naming the field and the contract doc.

import { describe, expect, it } from 'vitest';
import { validateImport } from '../src/contracts/validate.ts';
import type { ImportResult } from '../src/contracts/types.ts';
import dossierJson from '../../../synthetic/vista-del-sol/dossier.json';
import roomsV1Json from '../../../synthetic/vista-del-sol/room_program.json';
import roomsV2Json from '../../../synthetic/vista-del-sol/room_program.v2.json';

type Mutable = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function freshDossier(): Mutable {
  return structuredClone(dossierJson) as Mutable;
}
function freshRooms(): Mutable {
  return structuredClone(roomsV1Json) as Mutable;
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((i) => i.code);
}

describe('synthetic Vista del Sol files (positive path)', () => {
  it('dossier.json + room_program.json validate with no errors, no warnings, no refused rooms', () => {
    const result = validateImport(dossierJson, roomsV1Json);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.refusedRooms).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.roomProgram?.rooms).toHaveLength(43);
    expect(result.dossier?.project.project_id).toBe('vds-es-2026');
  });

  it('dossier.json + room_program.v2.json validate clean (44 rooms)', () => {
    const result = validateImport(dossierJson, roomsV2Json);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.refusedRooms).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.roomProgram?.rooms).toHaveLength(44);
  });

  it('unknown extra fields are ignored, never errors (convention 5)', () => {
    const dossier = freshDossier();
    dossier.project.some_future_field = { anything: [1, 2, 3] };
    const rooms = freshRooms();
    rooms.rooms[0].name_as_drawn_confidence = 0.93;
    rooms.rooms[0].name_as_drawn_source = 'sheet A-101 room schedule';
    const result = validateImport(dossier, rooms);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('★ violations — dossier.json project fields', () => {
  it('missing project.project_id refuses the import (sole hard requirement with rooms)', () => {
    const dossier = freshDossier();
    delete dossier.project.project_id;
    const result = validateImport(dossier, freshRooms());
    expect(result.ok).toBe(false);
    expect(result.dossier).toBeNull();
    const messages = result.errors.map((e) => e.message).join('\n');
    expect(messages).toContain('project_id');
    expect(messages).toContain('contracts/dossier-contract.md');
  });

  const degradable: Array<{ field: string; code: string; degradationMentions: string }> = [
    {
      field: 'school_level',
      code: 'dossier.project.school_level.missing',
      degradationMentions: 'age-dependent decisions queue',
    },
    {
      field: 'project_type',
      code: 'dossier.project.project_type.missing',
      degradationMentions: 'new_construction',
    },
    {
      field: 'planned_capacity',
      code: 'dossier.project.planned_capacity.missing',
      degradationMentions: 'tabulation cannot be produced',
    },
    {
      field: 'classroom_count',
      code: 'dossier.project.classroom_count.missing',
      degradationMentions: 'Staff fixture counts',
    },
  ];

  for (const { field, code, degradationMentions } of degradable) {
    it(`missing project.${field} (★) proceeds with the contract's stated degradation`, () => {
      const dossier = freshDossier();
      delete dossier.project[field];
      const result = validateImport(dossier, freshRooms());
      expect(result.ok).toBe(true); // degraded, not blocked
      expect(codes(result.warnings)).toContain(code);
      const w = result.warnings.find((x) => x.code === code)!;
      expect(w.message).toContain(field);
      expect(w.message).toContain('contracts/dossier-contract.md');
      expect(w.degradation).toContain(degradationMentions);
    });

    it(`null project.${field} behaves exactly like absence (convention 6)`, () => {
      const dossier = freshDossier();
      dossier.project[field] = null;
      const result = validateImport(dossier, freshRooms());
      expect(result.ok).toBe(true);
      expect(codes(result.warnings)).toContain(code);
    });
  }

  it('an invalid present value on a ★ enum (school_level) is an import error naming field and doc', () => {
    const dossier = freshDossier();
    dossier.project.school_level = 'junior';
    const result = validateImport(dossier, freshRooms());
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.path.includes('school_level'))!;
    expect(err.message).toContain('school_level');
    expect(err.message).toContain('eec | elementary | middle | high | span | adult_ed');
    expect(err.contract_ref).toContain('contracts/dossier-contract.md');
  });

  it('a wrongly-typed ★ value (planned_capacity as string) is an import error', () => {
    const dossier = freshDossier();
    dossier.project.planned_capacity = '350';
    const result = validateImport(dossier, freshRooms());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path.includes('planned_capacity'))).toBe(true);
  });
});

describe('★ violations — dossier.json buildings', () => {
  it('building without building_id warns: rooms cannot anchor', () => {
    const dossier = freshDossier();
    delete dossier.buildings[0].building_id;
    const result = validateImport(dossier, freshRooms());
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('dossier.building.building_id.missing');
    // Rooms referencing the now-anchorless building float, with a warning each.
    expect(codes(result.warnings)).toContain('room.building_id.unknown');
  });

  it('building without floors warns: multi-story triggers queue', () => {
    const dossier = freshDossier();
    delete dossier.buildings[0].floors;
    const result = validateImport(dossier, freshRooms());
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.code === 'dossier.building.floors.missing')!;
    expect(w.message).toContain('bldg-a');
    expect(w.degradation).toContain('isolation valves');
  });
});

describe('★ violations — room_program.json', () => {
  it('missing rooms refuses the import', () => {
    const rooms = freshRooms();
    delete rooms.rooms;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('rooms is required'))).toBe(true);
  });

  it('empty rooms refuses the import', () => {
    const rooms = freshRooms();
    rooms.rooms = [];
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain('room_program.rooms.empty');
  });

  it('missing room_program project_id refuses the import', () => {
    const rooms = freshRooms();
    delete rooms.project_id;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(false);
  });

  it('project_id mismatch between files refuses the import (shared stable-ID space)', () => {
    const rooms = freshRooms();
    rooms.project_id = 'some-other-project';
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.code === 'import.project_id.mismatch')!;
    expect(err.message).toContain('vds-es-2026');
    expect(err.message).toContain('some-other-project');
  });

  it('a room without room_id is refused individually; the rest of the import proceeds', () => {
    const rooms = freshRooms();
    delete rooms.rooms[2].room_id;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(result.refusedRooms).toHaveLength(1);
    expect(result.refusedRooms[0]!.index).toBe(2);
    expect(result.refusedRooms[0]!.issues[0]!.message).toContain('room_id');
    expect(result.refusedRooms[0]!.issues[0]!.message).toContain('import refused for the room');
    expect(result.roomProgram?.rooms).toHaveLength(42);
  });

  it('a room without name_as_drawn is refused individually (classification evidence)', () => {
    const rooms = freshRooms();
    delete rooms.rooms[5].name_as_drawn;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(result.refusedRooms).toHaveLength(1);
    expect(result.refusedRooms[0]!.room_id).toBe(rooms.rooms[5].room_id);
    expect(result.refusedRooms[0]!.issues[0]!.message).toContain('classification evidence');
  });

  it('a room without room_number warns and states the room_id fallback', () => {
    const rooms = freshRooms();
    delete rooms.rooms[0].room_number;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.code === 'room.room_number.missing')!;
    expect(w.message).toContain('rm-a101');
    expect(w.degradation).toContain('room_id');
  });

  it('a room without building_id warns that it floats', () => {
    const rooms = freshRooms();
    delete rooms.rooms[0].building_id;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.code === 'room.building_id.missing')!;
    expect(w.message).toContain('floats');
  });

  it('a room without floor warns that per-floor rules queue', () => {
    const rooms = freshRooms();
    delete rooms.rooms[0].floor;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.code === 'room.floor.missing')!;
    expect(w.degradation).toContain('queue');
  });

  it('an invalid ★ value on a room (floor as string) refuses that room only', () => {
    const rooms = freshRooms();
    rooms.rooms[1].floor = 'first';
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(result.refusedRooms).toHaveLength(1);
    expect(result.refusedRooms[0]!.room_id).toBe(rooms.rooms[1].room_id);
    expect(result.roomProgram?.rooms).toHaveLength(42);
  });

  it('an invalid optional value (age_band) is downgraded to a warning and treated as unknown', () => {
    const rooms = freshRooms();
    rooms.rooms[0].age_band = 'adult'; // not in the enum
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(result.refusedRooms).toEqual([]);
    const w = result.warnings.find((x) => x.code === 'room.age_band.invalid_ignored')!;
    expect(w.message).toContain('preK_K | elementary | secondary_adult');
    expect(w.degradation).toContain('queue');
  });

  it('duplicate room_id values refuse the import (stable IDs are sacred)', () => {
    const rooms = freshRooms();
    rooms.rooms[1].room_id = rooms.rooms[0].room_id;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.code === 'room_program.room_id.duplicate')!;
    expect(err.message).toContain('rm-a101');
  });

  it('a dangling adjacent_room_ids reference warns (confirm adjacency)', () => {
    const rooms = freshRooms();
    rooms.rooms[0].adjacent_room_ids = ['rm-nonexistent'];
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.code === 'room.adjacent.unknown_ref')!;
    expect(w.message).toContain('rm-nonexistent');
  });

  it('ids_stable: false flags the import', () => {
    const rooms = freshRooms();
    rooms.ids_stable = false;
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('room_program.ids_stable.false');
  });

  it('an unrecognized contract_version warns but proceeds (forward compatibility)', () => {
    const rooms = freshRooms();
    rooms.contract_version = '0.9';
    const result = validateImport(freshDossier(), rooms);
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('room_program.contract_version.unsupported');
  });
});

describe('result shape', () => {
  it('is JSON-serializable and deterministic across runs', () => {
    const a: ImportResult = validateImport(dossierJson, roomsV1Json);
    const b: ImportResult = validateImport(dossierJson, roomsV1Json);
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
  });
});
