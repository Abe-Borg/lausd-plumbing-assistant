// T4 — artifact generators + CSV serializers, with golden CSVs (plan §12).
// DoD: tabulation math traces to CountRules; DRAFT badges present; CSVs open
// cleanly in spreadsheet apps (proved by round-trip parsing + uniform shape).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { kb } from '@lausd-pa/kb';
import {
  artifactCsvs,
  buildArtifacts,
  collapseLocations,
  parseCsv,
} from '../src/index.ts';
import { resolveV1, runScript } from './helpers.ts';

function checkGoldenText(name: string, text: string): void {
  const path = fileURLToPath(new URL(`./goldens/artifacts/${name}`, import.meta.url));
  if (process.env.GOLDEN_UPDATE === '1' || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    if (process.env.GOLDEN_UPDATE !== '1') {
      throw new Error(`golden ${name} did not exist — written; review it and re-run`);
    }
    return;
  }
  expect(text, `golden mismatch: ${name}`).toBe(readFileSync(path, 'utf8'));
}

const { result: fullResult } = runScript();
const artifacts = buildArtifacts(kb, fullResult);
const csvs = artifactCsvs(artifacts);

describe('fixture schedule', () => {
  const byDesignation = Object.fromEntries(artifacts.schedule.rows.map((r) => [r.designation, r]));

  it('contains the acceptance-sketch selections with correct counts', () => {
    expect(byDesignation['WC-5']).toMatchObject({ count: 2 });
    expect(byDesignation['WC-1']).toMatchObject({ count: 9 }); // 1×3 boys + 2×3 girls
    expect(byDesignation['WC-2']).toMatchObject({ count: 6 }); // 1 accessible × 6 gang RRs
    expect(byDesignation['WC-3']).toMatchObject({ count: 1 }); // staff RR A212
    expect(byDesignation['WC-4']).toMatchObject({ count: 2 }); // ADA staff A112 + single-user B111
    expect(byDesignation['U-3']).toMatchObject({ count: 3 });
    expect(byDesignation['U-4']).toMatchObject({ count: 3 });
    expect(byDesignation['L-1']).toMatchObject({ count: 8 }); // 6 gang std + 2 kinder
    expect(byDesignation['L-2']).toMatchObject({ count: 6 });
    expect(byDesignation['L-3']).toMatchObject({ count: 1 });
    expect(byDesignation['L-4']).toMatchObject({ count: 2 });
    expect(byDesignation['SS-2']).toMatchObject({ count: 3 });
    expect(byDesignation['SS-1']).toMatchObject({ count: 1 });
    expect(byDesignation['EEW-1']).toMatchObject({ count: 1, draft: true });
    expect(byDesignation['L-5']).toMatchObject({ count: 1 });
    expect(byDesignation['FS-1']).toMatchObject({ count: 2 }); // mech + serving kitchen
    expect(byDesignation['FD-4']).toMatchObject({ count: 2 });
    expect(byDesignation['HB-8']).toMatchObject({ count: 6 });
    expect(byDesignation['HB-1']).toMatchObject({ count: 2 });
    expect(byDesignation['ST-2']).toMatchObject({ count: 5 }); // flex + nurse + lounge + parent + lib wk
    expect(byDesignation['ST-4']).toMatchObject({ count: 12 }); // 10 general (policy yes) + 2 kinder
    expect(byDesignation['ST-3']).toMatchObject({ count: 1 }); // makerspace (B115)
    expect(byDesignation['DF-12']).toMatchObject({ count: 3 });
    expect(byDesignation['DF-12A']).toMatchObject({ count: 4 }); // MPR + MULTI-USE + lunch + play yard
  });

  it('explodes components: flush valves, faucets, traps, filter heads roll up from parents', () => {
    expect(byDesignation['FLV-1']).toMatchObject({ count: 20, is_component: true }); // all WCs
    expect(byDesignation['FLV-2']).toMatchObject({ count: 6, is_component: true }); // all urinals
    expect(byDesignation['F-4']).toMatchObject({ count: 14, is_component: true }); // L-1 + L-2
    expect(byDesignation['F-5']).toMatchObject({ count: 3, is_component: true }); // L-3 + L-4
    expect(byDesignation['F-6']).toMatchObject({ count: 3, is_component: true }); // SS-2
    expect(byDesignation['PT-1']).toMatchObject({ count: 17, is_component: true }); // all lavatories
    expect(byDesignation['DFWF-1']).toMatchObject({ count: 7, is_component: true }); // all fountains
  });

  it('shows verified manufacturers and honest placeholders', () => {
    expect(byDesignation['L-1']!.manufacturers).toBe('CECO 551 / Kohler K-2867 / Zurn Z5844-CB');
    expect(byDesignation['F-4']!.manufacturers).toBe('Chicago 3400-ABCP / Zurn');
    expect(byDesignation['WC-1']!.manufacturers).toContain('not yet extracted');
  });

  it('resolves mounting heights per age band, accessible variants from the accessible table', () => {
    expect(byDesignation['L-1']!.mounting_height).toBe('25 (preK-K); 30 (elem)');
    expect(byDesignation['WC-5']!.mounting_height).toBe('11–12 (preK-K)');
    expect(byDesignation['WC-4']!.mounting_height).toBe('17–19 (adult)');
    expect(byDesignation['U-4']!.mounting_height).toBe('15 (elem)');
    expect(byDesignation['L-4']!.mounting_height).toBe('34 max (adult)');
  });

  it('collapses consecutive room numbers into ranges', () => {
    expect(collapseLocations(['A101', 'A102', 'A103', 'A104'])).toBe('A101–A104');
    expect(collapseLocations(['A101', 'A103'])).toBe('A101, A103');
    // General classrooms A101–A104 + kindergartens A105/A106 collapse together.
    expect(byDesignation['ST-4']!.location_text).toBe('A101–A106, A201–A206');
  });

  it('every row is traceable to its source decisions', () => {
    for (const row of artifacts.schedule.rows) {
      expect(row.sources.length).toBeGreaterThan(0);
      expect(row.citations.length).toBeGreaterThan(0);
    }
  });

  it('includes the LAUSD footer note block, each line cited', () => {
    const ids = artifacts.schedule.footer_notes.map((n) => n.obligation_id);
    expect(ids).toContain('ob.co.above_fixture');
    expect(ids).toContain('ob.wha.header');
    expect(ids).toContain('ob.rr.ir_flush_valves');
    expect(ids).toContain('ob.df.filter_provision');
    expect(ids).toContain('ob.lunch.drain_note');
    for (const n of artifacts.schedule.footer_notes) expect(n.citations.length).toBeGreaterThan(0);
  });

  it('a fresh import (nothing answered) renders gaps, not silence', () => {
    const fresh = buildArtifacts(kb, resolveV1());
    expect(fresh.schedule.gaps.length).toBeGreaterThan(0);
    const gapSubjects = fresh.schedule.gaps.map((g) => g.subject).join('\n');
    expect(gapSubjects).toContain('BOYS RR');
    // Auto-resolved rows are already there even before any human answers.
    expect(fresh.schedule.rows.some((r) => r.designation === 'WC-5')).toBe(true);
  });
});

