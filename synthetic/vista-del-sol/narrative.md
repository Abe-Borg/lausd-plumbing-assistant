# Synthetic Project Narrative — Vista del Sol Elementary School

**Purpose**: This is the fictional project that feeds the MVP. Every input file in this
directory conforms to the contracts in `/contracts`. The project is deliberately small,
deliberately boring, and deliberately seeded with a handful of imperfections — because
the demo's job is to show the *decision engine* working, not to show a big school.

## The story

LAUSD is building a new K-5 elementary school, **Vista del Sol ES**, in the City of Los
Angeles (LADWP water service). New construction, all-electric campus (no natural gas —
consistent with LAUSD's electrification mandate, and it keeps the gas subsystem out of
the MVP's scope honestly). Planned capacity **350 students**, **13 classrooms**
(staff fixture basis: 2 adults per classroom = 26 adults, per SDG 2.1-J).

Two buildings plus site features:

- **Building A** — two-story classroom building.
  Floor 1: four general classrooms (grades 1–2), two kindergarten classrooms each with
  an attached kindergarten restroom (ages 3–5 → the `preK_K` age band, WC-5 territory),
  one flexible classroom, boys/girls/staff restrooms, custodial closet, electrical room,
  mechanical room (electric water heaters).
  Floor 2: six general classrooms (grades 3–5), boys/girls/staff restrooms, custodial
  closet.
- **Building B** — one-story admin/MPR building: admin office, nurse office, staff
  lounge, parent center, library + workroom, multipurpose/dining room, **serving kitchen
  (warming/serving only — no cooking, no grease-producing equipment)**, boys/girls
  restrooms serving the MPR (public events), one single-user accessible restroom,
  custodial closet, receiving & central custodial supplies storage (this is an
  emergency-eyewash trigger per SDG 3.4-E.6), plant manager office, and two oddball
  rooms described below.
- **Site**: a lunch shelter and a play-yard drinking-fountain station (exterior
  fountain + bottle filler territory, SDG 2.1-K).

Street pressure from the (fictional) Water Pressure Flow Report: **88 psi** — above the
80 psi threshold, so the engine should auto-resolve a project-level decision: PRV
station required (SDG 3.4-E.2).

## Deliberately seeded imperfections (the exception queue's demo material)

These are not mistakes; they are the demo:

1. **`rm-b115` "STEAM ROOM"** — `room_type_code: null`. Genuinely ambiguous name
   (STEAM lab? steam room?). The dossier program correctly refused to guess. The demo
   resolves it to `makerspace` via a classification card. Intent: show that ambiguity
   becomes a 5-second human decision, not a silent wrong guess.
2. **`rm-b116` "MULTI-USE ROOM"** — classified `multipurpose_room` but with
   `room_type_confidence: 0.6`. Below the 0.8 trust threshold → confirmation card.
3. **`rm-a110` Boys Restroom (Floor 1)** — `age_band: null`, with a note that it serves
   both the kindergarten wing and grades 1–2. In a K-5 school the band is otherwise
   derivable, so this is the one restroom that genuinely needs a human call (fixture
   heights and WC model hang on it).
4. **General classrooms carry no sink information** — whether grades 1–2 classrooms get
   ST-4 sinks is an Ed-Specs decision, not derivable from the drawings. Expected
   behavior: ONE batch card ("Do general classrooms receive classroom sinks? Applies to
   10 rooms"), not ten cards. This is the no-overwhelm principle made visible.
5. **`takeoff.json` is absent entirely** — it's optional by contract, and this is a
   new-construction project. Expected behavior: nothing breaks; any distance-dependent
   rule (none in MVP core scope) would park politely.

## The delta file (`room_program.v2.json`) — the DD-shuffle demo

Act two of the demo. The architect revises the program:

- `rm-a107` Flexible Classroom **becomes an Art Classroom** (`art_classroom`) — water
  service stays hot+cold but the sink assembly changes (ST-2 family → ST-5/ST-6 family).
- **`rm-b117` Lactation Station is added** (hot+cold, ST-3 assembly).

Expected behavior on re-import: every previously made decision survives untouched except
`rm-a107`, which re-queues with a "facts changed underneath your decision" card, and
`rm-b117`, which arrives as a new room. The diff summary should say exactly that, in
those terms. This act is the believability moment for working designers — everyone has
lived the DD shuffle.

## What the engine should produce for this project (acceptance sketch)

- **Fixture schedule** including (not exhaustive): WC-5 + FLV-1/1a (kindergarten RRs),
  WC-1/WC-2 (student RRs, elementary band), WC-3/WC-4 (staff/adult RRs), U-3/U-4 in
  boys RRs, L-1/L-2 with F-4 (student), L-3/L-4 with F-5 (staff), DF-12/DF-12A
  fountain+bottle-filler units at required locations (student RR entries, MPR lobby,
  play yard, lunch shelter — exterior units flagged for vandal/sun finish), ST-2
  (nurse, lounge, parent center, library workroom), ST-4 (kindergarten classrooms;
  general classrooms pending the batch card), SS-2 + F-6 (custodial), serving-kitchen
  hand sink + floor sink (no grease interceptor — no grease-producing equipment),
  EEW unit at receiving/central custodial storage, FD/floor-drain set in restrooms per
  the urinal/WC count rules, HB-8 hose bibbs in student restrooms.
- **Fixture-to-occupant tabulation** per building + campus, based on 350 students /
  26 staff. (CPC ratio values ship as `draft` pending human verification — see the
  implementation plan's risk register.)
- **Water temperature service matrix**: tempered at student RR lavatories; hot+cold at
  staff RRs, nurse, lounge, parent center, library workroom, flexible/art classroom,
  custodial, serving kitchen; cold at general/kindergarten classroom sinks; tepid at
  the receiving-area emergency fixture.
- **Project-level decisions**: PRV station (auto-resolved, 88 psi), LADWP Rule 16-D
  backflow note, all-electric water heating acknowledgment.

## Files in this directory

| File | Contract | Notes |
|---|---|---|
| `dossier.json` | `contracts/dossier-contract.md` v0.1 | Project context |
| `room_program.json` | same | 43 rooms/spaces, seeded as described |
| `room_program.v2.json` | same | The DD-shuffle revision |
| *(no `takeoff.json`)* | `contracts/takeoff-contract.md` | Intentionally absent — optional |
