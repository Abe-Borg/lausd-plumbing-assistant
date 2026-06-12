// Derive concrete assembly lines (designation + count) from a resolved
// requirement decision: resolution counts × selector × age band × ADA flag.
// Quantities are stored abstractly (standard/accessible) so an age-band answer
// re-derives the variant without invalidating the human's count (plan §9).

import type { FixtureRequirement, Kb } from '@lausd-pa/kb';
import { assemblyById } from '@lausd-pa/kb';
import type { DecisionPoint, RoomEffectiveFacts } from './decisions.ts';

export interface FixtureLine {
  assembly: string;
  n: number;
  /** True when the named assembly's KB record is draft → badge. */
  draft: boolean;
}

export interface DerivedFixtures {
  lines: FixtureLine[];
  /** Set when lines cannot be derived yet (e.g. awaiting an age band). */
  pending?: string;
}

export function deriveFixtureLines(
  kb: Kb,
  req: FixtureRequirement,
  dp: DecisionPoint,
  effective: RoomEffectiveFacts,
): DerivedFixtures {
  if (!dp.resolution || dp.resolution.kind !== 'quantities') {
    return { lines: [], pending: 'unresolved' };
  }
  const { counts, assembly_choice } = dp.resolution;
  const total = counts.standard + counts.accessible;
  if (total === 0) return { lines: [] };

  const draftOf = (id: string): boolean =>
    assemblyById(kb, id)?.verification_status === 'draft';
  const line = (assembly: string, n: number): FixtureLine => ({
    assembly,
    n,
    draft: draftOf(assembly),
  });

  const sel = req.selector;
  if (sel.kind === 'choice') {
    if (!assembly_choice) return { lines: [], pending: 'awaiting assembly choice' };
    return { lines: [line(assembly_choice, total)] };
  }

  let standardAssembly: string | undefined;
  let accessibleAssembly: string | undefined;
  if (sel.kind === 'fixed') {
    standardAssembly = sel.assembly;
    accessibleAssembly = sel.accessible;
  } else {
    const band = effective.age_band;
    if (band === null) {
      return { lines: [], pending: 'awaiting age band' };
    }
    standardAssembly = sel.standard[band];
    accessibleAssembly = sel.accessible?.[band];
    if (standardAssembly === undefined) {
      return { lines: [], pending: `no assembly mapped for age band ${band}` };
    }
  }

  const lines: FixtureLine[] = [];
  // An ADA-designated room's single fixture is the accessible variant.
  const accessibleCount =
    counts.accessible > 0 ? counts.accessible : effective.ada_designated ? counts.standard : 0;
  const standardCount = total - accessibleCount;

  if (standardCount > 0) lines.push(line(standardAssembly, standardCount));
  if (accessibleCount > 0) {
    // Fall back to the standard assembly when no accessible variant is mapped
    // (e.g. preK_K WC) — surfaced via the requirement's OQ notes, never dropped.
    lines.push(line(accessibleAssembly ?? standardAssembly, accessibleCount));
  }
  // Merge lines that landed on the same assembly.
  const merged = new Map<string, FixtureLine>();
  for (const l of lines) {
    const existing = merged.get(l.assembly);
    if (existing) existing.n += l.n;
    else merged.set(l.assembly, { ...l });
  }
  return { lines: [...merged.values()] };
}
