// The resolution pipeline (plan §6). Pure:
//   resolve({dossier, roomProgram, kb, store}) → ResolveResult
// Stages: validate → normalize → classify gaps → fire room profiles →
// batch collapse → project rules → counts. No I/O, no clock, no randomness;
// every decision id and fingerprint is derived from content.

import type {
  Citation,
  FixtureRequirement,
  Kb,
  RoomTypeProfile,
  TaxonomyEntry,
} from '@lausd-pa/kb';
import { assemblyById, profileByCode, taxonomyByCode } from '@lausd-pa/kb';
import type { AgeBand, Dossier, RoomProgram, RoomRecord } from './contracts/types.ts';
import { validateImport } from './contracts/validate.ts';
import type {
  BuildingRollup,
  CardMember,
  CardOption,
  DecisionPoint,
  DecisionStore,
  Diagnostic,
  ExceptionCard,
  FixtureCounts,
  NotApplicableRule,
  QuantityField,
  ResolveResult,
  RoomRollup,
  Sex,
  StaleContext,
  TabRow,
  TabulationData,
} from './decisions.ts';
import { isResolved } from './decisions.ts';
import { computeOccupancy, ratioAllocationSuggestion, requiredCount, type Occupancy } from './counts.ts';
import { fingerprint } from './fingerprint.ts';
import { deriveFixtureLines } from './fixtures.ts';
import { normalizeRooms, type NormalizedRoom } from './normalize.ts';
import { rankCandidates } from './similarity.ts';

export interface ResolveInput {
  dossier: unknown;
  roomProgram: unknown;
  kb: Kb;
  store: DecisionStore;
}

const CONFIDENCE_TRUST_THRESHOLD = 0.8;

// Queue ordering (plan §7): import blockers → stale → classification →
// missing facts → batch policies → quantities → choices → acknowledgments.
const ORDER = {
  import_blocker: 0,
  stale: 10,
  classify: 20,
  missing_field: 30,
  batch_policy: 40,
  quantity: 50,
  choice: 60,
  ack: 70,
  out_of_coverage: 80,
} as const;

interface Ctx {
  kb: Kb;
  dossier: Dossier;
  rooms: RoomRecord[];
  store: DecisionStore;
  dps: DecisionPoint[];
  diagnostics: Diagnostic[];
  normalized: Map<string, NormalizedRoom>;
  /** room_id → not-applicable rule traces for the room-detail view. */
  notApplicable: Map<string, NotApplicableRule[]>;
  /** room_id → firing requirements (for cards/artifacts). */
  firedReqs: Map<string, FixtureRequirement[]>;
  occupancy: Occupancy;
}

function displayName(kb: Kb, code: string | null): string {
  if (code === null) return 'unclassified';
  return taxonomyByCode(kb, code)?.display_name ?? code;
}

