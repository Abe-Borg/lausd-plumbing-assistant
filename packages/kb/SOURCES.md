# KB Sources Index

Every encoded record family → the source documents and sections it came from, so a
human can audit the knowledge base against the originals page by page (plan §5).

**Provenance chain**: the LAUSD source documents are NOT in this repository. They were
analyzed during the planning sessions and distilled — with document/section pointers —
into `NOTES.md` (§4–§8) and `contracts/room-type-taxonomy.md`. KB records cite the
LAUSD documents directly using those preserved pointers. `verification_status:
"verified"` means the fact is backed by that planning record; `"draft"` means the fact
is a placeholder or an inference and carries a `todo` naming its entry in
`/OPEN-QUESTIONS.md`. Citation `note` fields are **distilled wording**, not verbatim
quotes.

## Source documents

| Cited as | Document | Version |
|---|---|---|
| `SDG` | LAUSD School Design Guide, plumbing excerpt (Book 1 §1.2; Book 2 §2.1-J/K; Book 3 §3.4) | 02/26/2025 |
| `22 1000` | Guide Specification 22 1000 Plumbing (fixture/equipment schedules + execution) | 250908 |
| `22 0513` | Guide Spec 22 0513 Basic Plumbing Materials & Methods | 250808 (not yet drawn on by the MVP slice) |
| `22 0500` | Guide Spec 22 0500 Common Work Results for Plumbing | 111001 (not yet drawn on by the MVP slice) |
| `22 0553` | Guide Spec 22 0553 Plumbing Identification | 111001 (not yet drawn on by the MVP slice) |
| `Title 8 CCR / ANSI Z358.1` | California Title 8 §5162 + ANSI Z358.1 (emergency fixtures) | unversioned |
| `CPC` | California Plumbing Code (fixture-count table) | **not in hand — all values draft (OQ-1)** |
| `contracts/room-type-taxonomy.md` | Our published room-type vocabulary (itself seeded from SDG 3.4-D, 2.1-J/K and 22 1000 commentary) | 0.2 |

## Record families → sources

| KB file | Record family | Primary sources |
|---|---|---|
| `data/taxonomy.json` | Room-type vocabulary (generated — `scripts/generate-taxonomy.mjs`) | `contracts/room-type-taxonomy.md` v0.2 (append-only) |
| `data/assemblies.json` | WC-1…WC-5, FLV-1/1a/2/2a | 22 1000 Part 2 WC/FLV schedules; SDG 3.4-A.2/3 (IR battery flush valves); flow maxima (1.28 gpf) |
| | U-3, U-4 | 22 1000 Part 2 U schedule (variant distinction draft — OQ-6) |
| | L-1 (full detail), L-2, L-3, L-4, L-5 | 22 1000 Part 2 L schedule; L-1 products CECO 551 / Kohler K-2867 / Zurn Z5844-CB; variants draft — OQ-8 |
| | F-2, F-4, F-5, F-6 | 22 1000 Part 2 F schedule; F-4 push-button metered ≥10 s ≤5 lb, Chicago 3400-ABCP / Zurn |
| | PT-1 | 22 1000 Part 2 PT schedule (tubular traps prohibited) |
| | S-2, ST-2, ST-3, ST-4, ST-5, ST-6 | 22 1000 Part 2 S/ST schedules; ST-2 = S-2 + F-2 + K-8801 (verified); ST-3/4/5/6 composition draft — OQ-10 |
| | SS-1, SS-2 | Taxonomy custodial rows; 22 1000 (hopper/service sinks cast iron only) |
| | DF-12, DF-12A, DFWF-1 | SDG 2.1-K; 22 1000 DF/DFWF schedules; unit mapping draft — OQ-5 |
| | EEW-1 | Title 8 §5162 / ANSI Z358.1; SDG 3.4-E.6 (designation draft — OQ-4) |
| | FD-1, FD-4, FS-1 | SDG 3.4-B.7 / 3.4-B; FD/FS designation mapping draft — OQ-11 (FD-4 verified via taxonomy lunch_shelter row) |
| | HB-1, HB-2, HB-8 | SDG 3.4-A.2 / 3.4-E.4; 22 1000 HB schedule; HB-1/HB-2 wall mapping draft — OQ-13 |
| `data/obligations.json` | Restroom kit (shutoff/IR valves/metered faucets/sloped floors) | SDG 3.4-A.2/3 |
| | Cleanouts | SDG 3.4 cleanout rules; 22 1000 Part 3 |
| | Water hammer arrestors; access panels | 22 1000 (WHA-1; max 2 valves/panel; air chambers not approved) |
| | Isolation valves (room / floor / back-to-back) | SDG 3.4 |
| | Fountain obligations (filter provision, brass-free, exterior HB + finish, alcoves) | SDG 2.1-K; 3.4-E.4; taxonomy play_yard row |
| | Lunch-shelter drain note | SDG 3.4-B.7 |
| | TMV placement + temperature setpoints | SDG 3.4-D |
| | L-1 cloud (header sizing, ADA insulation, backing, supplies) | 22 1000 L schedule + header sizing |
| | Trap primers; mechanical sill cocks; EEW tepid | SDG 3.4-B.7; 3.4-E.4; Title 8 §5162 |
| `data/height-tables.json` | Mounting heights (standard + accessible × 3 age bands) | 22 1000 2.46 (gaps — OQ-14) |
| `data/count-rules.json` | Occupancy basis (planned capacity; 2 staff/classroom; ceil) | SDG 2.1-J (verified) |
| | Sex split 50/50 | assumption — draft, OQ-2 |
| | Ratio tables (students, staff) | CPC Table 422.1 — **placeholders, draft, OQ-1** |
| `data/project-rules.json` | PRV >80 psi | SDG 3.4-E.2 |
| | LADWP Rule 16-D | SDG 3.4-E.1.b / 3.4-E.3 |
| | All-electric water heating | SDG 3.4-A.1.e; 22 1000 WH prohibitions |
| `data/layout-rules.json` | Restroom floor-drain counts | SDG 3.4-B.7 |
| | Fountain placement + unit selection | SDG 2.1-K.2.a (locations verified; DF-12/12A mapping draft — OQ-5/OQ-7) |
| `data/profiles.json` | 24 room-type profiles (Vista del Sol slice) | Taxonomy rows (water classes per SDG 3.4-D); SDG 3.4-A/B/D/E; 22 1000 schedules as above |

## Auditing

`npm test` runs the KB integrity suite: every record cited; every cross-reference
resolvable; taxonomy JSON regenerated from the contract doc and compared; every
`draft` record's `todo` pointing at a live OPEN-QUESTIONS entry; profile water classes
matching the taxonomy. The suite prints the draft-record census.
