// Artifact 1 — Fixture Schedule (plan §8.1).
// Rows grouped by family; counts roll up across rooms; composite assemblies
// explode their component schedule items (WC → FLV, L → F-4/PT-1, DF → DFWF-1)
// so the schedule reads like the one designers hand-build today. Every row is
// traceable to the rooms/decisions that produced it. Unresolved decisions
// surface as explicit gaps, never silently missing.

import type { AgeBand, Assembly, Citation, Kb, Obligation } from '@lausd-pa/kb';
import { assemblyById, obligationById, profileByCode } from '@lausd-pa/kb';
import type { ResolveResult } from '../decisions.ts';
import { isResolved } from '../decisions.ts';
import { deriveFixtureLines } from '../fixtures.ts';
import { toCsv } from './csv.ts';

export interface ScheduleSource {
  room_id: string | null;
  room_number: string;
  decision_id: string;
  n: number;
}

export interface ScheduleRow {
  designation: string;
  family: string;
  display_name: string;
  description: string;
  spec_section: string;
  manufacturers: string;
  mounting_height: string;
  count: number;
  locations: string[];
  location_text: string;
  draft: boolean;
  todo?: string;
  citations: Citation[];
  sources: ScheduleSource[];
  is_component: boolean;
}

export interface ScheduleGap {
  decision_id: string;
  subject: string;
  reason: string;
}

export interface FooterNote {
  obligation_id: string;
  text: string;
  citations: Citation[];
}

export interface FixtureSchedule {
  rows: ScheduleRow[];
  gaps: ScheduleGap[];
  footer_notes: FooterNote[];
  draft_row_count: number;
}

const FAMILY_ORDER = [
  'WC', 'FLV', 'U', 'L', 'F', 'PT', 'ST', 'S', 'SS', 'DF', 'DFWF', 'EEW', 'FD', 'FS', 'HB',
];

/** Footer obligations included when their triggering family is on the schedule. */
const FOOTER_TRIGGERS: Record<string, string[]> = {
  'ob.co.above_fixture': ['U', 'L', 'DF', 'ST', 'S', 'SS'],
  'ob.wha.header': ['WC', 'U', 'L', 'ST', 'SS'],
  'ob.rr.ir_flush_valves': ['FLV'],
  'ob.rr.metered_faucets': ['L'],
  'ob.df.filter_provision': ['DF'],
  'ob.lav.ada_insulation': ['L'],
  'ob.fd.trap_primer': ['FD'],
  'ob.lunch.drain_note': ['FD'],
};

/** Collapse sorted room numbers into ranges: A101,A102,A103 → A101–A103. */
export function collapseLocations(locations: string[]): string {
  const sorted = [...new Set(locations)].sort();
  const parsed = sorted.map((loc) => {
    const m = loc.match(/^([A-Za-z]+)(\d+)$/);
    return m ? { loc, prefix: m[1]!, num: parseInt(m[2]!, 10) } : { loc, prefix: null, num: 0 };
  });
  const out: string[] = [];
  let i = 0;
  while (i < parsed.length) {
    const start = parsed[i]!;
    if (start.prefix === null) {
      out.push(start.loc);
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < parsed.length &&
      parsed[j + 1]!.prefix === start.prefix &&
      parsed[j + 1]!.num === parsed[j]!.num + 1
    ) {
      j += 1;
    }
    if (j - i >= 2) {
      out.push(`${start.loc}–${parsed[j]!.loc}`);
    } else {
      for (let k = i; k <= j; k++) out.push(parsed[k]!.loc);
    }
    i = j + 1;
  }
  return out.join(', ');
}

function heightText(kb: Kb, assembly: Assembly, bands: Set<AgeBand>): string {
  if (!assembly.mounting_height_ref) return '';
  const accessible = assembly.applicability?.ada === true;
  const table = accessible ? kb.heightTable.accessible : kb.heightTable.standard;
  const row = table[assembly.mounting_height_ref];
  if (!row) return '';
  const bandLabel: Record<AgeBand, string> = {
    preK_K: 'preK-K',
    elementary: 'elem',
    secondary_adult: 'adult',
  };
  const parts: string[] = [];
  for (const band of ['preK_K', 'elementary', 'secondary_adult'] as AgeBand[]) {
    if (!bands.has(band)) continue;
    const h = row[band];
    if (h !== undefined) parts.push(`${h} (${bandLabel[band]})`);
    else parts.push(`per 22 1000 2.46 (${bandLabel[band]} — OQ-14)`);
  }
  return parts.join('; ');
}

function manufacturersText(assembly: Assembly): string {
  if (assembly.approved_products.length === 0) return 'Per 22 1000 (not yet extracted)';
  return assembly.approved_products
    .map((p) => (p.model ? `${p.manufacturer} ${p.model}` : p.manufacturer))
    .join(' / ');
}

interface Accumulator {
  count: number;
  locations: string[];
  bands: Set<AgeBand>;
  sources: ScheduleSource[];
  is_component: boolean;
}

