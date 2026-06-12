// Artifact 3 — Water Temperature Service Matrix (plan §8.3).
// One row per room-service pair (a receiving room is HC at the sink AND tepid
// at the emergency fixture), grouped by service class, each with its driving
// citation. Tempered rows carry the TMV placement note (SDG 3.4-D).

import type { Citation, Kb, WaterClass } from '@lausd-pa/kb';
import { obligationById, profileByCode } from '@lausd-pa/kb';
import type { ResolveResult } from '../decisions.ts';
import { isResolved } from '../decisions.ts';
import { toCsv } from './csv.ts';

export type ServiceClass = 'HC' | 'T' | 'TP' | 'C';

export interface TempMatrixRow {
  room_id: string;
  room_number: string;
  name_as_drawn: string;
  type_display: string;
  service: ServiceClass;
  service_label: string;
  citations: Citation[];
  note?: string;
}

export interface TempMatrix {
  rows: TempMatrixRow[];
  tmv_note: string;
  setpoints_note: string;
}

export const SERVICE_LABEL: Record<ServiceClass, string> = {
  HC: 'Hot + cold',
  T: 'Tempered',
  TP: 'Tepid (emergency)',
  C: 'Cold only',
};

const SERVICE_ORDER: ServiceClass[] = ['HC', 'T', 'TP', 'C'];

export function buildTempMatrix(kb: Kb, result: ResolveResult): TempMatrix {
  const rows: TempMatrixRow[] = [];
  const tmvNote = obligationById(kb, 'ob.tmv.placement')!;
  const setpoints = obligationById(kb, 'ob.temp.setpoints')!;

  for (const room of result.rooms) {
    const code = room.effective.room_type_code;
    if (!code) continue;
    const profile = profileByCode(kb, code);
    if (!profile) continue;

    // A room appears only when it actually has water-served fixtures resolved
    // (a "no sinks" policy answer drops the room off the matrix, honestly).
    const roomDps = result.decision_points.filter(
      (d) => d.room_id === room.room_id && d.requirement !== undefined,
    );
    const waterServed = roomDps.some((d) => {
      if (d.requirement!.key === 'floor_drain' || d.requirement!.key === 'pavilion_drain') return false;
      if (!isResolved(d) || d.resolution?.kind !== 'quantities') {
        // Unresolved fixture decisions keep the room on the matrix as pending
        // only if the class is fixed by the profile; skip quietly otherwise.
        return d.status === 'queued' || d.status === 'stale';
      }
      return d.resolution.counts.standard + d.resolution.counts.accessible > 0;
    });

    const cls = profile.water_class as WaterClass;
    if (waterServed && (cls === 'HC' || cls === 'T' || cls === 'C')) {
      rows.push({
        room_id: room.room_id,
        room_number: room.room_number,
        name_as_drawn: room.name_as_drawn,
        type_display: kb.taxonomy.find((t) => t.code === code)?.display_name ?? code,
        service: cls,
        service_label: SERVICE_LABEL[cls],
        citations: profile.citations,
        ...(cls === 'T' ? { note: tmvNote.text } : {}),
      });
    }

    // Emergency fixtures add a tepid row regardless of the room's base class.
    const eew = roomDps.find((d) => d.requirement!.key === 'eew');
    if (eew && isResolved(eew) && eew.resolution?.kind === 'quantities') {
      const n = eew.resolution.counts.standard + eew.resolution.counts.accessible;
      if (n > 0) {
        rows.push({
          room_id: room.room_id,
          room_number: room.room_number,
          name_as_drawn: room.name_as_drawn,
          type_display: kb.taxonomy.find((t) => t.code === code)?.display_name ?? code,
          service: 'TP',
          service_label: SERVICE_LABEL.TP,
          citations: eew.citations,
          note: 'Emergency shower/eyewash — tepid 60–100°F, potable connection.',
        });
      }
    }
  }

  rows.sort((a, b) => {
    const sa = SERVICE_ORDER.indexOf(a.service);
    const sb = SERVICE_ORDER.indexOf(b.service);
    if (sa !== sb) return sa - sb;
    return a.room_number < b.room_number ? -1 : 1;
  });

  return { rows, tmv_note: tmvNote.text, setpoints_note: setpoints.text };
}

export function tempMatrixCsv(matrix: TempMatrix): string {
  const rows: string[][] = [
    ['WATER TEMPERATURE SERVICE MATRIX (SDG 3.4-D)'],
    [],
    ['Room', 'Name', 'Type', 'Service', 'Driving citation', 'Note'],
  ];
  for (const r of matrix.rows) {
    rows.push([
      r.room_number,
      r.name_as_drawn,
      r.type_display,
      r.service_label,
      r.citations.map((c) => `${c.doc} ${c.section}`).join('; '),
      r.note ?? '',
    ]);
  }
  rows.push([]);
  rows.push(['Setpoints:', matrix.setpoints_note]);
  rows.push(['TMV placement:', matrix.tmv_note]);
  return toCsv(rows);
}
