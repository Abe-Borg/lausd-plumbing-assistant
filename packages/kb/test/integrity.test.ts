// KB integrity suite (T2 definition of done):
//  - every record has citations (doc + section + doc_version)
//  - every cross-reference (assemblies, obligations, taxonomy codes, height rows) resolves
//  - taxonomy.json is exactly what contracts/room-type-taxonomy.md says (regenerated parse)
//  - draft records carry a todo naming a live OQ-n entry in /OPEN-QUESTIONS.md
//  - profile water classes carry the taxonomy's water class through (plan §5)
//  - the draft census is reported

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs helper shared with the generation script
import { parseTaxonomyMarkdown } from '../scripts/generate-taxonomy.mjs';
import {
  allRecords,
  assemblyById,
  draftRecords,
  kb,
  obligationById,
  taxonomyByCode,
  waterClassFromRaw,
} from '../src/index.ts';
import type { AssemblySelector, KbRecordBase } from '../src/types.ts';

const repoFile = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

function selectorAssemblies(selector: AssemblySelector): string[] {
  switch (selector.kind) {
    case 'fixed':
      return [selector.assembly, ...(selector.accessible ? [selector.accessible] : [])];
    case 'by_age_band':
      return [
        ...Object.values(selector.standard),
        ...Object.values(selector.accessible ?? {}),
      ].filter((v): v is string => typeof v === 'string');
    case 'choice':
      return selector.options.map((o) => o.assembly);
  }
}

describe('taxonomy stays in sync with the contract doc', () => {
  it('data/taxonomy.json equals a fresh parse of contracts/room-type-taxonomy.md', () => {
    const md = repoFile('contracts/room-type-taxonomy.md');
    const fresh = parseTaxonomyMarkdown(md);
    expect(kb.taxonomy).toEqual(fresh);
  });

  it('has the expected shape (codes unique, water classes parseable)', () => {
    const codes = kb.taxonomy.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const t of kb.taxonomy) {
      expect(t.display_name.length).toBeGreaterThan(0);
      expect(typeof waterClassFromRaw(t.water_class_raw)).toBe('string');
    }
  });
});

