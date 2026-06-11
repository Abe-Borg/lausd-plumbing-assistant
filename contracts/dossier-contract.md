# Dossier Program Contract — `dossier.json` + `room_program.json`

**Status: Draft v0.1** · Producer: Abe's dossier program · Consumer: this program
(LAUSD Standards/Decision Engine)

The dossier program builds the whole-job picture from a set of construction drawings and
also builds the room program. This program needs two deliverables from it. Conventions
(required-core ★, degradation, stable IDs, confidence fields) per
[`README.md`](README.md).

> **Validation pending**: this draft was written before reviewing the dossier program's
> actual outputs. When Abe shares its current export shape, reconcile field names and
> mark each field as natively-available / derivable / needs-new-extraction.

---

## Deliverable 1: `dossier.json` — project context

One object per project. This is what makes the rules engine *project-aware*: school
level switches age bands and gas pressure class, project type switches entire rule
families, capacity drives fixture counts.

### `project` (object)

| Field | Type | Req | Semantics | If missing |
|---|---|---|---|---|
| `project_id` | string | ★ | Stable unique ID for the project across all exports | Import refused (sole hard requirement with `rooms`) |
| `name` | string |  | Human label shown in UI | UI shows project_id |
| `school_name` | string |  | Campus name (appears on deliverable headers) | Header left blank, queued as a fill-in |
| `lausd_project_id` | string |  | LAUSD ID number (required on drawing title blocks) | Deliverable headers flag "LAUSD ID needed" |
| `school_level` | enum | ★ | `eec` \| `elementary` \| `middle` \| `high` \| `span` \| `adult_ed` | All age-dependent decisions queue. Practically everything depends on this — treat as required |
| `grade_min`, `grade_max` | int |  | Grade span (K = 0, TK/preK = −1). Required when `school_level` = `span` (e.g., K-8) | Span schools: rooms without their own `age_band` queue |
| `project_type` | enum | ★ | `new_construction` \| `comprehensive_modernization` \| `repair_expansion` \| `addition` \| `replacement_in_kind` | Engine assumes `new_construction` (strictest) and flags the assumption project-wide |
| `planned_capacity` | int | ★ | Planned student enrollment. LAUSD bases student fixture counts on this, not on code occupancy of rooms | Fixture-count tabulation cannot be produced; all count decisions queue |
| `classroom_count` | int | ★ | Total classrooms incl. kindergarten, SDC, set-aside. Staff fixture count = **2 adults per classroom** (SDG 2.1-J) | Staff fixture counts queue; can be derived from room program if room typing is complete (engine will offer that) |
| `jurisdiction.city` | string |  | Permitting city | LA City rules applied as floor (LAUSD policy: LA standards are the minimum district-wide) with a flag |
| `jurisdiction.is_city_of_la` | bool |  | Drives LA Bureau of Sanitation specifics (FOG, industrial waste sampling box BMP) | Same as above |
| `water_purveyor.name` | string |  | e.g., LADWP | Backflow station design queued "verify purveyor rules" |
| `water_purveyor.is_ladwp` | bool |  | LADWP service → Rule 16-D backflow compliance | Same as above |
| `street_pressure_psi` | number |  | From Water Pressure Flow Report / SAR (designer must request; SAR re-validated annually) | PRV-station decision (>80 psi → PRV w/ strainers, dual valves) queues as "request SAR" |
| `sewer_connection_known` | bool + `notes` |  | Whether POC/manhole data exists | Riser-diagram-related obligations carry a "coordinate w/ civil" tag |
| `gas.has_service` | bool |  | Campus has/will have natural gas | Gas subsystem rules suppressed if `false`; queued if absent and any gas-consuming room type appears |
| `gas.pressure_class` | enum |  | `low_8in_wc` \| `medium_3psi`. LAUSD default: elementary = low, secondary = medium (medium allowed at multi-building elementary w/ gas co. permission) | Default by school level, flagged ("verify with gas company"; medium → Polyflo calc reminder) |

### `buildings` (array)

| Field | Type | Req | Semantics | If missing |
|---|---|---|---|---|
| `building_id` | string | ★ | Stable across exports | Rooms can't anchor; import warns |
| `name` | string |  | Label | — |
| `floors` | int | ★ | Storeys above grade | Multi-story triggers (per-floor isolation valves for water AND gas, per-floor DF/RR coverage, 2 bacteriological samples/floor) queue |
| `has_basement_or_subterranean_parking` | bool |  | Garage drains/sumps/overhead-sewer-cleanout rules; below-grade electrical room drains | Assumed `false`; flagged |
| `is_existing` | bool |  | Existing building being touched (vs new) | Defaults from `project_type`; flagged |

