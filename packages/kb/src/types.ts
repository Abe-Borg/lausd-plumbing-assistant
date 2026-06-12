// Knowledge-base record shapes (plan §4.1). Content lives in ../data/*.json —
// content is data, never code. Every record carries citations and a
// verification_status; `draft` records must carry a `todo` naming an OQ-n entry
// in /OPEN-QUESTIONS.md (enforced by the integrity tests).

export type AgeBand = 'preK_K' | 'elementary' | 'secondary_adult';

/** Domestic water temperature service class (SDG 3.4-D; taxonomy legend). */
export type WaterClass = 'HC' | 'T' | 'TP' | 'C' | 'M' | 'none';

export interface Citation {
  /** Source document: 'SDG', '22 1000', '22 0513', '22 0500', '22 0553',
   *  'Title 8 CCR', or a repo doc like 'contracts/room-type-taxonomy.md'. */
  doc: string;
  section: string;
  page?: number;
  doc_version: string;
  /** Distilled wording shown in citation popovers (labeled as distilled, not verbatim). */
  note?: string;
}

export type VerificationStatus = 'verified' | 'draft';

export interface KbRecordBase {
  id: string;
  citations: Citation[];
  verification_status: VerificationStatus;
  /** Required when draft; names the blocking open question, e.g. "OQ-4: …". */
  todo?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Taxonomy (generated from contracts/room-type-taxonomy.md — see scripts/)
// ---------------------------------------------------------------------------

export interface TaxonomyEntry {
  code: string;
  display_name: string;
  aliases: string[];
  /** Raw water column from the taxonomy table: HC | T | TP | C | M | — | HC/T */
  water_class_raw: string;
}

// ---------------------------------------------------------------------------
// Assemblies (schedule items; composite ones reference component assemblies)
// ---------------------------------------------------------------------------

export interface AssemblyComponent {
  kind: string;
  /** Assembly id of the component when it is itself a schedule item (e.g. 'F-4'). */
  ref?: string;
  note?: string;
}

export interface ApprovedProduct {
  manufacturer: string;
  model?: string;
}

export interface AssemblyApplicability {
  age_band?: AgeBand[];
  ada?: boolean;
  outdoor?: boolean;
  user_class?: 'student' | 'staff_adult' | 'public';
  note?: string;
}

export interface Assembly extends KbRecordBase {
  kind: 'assembly';
  family: string;
  display_name: string;
  /** Schedule-ready short text (fixture schedule Description column). */
  description_short: string;
  components: AssemblyComponent[];
  approved_products: ApprovedProduct[];
  applicability?: AssemblyApplicability;
  /** Obligation ids that ride with this assembly wherever it appears. */
  obligations: string[];
  spec_section: string;
  /** Row key into the height table when a mounting height applies. */
  mounting_height_ref?: string;
}

// ---------------------------------------------------------------------------
// Obligations (reusable requirement lines)
// ---------------------------------------------------------------------------

export interface Obligation extends KbRecordBase {
  kind: 'obligation';
  /** One designer-readable sentence. */
  text: string;
  /** Human-readable scope ("student and staff restrooms", "all lavatories", …). */
  applies_to: string;
  /** Include in the fixture-schedule footer note block (plan §8.1). */
  schedule_footer?: boolean;
}

// ---------------------------------------------------------------------------
// Height tables (22 1000 2.46 — standard + accessible, by age band)
// ---------------------------------------------------------------------------

export interface HeightTable extends KbRecordBase {
  kind: 'height_table';
  units: string;
  /** row key (e.g. 'lavatory_rim') → age band → height text (inches AFF). */
  standard: Record<string, Partial<Record<AgeBand, string>>>;
  accessible: Record<string, Partial<Record<AgeBand, string>>>;
}

// ---------------------------------------------------------------------------
// Room type profiles
// ---------------------------------------------------------------------------

export type AssemblySelector =
  | { kind: 'fixed'; assembly: string; accessible?: string }
  | {
      kind: 'by_age_band';
      standard: Partial<Record<AgeBand, string>>;
      /** Variant used where the room/fixture position is the accessible one. */
      accessible?: Partial<Record<AgeBand, string>>;
    }
  | { kind: 'choice'; options: { assembly: string; consequence?: string }[] };

export type QuantitySuggestion =
  | { method: 'ratio_allocation'; fixture_class: 'wc' | 'urinal' | 'lavatory' }
  | { method: 'fixed'; n: number }
  | { method: 'judgment'; n: number; basis_text: string };

export type QuantityRule =
  | {
      rule: 'fixed';
      n: number;
      /** 'rule' = cited LAUSD requirement; 'baseline' = editable program default. */
      basis: 'rule' | 'baseline';
    }
  | { rule: 'designer_quantity'; suggest: QuantitySuggestion }
  | {
      rule: 'conditional_policy';
      /** Policy key shared across rooms — collapses to one batch card (plan §6.5). */
      policy: string;
      prompt: string;
      then: { n: number };
    }
  | { rule: 'derived'; method: 'restroom_floor_drains' };

export interface RequirementCondition {
  sex?: 'male' | 'female';
  /** Room is attached to (adjacent to) a classroom — kinder RR pattern. */
  classroom_attached?: boolean;
  floor_below_grade?: boolean;
}

export interface FixtureRequirement extends KbRecordBase {
  kind: 'fixture_requirement';
  /** Stable key within the room: 'wc', 'urinal', 'lav', 'sink', … */
  key: string;
  label: string;
  selector: AssemblySelector;
  quantity: QuantityRule;
  applies_when?: RequirementCondition;
}

export interface RoomTypeProfile extends KbRecordBase {
  kind: 'room_type_profile';
  room_type_code: string;
  water_class: WaterClass;
  fixture_requirements: FixtureRequirement[];
  /** Obligation ids attached when the room resolves to ≥1 fixture. */
  obligations: string[];
  /** Named hooks consumed by building/site-level generators (fountains). */
  triggers: string[];
  /** Context line for the room-detail view (e.g. the rule that correctly does not fire). */
  display_note?: string;
}

// ---------------------------------------------------------------------------
// Count rules (occupancy basis + ratio tables)
// ---------------------------------------------------------------------------

export interface CountBasisRule extends KbRecordBase {
  kind: 'count_basis';
  students: 'planned_capacity';
  staff: 'two_per_classroom';
  rounding: 'ceil';
}

export interface SexSplitRule extends KbRecordBase {
  kind: 'sex_split';
  male: number;
  female: number;
}

export type TabFixtureClass = 'wc' | 'urinal' | 'lavatory' | 'drinking_fountain';

export interface RatioEntry {
  fixture_class: TabFixtureClass;
  /** Ratio denominator: 1 fixture per `per` occupants. */
  per: number;
  sex?: 'male' | 'female';
}

export interface RatioTable extends KbRecordBase {
  kind: 'count_ratios';
  occupancy: 'students_elementary' | 'staff_adult';
  ratios: RatioEntry[];
}

// ---------------------------------------------------------------------------
// Project rules + layout/placement rules
// ---------------------------------------------------------------------------

export interface ProjectRule extends KbRecordBase {
  kind: 'project_rule';
  rule: 'prv_over_80' | 'ladwp_16d' | 'all_electric';
  title: string;
  requirement_text: string;
  /** 'auto' resolves itself when its trigger fact is known; 'acknowledge' queues a project_ack card. */
  resolution: 'auto' | 'acknowledge';
  threshold_psi?: number;
}

export interface RestroomFloorDrainRule extends KbRecordBase {
  kind: 'layout_rule';
  rule: 'restroom_floor_drains';
  text: string;
  params: {
    urinal_group_min: number;
    fd_per_urinal_group: number;
    fd_per_wc_group: number;
    wc_group_double_at: number;
  };
}

export interface FountainPlacementRule extends KbRecordBase {
  kind: 'placement_rule';
  rule: 'fountains';
  locations: { trigger: string; text: string }[];
  unit_selection: {
    single_band: string;
    mixed_or_outdoor_public: string;
  };
}

// ---------------------------------------------------------------------------
// The loaded KB
// ---------------------------------------------------------------------------

export interface Kb {
  taxonomy: TaxonomyEntry[];
  assemblies: Assembly[];
  obligations: Obligation[];
  heightTable: HeightTable;
  countBasis: CountBasisRule;
  sexSplit: SexSplitRule;
  ratioTables: RatioTable[];
  projectRules: ProjectRule[];
  restroomFloorDrainRule: RestroomFloorDrainRule;
  fountainRule: FountainPlacementRule;
  profiles: RoomTypeProfile[];
}
