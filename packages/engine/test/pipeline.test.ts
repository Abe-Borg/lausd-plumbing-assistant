// T3 behavioral tests: the pipeline against the synthetic project's seeded
// imperfections (narrative.md) and the acceptance sketch.

import { describe, expect, it } from 'vitest';
import {
  computeDelta,
  deriveFixtureLines,
  reopenDecision,
  type DecisionPoint,
  type ResolveResult,
} from '../src/index.ts';
import { kb, resolveV1, resolveV2, roomsV1Json, runScript } from './helpers.ts';
import type { RoomProgram } from '../src/contracts/types.ts';

function dp(result: ResolveResult, id: string): DecisionPoint {
  const found = result.decision_points.find((d) => d.id === id);
  if (!found) throw new Error(`missing decision point ${id}`);
  return found;
}

function linesOf(result: ResolveResult, dpId: string): { assembly: string; n: number }[] {
  const d = dp(result, dpId);
  const roomId = d.room_id!;
  const room = result.rooms.find((r) => r.room_id === roomId)!;
  const reqId = d.requirement!.profile_req_id;
  const profile = kb.profiles.find((p) => p.room_type_code === room.effective.room_type_code)!;
  const req = profile.fixture_requirements.find((r) => r.id === reqId)!;
  return deriveFixtureLines(kb, req, d, room.effective).lines.map(({ assembly, n }) => ({ assembly, n }));
}

