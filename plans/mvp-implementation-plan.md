# MVP Implementation Plan — LAUSD Standards/Decision Engine

**Status: v1.0, ready for execution · Audience: coding agents with strong reasoning
ability · Authored from the planning record in `NOTES.md` and `/contracts`**

You are building the first demonstrable slice of a program whose entire reason for being
is: **make LAUSD plumbing design unreasonably easy for the human plumbing designer.**
Read `NOTES.md` §1–§1g before writing anything. This plan tells you *what to build and
why*; it deliberately contains **no code** — design within these constraints and use your
judgment on implementation details that don't contradict them.

---

## 0. Non-negotiables (violating any of these is a failed task)

1. **Deterministic core.** Same inputs + same KB + same recorded decisions →
   byte-identical outputs. No LLM calls anywhere in the MVP. No network calls at all at
   runtime. No randomness (where IDs are needed, derive them from content, not from
   UUID generators or timestamps).
2. **Never invent LAUSD facts.** Every knowledge-base record carries a citation
   (document, section, page where known, document version date) and a
   `verification_status: "verified" | "draft"`. If a fact you need is not in the
   planning record and not in the source documents you were given, you do **not** make
   it up — you mark the record `draft`, set a `todo` note, and add a line to
   `OPEN-QUESTIONS.md` at the repo root. Wrong plumbing facts in front of the plumbing
   team kill this product's credibility on day one.
3. **The exception queue is the product.** When the engine cannot decide something
   deterministically, the correct behavior is a well-formed exception card with options
   and citations — never a guess, never a crash, never a silent skip.
4. **Stable IDs are sacred.** All persistence is keyed by the stable IDs from the input
   contracts (`project_id`, `building_id`, `room_id`). See `contracts/README.md`
   convention 4.
5. **No overwhelm.** The demo audience is working plumbing designers. Every screen
   should answer "what do you want from me?" in one glance. Batch similar decisions.
   Progressive disclosure everywhere. If a screen needs a legend to be understood,
   redesign it.
6. **Contracts and docs are load-bearing.** If implementation forces a contract change,
   update the contract document (with changelog entry) in the same change set. The
   taxonomy is append-only.

## 1. MVP definition

> **Load a room program for one small elementary school → every deterministic LAUSD
> decision resolves itself, with citations → the designer answers a short stack of
> exception cards → the program emits the fixture schedule, the fixture-to-occupant
> tabulation, and the water temperature service matrix. Then the room program changes
> (DD shuffle) and the program shows that nothing the designer did was lost.**

### In scope

- Input ingestion + validation per `contracts/dossier-contract.md`
  (`dossier.json`, `room_program.json`).
- A knowledge base **slice** sufficient for the synthetic project
  (`synthetic/vista-del-sol/`): see §5 for the exact fixture families and rules.
- The resolution pipeline (§6) and exception queue (§7).
- Three artifacts (§8): fixture schedule, fixture-to-occupant tabulation, water
  temperature service matrix. CSV export + print-friendly view for each.
- Project-level decision cards (PRV at >80 psi; LADWP Rule 16-D note; all-electric
  water heating acknowledgment).
- The delta/resync flow (§9) using `room_program.v2.json`.
- Decision persistence across browser reloads.

### Out of scope (do not build, do not stub elaborately — a `// future` note suffices)

- Any LLM integration. The human queue substitutes for all of it in the MVP.
- Spec edit suggestions artifact (stretch S-1 only, see §11).
- Equipment list artifact (water heaters / TMVs / circulating pumps) — distance rules
  and `takeoff.json` ingestion come later.
- Gas subsystem (synthetic campus is all-electric), grease/FOG subsystem (serving
  kitchen only), science/acid waste, showers, pools, modernization logic.
- Multi-project management, auth, server-side anything, databases.
- Standard Technical Drawings content (explicitly deferred by Abe).

## 2. Demo script (build to this — it is the acceptance test of the whole MVP)

1. **Act 1 — Load.** Open app → "Vista del Sol ES" preloaded → import animation
   resolves 43 rooms in under a second → dashboard shows: N decisions auto-resolved
   (with citations available on hover/click), 6-ish exception cards waiting,
   project completeness meter.
2. **Act 2 — The queue.** Designer burns the stack: classify "STEAM ROOM" →
   makerspace; confirm "MULTI-USE ROOM"; set age band for Boys RR A110; one **batch
   card** "Do general classrooms receive sinks? (applies to 10 rooms)"; quantity cards
   for restrooms (suggested counts shown, designer accepts or edits). Each answer
   visually "snaps" the room's assembly together and ticks the meter. No card requires
   typing more than a number.