function changeSummary(kb: Kb, before: Record<string, unknown>, after: Record<string, unknown>): string {
  const parts: string[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (k === 'room_type_code') {
      parts.push(
        `Room type changed ${displayName(kb, (b as string) ?? null)} → ${displayName(kb, (a as string) ?? null)}`,
      );
    } else {
      parts.push(`${k} changed ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
    }
  }
  return parts.join('; ');
}

/** Overlay a stored human decision onto a freshly built decision point. */
function overlayStored(ctx: Ctx, dp: DecisionPoint): DecisionPoint {
  const stored = ctx.store.decisions[dp.id];
  if (!stored) return dp;
  if (stored.inputs_fingerprint === dp.inputs_fingerprint) {
    return {
      ...dp,
      status: 'human_resolved',
      resolution: stored.resolution,
      resolved_by: 'human',
    };
  }
  const stale: StaleContext = {
    before: stored.inputs_snapshot,
    after: dp.inputs_snapshot,
    prior_resolution: stored.resolution,
    change_summary: changeSummary(ctx.kb, stored.inputs_snapshot, dp.inputs_snapshot),
  };
  return { ...dp, status: 'stale', stale_context: stale };
}

function dpBase(
  id: string,
  scope: DecisionPoint['scope'],
  subject: string,
  rationale: string,
  citations: Citation[],
  verification: 'verified' | 'draft',
  snapshot: Record<string, unknown>,
): DecisionPoint {
  return {
    id,
    scope,
    subject,
    status: 'queued',
    rationale,
    citations,
    verification_status: verification,
    inputs_fingerprint: fingerprint(snapshot),
    inputs_snapshot: snapshot,
  };
}

// ---------------------------------------------------------------------------
// Stage 3 — classification gaps
// ---------------------------------------------------------------------------

function classificationDps(ctx: Ctx): void {
  for (const room of ctx.rooms) {
    const trusted =
      room.room_type_code != null &&
      taxonomyByCode(ctx.kb, room.room_type_code) !== undefined &&
      (room.room_type_confidence ?? 1) >= CONFIDENCE_TRUST_THRESHOLD;
    if (room.room_type_code != null && taxonomyByCode(ctx.kb, room.room_type_code) === undefined) {
      ctx.diagnostics.push({
        severity: 'warning',
        code: 'room.room_type_code.unknown',
        message: `Room ${room.room_id}: room_type_code "${room.room_type_code}" is not in the taxonomy — treated as unclassified.`,
      });
    }
    if (trusted) continue; // trusting the dossier's mapping is not a decision

    const snapshot = {
      name_as_drawn: room.name_as_drawn,
      room_type_code: room.room_type_code ?? null,
      room_type_confidence: room.room_type_confidence ?? null,
    };
    const isConfirm = room.room_type_code != null;
    const dp = dpBase(
      `room:${room.room_id}/classify`,
      'room',
      `Classification — ${room.name_as_drawn} (${room.room_number ?? room.room_id})`,
      isConfirm
        ? `Extractor mapped "${room.name_as_drawn}" to ${displayName(ctx.kb, room.room_type_code!)} at confidence ${room.room_type_confidence} — below the ${CONFIDENCE_TRUST_THRESHOLD} trust threshold.`
        : `The dossier program could not classify "${room.name_as_drawn}" — a human call, not a guess.`,
      [
        {
          doc: 'contracts/room-type-taxonomy.md',
          section: 'published room-type vocabulary',
          doc_version: '0.2',
        },
      ],
      'verified',
      snapshot,
    );
    dp.room_id = room.room_id;
    ctx.dps.push(overlayStored(ctx, dp));
  }
}

function effectiveTypeCodeResolver(ctx: Ctx): (roomId: string) => { code: string | null; provenance: string } {
  const byId = new Map(ctx.rooms.map((r) => [r.room_id, r]));
  const dpById = new Map(ctx.dps.map((d) => [d.id, d]));
  return (roomId: string) => {
    const room = byId.get(roomId);
    if (!room) return { code: null, provenance: 'unknown room' };
    const dp = dpById.get(`room:${roomId}/classify`);
    if (dp && dp.status === 'human_resolved' && dp.resolution?.kind === 'classification') {
      return { code: dp.resolution.room_type_code, provenance: 'classified by designer' };
    }
    if (dp) {
      // queued or stale → not yet usable
      if (room.room_type_code != null && dp.status === 'stale') {
        return { code: null, provenance: 'classification stale — re-queued' };
      }
      if (room.room_type_code != null) {
        return { code: null, provenance: `low confidence (${room.room_type_confidence}) — confirmation queued` };
      }
      return { code: null, provenance: 'unclassified — queued' };
    }
    if (room.room_type_code != null && taxonomyByCode(ctx.kb, room.room_type_code) !== undefined) {
      return {
        code: room.room_type_code,
        provenance: `dossier mapping (confidence ${room.room_type_confidence ?? 1})`,
      };
    }
    return { code: null, provenance: 'unclassified' };
  };
}

// ---------------------------------------------------------------------------
// Stage 2½ — age band / sex gaps (only where a fired profile needs them)
// ---------------------------------------------------------------------------

function profileNeedsAgeBand(profile: RoomTypeProfile): boolean {
  return profile.fixture_requirements.some((r) => r.selector.kind === 'by_age_band');
}

function ageBandAndSexDps(ctx: Ctx): void {
  for (const norm of ctx.normalized.values()) {
    const { room, effective } = norm;
    const profile = effective.room_type_code
      ? profileByCode(ctx.kb, effective.room_type_code)
      : undefined;
    if (!profile) continue;

    if (profileNeedsAgeBand(profile) && effective.age_band === null) {
      const snapshot = {
        room_age_band: room.age_band ?? null,
        school_level: ctx.dossier.project.school_level ?? null,
      };
      const dp = dpBase(
        `room:${room.room_id}/age_band`,
        'room',
        `Age band — ${room.name_as_drawn} (${norm.room_number})`,
        'Fixture variants and mounting heights hang on the age band; it is not stated and not unambiguously derivable.',
        [
          {
            doc: 'SDG',
            section: '2.1-J (age group labeling) & 22 1000 2.46 (heights by age band)',
            doc_version: '02/26/2025',
          },
        ],
        'verified',
        snapshot,
      );
      dp.room_id = room.room_id;
      const overlaid = overlayStored(ctx, dp);
      ctx.dps.push(overlaid);
      if (overlaid.status === 'human_resolved' && overlaid.resolution?.kind === 'age_band') {
        effective.age_band = overlaid.resolution.age_band;
        effective.age_band_provenance = 'set by designer';
      }
    }

    if (effective.sex === null) {
      const snapshot = {
        name_as_drawn: room.name_as_drawn,
        classroom_attached: effective.classroom_attached,
      };
      const dp = dpBase(
        `room:${room.room_id}/sex`,
        'room',
        `Served sex — ${room.name_as_drawn} (${norm.room_number})`,
        'Urinal rules and per-sex fixture counts need to know who this restroom serves; not derivable from the drawn name.',
        [
          {
            doc: 'contracts/dossier-contract.md',
            section: 'room program (OQ-17: served_sex field proposal)',
            doc_version: '0.1',
          },
        ],
        'verified',
        snapshot,
      );
      dp.room_id = room.room_id;
      const overlaid = overlayStored(ctx, dp);
      ctx.dps.push(overlaid);
      if (overlaid.status === 'human_resolved' && overlaid.resolution?.kind === 'sex') {
        effective.sex = overlaid.resolution.sex;
        effective.sex_provenance = 'set by designer';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 4 — fire room profiles
// ---------------------------------------------------------------------------

function conditionMatches(
  req: FixtureRequirement,
  norm: NormalizedRoom,
): { applies: boolean; reason?: string } {
  const cond = req.applies_when;
  if (!cond) return { applies: true };
  const e = norm.effective;
  if (cond.sex !== undefined && e.sex !== cond.sex) {
    return { applies: false, reason: `applies to ${cond.sex === 'male' ? 'boys' : 'girls'} restrooms only` };
  }
  if (cond.classroom_attached !== undefined && e.classroom_attached !== cond.classroom_attached) {
    return {
      applies: false,
      reason: cond.classroom_attached
        ? 'applies to classroom-attached restrooms only'
        : 'applies to gang (corridor-entry) restrooms only — classroom-attached restrooms exempt (OQ-7)',
    };
  }
  if (cond.floor_below_grade !== undefined && e.floor_below_grade !== cond.floor_below_grade) {
    return {
      applies: false,
      reason: 'applies below grade only — rule correctly not firing above grade',
    };
  }
  return { applies: true };
}

function reqVerification(kb: Kb, req: FixtureRequirement): 'verified' | 'draft' {
  if (req.verification_status === 'draft') return 'draft';
  const sel = req.selector;
  const assemblies =
    sel.kind === 'fixed'
      ? [sel.assembly, ...(sel.accessible ? [sel.accessible] : [])]
      : sel.kind === 'by_age_band'
        ? [...Object.values(sel.standard), ...Object.values(sel.accessible ?? {})]
        : sel.options.map((o) => o.assembly);
  return assemblies.some((a) => assemblyById(kb, a as string)?.verification_status === 'draft')
    ? 'draft'
    : 'verified';
}

function fireProfiles(ctx: Ctx): void {
  for (const norm of ctx.normalized.values()) {
    const { room, effective } = norm;
    const code = effective.room_type_code;
    if (code === null) continue; // classification pending

    const profile = profileByCode(ctx.kb, code);
    if (!profile) {
      // Recognized taxonomy code, but its rules are not in the MVP slice (§6.4).
      const snapshot = { room_type_code: code };
      const dp = dpBase(
        `room:${room.room_id}/coverage`,
        'room',
        `Coverage — ${room.name_as_drawn} (${norm.room_number})`,
        `${displayName(ctx.kb, code)} is a recognized room type, but its rules are not in the MVP knowledge-base slice yet.`,
        [{ doc: 'contracts/room-type-taxonomy.md', section: code, doc_version: '0.2' }],
        'verified',
        snapshot,
      );
      dp.room_id = room.room_id;
      const overlaid = overlayStored(ctx, dp);
      if (overlaid.status === 'queued') overlaid.status = 'out_of_coverage';
      ctx.dps.push(overlaid);
      continue;
    }

    const fired: FixtureRequirement[] = [];
    const seenKeys = new Set<string>();
    for (const req of profile.fixture_requirements) {
      const { applies, reason } = conditionMatches(req, norm);
      if (!applies) {
        const traces = ctx.notApplicable.get(room.room_id) ?? [];
        traces.push({
          requirement_id: req.id,
          label: req.label,
          reason: reason ?? 'condition not met',
          citations: req.citations,
        });
        ctx.notApplicable.set(room.room_id, traces);
        continue;
      }
      if (seenKeys.has(req.key)) {
        ctx.diagnostics.push({
          severity: 'warning',
          code: 'profile.requirement.collision',
          message: `Room ${room.room_id}: more than one ${req.key} requirement fired — check profile conditions.`,
        });
        continue;
      }
      seenKeys.add(req.key);
      fired.push(req);

      const snapshot = {
        requirement_id: req.id,
        room_type_code: code,
        sex: effective.sex,
        classroom_attached: effective.classroom_attached,
        ada_designated: effective.ada_designated,
        is_outdoor: effective.is_outdoor,
        floor_below_grade: effective.floor_below_grade,
      };
      const citationNote = req.citations[0]?.note;
      const dp = dpBase(
        `room:${room.room_id}/req:${req.key}`,
        'room',
        `${req.label} — ${room.name_as_drawn} (${norm.room_number})`,
        citationNote ?? `${req.label} per ${displayName(ctx.kb, code)} profile.`,
        req.citations,
        reqVerification(ctx.kb, req),
        snapshot,
      );
      dp.room_id = room.room_id;
      dp.requirement = { profile_req_id: req.id, key: req.key, label: req.label };

      let built = overlayStored(ctx, dp);
      if (built.status === 'queued') {
        // No stored human answer — resolve per the quantity rule.
        const q = req.quantity;
        if (q.rule === 'fixed') {
          built = {
            ...built,
            status: 'auto_resolved',
            resolved_by: 'engine',
            resolution: { kind: 'quantities', counts: { standard: q.n, accessible: 0 } },
            rationale:
              q.basis === 'rule'
                ? built.rationale
                : `${built.rationale} (baseline ${q.n} — editable in room detail)`,
          };
        } else if (q.rule === 'derived') {
          // Computed after sibling quantities resolve (derived pass).
          built = { ...built, pending_reason: 'derived from WC/urinal quantities' };
        }
        // designer_quantity and conditional_policy stay queued → cards.
      }
      ctx.dps.push(built);
    }
    ctx.firedReqs.set(room.room_id, fired);
  }
}

// ---------------------------------------------------------------------------
// Derived pass — restroom floor drains (SDG 3.4-B.7)
// ---------------------------------------------------------------------------

function derivedPass(ctx: Ctx): void {
  const byId = new Map(ctx.dps.map((d) => [d.id, d]));
  const params = ctx.kb.restroomFloorDrainRule.params;

  const totalOf = (roomId: string, key: string): number | null => {
    const dp = byId.get(`room:${roomId}/req:${key}`);
    if (!dp) return 0; // requirement did not fire (e.g. urinals in a girls RR)
    if (!isResolved(dp) || dp.resolution?.kind !== 'quantities') return null;
    return dp.resolution.counts.standard + dp.resolution.counts.accessible;
  };

  for (const dp of ctx.dps) {
    if (!dp.requirement || dp.pending_reason === undefined || dp.status !== 'queued') continue;
    if (dp.requirement.key !== 'floor_drain') continue;
    const roomId = dp.room_id!;
    const wc = totalOf(roomId, 'wc');
    const urinals = totalOf(roomId, 'urinal');
    if (wc === null || urinals === null) continue; // stays pending

    const fdFromUrinals = urinals >= params.urinal_group_min ? params.fd_per_urinal_group : 0;
    const fdFromWcs = wc >= 1 ? (wc >= params.wc_group_double_at ? 2 : params.fd_per_wc_group) : 0;
    const n = fdFromUrinals + fdFromWcs;
    dp.status = 'auto_resolved';
    dp.resolved_by = 'engine';
    dp.resolution = { kind: 'quantities', counts: { standard: n, accessible: 0 } };
    dp.rationale = `${n} floor drain(s): ${fdFromWcs} for the WC group (${wc} WC${wc === 1 ? '' : 's'}${wc >= params.wc_group_double_at ? ', ≥4 → two' : ''})${fdFromUrinals > 0 ? ` + ${fdFromUrinals} front-center of the urinal group (${urinals} urinals)` : ''} — ${ctx.kb.restroomFloorDrainRule.text}`;
    delete dp.pending_reason;
  }
}

// ---------------------------------------------------------------------------
// Fountains — building/site-level requirement generator (SDG 2.1-K.2.a)
// ---------------------------------------------------------------------------

function campusBands(ctx: Ctx): AgeBand[] {
  const bands = new Set<AgeBand>();
  for (const norm of ctx.normalized.values()) {
    const code = norm.effective.room_type_code;
    if (code && (code.startsWith('classroom_') || code === 'restroom_student')) {
      if (norm.effective.age_band) bands.add(norm.effective.age_band);
    }
  }
  return [...bands].sort();
}

function fountainDps(ctx: Ctx): void {
  const rule = ctx.kb.fountainRule;
  interface Loc {
    trigger: string;
    members: NormalizedRoom[];
    bands: (AgeBand | null)[];
    outdoor: boolean;
    building_id: string | null;
    locationText: string;
  }
  const locations: Loc[] = [];

  // Entry fountains: gang student restrooms clustered by shared adjacency
  // within a building+floor (a boys/girls pair sharing a custodial room is one
  // entry area → one combination unit).
  const entryRooms = [...ctx.normalized.values()]
    .filter(
      (n) =>
        n.effective.room_type_code === 'restroom_student' &&
        !n.effective.classroom_attached &&
        (profileByCode(ctx.kb, 'restroom_student')?.triggers ?? []).includes('fountain_at_entry'),
    )
    .sort((a, b) => (a.room.room_id < b.room.room_id ? -1 : 1));

  const groups = new Map<string, NormalizedRoom[]>();
  for (const r of entryRooms) {
    const key = `${r.room.building_id ?? '?'}|${r.room.floor ?? '?'}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [, rooms] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // Union-find over shared adjacency.
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let p = parent.get(x) ?? x;
      if (p !== x) {
        p = find(p);
        parent.set(x, p);
      }
      return p;
    };
    const union = (a: string, b: string): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
    };
    for (const a of rooms) {
      for (const b of rooms) {
        if (a.room.room_id >= b.room.room_id) continue;
        const adjA = new Set([...(a.room.adjacent_room_ids ?? []), a.room.room_id]);
        const adjB = new Set([...(b.room.adjacent_room_ids ?? []), b.room.room_id]);
        const shares = [...adjA].some((x) => adjB.has(x));
        if (shares) union(a.room.room_id, b.room.room_id);
      }
    }
    const clusters = new Map<string, NormalizedRoom[]>();
    for (const r of rooms) {
      const root = find(r.room.room_id);
      clusters.set(root, [...(clusters.get(root) ?? []), r]);
    }
    for (const members of [...clusters.values()].sort((a, b) =>
      a[0]!.room.room_id < b[0]!.room.room_id ? -1 : 1,
    )) {
      locations.push({
        trigger: 'fountain_at_entry',
        members,
        bands: members.map((m) => m.effective.age_band),
        outdoor: false,
        building_id: members[0]!.room.building_id ?? null,
        locationText: `${members.map((m) => m.room_number).join('/')} entry`,
      });
    }
  }

  // Lobby / play area / lunch shelter fountains serve the whole school.
  const wholeBands = campusBands(ctx);
  for (const norm of [...ctx.normalized.values()].sort((a, b) =>
    a.room.room_id < b.room.room_id ? -1 : 1,
  )) {
    const code = norm.effective.room_type_code;
    if (!code) continue;
    const profile = profileByCode(ctx.kb, code);
    if (!profile) continue;
    for (const trigger of profile.triggers) {
      if (trigger === 'fountain_at_entry') continue; // handled above
      locations.push({
        trigger,
        members: [norm],
        bands: wholeBands,
        outdoor: norm.effective.is_outdoor,
        building_id: norm.room.building_id ?? null,
        locationText:
          trigger === 'fountain_at_lobby'
            ? `${norm.room.name_as_drawn} (${norm.room_number}) lobby`
            : `${norm.room.name_as_drawn} (${norm.room_number})`,
      });
    }
  }

  for (const loc of locations) {
    const memberIds = loc.members.map((m) => m.room.room_id).sort();
    const id = `building:${loc.building_id ?? 'site'}/fountain:${memberIds.join('+')}`;
    const locationRule = rule.locations.find((l) => l.trigger === loc.trigger);
    const snapshot = {
      trigger: loc.trigger,
      members: memberIds,
      bands: [...new Set(loc.bands)].sort(),
      outdoor: loc.outdoor,
    };
    const dp = dpBase(
      id,
      'building',
      `Fountain + bottle filler — ${loc.locationText}`,
      `${locationRule?.text ?? 'Required fountain location'} (SDG 2.1-K.2.a).`,
      rule.citations,
      rule.verification_status,
      snapshot,
    );
    dp.building_id = loc.building_id ?? 'site';
    dp.requirement = { profile_req_id: rule.id, key: 'fountain', label: 'Fountain + bottle filler' };

    let built = overlayStored(ctx, dp);
    if (built.status === 'queued') {
      if (loc.bands.some((b) => b === null)) {
        built.pending_reason = 'awaiting age band of a served restroom';
      } else {
        const uniqueBands = [...new Set(loc.bands as AgeBand[])];
        const mixed = uniqueBands.length > 1 || loc.outdoor || loc.trigger !== 'fountain_at_entry';
        const unit = mixed ? rule.unit_selection.mixed_or_outdoor_public : rule.unit_selection.single_band;
        built = {
          ...built,
          status: 'auto_resolved',
          resolved_by: 'engine',
          resolution: {
            kind: 'quantities',
            counts: { standard: 1, accessible: 0 },
            assembly_choice: unit,
          },
          rationale: `${built.rationale} ${
            mixed
              ? `Dual-height ${unit}: ${loc.outdoor ? 'outdoor/public use' : uniqueBands.length > 1 ? 'serves mixed age bands' : 'public location'}.`
              : `Child-height ${unit}: single age band (${uniqueBands[0]}).`
          }${loc.outdoor ? ' Exterior: vandal-resistant finish, solar-reflective powder coat on sun-exposed stainless, recessed hose bibb beneath.' : ''}`,
        };
      }
    }
    ctx.dps.push(built);
  }
}