describe('Act 1 — load v1 with an empty store', () => {
  const result = resolveV1();

  it('imports clean: 43 rooms, no errors, no refusals', () => {
    expect(result.import_report.ok).toBe(true);
    expect(result.rooms).toHaveLength(43);
    expect(result.import_report.refusedRooms).toEqual([]);
  });

  it('queues exactly the seeded exception cards, in the §7 order', () => {
    expect(result.cards.map((c) => c.card_id)).toEqual([
      'card:room:rm-b115/classify',
      'card:room:rm-b116/classify',
      'card:room:rm-a110/age_band',
      'policy:classroom_general_sinks',
      'qty:classroom_flexible:rm-a107',
      'qty:lunch_shelter:rm-s001',
      'qty:restroom_student:female',
      'qty:restroom_student:male',
      'choice:room:rm-s001/req:hose_bibb',
      'card:project:all_electric',
      'card:project:ladwp_16d',
    ]);
  });

  it('the classroom-sink policy card batches all 10 general classrooms', () => {
    const card = result.cards.find((c) => c.card_id === 'policy:classroom_general_sinks')!;
    expect(card.card_type).toBe('batch_policy');
    expect(card.batch_members).toHaveLength(10);
    expect(card.decision_ids).toHaveLength(10);
  });

  it('the boys quantity card covers the three boys restrooms including A110 (band pending)', () => {
    const card = result.cards.find((c) => c.card_id === 'qty:restroom_student:male')!;
    expect(card.batch_members?.map((m) => m.room_id)).toEqual(['rm-a110', 'rm-a210', 'rm-b109']);
    expect(card.decision_ids).toHaveLength(9); // wc + urinal + lav × 3 rooms
    const wcField = card.quantity_fields!.find((f) => f.req_key === 'wc')!;
    expect(wcField.suggested).toEqual({ standard: 1, accessible: 1 }); // ceil(ceil(175/30)/3)=2
    expect(wcField.suggestion_is_draft).toBe(true);
    expect(wcField.suggestion_basis).toContain('DRAFT CPC values');
  });

  it('classify card for STEAM ROOM offers the full fuzzy-ranked taxonomy and no guess', () => {
    const card = result.cards.find((c) => c.card_id === 'card:room:rm-b115/classify')!;
    expect(card.default_suggestion).toBeUndefined();
    expect(card.options!.length).toBe(kb.taxonomy.length); // full list, §6.3
    expect(card.options!.some((o) => o.value === 'makerspace')).toBe(true);
    expect(dp(result, 'room:rm-b115/classify').status).toBe('queued');
  });

  it('MULTI-USE ROOM (confidence 0.6) asks for confirmation with the current mapping as default', () => {
    const card = result.cards.find((c) => c.card_id === 'card:room:rm-b116/classify')!;
    expect(card.default_suggestion).toBe('multipurpose_room');
    expect(card.prompt).toContain('60%');
  });

  it('kindergarten attached restrooms auto-resolve: WC-5 + L-1, floor drain, no hose bibb, no entry fountain', () => {
    expect(linesOf(result, 'room:rm-a105a/req:wc')).toEqual([{ assembly: 'WC-5', n: 1 }]);
    expect(linesOf(result, 'room:rm-a105a/req:lav')).toEqual([{ assembly: 'L-1', n: 1 }]);
    expect(linesOf(result, 'room:rm-a105a/req:floor_drain')).toEqual([{ assembly: 'FD-1', n: 1 }]);
    expect(result.decision_points.some((d) => d.id === 'room:rm-a105a/req:hose_bibb')).toBe(false);
    const room = result.rooms.find((r) => r.room_id === 'rm-a105a')!;
    expect(room.effective.classroom_attached).toBe(true);
    expect(room.not_applicable_rules.some((r) => r.label === 'Hose bibb')).toBe(true);
    expect(
      result.decision_points.some(
        (d) => d.requirement?.key === 'fountain' && d.inputs_snapshot.members?.toString().includes('rm-a105a'),
      ),
    ).toBe(false);
  });

  it('the electrical room above grade correctly fires nothing, with a visible trace', () => {
    const room = result.rooms.find((r) => r.room_id === 'rm-a114')!;
    expect(room.total_count).toBe(0);
    expect(room.not_applicable_rules).toHaveLength(1);
    expect(room.not_applicable_rules[0]!.reason).toContain('below grade only');
  });

  it('staff restrooms pick the accessible variants only where ADA-designated', () => {
    expect(linesOf(result, 'room:rm-a112/req:wc')).toEqual([{ assembly: 'WC-4', n: 1 }]);
    expect(linesOf(result, 'room:rm-a112/req:lav')).toEqual([{ assembly: 'L-4', n: 1 }]);
    expect(linesOf(result, 'room:rm-a212/req:wc')).toEqual([{ assembly: 'WC-3', n: 1 }]);
    expect(linesOf(result, 'room:rm-b111/req:wc')).toEqual([{ assembly: 'WC-4', n: 1 }]);
  });

  it('PRV auto-resolves at 88 psi with the SDG citation', () => {
    const prv = dp(result, 'project:prv');
    expect(prv.status).toBe('auto_resolved');
    expect(prv.rationale).toContain('88 psi > 80');
    expect(prv.citations[0]!.section).toContain('3.4-E.2');
  });

  it('fountains: floor-2 and Building B entries resolve to DF-12; MPR/play/lunch to DF-12A; floor-1 waits on A110', () => {
    const fountains = result.decision_points.filter((d) => d.requirement?.key === 'fountain');
    expect(fountains).toHaveLength(6);
    const byId = Object.fromEntries(fountains.map((f) => [f.id, f]));
    expect(byId['building:bldg-a/fountain:rm-a110+rm-a111']!.pending_reason).toContain('age band');
    expect(byId['building:bldg-a/fountain:rm-a210+rm-a211']!.resolution).toMatchObject({
      assembly_choice: 'DF-12',
    });
    expect(byId['building:bldg-b/fountain:rm-b109+rm-b110']!.resolution).toMatchObject({
      assembly_choice: 'DF-12',
    });
    expect(byId['building:bldg-b/fountain:rm-b107']!.resolution).toMatchObject({
      assembly_choice: 'DF-12A',
    });
    expect(byId['building:site/fountain:rm-s001']!.resolution).toMatchObject({
      assembly_choice: 'DF-12A',
    });
    expect(byId['building:site/fountain:rm-s002']!.resolution).toMatchObject({
      assembly_choice: 'DF-12A',
    });
    for (const f of fountains) expect(f.verification_status).toBe('draft'); // OQ-5 badge
  });

  it('tabulation badges DRAFT and marks unanswered classes pending', () => {
    const t = result.tabulation!;
    expect(t.occupancy).toMatchObject({ students: 350, staff: 26 });
    const boysWc = t.campus.find((r) => r.fixture_class === 'wc' && r.sex === 'male' && r.occupancy_group === 'students')!;
    expect(boysWc.required).toMatchObject({ count: 6, draft: true });
    expect(boysWc.status).toBe('pending');
    const staffWc = t.campus.find((r) => r.fixture_class === 'wc' && r.occupancy_group === 'staff' && r.sex === 'male')!;
    expect(staffWc.provided.count).toBe(3);
    expect(staffWc.status).toBe('ok');
  });
});