3. **Act 3 — The payoff.** Completeness hits 100% → artifacts unlock → show the fixture
   schedule (the thing they hand-build today), the occupant tabulation (the thing LAUSD
   requires on plans), the temp matrix. Export CSV. Print view.
4. **Act 4 — The DD shuffle.** Import `room_program.v2.json` → diff screen: "1 room
   changed (A107 Flexible → Art), 1 room added (B117 Lactation Station), 41 rooms
   untouched — all your decisions preserved, 2 items re-queued." Resolve the two cards,
   artifacts regenerate. This is the moment that wins working designers; make it land.

Write this script as a checked-off walkthrough in `plans/demo-walkthrough.md` when the
build is done, with screenshots.

## 3. Stack and repo layout (fixed — do not bikeshed)

- TypeScript end to end. Node 20+. npm workspaces. Vitest for tests.
- `packages/engine/` — **pure** TypeScript library. No DOM, no I/O, no globals. All
  functions of the engine are pure: `(inputs, kb, decisions) → result`.
- `packages/kb/` — knowledge-base content as JSON files + a thin typed loader.
  Content is data, never code.
- `apps/web/` — Vite + React single-page app. No backend; the app statically imports
  the KB and loads synthetic inputs from fetchable JSON. State persistence via
  localStorage (keyed by `project_id`) + manual "download/load decisions JSON" buttons.
- Existing top-level dirs (`contracts/`, `synthetic/`, `plans/`, `NOTES.md`) stay as
  documentation/data; engine reads synthetic inputs verbatim from `synthetic/`.
- Keep dependencies minimal: React, Vite, Vitest, a JSON-schema validator (e.g., ajv),
  and little else. Every additional dependency needs a one-line justification in the
  PR description.

## 4. Data model (described, not coded — derive precise types from this)

### 4.1 Knowledge base records (`packages/kb/data/*.json`)

Every record has: `id`, `kind`, `citations[] {doc, section, page?, doc_version}`,
`verification_status`, optional `todo`.

- **RoomTypeProfile** — keyed by taxonomy code. Fields: `water_class`
  (`HC|T|TP|C|M|none`), `fixture_requirements[]` (each: assembly selector + quantity
  rule: `fixed(n)` | `per_room` | `designer_quantity` (→ quantity card, with
  `suggested` formula) | `conditional` w/ named condition), `obligations[]` (ids),
  `triggers[]` (named rule hooks like `floor_drain_rules.restroom`,
  `fountain_at_entry`). Source: taxonomy doc + NOTES §6.
- **Assembly** — keyed by LAUSD designation (`L-1`, `WC-5`, `ST-4`, `DF-12A`…).
  Fields: `family`, `display_name`, `description_short` (schedule-ready text),
  `components[]` (e.g., L-1 → bowl products, faucet ref `F-4`, trap `PT-1`),
  `approved_products[] {manufacturer, model}`, `applicability` (structured conditions:
  `age_band`, `ada`, `indoor/outdoor`, `user_class`), `obligations[]`, `spec_section`
  (`"22 1000"`), `mounting_height_ref`.
- **Obligation** — reusable requirement line: `text` (one sentence, designer-readable),
  `applies_to` scope, `citations`. Examples: "Full-size cleanout above fixture, ≤6 in.
  above backsplash, aligned to fixture centerline (offset at mirrors)"; "Water hammer
  arrestor on fixture header (WHA-1)"; "Isolation valve in room, 3–7 ft AFF, locked
  recessed box, controls only this room".
- **HeightTable** — the two 22 1000 mounting-height tables (standard + accessible),
  rows by fixture class, columns by age band.
- **CountRule** — fixture-count math: occupancy basis (LAUSD overrides: students =
  `planned_capacity`, staff = `2 × classroom_count`, sex split 50/50 unless told
  otherwise — mark `draft`), ratio table per fixture class per occupancy type
  (**CPC Table values: enter as `draft` with `todo: "verify against current CPC
  edition"` — see §10 risk R1**), rounding rule (ceil).
- **ProjectRule** — project-level triggers: `street_pressure_psi > 80 → PRV station
  required (SDG 3.4-E.2)`; `water_purveyor.is_ladwp → Rule 16-D note (SDG 3.4-E.1.b)`;
  `gas.has_service == false → suppress gas family; emit all-electric acknowledgment
  (SDG 3.4-A.1.e)`.

### 4.2 Decision model (engine output + persisted state)