// ---------------------------------------------------------------------------
// Stage 6 — project rules
// ---------------------------------------------------------------------------

function projectRuleDps(ctx: Ctx): void {
  const p = ctx.dossier.project;

  const prvRule = ctx.kb.projectRules.find((r) => r.rule === 'prv_over_80')!;
  const pressure = p.street_pressure_psi ?? null;
  const prvSnapshot = { street_pressure_psi: pressure };
  const prvDp = dpBase(
    'project:prv',
    'project',
    'Pressure regulating (PRV) station',
    pressure === null
      ? 'Street pressure unknown — request the Water Pressure Flow Report / SAR (re-validated annually).'
      : pressure > (prvRule.threshold_psi ?? 80)
        ? `Street pressure ${pressure} psi > ${prvRule.threshold_psi} psi — ${prvRule.requirement_text}`
        : `Street pressure ${pressure} psi ≤ ${prvRule.threshold_psi} psi — no PRV station required.`,
    prvRule.citations,
    prvRule.verification_status,
    prvSnapshot,
  );
  let prv = overlayStored(ctx, prvDp);
  if (prv.status === 'queued' && pressure !== null) {
    prv = {
      ...prv,
      status: 'auto_resolved',
      resolved_by: 'engine',
      resolution: { kind: 'acknowledged' },
    };
  }
  ctx.dps.push(prv);

  if (p.water_purveyor?.is_ladwp === true) {
    const rule = ctx.kb.projectRules.find((r) => r.rule === 'ladwp_16d')!;
    const dp = dpBase(
      'project:ladwp_16d',
      'project',
      rule.title,
      rule.requirement_text,
      rule.citations,
      rule.verification_status,
      { is_ladwp: true },
    );
    ctx.dps.push(overlayStored(ctx, dp));
  }

  if (p.gas?.has_service === false) {
    const rule = ctx.kb.projectRules.find((r) => r.rule === 'all_electric')!;
    const dp = dpBase(
      'project:all_electric',
      'project',
      rule.title,
      rule.requirement_text,
      rule.citations,
      rule.verification_status,
      { has_service: false },
    );
    ctx.dps.push(overlayStored(ctx, dp));
    ctx.diagnostics.push({
      severity: 'info',
      code: 'gas.suppressed',
      message: 'Campus has no gas service — gas subsystem rules suppressed (SDG 3.4-A.1.e).',
    });
  }
}