export function buildFixtureSchedule(kb: Kb, result: ResolveResult): FixtureSchedule {
  const acc = new Map<string, Accumulator>();
  const gaps: ScheduleGap[] = [];

  const bump = (
    assemblyId: string,
    n: number,
    location: string,
    band: AgeBand | null,
    source: Omit<ScheduleSource, 'n'>,
    isComponent: boolean,
  ): void => {
    if (n === 0) return;
    const a = acc.get(assemblyId) ?? {
      count: 0,
      locations: [],
      bands: new Set<AgeBand>(),
      sources: [],
      is_component: isComponent,
    };
    a.count += n;
    a.locations.push(location);
    if (band) a.bands.add(band);
    a.sources.push({ ...source, n });
    a.is_component = a.is_component && isComponent;
    acc.set(assemblyId, a);
    // Explode components that are themselves schedule items.
    const assembly = assemblyById(kb, assemblyId);
    for (const c of assembly?.components ?? []) {
      if (c.ref) bump(c.ref, n, location, band, source, true);
    }
  };

  const roomsById = new Map(result.rooms.map((r) => [r.room_id, r]));

  for (const dp of result.decision_points) {
    if (!dp.requirement) continue;

    if (!isResolved(dp)) {
      if (dp.status !== 'out_of_coverage') {
        gaps.push({
          decision_id: dp.id,
          subject: dp.subject,
          reason:
            dp.status === 'stale'
              ? 'pending decision — facts changed underneath the prior answer'
              : dp.pending_reason
                ? `pending — ${dp.pending_reason}`
                : 'pending decision in the exception queue',
        });
      }
      continue;
    }

    // Fountains: building/site-level units chosen by the placement rule.
    if (dp.requirement.key === 'fountain') {
      if (dp.resolution?.kind === 'quantities' && dp.resolution.assembly_choice) {
        const label = dp.subject.replace('Fountain + bottle filler — ', '');
        bump(
          dp.resolution.assembly_choice,
          dp.resolution.counts.standard + dp.resolution.counts.accessible,
          label,
          null,
          { room_id: null, room_number: label, decision_id: dp.id },
          false,
        );
      }
      continue;
    }

    const room = dp.room_id ? roomsById.get(dp.room_id) : undefined;
    if (!room || !room.effective.room_type_code) continue;
    const profile = profileByCode(kb, room.effective.room_type_code);
    const req = profile?.fixture_requirements.find(
      (r) => r.id === dp.requirement!.profile_req_id,
    );
    if (!req) continue;

    const derived = deriveFixtureLines(kb, req, dp, room.effective);
    if (derived.pending) {
      if (derived.pending !== 'unresolved' && derived.lines.length === 0) {
        gaps.push({ decision_id: dp.id, subject: dp.subject, reason: `pending — ${derived.pending}` });
      }
      continue;
    }
    for (const line of derived.lines) {
      bump(
        line.assembly,
        line.n,
        room.room_number,
        room.effective.age_band,
        { room_id: room.room_id, room_number: room.room_number, decision_id: dp.id },
        false,
      );
    }
  }

  const rows: ScheduleRow[] = [...acc.entries()]
    .map(([designation, a]) => {
      const assembly = assemblyById(kb, designation)!;
      return {
        designation,
        family: assembly.family,
        display_name: assembly.display_name,
        description: assembly.description_short,
        spec_section: assembly.spec_section,
        manufacturers: manufacturersText(assembly),
        mounting_height: heightText(kb, assembly, a.bands),
        count: a.count,
        locations: [...new Set(a.locations)].sort(),
        location_text: collapseLocations(a.locations),
        draft: assembly.verification_status === 'draft',
        ...(assembly.todo !== undefined ? { todo: assembly.todo } : {}),
        citations: assembly.citations,
        sources: a.sources.sort((x, y) => (x.decision_id < y.decision_id ? -1 : 1)),
        is_component: a.is_component,
      };
    })
    .sort((a, b) => {
      const fa = FAMILY_ORDER.indexOf(a.family);
      const fb = FAMILY_ORDER.indexOf(b.family);
      if (fa !== fb) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
      return a.designation < b.designation ? -1 : 1;
    });

  const familiesPresent = new Set(rows.map((r) => r.family));
  const designationsPresent = new Set(rows.map((r) => r.designation));
  const footer: FooterNote[] = [];
  for (const [obligationId, families] of Object.entries(FOOTER_TRIGGERS)) {
    if (!families.some((f) => familiesPresent.has(f))) continue;
    // The lunch-shelter note only belongs when FD-4 itself is on the schedule.
    if (obligationId === 'ob.lunch.drain_note' && !designationsPresent.has('FD-4')) continue;
    const ob = obligationById(kb, obligationId) as Obligation;
    footer.push({ obligation_id: ob.id, text: ob.text, citations: ob.citations });
  }

  gaps.sort((a, b) => (a.decision_id < b.decision_id ? -1 : 1));
  return {
    rows,
    gaps,
    footer_notes: footer,
    draft_row_count: rows.filter((r) => r.draft).length,
  };
}

export function fixtureScheduleCsv(schedule: FixtureSchedule): string {
  const rows: string[][] = [
    ['Designation', 'Description', 'Spec Section', 'Approved Manufacturers', 'Mounting Height (in. AFF)', 'Count', 'Locations', 'Status'],
  ];
  for (const r of schedule.rows) {
    rows.push([
      r.designation,
      r.description,
      r.spec_section,
      r.manufacturers,
      r.mounting_height,
      String(r.count),
      r.location_text,
      r.draft ? 'DRAFT — verification pending' : '',
    ]);
  }
  if (schedule.gaps.length > 0) {
    rows.push([]);
    rows.push(['PENDING DECISIONS (not yet on schedule)']);
    for (const g of schedule.gaps) rows.push([g.subject, g.reason]);
  }
  rows.push([]);
  rows.push(['SCHEDULE NOTES']);
  for (const n of schedule.footer_notes) {
    rows.push([
      n.text,
      n.citations.map((c) => `${c.doc} ${c.section} (${c.doc_version})`).join('; '),
    ]);
  }
  return toCsv(rows);
}
