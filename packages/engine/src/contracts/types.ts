// TypeScript shapes of the input contracts (contracts/dossier-contract.md v0.1).
// Conventions (contracts/README.md): unknown fields are ignored (carried through as
// extras), `null` and absent both mean "producer does not know".

export type SchoolLevel = 'eec' | 'elementary' | 'middle' | 'high' | 'span' | 'adult_ed';

export type ProjectType =
  | 'new_construction'
  | 'comprehensive_modernization'
  | 'repair_expansion'
  | 'addition'
  | 'replacement_in_kind';

export type AgeBand = 'preK_K' | 'elementary' | 'secondary_adult';

export type RoomScope = 'new' | 'modernized' | 'untouched';

export type FoodService = 'none' | 'serving_only' | 'full_kitchen';

export interface DossierProject {
  project_id: string;
  name?: string | null;
  school_name?: string | null;
  lausd_project_id?: string | null;
  school_level?: SchoolLevel | null;
  grade_min?: number | null;
  grade_max?: number | null;
  project_type?: ProjectType | null;
  planned_capacity?: number | null;
  classroom_count?: number | null;
  jurisdiction?: {
    city?: string | null;
    is_city_of_la?: boolean | null;
    [extra: string]: unknown;
  } | null;
  water_purveyor?: {
    name?: string | null;
    is_ladwp?: boolean | null;
    [extra: string]: unknown;
  } | null;
  street_pressure_psi?: number | null;
  sewer_connection_known?: boolean | null;
  gas?: {
    has_service?: boolean | null;
    pressure_class?: 'low_8in_wc' | 'medium_3psi' | null;
    [extra: string]: unknown;
  } | null;
  [extra: string]: unknown;
}

export interface DossierBuilding {
  building_id: string;
  name?: string | null;
  floors?: number | null;
  has_basement_or_subterranean_parking?: boolean | null;
  is_existing?: boolean | null;
  [extra: string]: unknown;
}

export interface CampusFeatures {
  food_service?: FoodService | null;
  pool?: boolean | null;
  science_labs?: boolean | null;
  auto_shop?: boolean | null;
  wood_shop?: boolean | null;
  ceramics?: boolean | null;
  agriculture?: boolean | null;
  athletic_fields?: boolean | null;
  eec_onsite?: boolean | null;
  laundry?: boolean | null;
  film_or_photo_lab?: boolean | null;
  culinary_arts?: boolean | null;
  parking_subterranean?: boolean | null;
  [extra: string]: unknown;
}

export interface Dossier {
  contract_version?: string;
  project: DossierProject;
  buildings?: DossierBuilding[] | null;
  campus_features?: CampusFeatures | null;
  [extra: string]: unknown;
}

export interface RoomRecord {
  room_id: string;
  /** ★ but degradable: falls back to room_id with a warning. */
  room_number?: string | null;
  name_as_drawn: string;
  room_type_code?: string | null;
  room_type_confidence?: number | null;
  /** ★ but degradable: room floats, per-building outputs exclude it with a warning. */
  building_id?: string | null;
  /** ★ but degradable: per-floor rules queue. 1 = ground; 0/−1 = basement. */
  floor?: number | null;
  age_band?: AgeBand | null;
  occupant_load?: number | null;
  area_sf?: number | null;
  is_outdoor?: boolean | null;
  scope?: RoomScope | null;
  ada_designated?: boolean | null;
  adjacent_room_ids?: string[] | null;
  notes?: string | null;
  [extra: string]: unknown;
}

export interface RoomProgram {
  contract_version?: string;
  project_id: string;
  ids_stable?: boolean | null;
  rooms: RoomRecord[];
  [extra: string]: unknown;
}

export type IssueSeverity = 'error' | 'warning';

/** One validation finding, written for the designer who has to act on it. */
export interface ImportIssue {
  severity: IssueSeverity;
  /** Stable machine-readable code, e.g. `dossier.project.project_id.missing`. */
  code: string;
  /** Where in the file, e.g. `/project/school_level` or `/rooms/12`. */
  path: string;
  /** Names the field and the contract doc (plan §4.3). */
  message: string;
  /** Which contract section specifies this behavior. */
  contract_ref: string;
  /** What the engine does about it (the contract's "If missing" column). */
  degradation?: string;
}

export interface RefusedRoom {
  index: number;
  room_id?: string;
  room_number?: string;
  name_as_drawn?: string;
  issues: ImportIssue[];
}

export interface ImportResult {
  /** False only when the import as a whole is refused. */
  ok: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  /** Null when the import is refused. */
  dossier: Dossier | null;
  /** Null when the import is refused. `rooms` excludes refused rooms. */
  roomProgram: RoomProgram | null;
  /** Rooms excluded per the contract ("import refused for the room") — never silent. */
  refusedRooms: RefusedRoom[];
}
