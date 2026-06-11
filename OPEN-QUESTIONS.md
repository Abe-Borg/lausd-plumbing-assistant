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

## How to resolve one

1. Verify the fact against the source document (cite doc + section + version date).
2. Update the KB record: correct values, `verification_status: "verified"`, drop the `todo`.
3. Flip the row here to RESOLVED with a one-line note of what was confirmed.