- **DecisionPoint** — anything that had to be decided. Fields: `id` (deterministic:
  scope + subject, e.g. `room:rm-a110/age_band`, `room:rm-a110/assembly:WC`,
  `project:prv`), `scope` (`project|building|room`), `subject`, `status`
  (`auto_resolved | queued | human_resolved | stale | out_of_coverage`), `resolution`
  (chosen option + quantity where applicable), `options[]` (for queued), `rationale`
  (one sentence), `citations[]`, `inputs_fingerprint` (hash of the exact input fields
  this decision depends on — the delta mechanism, §9).
- **ExceptionCard** — a queued DecisionPoint dressed for humans: `card_type`
  (`classify_room | missing_field | choice | quantity_entry | batch_policy |
  project_ack | stale | out_of_coverage`), `prompt` (plain language, one sentence),
  `options[] {label, consequence_summary, citations}`, `batch_members[]` (room ids,
  for batch cards), `default_suggestion`.
- **DecisionStore** (persisted) — `{project_id, decisions: {decision_id → human
  resolution + timestamp}, schema_version}`. Human resolutions survive re-imports;
  the engine re-validates them against fingerprints (§9).

### 4.3 Input validation

Implement `contracts/dossier-contract.md` as JSON Schema in `packages/engine`. On
violation of a ★ field: import error with a human-readable message naming the field and
the contract doc. On missing optional fields: proceed and queue per the contract's
"If missing" column — those behaviors are normative, treat the contract doc as the spec.

## 5. Knowledge-base slice to encode (content work — the largest single task)

Encode ONLY what Vista del Sol needs. Source documents were analyzed in `NOTES.md`
(§4–§8 contain the distilled facts with section pointers); where NOTES is insufficient,
the source extracts live with Abe — mark `draft` + open question rather than guessing.