describe('Act 2/3 — the scripted decision file resolves everything', () => {
  const { result } = runScript();

  it('reaches 100% completeness with an empty queue', () => {
    expect(result.cards).toEqual([]);
    expect(result.completeness.resolved).toBe(result.completeness.total);
    expect(result.completeness.ratio).toBe(1);
  });

  it('A110 derives WC-1 + WC-2 after the elementary age-band answer', () => {
    expect(linesOf(result, 'room:rm-a110/req:wc')).toEqual([
      { assembly: 'WC-1', n: 1 },
      { assembly: 'WC-2', n: 1 },
    ]);
    expect(linesOf(result, 'room:rm-a110/req:urinal')).toEqual([
      { assembly: 'U-3', n: 1 },
      { assembly: 'U-4', n: 1 },
    ]);
  });

  it('A110 floor drains derive from the answered quantities (2 WCs + 2 urinals → 2 FDs)', () => {
    const fd = dp(result, 'room:rm-a110/req:floor_drain');
    expect(fd.status).toBe('auto_resolved');
    expect(fd.resolution).toMatchObject({ counts: { standard: 2 } });
    expect(fd.rationale).toContain('front-center');
  });

  it('the floor-1 entry fountain resolves to child-height DF-12 once A110 is elementary', () => {
    const f = dp(result, 'building:bldg-a/fountain:rm-a110+rm-a111');
    expect(f.status).toBe('auto_resolved');
    expect(f.resolution).toMatchObject({ assembly_choice: 'DF-12' });
  });

  it('general classrooms got their ST-4 sinks via the batch policy (fan-out per room)', () => {
    expect(linesOf(result, 'room:rm-a101/req:sink')).toEqual([{ assembly: 'ST-4', n: 1 }]);
    const d = dp(result, 'room:rm-a101/req:sink');
    expect(d.resolution).toMatchObject({ policy_value: 'yes' });
    expect(d.status).toBe('human_resolved');
  });

  it('the confirmed MULTI-USE ROOM generates a second lobby fountain', () => {
    const f = dp(result, 'building:bldg-b/fountain:rm-b116');
    expect(f.resolution).toMatchObject({ assembly_choice: 'DF-12A' });
  });

  it('tabulation is all ✓ (no shortfalls, nothing pending) with DRAFT-badged required values', () => {
    for (const row of result.tabulation!.campus) {
      expect(row.status).toBe('ok');
      if (row.required) expect(row.required.draft).toBe(true);
    }
  });

  it('undo: reopening the A110 age band re-queues it and the entry fountain goes pending again', () => {
    const { store } = runScript();
    const reopened = resolveV1(reopenDecision(store, 'room:rm-a110/age_band'));
    expect(reopened.cards.map((c) => c.card_id)).toEqual(['card:room:rm-a110/age_band']);
    expect(dp(reopened, 'building:bldg-a/fountain:rm-a110+rm-a111').pending_reason).toContain('age band');
    // The quantity answers survive — only the band re-asks.
    expect(dp(reopened, 'room:rm-a110/req:wc').status).toBe('human_resolved');
  });
});

