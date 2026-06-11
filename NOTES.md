# Claude's Scratchpad — LAUSD Plumbing Assistant

> Living notes. This is my working memory across sessions. Add to it as understanding of
> LAUSD plumbing design requirements grows. Keep provenance (doc / section / page) on facts.
> Started 2026-06-11 from first document review session with Abe.

---

## 1. Mission (refined 2026-06-11 session 2 — Abe's direction locked in)

**Make LAUSD plumbing design REALLY EASY** (Abe's words, emphatically). Easy = fewer
decisions + zero double-checking. The plumbing designer today plays "lego assembly" from
memory across ~5+ documents. The program does the assembly, the cross-referencing, and the
rule-triggering, so the human does engineering judgment.

**Primary user: the plumbing designer (at an A/E firm).**
**Upstream data: construction drawings (PDF). Revit explicitly OUT of scope for now.**

Capability pillars, with Abe's prioritization:
1. **Structured knowledge base** — foundation for everything. Fixtures/assemblies, rules
   (trigger → obligation), pipe/material schedules, citations + version dates.
2. **Assembly configurator** — ★ FRONT AND CENTER, the leading man. Context in (room type,
   grade level, indoor/outdoor, ADA, vandalism, new vs modernization) → complete assembly
   out: schedule numbers + the full obligation cloud. Game-like potential (see §1b).
3. **Room → requirements generator** — the "data spine" (see §1c). Same engine as the
   configurator, run in batch over a room list.
4. **Spec edit suggestions** — REVISED (session 4): no docx-editing module anywhere.
   THIS program emits a TEXT DELIVERABLE: precise per-section edit instructions for the
   district master specs — KEEP list (with room-driven rationale: "L-1 kept because Rooms
   101/103/201"), DELETE list (with "do not renumber" reminders), edit notes to strip,
   options to resolve (e.g., DSB-1 finish), manufacturer-count flags (<3 listed). The
   designer applies them in Word themselves. Generated from the selection set.
5. **Q&A with citations** — near-free once KB exists (peripheral LLM over KB).
6. ~~Design QA / linter~~ — DEFERRED (Abe). Architecturally free to defer: configurator
   output defines expected state; future linter = diff actuals against it.
7. ~~Deviation manager~~ — DEFERRED (Abe). It's the configurator's "not in standards"
   branch; stub as a flag now, build workflow later.

### 1a. Architecture position: LLM at the PERIPHERY, deterministic heart (decided, session 2)

Abe asked: LLM at the heart or periphery? My recommendation (delivered, he's on board with
direction generally): **periphery**. Rationale:
- Trust IS ease. Same input must give same output, with a citation, every time. A designer
  who must re-verify tool output against source docs gets negative value.
- The domain is finite & enumerable (~60 schedule families, a few hundred rules, a dozen
  tables). It fits in a database; it doesn't need probabilistic recall.
- LLM failure modes (hallucinated model numbers, plausible-wrong selections) cost DSA
  round-trips and change orders.

**Deterministic heart**: KB + rules/selection engine + template-based doc generation (spec
editor NEVER generates prose; it assembles canonical LAUSD text blocks).

**LLM's four jobs (all at the edge):**
1. **Ingestion** (biggest win): parse LAUSD Word/PDF prose → structured records, offline,
   once per doc version, human-verified. Source docs are dirty (duplicate CO-4 etc.) —
   needs intelligence + review UI, not a rigid parser.
2. **Front door**: NL → pre-filled configurator state ("3rd grade RR, modernization,
   450 kids"). LLM routes, never answers.
3. **Explanation**: conversational "why" grounded in retrieved rules, citation attached.
4. Later: deviation-request & comment-response drafting (prose, human-reviewed by nature).

### 1b. Configurator: game-like angle (Abe: "could be fun, come back to it")

The selection structure IS a build/loadout screen: pick context chips (grade band, ADA,
outdoor, vandalism) → assembly snaps together (bowl docks, faucet docks, trap docks) →
obligation cloud lights up as a checklist with a completeness meter. The snap-together
feedback is the correctness model made visible — an incomplete assembly LOOKS incomplete.
Avoid points/badges; the dopamine is the fully-resolved package clicking into place.

### 1c. Room program = the data spine (Abe: "compelling — expand")

Entered once, drives everything downstream:
- **Input paths**: comes from Abe's DOSSIER PROGRAM (see §1d) — extraction is NOT our job.
- **Engine**: room name → RoomTypeProfile → trigger catalog fires (fixtures, counts,
  water temp class, drains, emergency equipment, special waste, gas).
- **Outputs**: drawing-ready fixture schedule (designations matching 22 1000 = instant
  compliance) • the REQUIRED fixture-to-occupant tabulation (mandatory plan deliverable,
  generated as a side effect!) • water temp service matrix • triggered equipment list
  (WHs, TMVs, circ pumps via distance rules) • spec-editor selection set.
- **Compounding payoff**: architect moves a restroom in DD → re-import → delta shown →
  only changed decisions re-enter the exception queue. Kills the #1 source of
  drawing/spec mismatch.

### 1d. Ecosystem / module map (session 3 — Abe's modularity doctrine)

Abe builds modular, nimble programs. He ALREADY HAS:
- **Takeoff program**: counts fixtures, areas, lengths from drawings.
- **Dossier program**: builds the whole-job dossier from a drawing set AND builds the
  room program.

Module map (boundaries are data contracts, not features):

    [Takeoff pgm]──takeoff.json(optional)──┐
    [Dossier pgm]──dossier.json+rooms.json─┤
                                           ▼
                  ┌─ THIS PROGRAM: THE LAUSD STANDARDS/DECISION ENGINE ─┐
                  │  facts in → LAUSD-compliant DECISIONS out           │
                  │  (auto-resolve + exception queue + configurator)    │
                  └──┬──────────┬───────────┬───────────┬───────────┬───┘
                     ▼          ▼           ▼           ▼           ▼
              fixture sched  occupant   temp matrix  equipment  SPEC EDIT
                             tabulation              list       SUGGESTIONS (text)
              (selection set = internal model behind the suggestions; exportable
               as machine artifact for future modules, not a deliverable itself)
              future: [Linter module] consumes our expected-state export + takeoff facts
              future: [Deviation manager module] consumes our non-standard flags

**Identity in one line: "Where project facts become LAUSD-compliant plumbing decisions."**
Everything ingested = facts. Everything emitted = decisions + the paperwork proving them.

**What the designer opens this program FOR** (the nailed-down answer):
They are here to exercise engineering judgment on the decisions that genuinely need a
human — and nothing else. No data entry (upstream did it), no document formatting
(downstream modules do it). Session loop:
1. Import/refresh dossier + room program (one click).
2. Program auto-resolves every deterministic decision (with citations) BEFORE showing UI.
3. **Exception queue** (inbox-zero model): only ambiguities, multi-option choices, missing
   data, and deviation candidates ask for the human. The game-like configurator is the
   exception-resolution UI — each card snaps together, completeness meters per
   room/building/project.
4. Export deliverables: fixture schedule, fixture-to-occupant tabulation, water temp
   matrix, equipment list, selection-set.json → spec editor module.
5. On upstream change: re-import → delta view → only changed decisions re-queue.
Target feel: a whole elementary school processed in ~an hour, mostly reviewing green
checkmarks. THAT is "so fucking easy."

Decision record bonus: persisted decisions + citations + rationale ≈ the skeleton of the
**plumbing Basis of Design narrative** (required at every SDG submittal phase). Natural
future output, not v1 scope.

### 1e. Input contract (draft v0 — to validate when Abe shares his programs' details)

Form: versioned JSON files (`dossier.json`, `room_program.json`, `takeoff.json`); we
publish the schema, his programs target it. **Graceful degradation everywhere**: only a
minimal core is required; every missing field parks its dependent decisions in the
exception queue instead of blocking.

**From DOSSIER program — project context (required core ★):**
- ★ School level / grade configuration (K-5, 6-8, 9-12, EEC, span — note K-8 spans = age
  bands vary BY ROOM, not by project)
- ★ Project type: new / comprehensive modernization / repair-expansion / replacement-in-kind
- ★ Planned capacity (student fixture counts) + classroom count (staff = 2 adults/room)
- Jurisdiction: city (LA vs other — LA San is the floor regardless), water purveyor
  (LADWP → Rule 16-D), street pressure if known (>80 psi → PRV station)
- Buildings/floors structure (multi-story → per-floor isolation valves; per-floor fixture
  requirements)
- Campus feature flags: kitchen/food service type, pool, science labs, auto shop,
  ceramics, agriculture, subterranean parking, athletic fields, EEC, laundry…
  (each flips on whole subsystems)

**From DOSSIER program — room program (required core ★):**
- ★ room_id, room number, name/type, building, floor
- ★ Room type code from OUR PUBLISHED TAXONOMY (decided: we own the controlled room-type
  vocabulary, built from LAUSD's own ~30+ rule-bearing room names; dossier pre-maps what
  it can; unmapped rooms arrive free-text → exception queue one-click classify)
- ★ Age band / grade level served per room (SDG requires arch drawings to label age group
  per restroom — so this data exists upstream)
- Occupant load, area, ADA flags, indoor/outdoor, new-vs-existing status (modernization)
- Adjacencies (valuable: EEW-3 flip-down eyewash only legal in prep rooms IMMEDIATELY
  ACCESSIBLE to a lab w/ deluge shower; custodial-adjacent-to-RR checks later)

**From TAKEOFF program — optional enrichment (v1 ships without it):**
- Existing fixture inventory by room (modernization: replacement-in-kind logic,
  floor-drain feasibility, urinal conversions)
- Distances/lengths when known: WH→fixture-group distances (circ pump triggers 25/50 ft),
  building perimeters (hose bibb 75 ft spacing). Unknown distance → rule parks in queue
  as "provide distance or accept assumption."
- Drawn fixture counts (future linter food, NOT consumed in v1)

**Out the back (our exports):** fixture schedule, fixture-to-occupant tabulation, water
temp service matrix, equipment list, `selection-set.json` (spec editor contract),
expected-state export (future linter contract), decision record w/ citations (future BOD).

### 1f. Settled module decisions (sessions 3–4)

- **Spec editing: NO editing module at all** (session 4 supersedes session 3's "separate
  module" decision). This program emits SPEC EDIT SUGGESTIONS as a text deliverable;
  the human applies them in Word. Selection set remains the internal model behind it.
- **Room program EXTRACTION: Abe's dossier program** (not us). Room program RESOLUTION
  (room → requirements): THIS program — it's the configurator engine in batch mode;
  splitting it would cut one engine across two repos. Module boundary sits at the data
  contract, not through the middle of the rules engine.
- **Room-type taxonomy: WE publish it** (Abe confirmed); dossier pre-maps, free-text
  fallback lands in exception queue.

### 1g. Maintained interface documents (started session 4 — keep these current!)

Abe's directive: maintain precise, evolving docs describing what THIS program needs from
outside programs — what they deliver, in what shape. Live in `contracts/`:
- `contracts/README.md` — conventions (versioning, graceful degradation, stable IDs,
  units, forward compat), index, change management.
- `contracts/dossier-contract.md` — dossier.json + room_program.json, field by field,
  each with an "if missing" degradation behavior.
- `contracts/takeoff-contract.md` — takeoff.json, optional enrichment.
- `contracts/room-type-taxonomy.md` — OUR published controlled vocabulary (v0 seeded from
  LAUSD's own rule-bearing room names; grows during KB ingestion).
Update these whenever scope, rules, or upstream capabilities change. Each carries its own
version + changelog. Output contracts get added when downstream consumers exist.

### 1h. MVP v0 (session 5) — see `plans/mvp-implementation-plan.md` (authoritative)

One sentence: **load a room program for one small elementary school → deterministic
decisions auto-resolve with citations → designer answers a short exception-card stack →
out come the fixture schedule, fixture-to-occupant tabulation, and water temp matrix —
then the DD-shuffle delta proves no human decision is ever lost.**
- NO LLM anywhere in MVP (queue substitutes for all LLM edges). No network at runtime.
- Stack fixed: TS monorepo — pure engine package, KB-as-JSON package, Vite/React app.
- Synthetic project: `synthetic/vista-del-sol/` (narrative + dossier.json +
  room_program.json + v2 delta; takeoff.json intentionally absent). 43 rooms, K-5,
  all-electric, serving-only kitchen, 350 capacity / 13 classrooms, 88 psi street.
- Seeded exceptions: STEAM ROOM (null type), MULTI-USE ROOM (conf 0.6), Boys RR A110
  (age band null), general-classroom sink batch card, restroom quantity cards.
- Out of MVP: spec edit suggestions (stretch S-1), equipment list, gas/grease/science,
  modernization, takeoff ingestion.
- Top risk: CPC fixture-count ratios not in our extracts → encoded as DRAFT + badged in
  UI + OPEN-QUESTIONS.md; human-verify before any demo (plan §10 R1).
- Taxonomy bumped to v0.2 (appended `kitchen_serving`, `play_yard`).

## 2. Document inventory

> Standard Technical Drawings: **deferred for a while** (Abe, session 5) — keep tracking
> in the missing-docs list below; don't plan work against them until Abe re-opens it.

### In hand (extracted to text in /tmp/docs during session 1; re-extract as needed)
| Doc | Version | What it is |
|---|---|---|
| School Design Guide (plumbing excerpt PDF, 89 pgs) | 02/26/2025 | Book 1 §1.2 submittal process; Book 2 §2.1 building design (J restrooms, K drinking fountains/bottle fillers); Book 3 §3.4 Plumbing technical criteria (pp.147–164) |
| 22 1000 Plumbing | 250908 (Sep 2025) | THE fixture/equipment catalog + execution. ~60 schedule families (AP, BPV, BSV, CO, CPH, DFWF, DF, DSB, DT, DU, EEW, EWC, F, FD, FLH, FLV, FS, GT, HB, L, LGV, PH, PT, PRV, PSV, RD, SA, SS, S, ST, SE, SGV, SP, STV, TMVA, ATP, TD, U, VRV, WC, WMOB, WTC, WH, WHA, WT, YB, …) |
| 22 0513 Basic Plumbing Materials & Methods | 250808 (Aug 2025) | Valves (BV/BFV/CHV/EQV/GV/GLV/PV/SRV…), pipe & fitting schedule numbers P-1…P-16 / PF-*, **Table I Pipe & Fitting Schedule (use → pipe+fittings)**, welding quals, hangers, joints, flashings |
| 22 0553 Plumbing Identification | 111001 (Oct 2011!) | Valve tags/charts, pipe label colors/sizes (ANSI A13.1), underground marking tape + tracer wire |
| 22 0500 Common Work Results for Plumbing | 111001 (Oct 2011!) | Lead-free (AB 1953) regs, submittals, O&M manuals, training, **pipe test pressure table**, record drawings |

### Referenced but NOT in hand (ask Abe / fetch later)
- **Standard Technical Drawings** (e.g., P-032..P-035 ADA showers, drywell, DF access panel details) — heavily referenced
- Educational Specifications; Facilities Space Program
- Guide spec sections: 22 0548 (seismic), 22 0700 (insulation), 22 2013 (plumbing piping?), 21 1313 (fire sprinkler), 33 1100 (site water), 33 3000 (site sewer), 32 8413/8426 (irrigation), 11 4013 (food service), 12 3553 (lab casework)
- Submittal checklists Book 4 (esp. **4.9 Plumbing checklist** for 100% CD)
- Substitution/Deviation Request forms
- California Plumbing Code (fixture counts, sizing) — the code layer everything sits on
- Guide Specs **Revision Log** (online) — designers must verify latest versions

## 3. The two-layer (really three-layer) standards model

1. **Design Guide** = design intent & criteria ("provide floor drains at…", "tempered water at…", system design rules). Architect/engineer must comply during design.
2. **Guide Specifications** = contract documents template. A/E edits per project **in Word
   with Track Changes** (submittals rejected otherwise), starting fresh from district
   masters each project (never from past projects).
3. **Standard Technical Drawings + CPC/CBC/Title 24/Title 8** = the details and the law.

Conflict rule: if Design Guide and Guide Specs disagree → **most stringent applies** (SDG 1.2-Q.2.b.5).
Deviations from any of it → formal Substitution/Deviation Request, early, one per item.

## 4. THE core insight: fixtures are assemblies ("lego problem")

A schedule designation is a *kit of parts + a cloud of obligations*, not a product.

**Example: L-1 student lavatory** (22 1000):
- Bowl (CECO 551 / Kohler K-2867 / Zurn Z5844-CB) — cast iron, acid-resistant enamel
  (vitreous china PROHIBITED), 3 holes 4" centerset (single-hole PROHIBITED)
- Faucet **F-4** (separate schedule item: Chicago 3400-ABCP / Zurn) — push-button ADA
  metered, ≥10 sec, ≤5 lb force
- Drain, supply (IPS brass nipple ONLY — no braided/flex, no copper sweat adapters),
  loose-key square-shank lock-shield stops, each faucet its own ¼-turn angle stop
- PT-1 chrome cast-brass trap (tubular traps PROHIBITED)
- Plus the obligation cloud: cleanout above, aligned to fixture centerline, ≤6" above
  backsplash (offset if mirror); WHA-1 water hammer arrestor on header; room isolation
  valve 3–7 ft AFF controlling only that room; **tempered** water only (student) via
  remote TMV in custodial room; header sized ½"/¾"/1" for 2/3-4/5-6 lavs; mounting height
  32/30/25" by age group; steel backing plate spec; hand dryer count tied to lav count
  (1 per 2 lavs); insulation under accessible lavs (Plumberex/Lav-Guard).

That's ~12+ coupled decisions for the most common fixture in a school. Multiply by ~60
schedule families.

**LAUSD already half-acknowledges this**: ST-1…ST-9 are pre-bundled sink+faucet+strainer
combos mapped to room types (e.g., ST-2 = S-2 + F-2 + K-8801 for Concessions, Faculty
Lounge, Nurse, Parent Center…). WCs bundle bowl+flush valve(FLV)+seat(+carrier). The
configurator should generalize this pattern to everything.

## 5. Selection axes (what a human must juggle per fixture)

Observed axes across DF-1…DF-12A, WC-1…WC-6, L-1…L-5, SA-1…SA-4, EEW-1…EEW-4, U-1…U-4:
1. Grade level: Kindergarten / Elementary / Middle / High / Adult (heights, bowl types, seats)
2. User: student vs faculty/staff vs public
3. ADA/access compliance (and *which* approach: frontal, dual-height, child-height)
4. Indoor vs outdoor; sun exposure (solar-reflective powder coat / polymarble for heat)
5. Vandalism severity (severe-vandalism variants)
6. New construction vs modernization vs replacement-in-kind (cuspidors & EWCs replacement-only;
   non-water urinals need District approval + future-conversion rough-in)
7. Location specifics: remote from building (pedestal DF-9/9A; >100 ft from sewer → drywell),
   wall construction (stucco vs CMU changes HB-1 vs HB-2, AP-1 vs AP-3)
8. Water temperature class required (hot+cold / tempered / tepid / cold-only)

## 6. Rule triggers catalog (room/condition → obligation) — the rules engine seed

- **Water temp by room type** (SDG 3.4-D): Hot+Cold at ~27 room types (adult RRs, art,
  ceramics, culinary, custodial, nurse, science prep/demo, sports med…); Tempered only:
  student RR lavs, EEC sinks, student showers; Tepid only: emergency shower/eyewash;
  Cold only: general classrooms, kindergarten, CAD, science student stations, music, SpEd.
- **Temps**: 120°F at heater / 115°F furthest outlet; tempered 95–100°F (TMV near outlet but
  NOT in restroom — custodial rm); tepid 60–100°F. Circ pump triggers: >25 ft (faculty RR
  metered faucets, nurse), >50 ft (food service, custodial, high-flow); aquastat on 100/off 108.
- **Floor drains w/ trap primers** (SDG 3.4-B.7): student+staff RRs (1 front-center per 2+
  urinals; 1 per WC group, 2 if ≥4 WCs), showers/lockers/drying, custodial closet @ hopper,
  mech rooms, electrical rooms below grade, lunch shelters (CI w/ basket, no primer),
  uncovered trash (diverter valve system FD-10), deluge showers, washing machines, culinary.
- **Floor sinks**: boiler/mech rooms, kitchens, coffee urns, prep sinks (min 3"), milk-shake
  machines, refrigerators ≥30 ft³, walk-ins, WH drip pans, therapy rooms.
- **Emergency shower/eyewash** (Title 8 §5162, ANSI Z358.1): science classrooms, pool
  chem/mech rooms, central custodial storage (receiving in MS/HS); flip-down eyewash in prep
  rooms only as supplement; tepid water; potable connection.
- **Backflow** (SDG 3.4-E.3): 18-item trigger list (flush valves, boilers, soft drink, hose
  bibbs, demo tables, labs→RP principle, darkroom, cooling towers, fire, irrigation…).
  Meter protection: RP assemblies, dual parallel branches for domestic (uninterrupted
  service); LADWP Rule 16-D; PRV when street >80 psi (dual pilot-actuated, maybe 3rd small).
- **Hose bibbs**: under exterior DFs, outside eating, student RRs (if floor drain; locking
  cover), shower/locker (50 ft hose coverage), ~75 ft spacing around buildings, within 25 ft
  of walk-off-mat entrances; sill cocks in boiler/mech rooms + roofs w/ PV/skylights/HVAC.
- **Cleanouts**: above every urinal, lav, DF, bottle filler, sink; upper-terminal WC only when
  multiple; lav CO at centerline ≤6" above backsplash, offset for mirrors; to-grade every
  100 ft or >90° direction change; at property line; 24" min sewer depth (6 ft at property line).
- **Isolation valves**: every room with fixtures (3–7 ft AFF, control only that room, recessed
  locked box); per floor; per building (yard box, 2" operating nut, gate only below grade);
  back-to-back restrooms isolated separately; student shower solenoid w/ remote at coach office.
- **Science/chem waste**: dedicated acid waste system → ONE sampling box at building exterior
  (BMP w/ LA Bureau of Sanitation = NO neutralization tank, but provide space for future);
  no HVAC condensate into acid system; separate chem vent; FRPP/PVDF/316L piping per location
  (P-10/11/12/P-6 — plenum changes material!).
- **Food service**: FOG program, grease interceptor for all grease equipment (3-comp sinks,
  hand sinks, floor drains/sinks, prep, mop in kitchen prep area), dedicated discharge line
  if possible, separate vent, downstream of lateral else own lateral.
- **Special waste pretreat**: auto shop (oil interceptor+clarifier), ceramics/potting/ag
  (solids interceptor), film (silver recovery), parking garage sumps (oil+solids if hose bibbs).
- **Gas**: elementary = low pressure 8" w.c.; secondary = medium 3 psi (Polyflo calc for
  approval); EQ shutoff valve at each meter AND each building POC (DSA approved); valve
  cascade (master plug valve, building stop outside, floor isolation, room group valve, outlet
  valve + check); science labs → solenoid + push-button controller ≤48" (LGV-1); meter siting
  rules; gas load schedule per meter (existing/new/future CFH) required on plans.
- **Mandatory bottle fillers** (SDG 2.1-K): at all student RR entries (int+ext), gym int+ext
  (not on wood floor), MPR/auditoria lobbies, play areas/fields, lunch shelters. All DF/BF:
  brass-free waterways, future filter provision (DFWF-1 head+bypass in locked panel), CO above,
  pedestal units get lockable SS cover; alcove rules (CBC) on accessible routes.
- **Fixture counts**: CPC minimums; occupant load = planned capacity (students) + 2 adults per
  classroom (staff); tabulated fixture-to-occupant calc REQUIRED on plans per building.
- **Restroom kit** (SDG 3.4-A.2/3): RR shutoff above upper terminal WC behind locked panel
  (keyed for students, unkeyed for faculty), IR battery flush valves w/ manual override (NO
  hardwire), push-button metered faucets, hose bibb in recessed locked box, floor drains w/
  primers + sloped floors, full-size COs.

## 7. Quantitative tables to encode (source: 22 1000 / 22 0500 / SDG 3.4)

- **Flow maxima**: WC 1.28 gpf, urinal 1/8 gpf or non-water, lav 0.5 gpm, shower 1.8, kitchen 1.8.
- **Pressure/velocity**: ≥25 psi at farthest/highest fixture (or flushometer+emergency shower
  requirement); ≤5 fps hot AND cold; size per CPC fixture units; NBS Reports 66/79.
- **Fixture branch table** (22 1000 2.4x): WC FV 1" CW / 4" waste / 2" vent; lav ½+½ / 1½×1¼
  trap / 2 / 1½; etc. — full table extracted.
- **Header sizing**: WC headers 1½" (2 FV), 2" (3–9 FV); urinals 1"/1¼"/1½" (1-2/3/4-8);
  showers same as urinals; lavs ½"/¾"/1" (2/3-4/5-6).
- **Mounting heights, standard + accessible × 3 age bands** (22 1000 2.46) — two full tables;
  e.g. toilet seat 15–17/15/11–12; lav top 32/30/25 (std), 34/30/24 max (ADA); urinal lip
  24/18 std, 16/15/13 ADA; DF bubbler 36/30/30 max ADA.
- **WC variants**: WC-1 elem, WC-2 elem ADA, WC-3 secondary/adult, WC-4 secondary ADA 17–19",
  WC-5 kindergarten 11–12" (seat ring 1¼"!), WC-6 wall-hung (special case + carrier Z1200).
- **Pipe & Fitting Schedule Table I** (22 0513): use+limits → P/PF numbers. E.g. domestic
  H/C above ground interior = P-4 (Type L; Type M PROHIBITED) + PF-4a/4b; gas exterior UG =
  P-13 PE + anodeless riser; acid above ground = P-12 FRPP (P-11 PVDF in plenums); condensate
  = P-4 or P-6 (316L), DWV copper PROHIBITED for condensate; site water ≥4" = C900 (33 1100).
- **Test pressures** (22 0500 3.04): domestic water 200 psi, gas threaded 60 / welded 100 (air),
  fire sprinkler 200, compressed air 175, DWV = 10 ft head/water to highest vent 2 hr.
- **Disinfection**: 50 ppm/24 hr (25 ppm residual) or 200 ppm/3 hr; AWWA C651; bacteriological
  <500 cfu/mL, 2 samples/floor/building; then DWQP lead test per DF/BF (district does it).
- **Slopes**: sewer ¼"/ft; floor-drain floors 1/8"/ft; garage emergency drain per 4000 ft².
- **Pipe ID color table** (22 0553) + underground tape colors (APWA) + tracer wire 12 AWG.
- **Identification sizes** (22 0553 label length/letter size by pipe OD).

## 8. Prohibitions / gotchas ("lint rules")

No vitreous china lavatories • no single-hole faucets • lavs are cast iron AR enamel only •
hopper/service sinks cast iron only • no braided SS flex supplies • through-wall supplies =
IPS brass nipple (no copper MIP sweat) • no Type M copper • Type L above ground only inside •
no water (incl. fire) under slab except science demo tables • no DWV copper for condensate •
tubular traps prohibited • ELECTRIC water heaters only (no gas, no heat pump!) — ≤100 gal,
high-recovery, in series w/ manifold; no multi-flue; no booster type • storage/tankless/
instantaneous electric only • no plastic in shower internals (brass/SS; no ceramic disc) •
trim must be metal, no plastic • no hardwired flush sensors (battery IR + manual override) •
OS&Y only for fire (exception: equip rooms ≥7 ft w/ chain operator) • gate valves in yard
boxes only; NO ball valves below grade • max 2 valves per access panel • no roof-drain COs
inside building • trench drains only at 4 location types • combo waste&vent: only w/ District
permission, no WC/urinal, no kitchen/contaminated, oversize, vent downstream • non-water
urinals: District written approval BEFORE design + future water rough-in + upstream water
fixture + OEHS-approved sealants + 4 cartridges/yr stock + 2 hr training • hot tapping gas
prohibited • no dead legs • avoid gas through one building to serve another • EWCs
replacement-in-kind only • cuspidors replacement only • Stoneman lead roof flashing not
allowed • air chambers not approved (mechanical WHA only) • dielectric unions with
ferrous+non-ferrous metals prohibited (use brass nipple/flange/waterway DU-1..3) •
fixture schedule designations on drawings MUST match spec designations • when deleting
fixtures from spec, DO NOT RENUMBER (FD-2 stays FD-2 district-wide) • specs submitted
without Track Changes are rejected • ≥3 manufacturers per item (add if guide lists fewer).

## 9. Pain points → software opportunity map

| # | Pain point | Evidence | Software answer |
|---|---|---|---|
| 1 | Assembly composition (lego) | L-1, ST-1..9, WC bundles, DF+DFWF+panel+CO | Configurator with complete kit + obligation cloud |
| 2 | 8-axis selection decision trees | DF-1..12A commentary parentheticals | Faceted selector / decision capture |
| 3 | Rules scattered & repeated w/ drift | cleanout rules in SDG 3.4 AND 22 1000 P3; RR kit in 2 places | Normalized rule DB w/ citations; conflict surfacing ("most stringent") |
| 4 | Trigger blindness (negative knowledge) | prohibitions list; room-type triggers | Linter over design data |
| 5 | Version churn | headers 111001 vs 250908; revision log duty | Version watch + diff |
| 6 | Word-editing ceremony | track changes, edit-note deletion, no renumbering | Spec generator from selection set |
| 7 | Counts & sizing arithmetic | occupant-load table, header sizes, CPC | Calculators (counts, headers, branch sizes) |
| 8 | Cross-discipline handoffs | age-group labels on arch drawings; civil POC; FOG; HVAC condensate receptors | Coordination checklist per interface |
| 9 | Agency choreography | DSA, LADWP 16-D, LA San (IW permit, FOG), County Health, OEHS, SCAQMD | Per-project agency/permit tracker |
| 10 | Submittal compliance per phase | SDG 1.2 R; plumbing calcs at DD/50/100; checklist 4.9 | Phase deliverable checklists |

## 10. Defects found in LAUSD's own documents (good demo ammo; verify before citing)

- **22 1000: duplicate schedule number "CO-4"** — used for BOTH "tapped soil tee w/ brass
  plug (above grade, outside)" AND "raised threaded head brass plug (yard box)".
- **22 1000 2.01.B**: "Insulation for Piping: Refer to Section **23** 0700: Plumbing
  Insulation" but Related Sections lists **22** 0700. (23 0700 is HVAC insulation.)
- **22 0513 QA**: "CMC (California **Plumbing** Code)" — should be Mechanical.
- **22 0500 1.02.B.1**: "CBC, Code, and CMC, Plumbing Code" — mangled sentence; also
  stray "3OSHA" formatting.
- 22 0553 §3.01.B starts mid-sentence ("tracer wire on top of…") — lost lead-in text.
- Two sections last touched 2011 vs siblings touched 2025 — internal version spread.
→ A machine-readable KB with validation would catch all of these. Also: be tolerant when
parsing; the source material is imperfect.

## 11. Domain model sketch (for the eventual schema)

- **ScheduleItem**(id e.g. "L-1", family "L", title, description, applicability notes,
  components[], approved_products[{mfr, model}], or_equal: bool, source_cite, status)
- **Assembly** = ScheduleItem + linked ScheduleItems (L-1→F-4, ST-2→{S-2,F-2,K-8801},
  WC-1→{bowl, FLV-1/1a, seat}) + ObligationSet
- **Obligation**(trigger_expr, requirement_text, quantity_rule?, source_cite) — e.g.
  "fixture.family==DF → cleanout above; locked filter panel; hose bibb below if exterior"
- **RoomTypeProfile**(name, water_temp_class, fixtures_required[], drains[], emergency[],
  gas?, special_waste?) — seeded from SDG 3.4-D lists + Ed Specs later
- **PipeUse**(use, limits, P, PF) — Table I rows
- **Rule citations**: (doc_id, version YYMMDD, section path, page)
- **Project context**: school level, new/modernization, jurisdiction (LA city vs other),
  enrollment/planned capacity, buildings/floors/rooms

## 12. Open questions for Abe

1. ~~Primary user~~ → ANSWERED: plumbing designer.
2. ~~Upstream inputs~~ → ANSWERED: Revit + construction drawings exist; **focus on
   construction drawings (PDF) only for now, no Revit work.**
3. ~~MVP preference~~ → ANSWERED: assembly configurator front and center; QA/linter and
   deviation manager deferred.
4. Can we get: Standard Technical Drawings, Book 4 checklists (esp. 4.9), Ed Specs, the
   remaining Division 22 sections, CPC access? (Abe: "I'll show you those technical
   details later on.")
4a. Validate input contract §1e against the ACTUAL outputs of Abe's dossier + takeoff
   programs when he shares them (esp.: can dossier supply age band per room and project
   type? what does its room program record look like today?).
5. Is replacement/modernization work (existing schools) in scope from day 1? Lots of special
   "existing facilities" carve-outs (e.g., floor drain feasibility 3.4-B.7.c/d).
6. Licensing/liability framing: outputs are decision support w/ citations, engineer of
   record still seals. (Position the tool accordingly.)
7. Game-like configurator: how far to take it? (Parked by mutual agreement; revisit at
   UI design time.)

## 12a. Build order (current thinking, post session 2)

1. KB schema + ingest 22 1000 and SDG 3.4 first (LLM-assisted, human-verified). The
   content IS the product.
2. Selection/rules engine + **configurator UI** (the hero).
3. Room-program entry (manual grid + PDF room-schedule extraction) → batch configurator →
   fixture schedule + occupant tabulation outputs.
4. Spec editor (deterministic generation from selection set).
5. Cited Q&A whenever convenient after KB exists (cheap).
Deferred: linter, deviation manager (stub a "non-standard" flag in the configurator).

## 13. Session log

- **2026-06-11 (session 1)**: Reviewed 5 uploaded docs (SDG plumbing excerpt 02/26/2025;
  22 1000 250908; 22 0513 250808; 22 0553 111001; 22 0500 111001). Wrote this scratchpad.
  Key insight: fixtures are assemblies with obligation clouds; LAUSD's ST-schedules prove
  the district itself wants pre-bundling. Found internal doc defects (§10). Delivered
  analysis of pain points + capability map to Abe in chat. No code yet — repo is empty
  (LICENSE only).
- **2026-06-11 (session 2, same chat)**: Direction locked: configurator front & center;
  room program = data spine (expanded, §1c); spec editor confirmed; linter + deviation
  manager deferred; primary user = plumbing designer; construction drawings only (no
  Revit). Recommended and recorded LLM-at-periphery architecture (§1a): deterministic
  KB/rules heart, LLM for ingestion / NL front door / explanation / later prose drafting.
  Game-like configurator angle noted (§1b). Still no code — by design.
- **2026-06-11 (session 3, same chat)**: Modularity round. Abe revealed existing takeoff
  program + dossier program (which also builds the room program). Nailed this program's
  identity: the LAUSD STANDARDS/DECISION ENGINE — facts in, compliant decisions +
  deliverables out; designer is here ONLY for judgment calls via the exception queue
  (inbox-zero model). Drafted input contract v0 (§1e). Decided: spec editor = separate
  module/repo; we publish the room-type taxonomy (dossier pre-maps, free-text fallback);
  room EXTRACTION = dossier program, room RESOLUTION = us (same engine as configurator).
  Module map in §1d. Noted Basis of Design narrative as natural future output of the
  decision record. North star reaffirmed: SO F***ING EASY for the plumbing designer.
- **2026-06-11 (session 4, same chat)**: Abe approved the identity/outputs. CHANGED: spec
  editor module killed — replaced by "spec edit suggestions" text deliverable emitted by
  this program (§1, pillar 4; §1f). NEW STANDING DUTY: maintain interface contract docs
  (§1g) — created `contracts/` with README, dossier-contract, takeoff-contract, and
  room-type-taxonomy v0 (~50 codes seeded from LAUSD rule-bearing vocabulary). Still
  planning phase, no app code.
- **2026-06-11 (session 5, same chat)**: PR #1 merged earlier. Defined MVP (§1h) and
  wrote `plans/mvp-implementation-plan.md` for the coding-agent team (no code, by
  Abe's instruction — agents will write it). Built synthetic project
  `synthetic/vista-del-sol/` (narrative + contract-conformant dossier/room program +
  v2 delta for the DD-shuffle demo). Taxonomy → v0.2. Standard Technical Drawings
  deferred for a while (§2 note). Demo audience: the plumbing team; no-overwhelm is
  an explicit design constraint in the plan.