describe('fixture-to-occupant tabulation', () => {
  it('math traces to the CountRules records', () => {
    const ratios = kb.ratioTables.find((t) => t.occupancy === 'students_elementary')!;
    const boysWcRatio = ratios.ratios.find((r) => r.fixture_class === 'wc' && r.sex === 'male')!;
    const boysWc = artifacts.tabulation!.campus.find(
      (r) => r.fixture_class === 'wc' && r.sex === 'male' && r.occupancy_group === 'students',
    )!;
    expect(boysWc.required!.count).toBe(Math.ceil(175 / boysWcRatio.per));
    expect(boysWc.required!.ratio_text).toBe(`1:${boysWcRatio.per} → ${boysWc.required!.count}`);
    expect(boysWc.provided.count).toBe(6);
    expect(boysWc.status).toBe('ok');
  });

  it('DRAFT badges are everywhere required values appear', () => {
    for (const row of artifacts.tabulation!.campus) {
      if (row.required) expect(row.required.draft).toBe(true);
    }
    expect(artifacts.tabulation!.draft_banner).toContain('DRAFT');
    expect(csvs['fixture-to-occupant-tabulation.csv']).toContain('DRAFT');
  });

  it('per-building tables show provided counts with the campus-basis note (OQ-3)', () => {
    expect(artifacts.tabulation!.per_building.map((b) => b.building_id)).toEqual([
      'bldg-a',
      'bldg-b',
      'site',
    ]);
    expect(artifacts.tabulation!.per_building_note).toContain('OQ-3');
    const bldgA = artifacts.tabulation!.per_building[0]!;
    const aWcMale = bldgA.rows.find((r) => r.fixture_class === 'wc' && r.sex === 'male' && r.occupancy_group === 'students')!;
    expect(aWcMale.provided.count).toBe(4); // A110 (2) + A210 (2)
  });
});

