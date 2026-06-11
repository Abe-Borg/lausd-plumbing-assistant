# Room-Type Taxonomy

**Status: Draft v0.1 · Published by THIS program; consumed by the dossier program**

This is the controlled vocabulary for `room_type_code` in `room_program.json`. It is
deliberately built from **LAUSD's own rule-bearing room names** — the room types their
standards actually attach requirements to (water temperature lists in SDG 3.4-D, drain
rules in 3.4-B, fixture commentary throughout Guide Spec 22 1000, restroom/fountain
rules in SDG 2.1-J/K). It will grow during knowledge-base ingestion; codes are append-only
(never reuse or repurpose a code — same discipline LAUSD applies to fixture schedule
numbers).

The dossier program maps `name_as_drawn` → `room_type_code` where it can (use the
aliases column; matching is case/punctuation-insensitive). Anything unmapped ships with
`room_type_code: null` and this program's exception queue classifies it with one click.

**Water class legend** — the domestic water temperature service the room's fixtures get
(SDG 3.4-D): `HC` hot+cold · `T` tempered only · `TP` tepid (emergency fixtures) ·
`C` cold only · `M` mixed by fixture (see hooks) · `—` typically no plumbing.

## Restrooms, hygiene, lockers

| Code | Display name | Aliases seen in LAUSD docs/drawings | Water | Key rule hooks (abbreviated) |
|---|---|---|---|---|
| `restroom_student` | Student restroom | boys/girls RR, student toilet | T | Full student-RR kit (locked-panel shutoff above terminal WC, IR battery flush w/ override, metered faucets, hose bibb, floor drains+primers, cleanouts); L-1/L-2; WC by age band; fountain+bottle filler at entry; custodial room adjacent |
| `restroom_staff` | Staff/faculty/adult restroom | faculty RR, adult RR, visitor RR | HC | Faculty-RR kit (panel locked not keyed); L-3/L-4; circ pump if >25 ft from WH; WH-2/WH-3 point-of-use candidates |
| `restroom_single_user` | Single-user restroom | unisex RR, single accommodation | HC | Not allowed for students except where Ed Specs say; WH-3 tankless candidate |
| `shower_locker_student` | Student shower/locker room | gang shower, PE lockers | T | SA-1/SA-4; looped tempered manifold, battery isolation valves, remote solenoid at coach office; floor drains; hose bibb (50 ft hose coverage); drying room drains |
| `shower_staff` | Staff/special-ed shower | faculty shower | HC/T | SA-2 (staff), SA-3 (ADA staff & SpEd, tempered+cold); STD details P-032..P-035 |
| `drying_room` | Drying room (adjacent showers) | — | — | Floor drains w/ trap primers |
| `lactation_station` | Lactation station | mother's room | HC | ST-3 sink assembly |

## Classrooms — general & early years

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `classroom_general` | General classroom | std classroom | C | ST-4 if sink; cold only |
| `classroom_kindergarten` | Kindergarten classroom | TK, K room | C | WC-5 (11–12" bowl, 1¼" seat ring) in attached RR; age-band heights; no Kohler U-1 |
| `classroom_eec` | Early Education Center classroom | EEC, preschool, CDC | T | Tempered at sinks; Title 22; County Social Services agency |
| `classroom_special_ed` | Special education classroom | SDC, special day class | C | Cold only at classroom sink; SpEd showers under `shower_staff` rules |
| `classroom_flexible` | Flexible classroom | flex room | HC | ST-2; chemical-waste piping if science-flex (then prefer `science_lab_flex`) |
| `child_development` | Child development room | — | C | ST-4 |

## Classrooms — science (chemical waste family)

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `science_lab` | Science lab (MS/HS) | chemistry, biology, physics, physiology, modern science | M | Student stations COLD (F-12), teacher demo HC (F-11); acid waste system → exterior sampling box; EEW-1/EEW-2; LGV gas valves + solenoid controller ≤48"; no HVAC condensate into acid waste |
| `science_lab_6th` | 6th-grade science / flex science | 6th gr science | M | ST-1 (tempered/cold); lighter program than MS/HS labs |
| `science_lab_flex` | Flexible science classroom | flex science | M | Chemical waste piping required (SDG 3.4-B.4) |
| `science_prep` | Science prep/workroom | prep room, teacher workroom (science) | HC | ST-3; EEW-3 flip-down eyewash ONLY if immediately accessible to lab w/ deluge shower, else combo unit; SGV-6 gas behind panel |
| `forensic_lab` | Forensic lab | — | HC | ST-3 |
| `robotics_lab` | Robotics lab | — | HC | ST-3 |
| `makerspace` | Makerspace | — | HC | ST-3 |

## Classrooms — arts & CTE

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `art_classroom` | Art classroom | — | HC | ST-5/ST-6 |
| `ceramics_classroom` | Ceramics classroom | pottery | HC | **Solids interceptor** on sinks (DT/AP-4 floor access); ST-5/ST-6 |
| `graphics_design` | Graphics design classroom | — | HC | ST-6 |
| `digital_imaging` | Digital imaging | — | HC | ST-2 |
| `photography_lab` | Photography lab | photo lab | HC | ST-2; F-8 at finishing; backflow at darkroom equipment |
| `photo_negative_room` | Photo negative/film processing | darkroom | HC | F-10; silver recovery + neutralization (film processing) |
| `culinary_arts` | Culinary arts classroom | — | HC | Floor drains; F-2/F-7; kitchen-grade rules |
| `homemaking` | Homemaking | home economics | HC | ST-9 double-compartment; SGV-6 |
| `auto_shop` | Auto shop | autoshop | HC | **Oil interceptor + clarifier** on floor drains/sinks/cleaning tanks; wash rack → oil interceptor |
| `wood_shop` | Wood shop | industrial arts | — | Eyewash per Guide Specs |
| `agriculture_classroom` | Agriculture/horticulture | ag room | HC | Demo table drains → solids interceptor; HB-4/HB-6 at plots/animal areas; backflow at animal water devices |
| `cad_drafting_lab` | CAD/drafting lab | — | C | ST-4 |
| `instrumental_music` | Instrumental music | band room | C | ST-4 if sink |
| `patient_care_classroom` | Patient care classroom | — | HC | ST-3 |
| `sports_medicine` | Sports medicine classroom | athletic training | HC | Exam sink + hydrotherapy whirlpools (HC) |