// ---------------------------------------------------------------------------
// Stage 5 — batch collapse into cards (plus all other card building)
// ---------------------------------------------------------------------------

function member(norm: NormalizedRoom): CardMember {
  return {
    room_id: norm.room.room_id,
    room_number: norm.room_number,
    name_as_drawn: norm.room.name_as_drawn,
  };
}

function classifyOptions(ctx: Ctx, room: RoomRecord): CardOption[] {
  const ranked = rankCandidates(room.name_as_drawn, ctx.kb.taxonomy);
  const current =
    room.room_type_code && taxonomyByCode(ctx.kb, room.room_type_code)
      ? room.room_type_code
      : null;
  const top = ranked.slice(0, 8).map((r) => r.code);
  const codes = current && !top.includes(current) ? [current, ...top] : top;
  return codes.map((code) => {
    const tax = taxonomyByCode(ctx.kb, code) as TaxonomyEntry;
    const profile = profileByCode(ctx.kb, code);
    const hooks = profile
      ? profile.fixture_requirements.length > 0
        ? `fires: ${[...new Set(profile.fixture_requirements.map((r) => r.label.toLowerCase()))].join(', ')}`
        : profile.triggers.length > 0
          ? 'fires site/building fountain rules'
          : 'no plumbing requirements'
      : 'recognized, but outside the MVP rule slice';
    return {
      value: code,
      label: tax.display_name,
      consequence_summary: `${code === current ? 'Confirm current mapping — ' : ''}water: ${tax.water_class_raw}; ${hooks}`,
      citations: [
        { doc: 'contracts/room-type-taxonomy.md', section: code, doc_version: '0.2' },
      ] as Citation[],
    };
  });
}

