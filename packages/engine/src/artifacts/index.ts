// Stage 8 (plan §6): assemble the three artifact data structures strictly from
// resolved DecisionPoints. Pure function of (kb, resolve result).

import type { Kb } from '@lausd-pa/kb';
import type { ResolveResult } from '../decisions.ts';
import { buildFixtureSchedule, fixtureScheduleCsv, type FixtureSchedule } from './schedule.ts';
import { buildTabulationView, tabulationCsv, type TabulationView } from './tabulation.ts';
import { buildTempMatrix, tempMatrixCsv, type TempMatrix } from './tempMatrix.ts';

export interface Artifacts {
  schedule: FixtureSchedule;
  tabulation: TabulationView | null;
  temp_matrix: TempMatrix;
}

export function buildArtifacts(kb: Kb, result: ResolveResult): Artifacts {
  return {
    schedule: buildFixtureSchedule(kb, result),
    tabulation: buildTabulationView(result),
    temp_matrix: buildTempMatrix(kb, result),
  };
}

export function artifactCsvs(artifacts: Artifacts): Record<string, string> {
  return {
    'fixture-schedule.csv': fixtureScheduleCsv(artifacts.schedule),
    ...(artifacts.tabulation
      ? { 'fixture-to-occupant-tabulation.csv': tabulationCsv(artifacts.tabulation) }
      : {}),
    'water-temperature-matrix.csv': tempMatrixCsv(artifacts.temp_matrix),
  };
}

export {
  buildFixtureSchedule,
  fixtureScheduleCsv,
  collapseLocations,
  type FixtureSchedule,
  type ScheduleRow,
  type ScheduleGap,
  type FooterNote,
} from './schedule.ts';
export {
  buildTabulationView,
  tabulationCsv,
  rowLabel,
  statusLabel,
  type TabulationView,
} from './tabulation.ts';
export {
  buildTempMatrix,
  tempMatrixCsv,
  SERVICE_LABEL,
  type TempMatrix,
  type TempMatrixRow,
  type ServiceClass,
} from './tempMatrix.ts';
export { toCsv, parseCsv, csvEscape } from './csv.ts';
