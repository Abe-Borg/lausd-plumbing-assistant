# Claude's Scratchpad — LAUSD Plumbing Assistant

> Living notes. This is my working memory across sessions. Add to it as understanding of
> LAUSD plumbing design requirements grows. Keep provenance (doc / section / page) on facts.
> Started 2026-06-11 from first document review session with Abe.

---

## 1. Mission (draft — still hazy by design, refine with Abe)

Working hypothesis: **reduce the mental load of designing plumbing for LAUSD schools to
code + district standards, by turning LAUSD's prose standards into structured, queryable,
composable knowledge.**

The plumbing designer today plays "lego assembly" from memory across ~5+ documents. The
program should do the assembly, the cross-referencing, and the rule-triggering, so the
human does engineering judgment.

Candidate capability pillars (roughly in dependency order):
1. **Structured knowledge base** — parse Design Guide + Guide Specs into a database of
   fixtures/assemblies, rules (trigger → obligation), pipe/material schedules, with
   citations and version dates. Everything else builds on this.
2. **Q&A with citations** — "what faucet goes on a student lavatory?" → answer + source.
3. **Assembly configurator** — input context (room type, grade level, indoor/outdoor, ADA,
   vandalism, new vs modernization) → output complete assembly: schedule numbers, all
   attached obligations (cleanout, WHA, valves, temps, panels, heights, backing).
4. **Room → requirements generator** — room program in, per-room plumbing requirements +
   fixture counts (CPC minimums w/ LAUSD occupant-load overrides) out.
5. **Spec editing assistant** — given the project's selected fixture set, produce the
   edited 22 1000 etc. (delete unused without renumbering, strip edit notes, keep ≥3
   manufacturers, track changes), diff against district's latest revision.
6. **Design QA / linter** — check fixture schedules vs spec designations, prohibitions,
   header/branch sizing, cleanout placement, submittal checklist completeness.
7. **Deviation manager** — detect non-standard choices, draft Substitution/Deviation
   Request content (one form per item, single PDF, early submission).

## 2. Document inventory

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

1. Primary user: plumbing designer/engineer at an A/E firm? LAUSD design standards reviewer?
   Both? (Changes UX: authoring tool vs checking tool.)
2. What inputs exist upstream — Revit/BIM models, room data sheets, Excel programs? (SDG
   mandates AutoCAD .dwg + Excel schedules w/ CAFM IDs — integration targets?)
3. MVP preference: Q&A over the docs (fastest), or the assembly configurator (highest
   wow/value), or spec editor (most tedium removed)?
4. Can we get: Standard Technical Drawings, Book 4 checklists (esp. 4.9), Ed Specs, the
   remaining Division 22 sections, CPC access?
5. Is replacement/modernization work (existing schools) in scope from day 1? Lots of special
   "existing facilities" carve-outs (e.g., floor drain feasibility 3.4-B.7.c/d).
6. Licensing/liability framing: outputs are decision support w/ citations, engineer of
   record still seals. (Position the tool accordingly.)

## 13. Session log

- **2026-06-11 (session 1)**: Reviewed 5 uploaded docs (SDG plumbing excerpt 02/26/2025;
  22 1000 250908; 22 0513 250808; 22 0553 111001; 22 0500 111001). Wrote this scratchpad.
  Key insight: fixtures are assemblies with obligation clouds; LAUSD's ST-schedules prove
  the district itself wants pre-bundling. Found internal doc defects (§10). Delivered
  analysis of pain points + capability map to Abe in chat. No code yet — repo is empty
  (LICENSE only).