describe('water temperature service matrix', () => {
  const matrix = artifacts.temp_matrix;
  const servicesByRoom = new Map<string, string[]>();
  for (const r of matrix.rows) {
    servicesByRoom.set(r.room_number, [...(servicesByRoom.get(r.room_number) ?? []), r.service]);
  }

  it('matches the acceptance sketch services', () => {
    expect(servicesByRoom.get('A110')).toEqual(['T']); // student RR tempered
    expect(servicesByRoom.get('A112')).toEqual(['HC']); // staff RR
    expect(servicesByRoom.get('B102')).toEqual(['HC']); // nurse
    expect(servicesByRoom.get('B108')).toEqual(['HC']); // serving kitchen
    expect(servicesByRoom.get('A101')).toEqual(['C']); // general classroom (sinks: yes)
    expect(servicesByRoom.get('A105')).toEqual(['C']); // kindergarten classroom
    expect(servicesByRoom.get('B113')).toEqual(['HC', 'TP']); // receiving: sink + EEW tepid
    expect(servicesByRoom.get('A107')).toEqual(['HC']); // flexible classroom
    expect(servicesByRoom.get('B105')).toBeUndefined(); // library: no plumbing
    expect(servicesByRoom.get('A114')).toBeUndefined(); // electrical above grade
  });

  it('tempered rows carry the TMV placement note', () => {
    const tempered = matrix.rows.filter((r) => r.service === 'T');
    expect(tempered.length).toBe(8); // 6 gang + 2 kinder student RRs
    for (const r of tempered) expect(r.note).toContain('not inside the restroom');
  });

  it('every row carries a driving citation', () => {
    for (const r of matrix.rows) expect(r.citations.length).toBeGreaterThan(0);
  });
});

describe('CSV exports', () => {
  it('round-trip cleanly and match the committed goldens', () => {
    for (const [name, text] of Object.entries(csvs)) {
      const parsed = parseCsv(text);
      expect(parsed.length).toBeGreaterThan(3);
      expect(text.endsWith('\r\n')).toBe(true);
      checkGoldenText(name, text);
    }
  });

  it('the schedule CSV has a uniform 8-column data block', () => {
    const parsed = parseCsv(csvs['fixture-schedule.csv']!);
    const header = parsed[0]!;
    expect(header).toHaveLength(8);
    const dataRows = parsed.slice(1, 1 + artifacts.schedule.rows.length);
    for (const row of dataRows) expect(row).toHaveLength(8);
  });

  it('is deterministic across runs', () => {
    const again = artifactCsvs(buildArtifacts(kb, runScript().result));
    expect(again).toEqual(csvs);
  });
});