function buildCards(ctx: Ctx, refusedCards: ExceptionCard[]): ExceptionCard[] {
  const cards: ExceptionCard[] = [...refusedCards];
  const normById = ctx.normalized;
  const ageBandLabels: Record<AgeBand, string> = {
    preK_K: 'Pre-K / Kindergarten (ages 3–5)',
    elementary: 'Elementary (ages 6–11)',
    secondary_adult: 'Secondary / Adult (12+)',
  };
  const ageBandConsequences: Record<AgeBand, string> = {
    preK_K: 'WC-5 (11–12 in. bowls), kindergarten mounting heights',
    elementary: 'WC-1/WC-2, elementary mounting heights (lav rim 30 in.)',
    secondary_adult: 'WC-3/WC-4, adult mounting heights (lav rim 32 in.)',
  };

  // Group queued designer-quantity requirement DPs for batch collapse.
  interface QuantityGroup {
    groupKey: string;
    dps: DecisionPoint[];
    norm: NormalizedRoom[];
    reqs: Map<string, FixtureRequirement>;
  }
  const quantityGroups = new Map<string, QuantityGroup>();
  const policyGroups = new Map<
    string,
    { dps: DecisionPoint[]; members: NormalizedRoom[]; req: FixtureRequirement; prompt: string }
  >();

  for (const dp of ctx.dps) {
    const cardWorthy =
      (dp.status === 'queued' || dp.status === 'out_of_coverage') &&
      dp.pending_reason === undefined;
    const staleCard = dp.status === 'stale';
    if (!cardWorthy && !staleCard) continue;

    const norm = dp.room_id ? normById.get(dp.room_id) : undefined;
    const req = dp.requirement
      ? ctx.firedReqs
          .get(dp.room_id ?? '')
          ?.find((r) => r.id === dp.requirement!.profile_req_id)
      : undefined;

    // --- stale cards (one per decision; highest priority after import blockers) ---
    if (staleCard) {
      cards.push({
        card_id: `stale:${dp.id}`,
        card_type: 'stale',
        prompt: `${dp.stale_context?.change_summary ?? 'Facts changed underneath this decision'}; your ${dp.requirement?.label.toLowerCase() ?? 'decision'} was based on the old facts.`,
        detail: `Re-decide: ${dp.subject}`,
        decision_ids: [dp.id],
        ...(norm ? { batch_members: [member(norm)] } : {}),
        ...(req && req.selector.kind === 'choice'
          ? {
              options: req.selector.options.map((o) => ({
                value: o.assembly,
                label: o.assembly,
                consequence_summary: o.consequence,
                citations: req.citations,
              })),
            }
          : {}),
        ...(req
          ? { quantity_fields: [quantityField(ctx, req, norm)] }
          : {}),
        citations: dp.citations,
        order_rank: ORDER.stale,
        stale_context: dp.stale_context!,
      });
      continue;
    }

    // --- queued decisions, routed by type ---
    if (dp.id.endsWith('/classify')) {
      const room = norm!.room;
      const isConfirm = room.room_type_code != null;
      cards.push({
        card_id: `card:${dp.id}`,
        card_type: 'classify_room',
        prompt: isConfirm
          ? `Confirm room type for "${room.name_as_drawn}" (${norm!.room_number}) — extractor confidence ${Math.round((room.room_type_confidence ?? 0) * 100)}%.`
          : `Classify "${room.name_as_drawn}" (${norm!.room_number}).`,
        ...(room.notes ? { detail: room.notes } : {}),
        decision_ids: [dp.id],
        options: classifyOptions(ctx, room),
        ...(isConfirm ? { default_suggestion: room.room_type_code as string } : {}),
        citations: dp.citations,
        order_rank: ORDER.classify,
      });
    } else if (dp.id.endsWith('/age_band')) {
      const room = norm!.room;
      cards.push({
        card_id: `card:${dp.id}`,
        card_type: 'missing_field',
        prompt: `Which age band does ${room.name_as_drawn} (${norm!.room_number}) serve?`,
        ...(room.notes ? { detail: room.notes } : {}),
        decision_ids: [dp.id],
        options: (Object.keys(ageBandLabels) as AgeBand[]).map((band) => ({
          value: band,
          label: ageBandLabels[band],
          consequence_summary: ageBandConsequences[band],
          citations: dp.citations,
        })),
        citations: dp.citations,
        order_rank: ORDER.missing_field,
      });
    } else if (dp.id.endsWith('/sex')) {
      cards.push({
        card_id: `card:${dp.id}`,
        card_type: 'missing_field',
        prompt: `Who does ${norm!.room.name_as_drawn} (${norm!.room_number}) serve?`,
        decision_ids: [dp.id],
        options: (['male', 'female', 'unisex'] as Sex[]).map((s) => ({
          value: s,
          label: s === 'male' ? 'Boys' : s === 'female' ? 'Girls' : 'All-gender',
          citations: dp.citations,
        })),
        citations: dp.citations,
        order_rank: ORDER.missing_field,
      });
    } else if (dp.id.includes('/coverage')) {
      cards.push({
        card_id: `card:${dp.id}`,
        card_type: 'out_of_coverage',
        prompt: dp.rationale,
        decision_ids: [dp.id],
        options: [
          {
            value: 'acknowledge',
            label: 'Acknowledge — handle this room outside the tool for now',
            citations: dp.citations,
          },
        ],
        citations: dp.citations,
        order_rank: ORDER.out_of_coverage,
        ...(norm ? { batch_members: [member(norm)] } : {}),
      });
    } else if (dp.scope === 'project') {
      if (dp.id === 'project:prv') {
        cards.push({
          card_id: `card:${dp.id}`,
          card_type: 'missing_field',
          prompt: 'Street pressure is unknown — request the Water Pressure Flow Report (SAR) to settle the PRV-station decision.',
          decision_ids: [dp.id],
          citations: dp.citations,
          order_rank: ORDER.missing_field,
        });
      } else {
        cards.push({
          card_id: `card:${dp.id}`,
          card_type: 'project_ack',
          prompt: dp.rationale,
          decision_ids: [dp.id],
          options: [{ value: 'acknowledge', label: 'Acknowledged — carry into the design', citations: dp.citations }],
          citations: dp.citations,
          order_rank: ORDER.ack,
        });
      }
    } else if (req && req.quantity.rule === 'conditional_policy') {
      const key = req.quantity.policy;
      const group = policyGroups.get(key) ?? {
        dps: [],
        members: [],
        req,
        prompt: req.quantity.prompt,
      };
      group.dps.push(dp);
      group.members.push(norm!);
      policyGroups.set(key, group);
    } else if (req && req.quantity.rule === 'designer_quantity') {
      // Collapse identical queued quantity decisions across same-type rooms
      // (same room type + sex → same suggestion).
      const groupKey =
        req.quantity.suggest.method === 'ratio_allocation'
          ? `${norm!.effective.room_type_code}:${norm!.effective.sex}`
          : `${norm!.effective.room_type_code}:${dp.room_id}`; // singletons stay per-room
      const group: QuantityGroup = quantityGroups.get(groupKey) ?? {
        groupKey,
        dps: [],
        norm: [],
        reqs: new Map(),
      };
      group.dps.push(dp);
      if (!group.norm.some((n) => n.room.room_id === dp.room_id)) group.norm.push(norm!);
      group.reqs.set(req.id, req);
      quantityGroups.set(groupKey, group);
    }
  }

  // --- batch policy cards ---
  for (const [key, group] of [...policyGroups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const req = group.req;
    const thenN = req.quantity.rule === 'conditional_policy' ? req.quantity.then.n : 1;
    const assembly = req.selector.kind === 'fixed' ? req.selector.assembly : '?';
    cards.push({
      card_id: `policy:${key}`,
      card_type: 'batch_policy',
      prompt: `${req.quantity.rule === 'conditional_policy' ? req.quantity.prompt : ''} (applies to ${group.members.length} rooms)`,
      decision_ids: group.dps.map((d) => d.id).sort(),
      batch_members: group.members
        .map(member)
        .sort((a, b) => (a.room_number < b.room_number ? -1 : 1)),
      options: [
        {
          value: 'yes',
          label: 'Yes — provide sinks',
          consequence_summary: `Each room receives ${thenN} × ${assembly} (cold water service); cleanout, water-hammer arrestor and room isolation valve obligations attach.`,
          citations: req.citations,
        },
        {
          value: 'no',
          label: 'No sinks',
          consequence_summary: 'No classroom plumbing; rooms drop off the water-service matrix.',
          citations: req.citations,
        },
      ],
      citations: req.citations,
      order_rank: ORDER.batch_policy,
    });
  }

  // --- quantity cards (batched and singleton) ---
  for (const [key, group] of [...quantityGroups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const reqs = [...group.reqs.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
    const sample = group.norm[0]!;
    const choiceReq = reqs.find((r) => r.selector.kind === 'choice');
    const fields = reqs
      .filter((r) => r.selector.kind !== 'choice')
      .map((r) => quantityField(ctx, r, sample));

    if (choiceReq) {
      // A choice selector (art sink ST-5/ST-6; lunch-shelter HB-1/HB-2) gets its
      // own choice card with the quantity inline.
      const f = quantityField(ctx, choiceReq, sample);
      cards.push({
        card_id: `choice:${group.dps.find((d) => d.requirement?.key === choiceReq.key)!.id}`,
        card_type: 'choice',
        prompt: `${choiceReq.label} — ${sample.room.name_as_drawn} (${sample.room_number}): choose the assembly.`,
        decision_ids: group.dps
          .filter((d) => d.requirement?.key === choiceReq.key)
          .map((d) => d.id),
        batch_members: [member(sample)],
        options: (choiceReq.selector.kind === 'choice' ? choiceReq.selector.options : []).map((o) => ({
          value: o.assembly,
          label: o.assembly,
          consequence_summary: o.consequence,
          citations: choiceReq.citations,
        })),
        quantity_fields: [f],
        citations: choiceReq.citations,
        order_rank: ORDER.choice,
      });
    }
    if (fields.length > 0) {
      const isBatch = group.norm.length > 1;
      const sexLabel =
        sample.effective.sex === 'male' ? 'Boys' : sample.effective.sex === 'female' ? 'Girls' : '';
      cards.push({
        card_id: `qty:${key}`,
        card_type: 'quantity_entry',
        prompt: isBatch
          ? `Set fixture quantities for the ${group.norm.length} ${sexLabel.toLowerCase()} student restrooms (suggestions shown — accept or edit).`
          : `Set quantities for ${sample.room.name_as_drawn} (${sample.room_number}).`,
        decision_ids: group.dps
          .filter((d) => !choiceReq || d.requirement?.key !== choiceReq.key)
          .map((d) => d.id)
          .sort(),
        batch_members: group.norm
          .map(member)
          .sort((a, b) => (a.room_number < b.room_number ? -1 : 1)),
        quantity_fields: fields,
        citations: reqs.flatMap((r) => r.citations),
        order_rank: ORDER.quantity,
      });
    }
  }

  cards.sort((a, b) =>
    a.order_rank !== b.order_rank ? a.order_rank - b.order_rank : a.card_id < b.card_id ? -1 : 1,
  );
  return cards;
}

function quantityField(ctx: Ctx, req: FixtureRequirement, norm: NormalizedRoom | undefined): QuantityField {
  const sel = req.selector;
  const band = norm?.effective.age_band ?? null;
  let preview = '';
  let hasAccessible = false;
  if (sel.kind === 'fixed') {
    preview = sel.accessible ? `${sel.assembly} + ${sel.accessible} (accessible)` : sel.assembly;
    hasAccessible = sel.accessible !== undefined;
  } else if (sel.kind === 'by_age_band') {
    const std = band ? sel.standard[band] : undefined;
    const acc = band ? sel.accessible?.[band] : undefined;
    preview = std
      ? acc
        ? `${std} + ${acc} (accessible)`
        : std
      : `by age band (${Object.values(sel.standard).join('/')})`;
    hasAccessible = acc !== undefined || (!band && sel.accessible !== undefined);
  } else {
    preview = sel.options.map((o) => o.assembly).join(' or ');
  }

  let suggested: FixtureCounts | null = null;
  let basis = '';
  let draft = false;
  const q = req.quantity;
  if (q.rule === 'designer_quantity') {
    if (q.suggest.method === 'ratio_allocation') {
      const sex = norm?.effective.sex;
      if (sex === 'male' || sex === 'female') {
        const restroomCount = [...ctx.normalized.values()].filter(
          (n) =>
            n.effective.room_type_code === 'restroom_student' &&
            !n.effective.classroom_attached &&
            n.effective.sex === sex,
        ).length;
        const s = ratioAllocationSuggestion(
          ctx.kb,
          ctx.occupancy,
          q.suggest.fixture_class === 'wc'
            ? 'wc'
            : q.suggest.fixture_class === 'urinal'
              ? 'urinal'
              : 'lavatory',
          sex,
          restroomCount,
        );
        if (s) {
          const accessible = hasAccessible && s.total >= 1 ? 1 : 0;
          suggested = { standard: s.total - accessible, accessible };
          basis = `${s.basis}${accessible > 0 ? ' Includes 1 accessible position (heuristic — OQ-6/R2).' : ''}`;
          draft = true;
        } else {
          basis = 'No suggestion — planned capacity or ratio table unavailable.';
          draft = true;
        }
      } else {
        basis = 'No suggestion — restroom sex unknown.';
        draft = true;
      }
    } else if (q.suggest.method === 'fixed') {
      suggested = { standard: q.suggest.n, accessible: 0 };
      basis = `Suggested ${q.suggest.n} (typical for this room type) — edit freely.`;
    } else {
      suggested = { standard: q.suggest.n, accessible: 0 };
      basis = q.suggest.basis_text;
    }
  }
  return {
    req_key: req.key,
    label: req.label,
    assembly_preview: preview,
    suggested,
    suggestion_basis: basis,
    suggestion_is_draft: draft,
    has_accessible_variant: hasAccessible,
  };
}

// ---------------------------------------------------------------------------
// Stage 7 — counts / tabulation
// ---------------------------------------------------------------------------

const REQ_KEY_TO_TAB_CLASS: Record<string, 'wc' | 'urinal' | 'lavatory'> = {
  wc: 'wc',
  urinal: 'urinal',
  lav: 'lavatory',
};

function buildTabulation(ctx: Ctx): TabulationData | null {
  const occ = ctx.occupancy;
  if (occ.students === null && occ.staff === null) return null;

  interface Provided {
    count: number;
    pending: boolean;
  }
  const provided = new Map<string, Provided>(); // key: group|class|sex|building
  const add = (group: string, cls: string, sex: string, building: string, n: number, pending: boolean): void => {
    for (const b of [building, '*']) {
      const key = `${group}|${cls}|${sex}|${b}`;
      const cur = provided.get(key) ?? { count: 0, pending: false };
      cur.count += n;
      cur.pending = cur.pending || pending;
      provided.set(key, cur);
    }
  };

  const dpsByRoom = new Map<string, DecisionPoint[]>();
  for (const dp of ctx.dps) {
    if (dp.room_id) dpsByRoom.set(dp.room_id, [...(dpsByRoom.get(dp.room_id) ?? []), dp]);
  }

  for (const norm of ctx.normalized.values()) {
    const code = norm.effective.room_type_code;
    if (!code) continue;
    const group =
      code === 'restroom_student'
        ? 'students'
        : code === 'restroom_staff' || code === 'restroom_single_user'
          ? 'staff'
          : null;
    if (!group) continue;
    const building = norm.room.building_id ?? '?';
    const reqs = ctx.firedReqs.get(norm.room.room_id) ?? [];
    for (const dp of dpsByRoom.get(norm.room.room_id) ?? []) {
      const key = dp.requirement?.key;
      if (!key || !(key in REQ_KEY_TO_TAB_CLASS)) continue;
      const cls = REQ_KEY_TO_TAB_CLASS[key]!;
      const sex = norm.effective.sex ?? 'unisex';
      if (!isResolved(dp)) {
        add(group, cls, sex, building, 0, true);
        continue;
      }
      const req = reqs.find((r) => r.id === dp.requirement!.profile_req_id);
      if (!req) continue;
      const derived = deriveFixtureLines(ctx.kb, req, dp, norm.effective);
      const n = derived.lines.reduce((acc, l) => acc + l.n, 0);
      add(group, cls, sex, building, n, derived.pending !== undefined);
    }
  }

  // Drinking fountains (combination units) count toward the student DF minimum.
  for (const dp of ctx.dps) {
    if (dp.requirement?.key !== 'fountain') continue;
    const building = dp.building_id ?? 'site';
    if (!isResolved(dp)) add('students', 'drinking_fountain', 'any', building, 0, true);
    else add('students', 'drinking_fountain', 'any', building, 1, false);
  }

  const get = (group: string, cls: string, sex: string, building: string): Provided =>
    provided.get(`${group}|${cls}|${sex}|${building}`) ?? { count: 0, pending: false };

  const rowsFor = (building: string, campusRequired: boolean): TabRow[] => {
    const rows: TabRow[] = [];
    const studentBasis = (sex: 'male' | 'female'): string =>
      `${sex === 'male' ? occ.male_students : occ.female_students} ${sex === 'male' ? 'boys' : 'girls'} (50/50 of ${occ.students} planned capacity${occ.sex_split_draft ? ', DRAFT split' : ''})`;

    const push = (
      group: 'students' | 'staff',
      cls: TabRow['fixture_class'],
      sex: 'male' | 'female' | undefined,
      basis: string,
      requiredGroup: 'students_elementary' | 'staff_adult',
      providedEntry: Provided,
      note?: string,
      pooledRequired?: number,
    ): void => {
      const required = campusRequired
        ? requiredCount(ctx.kb, occ, requiredGroup, cls, sex)
        : null;
      const reqCount = pooledRequired ?? required?.count ?? null;
      const status: TabRow['status'] = providedEntry.pending
        ? 'pending'
        : reqCount !== null && providedEntry.count < reqCount
          ? 'short'
          : 'ok';
      rows.push({
        occupancy_group: group,
        fixture_class: cls,
        ...(sex !== undefined ? { sex } : {}),
        basis_text: basis,
        required:
          required !== null
            ? { count: required.count, ratio_text: required.ratio_text, draft: required.draft }
            : null,
        provided: { count: providedEntry.count, ...(note ? { note } : {}) },
        status,
        ...(status === 'short' && reqCount !== null
          ? { shortfall: reqCount - providedEntry.count }
          : {}),
      });
    };

    if (occ.students !== null) {
      push('students', 'wc', 'male', studentBasis('male'), 'students_elementary', get('students', 'wc', 'male', building));
      push('students', 'wc', 'female', studentBasis('female'), 'students_elementary', get('students', 'wc', 'female', building));
      const kinderWc = get('students', 'wc', 'unisex', building);
      if (kinderWc.count > 0 || kinderWc.pending) {
        rows.push({
          occupancy_group: 'students',
          fixture_class: 'wc',
          basis_text: 'classroom-attached single restrooms (either sex)',
          required: null,
          provided: { count: kinderWc.count, note: 'unisex — available to either sex' },
          status: kinderWc.pending ? 'pending' : 'ok',
        });
      }
      push('students', 'urinal', 'male', studentBasis('male'), 'students_elementary', get('students', 'urinal', 'male', building));
      push('students', 'lavatory', 'male', studentBasis('male'), 'students_elementary', get('students', 'lavatory', 'male', building));
      push('students', 'lavatory', 'female', studentBasis('female'), 'students_elementary', get('students', 'lavatory', 'female', building));
      const kinderLav = get('students', 'lavatory', 'unisex', building);
      if (kinderLav.count > 0 || kinderLav.pending) {
        rows.push({
          occupancy_group: 'students',
          fixture_class: 'lavatory',
          basis_text: 'classroom-attached single restrooms (either sex)',
          required: null,
          provided: { count: kinderLav.count, note: 'unisex — available to either sex' },
          status: kinderLav.pending ? 'pending' : 'ok',
        });
      }
      push(
        'students',
        'drinking_fountain',
        undefined,
        `${occ.students} students (campus)`,
        'students_elementary',
        get('students', 'drinking_fountain', 'any', building),
        'combination fountain + bottle-filler units',
      );
    }

    if (occ.staff !== null) {
      // Staff facilities here are single-user/unisex: the pool serves both
      // sexes, so each row carries the pool with a note and the status checks
      // the pool against the summed requirement.
      const pool = get('staff', 'wc', 'unisex', building);
      const reqM = campusRequired ? requiredCount(ctx.kb, occ, 'staff_adult', 'wc', 'male') : null;
      const reqF = campusRequired ? requiredCount(ctx.kb, occ, 'staff_adult', 'wc', 'female') : null;
      const pooled = (reqM?.count ?? 0) + (reqF?.count ?? 0);
      const staffBasis = (sex: 'male' | 'female'): string =>
        `${sex === 'male' ? occ.male_staff : occ.female_staff} staff (2 per classroom × ${ctx.dossier.project.classroom_count}, 50/50)`;
      push('staff', 'wc', 'male', staffBasis('male'), 'staff_adult', pool, 'unisex single-user pool (serves both sexes)', campusRequired ? pooled : undefined);
      push('staff', 'wc', 'female', staffBasis('female'), 'staff_adult', pool, 'unisex single-user pool (serves both sexes)', campusRequired ? pooled : undefined);
      const lavPool = get('staff', 'lavatory', 'unisex', building);
      const lreqM = campusRequired ? requiredCount(ctx.kb, occ, 'staff_adult', 'lavatory', 'male') : null;
      const lreqF = campusRequired ? requiredCount(ctx.kb, occ, 'staff_adult', 'lavatory', 'female') : null;
      const lPooled = (lreqM?.count ?? 0) + (lreqF?.count ?? 0);
      push('staff', 'lavatory', 'male', staffBasis('male'), 'staff_adult', lavPool, 'unisex single-user pool (serves both sexes)', campusRequired ? lPooled : undefined);
      push('staff', 'lavatory', 'female', staffBasis('female'), 'staff_adult', lavPool, 'unisex single-user pool (serves both sexes)', campusRequired ? lPooled : undefined);
    }
    return rows;
  };

  const buildings = (ctx.dossier.buildings ?? []).map((b) => ({
    building_id: b.building_id,
    name: b.name ?? b.building_id,
    rows: rowsFor(b.building_id, false),
  }));

  return {
    campus: rowsFor('*', true),
    per_building: buildings,
    per_building_note:
      'Required minimums are computed at campus level (planned capacity is campus-wide); per-building distribution basis is an open question (OQ-3).',
    occupancy: {
      students: occ.students,
      staff: occ.staff,
      male_students: occ.male_students,
      female_students: occ.female_students,
      sex_split_draft: occ.sex_split_draft,
    },
  };
}

// ---------------------------------------------------------------------------
// Rollups
// ---------------------------------------------------------------------------

function buildRollups(ctx: Ctx): { rooms: RoomRollup[]; buildings: BuildingRollup[] } {
  const dpsByRoom = new Map<string, DecisionPoint[]>();
  for (const dp of ctx.dps) {
    if (dp.room_id) dpsByRoom.set(dp.room_id, [...(dpsByRoom.get(dp.room_id) ?? []), dp]);
  }

  const rooms: RoomRollup[] = [...ctx.normalized.values()].map((norm) => {
    const dps = dpsByRoom.get(norm.room.room_id) ?? [];
    const profile = norm.effective.room_type_code
      ? profileByCode(ctx.kb, norm.effective.room_type_code)
      : undefined;
    const resolved = dps.filter(isResolved).length;
    const outOfCoverage = dps.some((d) => d.status === 'out_of_coverage');
    return {
      room_id: norm.room.room_id,
      room_number: norm.room_number,
      name_as_drawn: norm.room.name_as_drawn,
      building_id: norm.room.building_id ?? null,
      floor: norm.room.floor ?? null,
      effective: norm.effective,
      water_class: profile?.water_class ?? null,
      decision_ids: dps.map((d) => d.id).sort(),
      resolved_count: resolved,
      total_count: dps.length,
      ...(profile?.display_note ? { display_note: profile.display_note } : {}),
      not_applicable_rules: ctx.notApplicable.get(norm.room.room_id) ?? [],
      out_of_coverage: outOfCoverage,
    };
  });

  const buildingMap = new Map<string, BuildingRollup>();
  for (const b of ctx.dossier.buildings ?? []) {
    buildingMap.set(b.building_id, {
      building_id: b.building_id,
      name: b.name ?? b.building_id,
      resolved_count: 0,
      total_count: 0,
    });
  }
  for (const dp of ctx.dps) {
    const bid =
      dp.building_id ??
      (dp.room_id ? (ctx.normalized.get(dp.room_id)?.room.building_id ?? null) : null);
    if (!bid) continue;
    const b = buildingMap.get(bid);
    if (!b) continue;
    b.total_count += 1;
    if (isResolved(dp)) b.resolved_count += 1;
  }

  return { rooms, buildings: [...buildingMap.values()] };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function resolve(input: ResolveInput): ResolveResult {
  const report = validateImport(input.dossier, input.roomProgram);

  const refusedCards: ExceptionCard[] = report.refusedRooms.map((r) => ({
    card_id: `import:rooms/${r.index}`,
    card_type: 'missing_field',
    prompt: `Import blocker: ${r.issues[0]?.message ?? 'room refused'}`,
    detail: 'Fix the dossier export upstream and re-import — this room cannot be processed.',
    decision_ids: [],
    citations: [],
    order_rank: ORDER.import_blocker,
  }));

  if (!report.ok || !report.dossier || !report.roomProgram) {
    return {
      import_report: report,
      decision_points: [],
      cards: refusedCards,
      rooms: [],
      buildings: [],
      completeness: { resolved: 0, total: 0, ratio: 0 },
      tabulation: null,
      diagnostics: report.errors.map((e) => ({
        severity: 'warning',
        code: e.code,
        message: e.message,
      })),
    };
  }

  const dossier = report.dossier;
  const roomProgram: RoomProgram = report.roomProgram;

  const ctx: Ctx = {
    kb: input.kb,
    dossier,
    rooms: roomProgram.rooms,
    store: input.store,
    dps: [],
    diagnostics: [],
    normalized: new Map(),
    notApplicable: new Map(),
    firedReqs: new Map(),
    occupancy: computeOccupancy(dossier, input.kb),
  };

  // Stage 3 (classification first — effective types feed normalization).
  classificationDps(ctx);
  const typeResolver = effectiveTypeCodeResolver(ctx);

  // Stage 2 — normalize.
  for (const norm of normalizeRooms(dossier, roomProgram.rooms, typeResolver)) {
    ctx.normalized.set(norm.room.room_id, norm);
  }

  // Age band / sex gaps (overlaying stored answers onto effective facts).
  ageBandAndSexDps(ctx);

  // Stage 4 — fire profiles.
  fireProfiles(ctx);

  // Derived floor drains.
  derivedPass(ctx);

  // Building/site fountain generator.
  fountainDps(ctx);

  // Stage 6 — project rules.
  projectRuleDps(ctx);

  // Orphaned stored decisions (their decision points no longer exist).
  const livingIds = new Set(ctx.dps.map((d) => d.id));
  for (const storedId of Object.keys(input.store.decisions).sort()) {
    if (!livingIds.has(storedId)) {
      ctx.diagnostics.push({
        severity: 'info',
        code: 'store.orphaned_decision',
        message: `Stored decision ${storedId} no longer matches any decision point (room removed or rule changed) — archive it via the delta flow.`,
      });
    }
  }

  // Stage 5 — cards.
  const cards = buildCards(ctx, refusedCards);

  // Rollups + completeness.
  const { rooms, buildings } = buildRollups(ctx);
  const resolved = ctx.dps.filter(isResolved).length;
  const total = ctx.dps.length;

  // Stage 7 — tabulation.
  const tabulation = buildTabulation(ctx);
  for (const row of tabulation?.campus ?? []) {
    if (row.status === 'short') {
      ctx.diagnostics.push({
        severity: 'warning',
        code: 'counts.shortfall',
        message: `${row.occupancy_group} ${row.fixture_class}${row.sex ? ` (${row.sex})` : ''}: provided ${row.provided.count} < required ${row.required?.count} (DRAFT CPC values) — short by ${row.shortfall}.`,
      });
    }
  }

  return {
    import_report: report,
    decision_points: ctx.dps,
    cards,
    rooms,
    buildings,
    completeness: { resolved, total, ratio: total === 0 ? 0 : resolved / total },
    tabulation,
    diagnostics: ctx.diagnostics,
  };
}