- **Room profiles** (from taxonomy v0.2): `classroom_general`, `classroom_kindergarten`,
  `classroom_flexible`, `art_classroom` (v2), `restroom_student` (all three age bands),
  `restroom_staff`, `restroom_single_user`, `custodial_closet`,
  `custodial_receiving_storage` (emergency eyewash trigger), `electrical_room` (rule
  exists but does NOT fire above grade — encode the condition, it's a nice "rule
  correctly not firing" demo detail), `mechanical_room`, `nurse_office`,
  `teachers_lounge`, `parent_center`, `library`, `library_workroom`,
  `multipurpose_room`, `kitchen_serving`, `lunch_shelter`, `play_yard`,
  `lactation_station` (v2), `makerspace` (STEAM-room resolution target),
  `admin_office`, `plant_manager_office`.
- **Assemblies**: WC-1, WC-2, WC-3, WC-4, WC-5 (+ FLV-1/FLV-1a + seats as components);
  U-3, U-4 (+ FLV-2/2a); L-1, L-2, L-3, L-4 (+ F-4/F-5, PT-1, supplies/stops as
  components); ST-2, ST-3, ST-4 (+ S-1/S-2, F-1/F-2/F-3 components); ST-5/ST-6 (for
  the v2 art classroom); SS-2 (+ F-6); DF-12, DF-12A (+ DFWF-1 head assembly, bottle
  filler, exterior finish variant note); L-5 only if trivial, else skip; EEW unit for
  receiving/storage (mark `draft` — NOTES §6 records the trigger, exact unit selection
  for elementary receiving needs verification); FD-1/FD-2 + trap primer obligation;
  FS floor sink (mechanical/serving); HB-8 (restroom hose bibb).
- **Obligation set** (~25 lines): restroom kit items (NOTES §6 "Restroom kit"),
  cleanout rules, water hammer arrestors, isolation valves, access panels (as
  obligation text lines, not full assembly records), fountain-filter provision +
  hose-bibb-under-exterior-fountain, lunch shelter drain note.
- **Height tables**: both, all three age bands (NOTES §7 has them).
- **Count rules**: occupancy basis per SDG 2.1-J (verified); CPC ratios as `draft`
  placeholders (R1).
- **Water class map**: already encoded in taxonomy — profiles must carry it through.
- **Fountain placement rule**: combination fountain + bottle filler at student RR
  entries, MPR lobby, play areas, lunch shelters (SDG 2.1-K.2.a) — implement as a
  building/site-level requirement generator attached to the relevant room types, with
  indoor/outdoor variants (DF-12 child-height vs DF-12A dual-height: when both age
  bands are served, prefer dual-height — mark `draft`).

Create `packages/kb/SOURCES.md` indexing every encoded record family → source document
+ section, so a human can audit the KB against the originals page by page.

## 6. Resolution pipeline (the engine's spine)

Pure function, conceptually: `resolve(dossier, roomProgram, kb, decisionStore) →
{decisionPoints[], exceptionCards[], artifacts, completeness, diagnostics}`.

Stages (each stage's output feeds the next; keep them separately testable):

1. **Validate** inputs against schemas; produce import errors / warnings.
2. **Normalize** — derive per-room effective facts: age band (from room, else derivable
   from `school_level` when unambiguous, else queue `missing_field`), indoor/outdoor,
   ada flags. Record provenance of every derived fact.
3. **Classify gaps** — rooms with `room_type_code: null` or confidence < 0.8 → queue
   `classify_room` (options: full taxonomy list, fuzzy-ordered by `name_as_drawn`
   similarity — a static string-similarity ranking, NOT an LLM).
4. **Fire room profiles** — for each classified room: instantiate fixture requirements
   → DecisionPoints. Where the profile gives a deterministic assembly (kindergarten RR
   + preK_K → WC-5), `auto_resolved` with citation. Where applicability needs a human
   (quantity entries; general-classroom sink policy), queue. Where the room type is
   recognized but its rules aren't in the MVP slice → `out_of_coverage` card (honest,
   not an error).
5. **Batch collapse** — identical queued DecisionPoints across rooms of the same type
   collapse into one `batch_policy` card listing members. (Resolution fans back out to
   per-room decisions so later single-room overrides remain possible.)
6. **Project rules** — PRV, Rule 16-D, all-electric: project-scope DecisionPoints.
7. **Counts** — compute campus/building required fixture counts (CountRules); compare
   against the sum of resolved per-room quantities; produce the tabulation data
   structure (and a shortfall diagnostic if provided < required — surfaced in the
   tabulation view, not as a blocking error).
8. **Artifacts** — assemble the three artifact data structures (§8) strictly from
   resolved DecisionPoints. Artifacts render only what is resolved; unresolved items
   render as explicit gaps ("pending decision …") so partial states are honest.

Completeness = resolved ÷ total DecisionPoints, also rolled up per room and building.

## 7. Exception queue UX rules

- One card at a time, biggest-impact first (ordering: import blockers → classification
  → batch policies → quantities → acknowledgments).
- Every card: one-sentence prompt, 2–6 options with one-line consequence summaries,
  citation chips (click → exact quoted text in a popover, from the KB record).
- Batch cards show member count and member list behind a disclosure.
- Quantity cards pre-fill the suggestion and show its basis ("suggested 3 WC: required
  building total 8 ÷ 3 restrooms, rounded up — edit freely").
- Answering a card animates the affected room card "snapping" to resolved (subtle —
  one tasteful animation, ~300 ms; this is the seed of the game-like direction, keep it
  understated for the plumbing-team demo).
- Undo: any human decision can be reopened from the room detail view.

## 8. Artifact specifications

All three: on-screen view + CSV export + print stylesheet. Every row traceable — hover
reveals which rooms/decisions produced it.

1. **Fixture Schedule** — rows grouped by family, columns: Designation (e.g., `WC-5`) ·
   Description (schedule-ready short text from KB) · Spec section (`22 1000`) ·
   Approved manufacturers (condensed "Kohler / Zurn / American Std / or equal") ·
   Mounting height (resolved per age band from HeightTable, shown only where
   applicable) · Count (sum across rooms) · Locations (room numbers, collapsed ranges).
   Footer note block: auto-included obligation lines that belong on the schedule
   (e.g., "Provide cleanout above each lavatory…") — keep to the handful that LAUSD
   expects on drawings; cite each.
2. **Fixture-to-Occupant Tabulation** (SDG 2.1-J.1.h) — one table per building + campus
   roll-up. Columns: Fixture class (WC-male/female, urinal, lavatory, drinking
   fountain/bottle filler) · Occupancy basis (e.g., "350 students, 50/50") · Required
   (with ratio shown, e.g., "1:30 → 6") · Provided · Status (✓ / short by N). Required
   values visibly badge `DRAFT — CPC values pending verification` until R1 clears.
3. **Water Temperature Service Matrix** — rows per room (grouped by class), columns:
   Room · Type · Service (HC/Tempered/Tepid/Cold) · Driving citation (SDG 3.4-D list
   item). Include the TMV placement note for tempered rows ("regulating valve near
   outlet; locate in custodial or similar room — not in restroom").

## 9. Delta / resync (Act 4 — get this right)

- Each DecisionPoint stores `inputs_fingerprint`: a stable hash of exactly the input
  fields it depends on (room's type code, age band, flags — not the whole room object,
  so cosmetic changes like `notes` don't invalidate decisions).
- On re-import: match rooms by `room_id`. New room → new DecisionPoints (queued as
  normal). Removed room → its decisions archived with a diagnostic. Changed
  fingerprint under a `human_resolved` decision → status `stale`, card type `stale`
  with before/after summary ("Room type changed Flexible Classroom → Art Classroom;
  your sink decision was based on the old type"). Changed fingerprint under
  `auto_resolved` → silently re-resolve.
- Diff summary screen before applying: counts of added / removed / changed / untouched
  rooms and exactly which human decisions are affected. Apply is one click; nothing is
  lost without being shown.

## 10. Risk register (owners: the agents; resolutions go in OPEN-QUESTIONS.md)

- **R1 — CPC fixture-count ratios.** Not in our source extracts. Encode structure +
  draft values, badge everywhere, and list as the top OPEN-QUESTION for Abe/designer
  verification before any demo. Do not present unbadged counts.
- **R2 — Per-restroom quantity allocation.** Suggested counts (required ÷ restroom
  count) are a heuristic, not a standard. Always designer-editable; never present the
  suggestion as a requirement.
- **R3 — Fountain unit selection (DF-12 vs DF-12A vs others).** Encode the MVP's
  simplified mapping, mark `draft`, cite 22 1000 commentary.
- **R4 — EEW at elementary receiving/storage.** SDG 3.4-E.6 wording distinguishes
  school levels; encode conservatively (require it; `draft`).
- **R5 — Scope creep.** Any "while I'm here" addition outside §1 In-scope requires a
  note in the PR description and must not delay the demo path.

## 11. Stretch (only after the demo script passes end to end)

- **S-1 Spec Edit Suggestions (text artifact)** for 22 1000: from the selection set vs.
  a KB file listing the master's full schedule-item inventory → KEEP (with room-driven
  reasons) / DELETE (with "do not renumber" reminder) / per-family counts. NOTES §1
  pillar 4 has the format.
- **S-2** GitHub Action: typecheck + tests on PR.
- **S-3** XLSX export (CSV is the MVP bar).

## 12. Task breakdown (sized for parallel agents; respect dependencies)

| # | Task | Depends on | Definition of done |
|---|---|---|---|
| T0 | Repo scaffold: workspaces, TS config, Vitest, lint, `OPEN-QUESTIONS.md` seeded | — | `npm test` green on empty suites; layout per §3 |
| T1 | Contracts-as-code: JSON Schemas + validators + fixture tests against all three synthetic files (incl. a deliberately broken fixture per ★ field) | T0 | Synthetic files validate; each ★ violation yields its specified human-readable error |
| T2 | KB schema + content slice per §5 + `SOURCES.md` + KB integrity tests (every record has citations; every assembly referenced by a profile exists; taxonomy codes match contract doc) | T0 | Integrity suite green; `draft` count reported; SOURCES.md complete |
| T3 | Engine pipeline §6 + decision store + fingerprints §9, with golden-file tests: `resolve(vista-del-sol v1, kb, {})` snapshot; full-resolution snapshot (all cards answered per a scripted decision file); v2 delta snapshot | T1, T2 | Goldens committed and reviewed by a second agent for plausibility against NOTES §6–§8; determinism test (two runs, deep-equal) green |
| T4 | Artifact generators §8 + CSV serializers, golden CSVs committed | T3 | Tabulation math traces to CountRules; DRAFT badges present; CSVs open cleanly in spreadsheet apps |
| T5 | Web app: load screen, dashboard, queue, room detail, artifacts views, print styles, localStorage persistence | T3 (T4 for artifact views) | Demo script Acts 1–3 pass on synthetic v1 |
| T6 | Delta flow UI (diff summary, stale cards) | T5 | Act 4 passes; no human decision lost or silently changed |
| T7 | Demo hardening: `plans/demo-walkthrough.md` with screenshots; empty/edge states; a 10-minute reset path (clear storage, reload v1) | T5, T6 | A non-author can run the full demo from the walkthrough alone |

Working agreements: one PR per task; PR description states what was *not* done and any
contract/doc edits; if blocked on a domain fact > 15 minutes, write the OPEN-QUESTION
and proceed with `draft`; keep `NOTES.md` untouched (it's the planning record — Claude
maintains it) but append freely to `OPEN-QUESTIONS.md`.

## 13. Definition of MVP done

- [ ] Demo script Acts 1–4 pass end to end from a fresh browser profile.
- [ ] All tests green; determinism test green; goldens reviewed.
- [ ] Zero un-cited KB records; `draft` records enumerated in OPEN-QUESTIONS.md.
- [ ] Tabulation shows DRAFT badge until R1 is resolved by a human.
- [ ] `plans/demo-walkthrough.md` exists with screenshots.
- [ ] No network calls at runtime (verify in devtools).
