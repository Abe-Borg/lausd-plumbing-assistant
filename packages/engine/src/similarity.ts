// Static string similarity for classification ranking (plan §6.3).
// Sørensen–Dice over character bigrams. Deterministic; explicitly NOT an LLM.

function bigrams(text: string): Map<string, number> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const grams = new Map<string, number>();
  const padded = ` ${normalized} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

export function diceSimilarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const n of ga.values()) totalA += n;
  for (const n of gb.values()) totalB += n;
  if (totalA === 0 || totalB === 0) return 0;
  for (const [g, n] of ga) {
    const m = gb.get(g);
    if (m !== undefined) overlap += Math.min(n, m);
  }
  return (2 * overlap) / (totalA + totalB);
}

export interface RankedCandidate {
  code: string;
  score: number;
}

/** Rank taxonomy candidates against a drawn room name. Stable: ties break by code. */
export function rankCandidates(
  nameAsDrawn: string,
  candidates: { code: string; display_name: string; aliases: string[] }[],
): RankedCandidate[] {
  const ranked = candidates.map((c) => {
    const texts = [c.display_name, c.code.replace(/_/g, ' '), ...c.aliases];
    let score = 0;
    for (const t of texts) score = Math.max(score, diceSimilarity(nameAsDrawn, t));
    return { code: c.code, score };
  });
  ranked.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.code < b.code ? -1 : 1));
  return ranked;
}
