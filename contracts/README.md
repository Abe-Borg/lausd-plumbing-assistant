# Interface Contracts

This directory defines **precisely what this program (the LAUSD Standards/Decision
Engine) needs from outside programs** — what they deliver, and in what shape. These are
living documents: they change as the program grows, and they are the authoritative
boundary between this program and the rest of the ecosystem.

The decision engine consumes **facts** and emits **decisions**. Everything in this
directory is about the facts side.

## Index

| Contract | Supplies | Producer | Status |
|---|---|---|---|
| [`dossier-contract.md`](dossier-contract.md) | `dossier.json`, `room_program.json` | Dossier program (Abe's, existing) | Draft v0.1 |
| [`takeoff-contract.md`](takeoff-contract.md) | `takeoff.json` (optional) | Takeoff program (Abe's, existing) | Draft v0.1 |
| [`room-type-taxonomy.md`](room-type-taxonomy.md) | The controlled room-type vocabulary referenced by `room_program.json` | **This program publishes it**; the dossier program maps to it | Draft v0.1 |

Output contracts (selection set, expected state, etc.) will be added here when downstream
consumer modules actually exist. Until then, the five user-facing deliverables (fixture
schedule, fixture-to-occupant tabulation, water temperature service matrix, equipment
list, spec edit suggestions) are documents for humans, not contracts for programs.

## Conventions (apply to every contract here)

1. **JSON, UTF-8, one file per export.** Field names in `snake_case`.
2. **Versioned.** Every file carries `"contract_version"` (semver). Producers state the
   version they target; this program supports stated versions explicitly. Breaking field
   changes bump the minor version pre-1.0, major after.
3. **Graceful degradation is the design center.** Only the ★ required core blocks import.
   Every optional field's contract entry states *what happens when it is absent* — in
   every case the answer is "the dependent decisions park in the exception queue with a
   stated reason," never a crash, never a block.
4. **Stable IDs are sacred.** `project_id`, `building_id`, `room_id` must be stable across
   re-exports of the same project. The delta/re-import experience (decisions persist;
   only changed facts re-queue) depends entirely on this. If the producer cannot keep an
   ID stable, it must say so in the export (`"ids_stable": false`) so this program falls
   back to matching heuristics and flags the import.
5. **Unknown fields are ignored, never errors** (forward compatibility). Producers may
   include extra fields freely.
6. **`null` vs absent mean the same thing**: "producer does not know." Producers should
   omit rather than guess. A guessed value is worse than a queued question.
7. **Confidence is welcome.** Any field may be accompanied by a sibling
   `<field>_confidence` (0–1) and/or `<field>_source` (e.g., `"sheet A-101 room schedule"`).
   Low-confidence values (< 0.8 by default) are surfaced for confirmation in the exception
   queue instead of being silently trusted.
8. **Units are fixed**: feet for distance, square feet for area, psi for pressure, gallons
   for volume, °F for temperature. No unit fields, no mixed units.
9. **Change management**: every contract doc ends with a changelog table. Changes are
   made here first, agreed with the producer program's owner, then implemented.

## How the pieces meet (recap)

```
[Takeoff program] ──── takeoff.json (optional enrichment) ────┐
[Dossier program] ──── dossier.json + room_program.json ──────┤
                                                              ▼
                THIS PROGRAM — auto-resolve → exception queue → deliverables
```

The dossier program also owns *extraction* of the room program from drawings. This
program owns *resolution* (room → LAUSD requirements). The room-type taxonomy is the
shared vocabulary that makes the handoff clean: the dossier pre-maps room names to
taxonomy codes where it can; anything unmapped arrives as free text and becomes a
one-click classification in this program's exception queue.

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-06-11 | 0.1 | Initial draft set: conventions, dossier, takeoff, taxonomy v0. |
