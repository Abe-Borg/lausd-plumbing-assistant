// Thin typed loader over the KB content in ../data. Content is data, never code.
// The integrity test suite (test/integrity.test.ts) is what makes the casts here
// trustworthy: citations present, references resolvable, taxonomy in sync with
// the contract doc, draft records pointing at OPEN-QUESTIONS.md entries.

import taxonomyJson from '../data/taxonomy.json';
import assembliesJson from '../data/assemblies.json';
import obligationsJson from '../data/obligations.json';
import heightTablesJson from '../data/height-tables.json';
import countRulesJson from '../data/count-rules.json';
import projectRulesJson from '../data/project-rules.json';
import layoutRulesJson from '../data/layout-rules.json';
import profilesJson from '../data/profiles.json';

import type {
  Assembly,
  CountBasisRule,
  FountainPlacementRule,
  HeightTable,
  Kb,
  KbRecordBase,
  Obligation,
  ProjectRule,
  RatioTable,
  RestroomFloorDrainRule,
  RoomTypeProfile,
  SexSplitRule,
  TaxonomyEntry,
  WaterClass,
} from './types.ts';

export * from './types.ts';

interface CountRulesFile {
  basis: CountBasisRule;
  sex_split: SexSplitRule;
  ratio_tables: RatioTable[];
}

interface LayoutRulesFile {
  restroom_floor_drains: RestroomFloorDrainRule;
  fountains: FountainPlacementRule;
}

const countRules = countRulesJson as unknown as CountRulesFile;
const layoutRules = layoutRulesJson as unknown as LayoutRulesFile;

export const kb: Kb = {
  taxonomy: taxonomyJson as unknown as TaxonomyEntry[],
  assemblies: assembliesJson as unknown as Assembly[],
  obligations: obligationsJson as unknown as Obligation[],
  heightTable: heightTablesJson as unknown as HeightTable,
  countBasis: countRules.basis,
  sexSplit: countRules.sex_split,
  ratioTables: countRules.ratio_tables,
  projectRules: projectRulesJson as unknown as ProjectRule[],
  restroomFloorDrainRule: layoutRules.restroom_floor_drains,
  fountainRule: layoutRules.fountains,
  profiles: profilesJson as unknown as RoomTypeProfile[],
};

export function assemblyById(k: Kb, id: string): Assembly | undefined {
  return k.assemblies.find((a) => a.id === id);
}

export function obligationById(k: Kb, id: string): Obligation | undefined {
  return k.obligations.find((o) => o.id === id);
}

export function profileByCode(k: Kb, roomTypeCode: string): RoomTypeProfile | undefined {
  return k.profiles.find((p) => p.room_type_code === roomTypeCode);
}

export function taxonomyByCode(k: Kb, code: string): TaxonomyEntry | undefined {
  return k.taxonomy.find((t) => t.code === code);
}

/** Map the taxonomy's raw water column to the profile water class enum. */
export function waterClassFromRaw(raw: string): WaterClass {
  switch (raw) {
    case 'HC':
    case 'T':
    case 'TP':
    case 'C':
    case 'M':
      return raw;
    case '—':
      return 'none';
    default:
      // Mixed entries like 'HC/T' (staff showers) — mixed by fixture.
      return 'M';
  }
}

/** Every KB record (including nested fixture requirements), for audits and UI. */
export function allRecords(k: Kb): KbRecordBase[] {
  return [
    ...k.assemblies,
    ...k.obligations,
    k.heightTable,
    k.countBasis,
    k.sexSplit,
    ...k.ratioTables,
    ...k.projectRules,
    k.restroomFloorDrainRule,
    k.fountainRule,
    ...k.profiles,
    ...k.profiles.flatMap((p) => p.fixture_requirements),
  ];
}

/** All records still awaiting human verification (drives the DRAFT reporting). */
export function draftRecords(k: Kb): KbRecordBase[] {
  return allRecords(k).filter((r) => r.verification_status === 'draft');
}
