// Stage 2 — Normalize (plan §6): derive per-room effective facts with provenance.
// Derivations only use facts in the input files; anything underivable stays null
// and the pipeline queues the corresponding card. Human resolutions from the
// decision store are overlaid in resolve.ts, not here.

import type { Dossier, RoomRecord, SchoolLevel } from './contracts/types.ts';
import type { RoomEffectiveFacts, Sex } from './decisions.ts';
import type { AgeBand } from './contracts/types.ts';

/**
 * Age band derivable from school level only when every room of that school
 * unambiguously shares it. K-5 elementary is NOT unambiguous (kindergarten rooms
 * are preK_K), so `elementary` derives nothing and rooms missing a band queue —
 * per the contract's "If missing" column and the synthetic project's intent.
 */
export function ageBandFromSchoolLevel(level: SchoolLevel | null | undefined): AgeBand | null {
  switch (level) {
    case 'eec':
      return 'preK_K';
    case 'middle':
    case 'high':
    case 'adult_ed':
      return 'secondary_adult';
    default:
      return null; // elementary (mixed preK_K/elementary), span, unknown
  }
}

export function deriveSex(
  room: RoomRecord,
  roomTypeCode: string | null,
  classroomAttached: boolean,
): { sex: Sex | null; provenance: string } {
  const name = (room.name_as_drawn ?? '').toLowerCase();
  if (/\bboys?\b/.test(name)) {
    return { sex: 'male', provenance: `derived from name "${room.name_as_drawn}"` };
  }
  if (/\bgirls?\b/.test(name)) {
    return { sex: 'female', provenance: `derived from name "${room.name_as_drawn}"` };
  }
  if (roomTypeCode === 'restroom_student' && classroomAttached) {
    return { sex: 'unisex', provenance: 'classroom-attached single restroom (unisex)' };
  }
  if (roomTypeCode === 'restroom_staff' || roomTypeCode === 'restroom_single_user') {
    return { sex: 'unisex', provenance: 'staff/single-user restroom (serves all)' };
  }
  if (roomTypeCode === 'restroom_student') {
    return { sex: null, provenance: 'not derivable — queued (see OQ-17 served_sex proposal)' };
  }
  return { sex: 'unisex', provenance: 'not sex-specific' };
}

export interface NormalizedRoom {
  room: RoomRecord;
  room_number: string;
  room_number_fallback: boolean;
  effective: RoomEffectiveFacts;
}

/** Room types whose adjacency marks an attached restroom. */
const CLASSROOM_PREFIX = 'classroom_';

export function normalizeRooms(
  dossier: Dossier,
  rooms: RoomRecord[],
  /** Effective type codes after classification overlay (room_id → code|null). */
  effectiveTypeCode: (roomId: string) => { code: string | null; provenance: string },
): NormalizedRoom[] {
  const byId = new Map(rooms.map((r) => [r.room_id, r]));
  const schoolLevelBand = ageBandFromSchoolLevel(dossier.project.school_level ?? null);

  return rooms.map((room) => {
    const { code, provenance: typeProvenance } = effectiveTypeCode(room.room_id);

    // classroom_attached: any adjacent room resolves to a classroom_* type.
    const classroomAttached = (room.adjacent_room_ids ?? []).some((adjId) => {
      const adj = byId.get(adjId);
      if (!adj) return false;
      const adjCode = effectiveTypeCode(adjId).code;
      return adjCode !== null && adjCode.startsWith(CLASSROOM_PREFIX);
    });

    let ageBand: AgeBand | null = room.age_band ?? null;
    let ageBandProvenance = ageBand !== null ? 'room program' : 'not stated';
    if (ageBand === null && schoolLevelBand !== null) {
      ageBand = schoolLevelBand;
      ageBandProvenance = `derived from school_level "${dossier.project.school_level}"`;
    }

    const { sex, provenance: sexProvenance } = deriveSex(room, code, classroomAttached);

    const floor = room.floor ?? null;
    const effective: RoomEffectiveFacts = {
      room_type_code: code,
      type_provenance: typeProvenance,
      age_band: ageBand,
      age_band_provenance: ageBandProvenance,
      sex,
      sex_provenance: sexProvenance,
      classroom_attached: classroomAttached,
      is_outdoor: room.is_outdoor ?? false,
      ada_designated: room.ada_designated ?? false,
      floor_below_grade: floor !== null && floor < 1,
    };

    return {
      room,
      room_number: room.room_number && room.room_number !== '' ? room.room_number : room.room_id,
      room_number_fallback: !room.room_number,
      effective,
    };
  });
}
