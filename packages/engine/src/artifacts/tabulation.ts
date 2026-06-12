// Artifact 2 — Fixture-to-Occupant Tabulation (SDG 2.1-J.1.h; plan §8.2).
// The math lives in the engine's stage 7 (counts.ts / resolve.ts); this module
// renders it. Required values badge DRAFT until the CPC ratios are verified
// (risk R1 / OQ-1) — never an unbadged count.

import type { ResolveResult, TabRow } from '../decisions.ts';
import { toCsv } from './csv.ts';

export interface TabulationView {
  occupancy_summary: string;
  draft_banner: string;
  campus: TabRow[];
  per_building: { building_id: string; name: string; rows: TabRow[] }[];
  per_building_note: string;
}

const CLASS_LABEL: Record<TabRow['fixture_class'], string> = {
  wc: 'Water closets',
  urinal: 'Urinals',
  lavatory: 'Lavatories',
  drinking_fountain: 'Drinking fountains / bottle fillers',
};

export function rowLabel(row: TabRow): string {
  const sex = row.sex === 'male' ? ' — male' : row.sex === 'female' ? ' — female' : '';
  const group = row.occupancy_group === 'students' ? 'Students' : 'Staff';
  return `${CLASS_LABEL[row.fixture_class]}${sex} (${group})`;
}

export function statusLabel(row: TabRow): string {
  if (row.status === 'ok') return '✓';
  if (row.status === 'pending') return 'pending decisions';
  return `short by ${row.shortfall}`;
}

export function buildTabulationView(result: ResolveResult): TabulationView | null {
  const t = result.tabulation;
  if (!t) return null;
  const occ = t.occupancy;
  return {
    occupancy_summary: `${occ.students ?? '?'} students (${occ.male_students ?? '?'}/${occ.female_students ?? '?'} at 50/50${occ.sex_split_draft ? ' — DRAFT split, OQ-2' : ''}) + ${occ.staff ?? '?'} staff (2 per classroom, SDG 2.1-J)`,
    draft_banner:
      'DRAFT — required minimums use placeholder CPC ratio values pending verification against the current CPC edition (OQ-1). Do not submit.',
    campus: t.campus,
    per_building: t.per_building,
    per_building_note: t.per_building_note,
  };
}

export function tabulationCsv(view: TabulationView): string {
  const header = ['Fixture class', 'Occupancy basis', 'Required', 'Ratio', 'Provided', 'Status', 'Notes'];
  const rows: string[][] = [
    ['FIXTURE-TO-OCCUPANT TABULATION (SDG 2.1-J.1.h)'],
    [view.draft_banner],
    ['Occupancy basis:', view.occupancy_summary],
    [],
    ['CAMPUS'],
    header,
  ];
  const renderRows = (tabRows: TabRow[], campus: boolean): void => {
    for (const r of tabRows) {
      rows.push([
        rowLabel(r),
        r.basis_text,
        r.required ? `${r.required.count}${r.required.draft ? ' (DRAFT)' : ''}` : campus ? '—' : 'campus basis',
        r.required?.ratio_text ?? '',
        String(r.provided.count),
        statusLabel(r),
        r.provided.note ?? '',
      ]);
    }
  };
  renderRows(view.campus, true);
  for (const b of view.per_building) {
    rows.push([]);
    rows.push([`BUILDING — ${b.name}`]);
    rows.push(header);
    renderRows(b.rows, false);
  }
  rows.push([]);
  rows.push([view.per_building_note]);
  return toCsv(rows);
}