### `campus_features` (object of booleans/enums — each flips on a subsystem)

`food_service` (`none` \| `serving_only` \| `full_kitchen`), `pool`, `science_labs`,
`auto_shop`, `wood_shop`, `ceramics`, `agriculture`, `athletic_fields`, `eec_onsite`,
`laundry`, `film_or_photo_lab`, `culinary_arts`, `parking_subterranean`.

**If a flag is absent** the engine infers it from the room program where possible
(a `kitchen` room implies `food_service: full_kitchen`) and queues the inference for
confirmation. Flags exist so the engine can detect *missing rooms* too ("campus has
`pool: true` but no pool equipment room in the room program — chlorination room with
emergency shower/eyewash is required").

---

## Deliverable 2: `room_program.json` — the data spine

```json
{
  "contract_version": "0.1",
  "project_id": "…",
  "ids_stable": true,
  "rooms": [ … ]
}
```

### Each room object

| Field | Type | Req | Semantics | If missing |
|---|---|---|---|---|
| `room_id` | string | ★ | **Stable across re-exports.** The entire delta/re-import experience (decisions persist, only changes re-queue) hangs on this | Import refused for the room |
| `room_number` | string | ★ | As drawn (e.g., "B-201"). Appears on deliverables | Falls back to `room_id`, flagged |
| `name_as_drawn` | string | ★ | Verbatim room name from the drawings | Required — it is the classification evidence and the audit trail |
| `room_type_code` | string \| null |  | Code from [`room-type-taxonomy.md`](room-type-taxonomy.md). Dossier pre-maps what it can; `null` → exception queue (one-click classify, LLM proposes from `name_as_drawn`) | Room enters queue unclassified; nothing downstream blocks |
| `room_type_confidence` | number |  | 0–1; below 0.8 the classification is surfaced for confirmation | Treated as 1.0 when code present (trusted) |
| `building_id` | string | ★ | FK to `buildings` | Room floats; per-building outputs exclude it with a warning |
| `floor` | int | ★ | 1 = ground; 0/−1 = basement | Per-floor rules queue |
| `age_band` | enum \| null |  | `preK_K` (ages 3–5) \| `elementary` (6–11) \| `secondary_adult` (12+). Drives fixture variants (WC-1/3/5…), mounting-height tables, IR-sensor heights. SDG requires architectural drawings to label age group per restroom — so this exists upstream; extract it | Derived from `school_level` where unambiguous; queued per room otherwise (always queued for `span` schools) |
| `occupant_load` | int |  | Code occupant load if shown | Only some checks use it (LAUSD counts come from `planned_capacity`); absence is fine |
| `area_sf` | number |  | Room area | Area-driven rules (e.g., garage emergency drain per 4,000 sf) queue |
| `is_outdoor` | bool |  | Outdoor/semi-outdoor space (lunch shelter, field sanitary unit) | Inferred from room type; flagged when it matters (fixture finish/vandal variants) |
| `scope` | enum |  | `new` \| `modernized` \| `untouched` — essential on modernization projects (existing-facilities carve-outs, e.g. floor-drain feasibility) | All rooms treated per `project_type`, flagged |
| `ada_designated` | bool |  | Room is the designated accessible facility (e.g., the ADA restroom) | Engine applies code-minimum ADA distribution rules and queues confirmation |
| `adjacent_room_ids` | string[] |  | Physical adjacency/direct access. Feeds adjacency-dependent rules (flip-down eyewash EEW-3 legal only in prep rooms immediately accessible to a lab with a deluge shower; custodial adjacent to student RR) | Adjacency-dependent selections queue with "confirm adjacency" |
| `notes` | string |  | Anything the extractor wants to pass through | Shown in UI |

### What this program does NOT want from the dossier

- No fixture selections, no plumbing opinions — facts only. Selection is this program's job.
- No CAD geometry. Names, numbers, types, relationships.
- No guessed values: omit and let the exception queue ask the human.

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-06-11 | 0.1 | Initial draft from SDG/spec rule analysis; pre-validation against actual dossier exports. |