## Admin, staff & student support

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `nurse_office` | Nurse office / first aid | health office, therapy room | HC | Circ pump if >25 ft; floor sink (therapy); WH-3 candidate; EWC-2 replacement-only |
| `admin_office` | Administration area | main office | — | EWC-2 (replacement-in-kind only) context |
| `teachers_lounge` | Faculty lounge | staff lounge | HC | ST-2; kitchen sink 1.8 gpm |
| `parent_center` | Parent center | — | HC | ST-2 |
| `library` | Library / media center | LMC | — | — |
| `library_workroom` | Library workroom | — | HC | ST-2 |
| `student_store` | Student store | — | HC | L-5 hand sink (Advance TABCO) |
| `plant_manager_office` | Plant manager office | — | — | — |

## Food service & assembly

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `kitchen` | Kitchen (food service) | cafeteria kitchen | HC | FOG program; grease interceptor (3-comp, hand, prep, mop sinks, floor drains/sinks in prep area), separate vent, downstream of lateral; floor sinks at equipment; BPV-3 at equipment; F-7/F-8/F-9 |
| `kitchen_serving` | Serving/warming kitchen (no cooking) | servery, warming kitchen, serving area | HC | Hand sink; mop/floor sink; **no grease interceptor when no grease-producing equipment present** (SDG 3.4-B.5 ties interceptors to grease-producing equipment — verify scope with District per project) |
| `cafeteria_dining` | Cafeteria / dining | MPR dining | — | FS-1/FS-2 floor sinks (MPR/cafeteria buildings) |
| `multipurpose_room` | Multipurpose room | MPR | — | Fountain+bottle filler at lobby |
| `auditorium` | Auditorium | — | — | Fountain+bottle filler at lobby; concessions HC |
| `concessions` | Concessions stand | snack bar | HC | ST-2; at gym/MPR/auditorium/fields |
| `lunch_shelter` | Lunch shelter / outdoor eating | — | — | Cast-iron pavilion drains (FD-4, no primer — daily washdown); hose bibbs ¾" on 1" line; fountain+bottle filler |
| `gymnasium` | Gymnasium | gym | — | DF-5/DF-4 (PE locations); fountain+bottle filler inside lobby + outside (not on wood floor) |
| `athletic_field_sanitary` | Field sanitary unit | field restroom bldg | T | DF-3 (HS athletic field); pedestal DF-9/9A if remote; >100 ft from sewer → drywell |

## Building services & site

| Code | Display name | Aliases | Water | Key rule hooks |
|---|---|---|---|---|
| `custodial_closet` | Custodial closet | janitor closet, hopper room | HC | SS-1/SS-2 hopper sink (cast iron only) + floor drain near it; TMV location host; WH-2 point-of-use ("hopper rooms, J buildings") |
| `custodial_receiving_storage` | Central custodial receiving/storage | receiving | HC | **Emergency shower/eyewash** (central supplies storage; receiving area at MS/HS); SS-1 |
| `boiler_room` | Boiler room | — | — | Floor sinks; sill cocks; gas valves (SGV-4/5); floor drains |
| `mechanical_room` | Mechanical equipment room | mech room | — | Floor drains + floor sinks; sill cocks; WH-3 candidate; FS-3 nearby roof receptors |
| `electrical_room` | Electrical room | — | — | Floor drain only when below grade |
| `pool_equipment_room` | Pool equipment/chlorination room | chem storage (pool) | TP | **EEW-4** floor-mounted combo; emergency fixtures per Title 8 §5162 |
| `parking_garage_subterranean` | Subterranean parking | basement garage | — | Emergency drain per 4,000 sf; oil+solids interceptors at sumps (if hose bibbs); overhead-sewer terminal cleanouts upstairs, NOT in garage; trench drain at driveway entrance |
| `laundry_room` | Laundry room | — | HC | WMOB-1 outlet box w/ hammer arresters; floor drain; SGV-7 if gas dryer |
| `trash_area_uncovered` | Uncovered trash area | trash enclosure | — | FD-10 diversion-valve drain (storm↔sewer); RP backflow on its hose bibb |
| `lath_house` | Lath house | greenhouse | C | HB-3 |
| `corridor_walkway` | Corridor / exterior walkway | hall | — | Fountains/bottle fillers in CBC alcoves; upper-floor exterior walkways: recessed hose bibbs + drains, hose-down design |
| `play_yard` | Play yard / exterior play area | playground, courts, play area | — | Fountain + bottle filler required at exterior play areas (SDG 2.1-K.2.a.4); exterior units vandal-resistant w/ recessed hose bibb beneath; sun-exposed stainless gets solar-reflective powder coat |

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-06-11 | 0.1 | Initial ~55-code seed from SDG 3.4 / 2.1-J,K and Guide Spec 22 1000 commentary. Codes are append-only from here. |
| 2026-06-11 | 0.2 | Appended `kitchen_serving` and `play_yard` (needed by the Vista del Sol synthetic project). |
