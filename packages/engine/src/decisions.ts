// The decision model (plan §4.2): DecisionPoints are the engine's output,
// ExceptionCards are queued DecisionPoints dressed for humans, and the
// DecisionStore is the persisted human record that survives re-imports.

import type { Citation, VerificationStatus, WaterClass } from '@lausd-pa/kb';
import type { AgeBand, ImportResult } from './contracts/types.ts';

export type DecisionScope = 'project' | 'building' | 'room' | 'import';

export type DecisionStatus =
  | 'auto_resolved'
  | 'queued'
  | 'human_resolved'
  | 'stale'
  | 'out_of_coverage';

export type Sex = 'male' | 'female' | 'unisex';

/** Quantity split: variant assemblies derive from the selector + age band at render. */
export interface FixtureCounts {
  standard: number;
  accessible: number;
}

export type DecisionResolution =
  | { kind: 'classification'; room_type_code: string }
  | { kind: 'age_band'; age_band: AgeBand }
  | { kind: 'sex'; sex: Sex }
  | {
      kind: 'quantities';
      counts: FixtureCounts;
      /** For choice selectors (e.g. ST-5 vs ST-6) — the chosen assembly id. */
      assembly_choice?: string;
      /** For conditional_policy requirements — the policy answer that produced this. */
      policy_value?: 'yes' | 'no';
    }
  | { kind: 'acknowledged' };

export interface StaleContext {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  prior_resolution: DecisionResolution;
  /** Human-readable description of what changed underneath the decision. */
  change_summary: string;
}

export interface DecisionPoint {
  /** Deterministic: scope + subject, e.g. `room:rm-a110/age_band`, `project:prv`. */
  id: string;
  scope: DecisionScope;
  subject: string;
  room_id?: string;
  building_id?: string;
  status: DecisionStatus;
  resolution?: DecisionResolution;
  resolved_by?: 'engine' | 'human';
  /** One sentence. */
  rationale: string;
  citations: Citation[];
  /** Draft when any KB record feeding this decision is draft → DRAFT badge. */
  verification_status: VerificationStatus;
  inputs_fingerprint: string;
  inputs_snapshot: Record<string, unknown>;
  requirement?: {
    profile_req_id: string;
    key: string;
    label: string;
  };
  /** Queued decisions that are awaiting other decisions, not a human (no card). */
  pending_reason?: string;
  stale_context?: StaleContext;
}

export type CardType =
  | 'classify_room'
  | 'missing_field'
  | 'choice'
  | 'quantity_entry'
  | 'batch_policy'
  | 'project_ack'
  | 'stale'
  | 'out_of_coverage';

export interface CardOption {
  value: string;
  label: string;
  consequence_summary?: string;
  citations: Citation[];
}

export interface CardMember {
  room_id: string;
  room_number: string;
  name_as_drawn: string;
}

/** One editable quantity line on a quantity card (per requirement key). */
export interface QuantityField {
  req_key: string;
  label: string;
  /** Assembly designation(s) this will produce, for display ("WC-1 + WC-2 (ADA)"). */
  assembly_preview: string;
  suggested: FixtureCounts | null;
  suggestion_basis: string;
  /** True when the suggestion rests on draft KB values (CPC placeholders etc.). */
  suggestion_is_draft: boolean;
  /** Whether an accessible split is offered for this line. */
  has_accessible_variant: boolean;
}

export interface ExceptionCard {
  card_id: string;
  card_type: CardType;
  /** One sentence, plain language. */
  prompt: string;
  /** Extra context (e.g. the room note that explains the ambiguity). */
  detail?: string;
  /** Decision point ids this card resolves (batch cards: one per member × field). */
  decision_ids: string[];
  batch_members?: CardMember[];
  options?: CardOption[];
  quantity_fields?: QuantityField[];
  default_suggestion?: string;
  citations: Citation[];
  /** Queue ordering: lower first (plan §7). */
  order_rank: number;
  stale_context?: StaleContext;
}

export interface StoredDecision {
  resolution: DecisionResolution;
  inputs_fingerprint: string;
  inputs_snapshot: Record<string, unknown>;
  /** UI metadata only — the engine never reads or writes wall-clock time. */
  decided_at?: string;
  via_card?: string;
}

export interface DecisionStore {
  schema_version: 1;
  project_id: string;
  decisions: Record<string, StoredDecision>;
  /** Decisions whose rooms disappeared on re-import — kept, never silently dropped. */
  archived: Record<string, StoredDecision & { archived_reason: string }>;
}

export function emptyStore(projectId: string): DecisionStore {
  return { schema_version: 1, project_id: projectId, decisions: {}, archived: {} };
}

export interface Diagnostic {
  severity: 'info' | 'warning';
  code: string;
  message: string;
}

export interface NotApplicableRule {
  requirement_id: string;
  label: string;
  reason: string;
  citations: Citation[];
}

export interface RoomEffectiveFacts {
  room_type_code: string | null;
  type_provenance: string;
  age_band: AgeBand | null;
  age_band_provenance: string;
  sex: Sex | null;
  sex_provenance: string;
  classroom_attached: boolean;
  is_outdoor: boolean;
  ada_designated: boolean;
  floor_below_grade: boolean;
}

export interface RoomRollup {
  room_id: string;
  room_number: string;
  name_as_drawn: string;
  building_id: string | null;
  floor: number | null;
  effective: RoomEffectiveFacts;
  water_class: WaterClass | null;
  decision_ids: string[];
  resolved_count: number;
  total_count: number;
  display_note?: string;
  not_applicable_rules: NotApplicableRule[];
  out_of_coverage: boolean;
}

export interface BuildingRollup {
  building_id: string;
  name: string;
  resolved_count: number;
  total_count: number;
}

// --- fixture-to-occupant tabulation data (stage 7; rendered by T4) ---

export type TabOccupancyGroup = 'students' | 'staff';

export interface TabRow {
  occupancy_group: TabOccupancyGroup;
  fixture_class: 'wc' | 'urinal' | 'lavatory' | 'drinking_fountain';
  sex?: 'male' | 'female';
  /** e.g. "175 boys (50/50 of 350 planned capacity)" */
  basis_text: string;
  required: { count: number; ratio_text: string; draft: boolean } | null;
  provided: { count: number; note?: string };
  status: 'ok' | 'short' | 'pending';
  shortfall?: number;
}

export interface TabulationData {
  campus: TabRow[];
  per_building: { building_id: string; name: string; rows: TabRow[] }[];
  /** Campus-level Required cannot be distributed per building — OQ-3. */
  per_building_note: string;
  occupancy: {
    students: number | null;
    staff: number | null;
    male_students: number | null;
    female_students: number | null;
    sex_split_draft: boolean;
  };
}

export interface Completeness {
  resolved: number;
  total: number;
  ratio: number;
}

export interface ResolveResult {
  import_report: ImportResult;
  decision_points: DecisionPoint[];
  cards: ExceptionCard[];
  rooms: RoomRollup[];
  buildings: BuildingRollup[];
  completeness: Completeness;
  tabulation: TabulationData | null;
  diagnostics: Diagnostic[];
}

export function isResolved(dp: DecisionPoint): boolean {
  return (
    (dp.status === 'auto_resolved' || dp.status === 'human_resolved') &&
    dp.resolution !== undefined
  );
}
