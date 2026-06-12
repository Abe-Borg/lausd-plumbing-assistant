# Open Questions

Questions for Abe / the plumbing designer that block marking knowledge-base records
`verified`. Per the working agreements (plan §12): if an agent is blocked on a domain
fact for more than 15 minutes, the fact is encoded with
`verification_status: "draft"` plus a `todo` note, and a line is appended here.
**Append-only log; mark items resolved rather than deleting them.**

Every `draft` KB record must trace to exactly one OQ id (the record's `todo` cites it).

| ID | Status | Question / fact needing verification | Where it surfaces |
|---|---|---|---|
| OQ-1 | OPEN | **CPC fixture-count ratios (risk R1 — top priority before any demo).** The CPC table values (students per WC/urinal/lavatory/drinking fountain, by sex and school level, for both student and staff occupancies) are not in our source extracts. Encoded as `draft` placeholder values in `packages/kb/data/count-rules.json`; every required-count figure renders with a DRAFT badge until a human verifies against the current CPC edition. | Fixture-to-occupant tabulation; restroom quantity-card suggestions |
| OQ-2 | OPEN | **Sex split of planned capacity.** Engine assumes 50/50 boys/girls of `planned_capacity` unless told otherwise (plan §4.1 says mark `draft`). Confirm this is the accepted LAUSD/CPC convention. | Count rules; tabulation occupancy basis |
| OQ-3 | OPEN | **Per-building required-count basis.** SDG 2.1-J.1.h requires the fixture-to-occupant tabulation per building, but `planned_capacity` is campus-wide and the dossier carries no per-building occupancy. MVP computes Required at campus level and shows per-building Provided; confirm how LAUSD expects per-building Required to be derived. | Tabulation layout |
| OQ-4 | OPEN | **Emergency eyewash/shower unit at elementary receiving/central custodial storage (risk R4).** SDG 3.4-E.6 wording distinguishes school levels; exact unit designation (EEW-1 vs others) for an elementary receiving room needs verification. Encoded conservatively: unit required, designation `draft`. | `custodial_receiving_storage` profile; fixture schedule |
| OQ-5 | OPEN | **DF-12 vs DF-12A selection mapping (risk R3).** MVP simplified mapping: single age band served → DF-12 (child height); multiple bands / public or outdoor mixed use → DF-12A (dual height), per plan §5 "prefer dual-height when both bands served — mark draft". Verify against 22 1000 commentary. | Fountain placement generator; fixture schedule |
| OQ-6 | OPEN | **U-3 vs U-4 distinction.** The planning record places U-3/U-4 in boys student restrooms but not what distinguishes them. MVP assumes U-3 standard / U-4 accessible mounting, and suggests 1 accessible urinal per gang restroom (heuristic, always editable). Verify against the 22 1000 U schedule. | Urinal selection; quantity-card suggestions |
| OQ-7 | OPEN | **Classroom-attached single restrooms (kindergarten pattern): hose bibb + entry fountain.** SDG 3.4-A.2 puts a hose bibb in student restrooms (where floor drains exist) and SDG 2.1-K.2.a puts fountains at student RR entries. MVP exempts classroom-attached single RRs from both (the entry is inside the classroom; HB-8 in a 70 sf kinder toilet room looks wrong). Confirm the intended scope. | restroom_student profile; fountain generator |
| OQ-8 | OPEN | **L-2 / L-3 / L-4 / F-5 / F-6 definitions + approved-product extraction sweep.** The planning record pairs L-1/L-2+F-4 (student) and L-3/L-4+F-5 (staff) but the variant definitions and most approved-product lists (WC bowls, seats, urinals, ST components…) are not extracted yet. MVP marks the variants draft; schedule shows products only where verified (L-1, F-4, L-5). | Assemblies; fixture schedule manufacturers column |
| OQ-9 | OPEN | **FLV-1 vs FLV-1a and FLV-2 vs FLV-2a distinction.** The restroom kit requires battery IR flush valves with manual override; which designation is the sensor variant is not in the extracts. | WC/urinal components |
| OQ-10 | OPEN | **ST-3 / ST-4 / ST-5 / ST-6 composition + ST-5 vs ST-6 selection guidance.** ST-2 = S-2 + F-2 + K-8801 is verified; the other ST bundles' components are not extracted. Art classrooms offer a designer choice between ST-5/ST-6 with no guidance text until verified. | Sink assemblies; art-classroom choice card |
| OQ-11 | OPEN | **FD / FS designation mapping.** Which floor-drain designation (FD-1 vs FD-2 …) applies at restrooms / custodial / mechanical rooms, and which floor-sink designation at mechanical vs serving rooms. FD-4 at lunch shelters is verified. | Floor drains/sinks on the schedule |
| OQ-12 | OPEN | **Serving-kitchen hand sink designation.** Mapped to L-5 (Advance TABCO hand sink, verified record) as a draft mapping. Verify against 22 1000 / food-service standards. | kitchen_serving profile |
| OQ-13 | OPEN | **HB-1 vs HB-2 wall-construction mapping.** NOTES records that stucco vs CMU changes HB-1 vs HB-2 but not which maps to which; lunch-shelter hose bibbs are a designer choice until verified. | lunch_shelter profile |
| OQ-14 | OPEN | **Height-table gaps.** Standard drinking-fountain bubbler heights; accessible WC seat heights for elementary/preK; confirm there is no standard preK urinal row. (Encoded rows are verified per 22 1000 2.46.) | Height table; schedule mounting heights |
| OQ-15 | OPEN | **Kindergarten classroom sinks (ST-4).** Encoded as fixed 1 per the planning record's acceptance sketch; verify against Ed Specs. | classroom_kindergarten profile |
| OQ-16 | OPEN | **"No Kohler U-1" at kindergarten.** The taxonomy carries this prohibition on the kindergarten row; clarify which product U-1 refers to (seat?). | WC-5 notes |
| OQ-17 | OPEN | **`served_sex` field for the dossier contract (v0.2 proposal).** Urinal rules and per-sex count allocation need the restroom's served sex; the MVP derives it from `name_as_drawn` (BOYS/GIRLS) and queues a card otherwise. Propose adding an explicit optional field to `contracts/dossier-contract.md` with the dossier program's owner. | Engine normalize stage; quantity suggestions |
| OQ-18 | NOTE | **Plan §2 Act-4 narration says "41 rooms untouched"; the synthetic data yields 42** (43 v1 rooms − 1 changed = 42 untouched, 1 added). The diff screen reports the computed truth (42). "2 items re-queued" holds: A107's stale sink decision + B117's new sink card. Flagging per the no-silent-deviation rule; no action needed unless the plan intended different data. | Delta diff summary (Act 4) |
| OQ-19 | OPEN | **Spot-verify two SDG subsection numbers carried from the implementation plan.** `SDG 3.4-A.1.e` (all-electric water heating) and `SDG 3.4-E.1.b` (LADWP Rule 16-D) are cited per plan §4.1/§1; NOTES.md attributes the underlying facts to 22 1000 prohibitions / SDG 3.4-E.3 without those exact subsections. The facts themselves are verified; confirm the subsection granularity against the SDG PDF (golden-review findings 2–3). | project-rules.json citations |

## How to resolve one

1. Verify the fact against the source document (cite doc + section + version date).
2. Update the KB record: correct values, `verification_status: "verified"`, drop the `todo`.
3. Flip the row here to RESOLVED with a one-line note of what was confirmed.
