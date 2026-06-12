// Delta / resync (plan §9): the diff summary shown BEFORE applying a re-import.
// Rooms match by room_id (stable IDs are sacred). The stale/preserved mechanics
// live in resolve() via fingerprints; this module computes the human-readable
// preview so nothing is lost without being shown.

import type { RoomProgram, RoomRecord } from './contracts/types.ts';
import type { CardMember, DecisionResolution, DecisionStore, ResolveResult } from './decisions.ts';

/** Fields whose change is decision-relevant (cosmetic fields like notes are not). */
const DIFF_FIELDS: (keyof RoomRecord)[] = [
  'name_as_drawn',
  'room_type_code',
  'room_type_confidence',
  'building_id',
  'floor',
  'age_band',
  'is_outdoor',
  'ada_designated',
  'scope',
  'adjacent_room_ids',
];

export interface RoomFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RoomChange extends CardMember {
  changed_fields: RoomFieldChange[];
}

export interface StaleDecisionPreview {
  decision_id: string;
  subject: string;
  change_summary: string;
  prior_resolution: DecisionResolution;
  room_id?: string;
}

export interface DeltaSummary {
  added: CardMember[];
  removed: CardMember[];
  changed: RoomChange[];
  untouched_count: number;
  /** Human decisions invalidated by changed facts — re-queued, never silently changed. */
  stale_decisions: StaleDecisionPreview[];
  /** New decisions queued by added rooms (cards the designer will see). */
  new_queued_decision_ids: string[];
  /** Stored decisions whose rooms disappeared — to be archived on apply. */
  decisions_to_archive: string[];
  /** Auto decisions that silently re-resolve (count only — they need no human). */
  preserved_human_count: number;
}

function memberOf(room: RoomRecord): CardMember {
  return {
    room_id: room.room_id,
    room_number: room.room_number ?? room.room_id,
    name_as_drawn: room.name_as_drawn,
  };
}

export function computeDelta(
  prev: RoomProgram,
  nextResolved: ResolveResult,
  store: DecisionStore,
): DeltaSummary {
  const nextProgram = nextResolved.import_report.roomProgram;
  const nextRooms = nextProgram?.rooms ?? [];
  const prevById = new Map(prev.rooms.map((r) => [r.room_id, r]));
  const nextById = new Map(nextRooms.map((r) => [r.room_id, r]));

  const added = nextRooms.filter((r) => !prevById.has(r.room_id)).map(memberOf);
  const removed = prev.rooms.filter((r) => !nextById.has(r.room_id)).map(memberOf);

  const changed: RoomChange[] = [];
  let untouched = 0;
  for (const prevRoom of prev.rooms) {
    const nextRoom = nextById.get(prevRoom.room_id);
    if (!nextRoom) continue;
    const fields: RoomFieldChange[] = [];
    for (const f of DIFF_FIELDS) {
      const before = prevRoom[f] ?? null;
      const after = nextRoom[f] ?? null;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        fields.push({ field: f as string, before, after });
      }
    }
    if (fields.length > 0) changed.push({ ...memberOf(nextRoom), changed_fields: fields });
    else untouched += 1;
  }

  const stale: StaleDecisionPreview[] = nextResolved.decision_points
    .filter((dp) => dp.status === 'stale')
    .map((dp) => ({
      decision_id: dp.id,
      subject: dp.subject,
      change_summary: dp.stale_context?.change_summary ?? 'inputs changed',
      prior_resolution: dp.stale_context!.prior_resolution,
      ...(dp.room_id !== undefined ? { room_id: dp.room_id } : {}),
    }));

  const addedIds = new Set(added.map((a) => a.room_id));
  const newQueued = nextResolved.cards
    .flatMap((c) => c.decision_ids)
    .filter((id) => {
      const roomId = id.match(/^room:([^/]+)\//)?.[1];
      return roomId !== undefined && addedIds.has(roomId);
    })
    .sort();

  const livingIds = new Set(nextResolved.decision_points.map((d) => d.id));
  const toArchive = Object.keys(store.decisions)
    .filter((id) => !livingIds.has(id))
    .sort();

  const preservedHuman = nextResolved.decision_points.filter(
    (dp) => dp.status === 'human_resolved',
  ).length;

  return {
    added,
    removed,
    changed,
    untouched_count: untouched,
    stale_decisions: stale,
    new_queued_decision_ids: newQueued,
    decisions_to_archive: toArchive,
    preserved_human_count: preservedHuman,
  };
}