describe('Act 4 — the DD shuffle (v2 re-import)', () => {
  const { store } = runScript();
  const v2 = resolveV2(store);
  const delta = computeDelta(roomsV1Json as unknown as RoomProgram, v2, store);

  it('summarizes: 1 changed, 1 added, 0 removed, 42 untouched', () => {
    expect(delta.changed.map((c) => c.room_id)).toEqual(['rm-a107']);
    expect(delta.changed[0]!.changed_fields.map((f) => f.field)).toEqual([
      'name_as_drawn',
      'room_type_code',
      'room_type_confidence',
    ]);
    expect(delta.added.map((a) => a.room_id)).toEqual(['rm-b117']);
    expect(delta.removed).toEqual([]);
    expect(delta.untouched_count).toBe(42);
  });

  it('exactly one human decision goes stale — A107\'s sink — with a before/after story', () => {
    expect(delta.stale_decisions).toHaveLength(1);
    const stale = delta.stale_decisions[0]!;
    expect(stale.decision_id).toBe('room:rm-a107/req:sink');
    expect(stale.change_summary).toContain('Flexible classroom');
    expect(stale.change_summary).toContain('Art classroom');
    expect(stale.prior_resolution).toMatchObject({ kind: 'quantities' });
  });

  it('the new lactation station queues exactly one new decision', () => {
    expect(delta.new_queued_decision_ids).toEqual(['room:rm-b117/req:sink']);
  });

  it('every other human decision is preserved untouched', () => {
    expect(delta.decisions_to_archive).toEqual([]);
    const b115 = v2.decision_points.find((d) => d.id === 'room:rm-b115/classify')!;
    expect(b115.status).toBe('human_resolved');
    const policy = v2.decision_points.find((d) => d.id === 'room:rm-a101/req:sink')!;
    expect(policy.status).toBe('human_resolved');
  });

  it('the queue shows the stale card first, then the new room\'s card', () => {
    expect(v2.cards.map((c) => c.card_id)).toEqual([
      'stale:room:rm-a107/req:sink',
      'qty:lactation_station:rm-b117',
    ]);
    const staleCard = v2.cards[0]!;
    expect(staleCard.card_type).toBe('stale');
    expect(staleCard.options!.map((o) => o.value)).toEqual(['ST-5', 'ST-6']);
    expect(staleCard.stale_context!.prior_resolution).toMatchObject({ kind: 'quantities' });
  });

  it('resolving the two cards brings v2 back to 100%', () => {
    const { result } = runScript(
      [
        {
          card_id: 'stale:room:rm-a107/req:sink',
          answer: () => ({ kind: 'choice', assembly: 'ST-5', counts: { standard: 1, accessible: 0 } }),
        },
        {
          card_id: 'qty:lactation_station:rm-b117',
          answer: () => ({
            kind: 'quantities',
            counts: { 'room:rm-b117/req:sink': { standard: 1, accessible: 0 } },
          }),
        },
      ],
      store,
      resolveV2,
    );
    expect(result.cards).toEqual([]);
    expect(result.completeness.ratio).toBe(1);
    expect(linesOf(result, 'room:rm-a107/req:sink')).toEqual([{ assembly: 'ST-5', n: 1 }]);
    expect(linesOf(result, 'room:rm-b117/req:sink')).toEqual([{ assembly: 'ST-3', n: 1 }]);
  });

  it('a cosmetic change (notes) does not invalidate anything', () => {
    const cosmetic = structuredClone(roomsV1Json) as RoomProgram & { rooms: { notes?: string }[] };
    cosmetic.rooms[0]!.notes = 'repainted blue';
    const r = resolveV1(store);
    const r2 = runScriptlessResolve(cosmetic, store);
    expect(r2.decision_points.filter((d) => d.status === 'stale')).toEqual([]);
    expect(r2.completeness.resolved).toBe(r.completeness.resolved);
  });
});

import { resolve as engineResolve } from '../src/index.ts';
import { dossierJson } from './helpers.ts';
import type { DecisionStore } from '../src/index.ts';

function runScriptlessResolve(roomProgram: unknown, store: DecisionStore): ResolveResult {
  return engineResolve({ dossier: dossierJson, roomProgram, kb, store });
}
