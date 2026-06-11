# Takeoff Program Contract — `takeoff.json` (optional enrichment)

**Status: Draft v0.1** · Producer: Abe's takeoff program · Consumer: this program
(LAUSD Standards/Decision Engine)

**This file is optional. V1 of the decision engine ships and works without it.** Its
absence parks specific decisions in the exception queue; it never blocks.

Why it matters anyway, in priority order:

1. **Modernization projects** — the existing fixture inventory is what
   replacement-in-kind logic, floor-drain feasibility carve-outs, and non-water-urinal
   conversion rules operate on.
2. **Distance-triggered rules** — several LAUSD rules switch on measured lengths
   (circulating pump required beyond 25 ft / 50 ft of hot-water run; hose bibbs at
   ~75 ft spacing around buildings; pedestal fountains >100 ft from a building sewer →
   drywell).
3. **Future linter food** — drawn-fixture counts vs. our expected state. Explicitly NOT
   consumed in v1; listed so the takeoff program can plan for it.

For new-construction fixture *counts*, the engine does NOT use takeoff data — counts come
from `planned_capacity` + CPC minimums + LAUSD occupant-load overrides (see
dossier contract). Takeoff counts of *new* work only ever serve the future linter.

---

## Shape

```json
{
  "contract_version": "0.1",
  "project_id": "…",
  "existing_fixtures": [ … ],
  "distances": [ … ],
  "areas": [ … ]
}
```

`project_id`, `room_id`, `building_id` values must match the dossier exports (shared
stable-ID space — see [`README.md`](README.md) convention 4).

### `existing_fixtures` (array) — modernization inventory

| Field | Type | Req | Semantics | If missing |
|---|---|---|---|---|
| `room_id` | string | ★ | Where it is. If the takeoff can't resolve a room, give `building_id` + `location_note` instead | Unlocated fixtures listed in a project-level "place me" queue |
| `fixture_kind` | enum | ★ | Controlled list: `water_closet`, `urinal`, `lavatory`, `sink`, `service_sink`, `drinking_fountain`, `bottle_filler`, `electric_water_cooler`, `shower`, `floor_drain`, `floor_sink`, `hose_bibb`, `water_heater`, `emergency_shower_eyewash`, `gas_outlet`, `other` | — |
| `count` | int | ★ | How many | — |
| `condition` / `era` | string |  | Free text ("original 1960s", "replaced 2018") | Replacement-vs-keep decisions queue with less context |
| `is_ada` | bool |  | Existing accessible fixture | ADA distribution checks queue |
| `notes` | string |  | Pass-through | — |

**If the whole array is absent on a modernization project**: every touched room's
replacement-in-kind logic queues with "existing inventory unknown — supply takeoff or
enter manually."

### `distances` (array) — measured lengths the rules engine consumes

| Field | Type | Req | Semantics |
|---|---|---|---|
| `kind` | enum | ★ | `water_heater_to_fixture_group` · `building_perimeter` · `fixture_to_building_sewer` · `pipe_run` · `other` |
| `from_ref`, `to_ref` | string | ★ | `room_id`, `building_id`, or equipment tag — enough for a human to recognize |
| `feet` | number | ★ | Length in feet |
| `measured_vs_estimated` | enum |  | `measured` \| `estimated` — estimated values are accepted but flagged on the decision they feed |

Rules currently consuming distances (grows over time):
- `water_heater_to_fixture_group` > 25 ft → circulating pump required for faculty
  restrooms w/ metered faucets and nurse offices; > 50 ft → required for food service,
  custodial sinks, high-flow areas (SDG 3.4-D.6.c).
- `building_perimeter` → hose bibb spacing check (~75 ft, SDG 3.4-E.4).
- `fixture_to_building_sewer` > 100 ft for pedestal drinking fountains → drywell
  permitted (SDG 3.4-A... fountain rules).

**If absent**: each such rule parks in the queue as "provide distance or accept stated
assumption" — the designer can type a number or accept the conservative default.

### `areas` (array)

| Field | Type | Req | Semantics |
|---|---|---|---|
| `ref` | string | ★ | `room_id` or `building_id` |
| `kind` | enum | ★ | `room_floor_area` · `garage_floor_area` · `roof_area` · `other` |
| `square_feet` | number | ★ | Area |

Current consumer: subterranean garage emergency-drain density (1 per 4,000 sf,
SDG 3.4-B.7.j). Roof areas reserved for future storm sizing work.

### Explicitly NOT consumed in v1

- Counts of newly-drawn fixtures (future linter input only)
- Pipe lengths for cost/estimating (not this program's job)
- Anything geometric (coordinates, polylines)

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-06-11 | 0.1 | Initial draft. Optional-enrichment posture established. |
