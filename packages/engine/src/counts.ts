// Stage 7 — fixture-count math (CountRules). Occupancy basis is verified
// (SDG 2.1-J: students = planned_capacity, staff = 2 × classroom_count);
// the ratio values are DRAFT placeholders until OQ-1 clears, and everything
// derived from them carries `draft: true` so the UI badges it.

import type { Kb, TabFixtureClass } from '@lausd-pa/kb';
import type { Dossier } from './contracts/types.ts';

export interface Occupancy {
  students: number | null;
  staff: number | null;
  male_students: number | null;
  female_students: number | null;
  male_staff: number | null;
  female_staff: number | null;
  sex_split_draft: boolean;
}

export function computeOccupancy(dossier: Dossier, kb: Kb): Occupancy {
  const students = dossier.project.planned_capacity ?? null;
  const classrooms = dossier.project.classroom_count ?? null;
  const staff = classrooms !== null ? classrooms * 2 : null;
  const split = (n: number | null): { male: number | null; female: number | null } => {
    if (n === null) return { male: null, female: null };
    const male = Math.ceil(n * kb.sexSplit.male);
    return { male, female: n - male };
  };
  const s = split(students);
  const st = split(staff);
  return {
    students,
    staff,
    male_students: s.male,
    female_students: s.female,
    male_staff: st.male,
    female_staff: st.female,
    sex_split_draft: kb.sexSplit.verification_status === 'draft',
  };
}

export interface RequiredCount {
  count: number;
  ratio_text: string;
  draft: boolean;
}

export function requiredCount(
  kb: Kb,
  occupancy: Occupancy,
  group: 'students_elementary' | 'staff_adult',
  fixtureClass: TabFixtureClass,
  sex?: 'male' | 'female',
): RequiredCount | null {
  const table = kb.ratioTables.find((t) => t.occupancy === group);
  if (!table) return null;
  const entry = table.ratios.find((r) => r.fixture_class === fixtureClass && r.sex === sex);
  if (!entry) return null;

  let population: number | null;
  if (group === 'students_elementary') {
    population =
      sex === 'male'
        ? occupancy.male_students
        : sex === 'female'
          ? occupancy.female_students
          : occupancy.students;
  } else {
    population =
      sex === 'male'
        ? occupancy.male_staff
        : sex === 'female'
          ? occupancy.female_staff
          : occupancy.staff;
  }
  if (population === null) return null;

  // Rounding rule: ceil (counts.occupancy_basis).
  const count = Math.ceil(population / entry.per);
  return {
    count,
    ratio_text: `1:${entry.per} → ${count}`,
    draft: table.verification_status === 'draft',
  };
}

export interface RatioSuggestion {
  total: number;
  basis: string;
  draft: boolean;
}

/**
 * Per-restroom suggestion: campus required ÷ number of same-sex gang student
 * restrooms, rounded up. A heuristic, not a standard (risk R2) — always
 * presented as editable, never as a requirement.
 */
export function ratioAllocationSuggestion(
  kb: Kb,
  occupancy: Occupancy,
  fixtureClass: TabFixtureClass,
  sex: 'male' | 'female',
  restroomCount: number,
): RatioSuggestion | null {
  const required = requiredCount(
    kb,
    occupancy,
    'students_elementary',
    fixtureClass,
    fixtureClass === 'drinking_fountain' ? undefined : sex,
  );
  if (required === null || restroomCount === 0) return null;
  const total = Math.ceil(required.count / restroomCount);
  return {
    total,
    basis: `Suggested ${total} per room: campus required ${required.count} (${required.ratio_text}, DRAFT CPC values) ÷ ${restroomCount} ${sex === 'male' ? 'boys' : 'girls'} restrooms, rounded up — edit freely.`,
    draft: true, // rests on draft CPC ratios and the R2 allocation heuristic
  };
}