describe('every record is cited', () => {
  it('all records have ≥1 citation with doc, section and doc_version', () => {
    const uncited: string[] = [];
    for (const r of allRecords(kb)) {
      if (
        !Array.isArray(r.citations) ||
        r.citations.length === 0 ||
        r.citations.some((c) => !c.doc || !c.section || !c.doc_version)
      ) {
        uncited.push(r.id);
      }
    }
    expect(uncited, `uncited records: ${uncited.join(', ')}`).toEqual([]);
  });

  it('all records have unique ids', () => {
    const ids = allRecords(kb).map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate ids: ${dupes.join(', ')}`).toEqual([]);
  });
});

describe('cross-references resolve', () => {
  it('every assembly referenced by a profile selector exists', () => {
    for (const profile of kb.profiles) {
      for (const req of profile.fixture_requirements) {
        for (const id of selectorAssemblies(req.selector)) {
          expect(assemblyById(kb, id), `${req.id} → missing assembly ${id}`).toBeDefined();
        }
      }
    }
  });

  it('every component ref inside an assembly exists', () => {
    for (const a of kb.assemblies) {
      for (const c of a.components) {
        if (c.ref) {
          expect(assemblyById(kb, c.ref), `${a.id} → missing component ${c.ref}`).toBeDefined();
        }
      }
    }
  });

  it('every obligation referenced by profiles and assemblies exists', () => {
    const refs = new Set<string>();
    for (const p of kb.profiles) for (const o of p.obligations) refs.add(o);
    for (const a of kb.assemblies) for (const o of a.obligations) refs.add(o);
    for (const id of [...refs]) {
      expect(obligationById(kb, id), `missing obligation ${id}`).toBeDefined();
    }
  });

  it('fountain-rule unit selections point at real assemblies', () => {
    expect(assemblyById(kb, kb.fountainRule.unit_selection.single_band)).toBeDefined();
    expect(assemblyById(kb, kb.fountainRule.unit_selection.mixed_or_outdoor_public)).toBeDefined();
  });

  it('every profile room_type_code exists in the taxonomy', () => {
    for (const p of kb.profiles) {
      expect(taxonomyByCode(kb, p.room_type_code), `unknown code ${p.room_type_code}`).toBeDefined();
    }
  });

  it('every mounting_height_ref points at a height-table row', () => {
    const rows = new Set([
      ...Object.keys(kb.heightTable.standard),
      ...Object.keys(kb.heightTable.accessible),
    ]);
    for (const a of kb.assemblies) {
      if (a.mounting_height_ref) {
        expect(rows.has(a.mounting_height_ref), `${a.id} → missing height row ${a.mounting_height_ref}`).toBe(true);
      }
    }
  });
});

describe('profiles carry the taxonomy water class through (plan §5)', () => {
  it('profile water_class equals the taxonomy water class', () => {
    for (const p of kb.profiles) {
      const tax = taxonomyByCode(kb, p.room_type_code)!;
      expect(p.water_class, `${p.room_type_code} water class`).toBe(
        waterClassFromRaw(tax.water_class_raw),
      );
    }
  });
});

describe('the Vista del Sol slice is complete (plan §5)', () => {
  const requiredProfiles = [
    'classroom_general',
    'classroom_kindergarten',
    'classroom_flexible',
    'art_classroom',
    'restroom_student',
    'restroom_staff',
    'restroom_single_user',
    'custodial_closet',
    'custodial_receiving_storage',
    'electrical_room',
    'mechanical_room',
    'nurse_office',
    'teachers_lounge',
    'parent_center',
    'library',
    'library_workroom',
    'multipurpose_room',
    'kitchen_serving',
    'lunch_shelter',
    'play_yard',
    'lactation_station',
    'makerspace',
    'admin_office',
    'plant_manager_office',
  ];

  it(`all ${requiredProfiles.length} room profiles exist`, () => {
    const have = new Set(kb.profiles.map((p) => p.room_type_code));
    const missing = requiredProfiles.filter((c) => !have.has(c));
    expect(missing, `missing profiles: ${missing.join(', ')}`).toEqual([]);
  });

  it('the assemblies named by the plan exist', () => {
    const required = [
      'WC-1', 'WC-2', 'WC-3', 'WC-4', 'WC-5',
      'FLV-1', 'FLV-1a', 'FLV-2', 'FLV-2a',
      'U-3', 'U-4',
      'L-1', 'L-2', 'L-3', 'L-4', 'L-5',
      'F-4', 'F-5', 'F-6',
      'PT-1',
      'ST-2', 'ST-3', 'ST-4', 'ST-5', 'ST-6',
      'SS-1', 'SS-2',
      'DF-12', 'DF-12A', 'DFWF-1',
      'EEW-1',
      'FD-1', 'FD-4', 'FS-1',
      'HB-8',
    ];
    const missing = required.filter((id) => !assemblyById(kb, id));
    expect(missing, `missing assemblies: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('draft discipline', () => {
  it('every draft record carries a todo naming a live OQ entry', () => {
    const oqDoc = repoFile('OPEN-QUESTIONS.md');
    const liveOqIds = new Set(
      [...oqDoc.matchAll(/\|\s*(OQ-\d+)\s*\|/g)].map((m) => m[1] as string),
    );
    expect(liveOqIds.size).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const r of draftRecords(kb)) {
      const oqRef = r.todo?.match(/OQ-\d+/)?.[0];
      if (!oqRef || !liveOqIds.has(oqRef)) offenders.push(`${r.id} (todo: ${r.todo ?? 'none'})`);
    }
    expect(offenders, `draft records without a live OQ reference: ${offenders.join('; ')}`).toEqual([]);
  });

  it('verified records do not reference CPC placeholders', () => {
    for (const r of allRecords(kb)) {
      if (r.verification_status === 'verified') {
        for (const c of r.citations) {
          expect(c.doc, `${r.id} cites CPC but is marked verified`).not.toBe('CPC');
        }
      }
    }
  });

  it('reports the draft census', () => {
    const drafts = draftRecords(kb);
    const byKind = new Map<string, number>();
    for (const r of drafts) {
      const kind = (r as KbRecordBase & { kind?: string }).kind ?? 'unknown';
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    }
    const all = allRecords(kb);
    console.log(
      `[kb] ${all.length} records; ${drafts.length} draft ` +
        `(${[...byKind.entries()].map(([k, n]) => `${k}: ${n}`).join(', ')})\n` +
        drafts.map((d) => `  - ${d.id}: ${d.todo}`).join('\n'),
    );
    expect(drafts.length).toBeGreaterThan(0); // CPC ratios alone guarantee this pre-verification
  });
});
